// src/lib/server/quality/ai-detection.ts
// Heuristic AI detector (perplexity, burstiness) + optional GPTZero API

export interface AiDetectionResult {
  aiScore: number;
  perplexity: number;
  burstiness: number;
  passed: boolean;
  method: 'heuristic' | 'gptzero' | 'none';
  error?: string;
}

function ngramFrequencies(text: string, n: number): Map<string, number> {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const freqs = new Map<string, number>();
  for (let i = 0; i <= words.length - n; i++) {
    const ngram = words.slice(i, i + n).join(' ');
    freqs.set(ngram, (freqs.get(ngram) ?? 0) + 1);
  }
  return freqs;
}

function perWordProbabilities(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const total = words.length;
  const unigrams = ngramFrequencies(text, 1);
  const bigrams = ngramFrequencies(text, 2);
  const trigrams = ngramFrequencies(text, 3);

  const probs: number[] = [];
  for (let i = 0; i < total; i++) {
    const w = words[i];
    if (!w) continue;
    const unigramProb = (unigrams.get(w) ?? 0) / total;

    let bigramProb = 0;
    const bigram = i > 0 ? `${words[i - 1] ?? ''} ${w}` : '';
    const bigramCount = bigram ? (bigrams.get(bigram) ?? 0) : 0;
    if (i > 0 && bigramCount > 0) {
      const prev = words[i - 1] ?? '';
      bigramProb = bigramCount / (unigrams.get(prev) ?? 1);
    }

    let trigramProb = 0;
    const trigram = i > 1 ? `${words[i - 2] ?? ''} ${words[i - 1] ?? ''} ${w}` : '';
    const trigramCount = trigram ? (trigrams.get(trigram) ?? 0) : 0;
    if (i > 1 && trigramCount > 0) {
      const prevBigram = `${words[i - 2] ?? ''} ${words[i - 1] ?? ''}`;
      trigramProb = trigramCount / (bigrams.get(prevBigram) ?? 1);
    }

    const prob = 0.3 * unigramProb + 0.3 * bigramProb + 0.4 * trigramProb;
    probs.push(prob > 0 ? prob : 1e-10);
  }
  return probs;
}

export function computePerplexity(text: string): number {
  const probs = perWordProbabilities(text);
  if (probs.length === 0) return 0;
  const logSum = probs.reduce((s, p) => s + Math.log(p), 0);
  return Math.exp(-logSum / probs.length);
}

export function computeBurstiness(text: string): number {
  const freqs = ngramFrequencies(text, 1);
  const counts = Array.from(freqs.values());
  if (counts.length < 2) return 0;
  const mean = counts.reduce((s, c) => s + c, 0) / counts.length;
  const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length;
  const stdDev = Math.sqrt(variance);
  return stdDev / (mean || 1);
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

export function heuristicDetect(text: string): AiDetectionResult {
  const plainText = stripMarkdown(text);
  if (!plainText || plainText.length < 100) {
    return {
      aiScore: 0,
      perplexity: 0,
      burstiness: 0,
      passed: true,
      method: 'heuristic',
    };
  }

  const perplexity = computePerplexity(plainText);
  const burstiness = computeBurstiness(plainText);

  // AI text tends to have LOW perplexity (predictable) and LOW burstiness (uniform)
  // Human text: higher perplexity, higher burstiness
  // Score: 0 = definitely human, 1 = definitely AI
  const perplexityScore = Math.max(0, Math.min(1, 1 - perplexity / 10));
  const burstinessScore = Math.max(0, Math.min(1, 1 - burstiness / 3));
  const aiScore = 0.55 * perplexityScore + 0.45 * burstinessScore;

  return {
    aiScore: Number(aiScore.toFixed(3)),
    perplexity: Number(perplexity.toFixed(3)),
    burstiness: Number(burstiness.toFixed(3)),
    passed: true, // Warning only, never blocks
    method: 'heuristic',
  };
}

export async function checkAiDetection(
  text: string,
  options?: {
    gptzeroKey?: string;
  },
): Promise<AiDetectionResult> {
  if (options?.gptzeroKey) {
    try {
      const result = await gptzeroCheck(text, options.gptzeroKey);
      if (result) return result;
    } catch {
      // Fall through to heuristic
    }
  }

  return heuristicDetect(text);
}

async function gptzeroCheck(text: string, apiKey: string): Promise<AiDetectionResult | null> {
  const res = await fetch('https://api.gptzero.me/v2/predict/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      document: text,
      version: '2024-04-01',
    }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    doc?: {
      completely_generated_prob?: number;
      overall_burstiness?: number;
      overall_perplexity?: number;
    };
  };
  const doc = data.doc;
  if (!doc) return null;

  const aiScore = doc.completely_generated_prob ?? 0.5;
  return {
    aiScore: Number(aiScore.toFixed(3)),
    perplexity: doc.overall_perplexity ?? 0,
    burstiness: doc.overall_burstiness ?? 0,
    passed: true,
    method: 'gptzero',
  };
}
