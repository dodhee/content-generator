// src/lib/server/quality/plagiarism.ts
// Local fingerprint (shingle overlap) + optional Copyleaks API

export interface PlagiarismMatch {
  articleId: string;
  similarity: number;
  snippet: string;
}

export interface PlagiarismResult {
  score: number;
  matches: PlagiarismMatch[];
  passed: boolean;
  method: 'local' | 'copyleaks' | 'none';
  error?: string;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function computeFingerprint(text: string, shingleSize = 3): number[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < shingleSize) return [];

  const shingles = new Set<string>();
  for (let i = 0; i <= words.length - shingleSize; i++) {
    shingles.add(words.slice(i, i + shingleSize).join(' '));
  }

  return Array.from(shingles).map(hashCode);
}

export function jaccardSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const h of setA) {
    if (setB.has(h)) intersection++;
  }
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection / union.size;
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
    .replace(/[#*_~>`>-]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function checkPlagiarism(
  text: string,
  db: D1Database,
  options?: {
    threshold?: number;
    articleId?: string;
    siteId?: string;
    workspaceId?: string;
    copyleaksKey?: string;
  },
): Promise<PlagiarismResult> {
  const threshold = options?.threshold ?? 0.3;
  const plainText = stripMarkdown(text);

  // Try Copyleaks if key provided
  if (options?.copyleaksKey) {
    try {
      const result = await copyleaksCheck(plainText, options.copyleaksKey);
      if (result) return result;
    } catch {
      // Fall through to local
    }
  }

  // Local fingerprint comparison
  if (!plainText || plainText.length < 50) {
    return { score: 0, matches: [], passed: true, method: 'local' };
  }

  const fingerprint = computeFingerprint(plainText);

  const articles = await db
    .prepare(
      `SELECT id, content_md FROM articles
       WHERE content_md IS NOT NULL AND content_md != '' AND id != ?
       ORDER BY created_at DESC LIMIT 200`,
    )
    .bind(options?.articleId ?? '')
    .all<{ id: string; content_md: string }>();

  const matches: PlagiarismMatch[] = [];
  for (const article of articles.results ?? []) {
    if (!article.content_md) continue;
    const otherFp = computeFingerprint(stripMarkdown(article.content_md));
    const sim = jaccardSimilarity(fingerprint, otherFp);
    if (sim >= threshold) {
      matches.push({
        articleId: article.id,
        similarity: sim,
        snippet: article.content_md.slice(0, 200),
      });
    }
  }

  const score = matches.length > 0 ? Math.max(...matches.map((m) => m.similarity)) : 0;

  return {
    score,
    matches,
    passed: score < threshold,
    method: 'local',
  };
}

async function copyleaksCheck(text: string, apiKey: string): Promise<PlagiarismResult | null> {
  // Copyleaks free tier: auth + scan
  const authRes = await fetch('https://api.copyleaks.com/v3/account/login/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: apiKey }),
  });
  if (!authRes.ok) return null;

  const { access_token: token } = (await authRes.json()) as { access_token: string };
  if (!token) return null;

  const scanId = `cg_${crypto.randomUUID()}`;
  const scanRes = await fetch(`https://api.copyleaks.com/v3/scans/submit/file/${scanId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      base64: btoa(text),
      filename: 'content.txt',
      properties: {
        webhooks: { status: '' },
        sandbox: true,
        actions: [],
      },
    }),
  });
  if (!scanRes.ok) return null;

  // Poll for result (simplified — production would use webhook)
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const resultRes = await fetch(`https://api.copyleaks.com/v3/scans/${scanId}/result`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resultRes.ok) {
      const data = (await resultRes.json()) as {
        results?: Array<{ matchScore: number }>;
      };
      const maxScore = (data.results ?? []).reduce((m, r) => Math.max(m, r.matchScore), 0);
      return {
        score: maxScore / 100,
        matches: [],
        passed: maxScore < 30,
        method: 'copyleaks',
      };
    }
  }

  return null;
}
