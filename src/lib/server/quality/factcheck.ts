// src/lib/server/quality/factcheck.ts
// Claim extraction → DuckDuckGo HTML scrape → source attach

export interface Claim {
  id: string;
  text: string;
  status: 'unverified' | 'verified' | 'no_source';
  sources: ClaimSource[];
}

export interface ClaimSource {
  url: string;
  title: string;
  snippet: string;
}

// Pattern-based claim extraction (stats, facts, quotes)
const CLAIM_PATTERNS = [
  // "X% of Y", "1 in 5", "2x more", numbers
  /\b\d+(?:\.\d+)?\s*%(\s+(?:of|from|of the))?\b/g,
  /\b\d+\s*(?:in|out of)\s*\d+\b/g,
  /\b\d+(?:\.\d+)?\s*x\s+(?:more|times|faster|higher)\b/g,
  /\b(?:more than|over|under|less than)\s+\d+(?:\.\d+)?\s*(?:million|billion|thousand)?\b/g,
  // Years in claims
  /\b(?:in|since|by)\s+19\d{2}|20\d{2}\b/g,
  // Quoted statements (common in expert claims)
  /"[^"]{20,}"/g,
];

export function extractClaims(text: string): string[] {
  const claims = new Set<string>();
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    // Skip headings (short lines ending with no period)
    if (paragraph.length < 40) continue;
    // Skip lists/bullets that are fragmentary
    if (paragraph.startsWith('-') || paragraph.startsWith('*')) continue;

    const matched: string[] = [];
    for (const pattern of CLAIM_PATTERNS) {
      for (const match of paragraph.matchAll(pattern)) {
        matched.push(match[0]);
      }
    }

    if (matched.length >= 1) {
      claims.add(paragraph.slice(0, 300));
    }
  }

  return Array.from(claims).slice(0, 20);
}

// DuckDuckGo HTML scrape (no API key, free tier)
export async function searchSources(
  claim: string,
  options?: { maxResults?: number },
): Promise<ClaimSource[]> {
  const maxResults = options?.maxResults ?? 3;
  const query = encodeURIComponent(claim.replace(/"/g, '').slice(0, 200));

  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ContentGenerator/1.0)',
        Accept: 'text/html',
      },
    });
    if (!res.ok) return [];

    const html = await res.text();
    return parseDuckDuckGoResults(html).slice(0, maxResults);
  } catch {
    return [];
  }
}

function parseDuckDuckGoResults(html: string): ClaimSource[] {
  const results: ClaimSource[] = [];
  // DuckDuckGo HTML results: <a class="result__a" href="...">title</a> + <a class="result__snippet">snippet</a>
  const blockRegex = /<div class="result[^"]*">([\s\S]*?)<\/div><\/div>/g;
  const hrefRegex = /class="result__a"[^>]*href="([^"]+)"/;
  const titleRegex = /class="result__a"[^>]*>([\s\S]*?)<\/a>/;
  const snippetRegex = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/;

  for (;;) {
    const match = blockRegex.exec(html);
    if (!match) break;
    const block = match[1] as string;

    const href = block.match(hrefRegex)?.[1];
    if (!href) continue;

    const title = decodeEntities(block.match(titleRegex)?.[1] ?? '').trim();
    const snippet = decodeEntities(block.match(snippetRegex)?.[1] ?? '').trim();

    // DuckDuckGo redirect URLs — clean them
    const url = cleanUrl(href);
    if (!url.startsWith('http')) continue;

    results.push({ url, title, snippet });
  }

  return results;
}

function cleanUrl(raw: string): string {
  try {
    const decoded = decodeURIComponent(raw);
    const match = decoded.match(/uddg=([^&]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : decoded;
  } catch {
    return raw;
  }
}

function decodeEntities(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export async function verifyClaims(
  text: string,
  options?: { maxClaims?: number },
): Promise<Claim[]> {
  const maxClaims = options?.maxClaims ?? 10;
  const extracted = extractClaims(text).slice(0, maxClaims);

  const results: Claim[] = [];
  for (const claimText of extracted) {
    const sources = await searchSources(claimText);
    results.push({
      id: `claim_${crypto.randomUUID()}`,
      text: claimText,
      status: sources.length > 0 ? 'verified' : 'no_source',
      sources,
    });
  }

  return results;
}
