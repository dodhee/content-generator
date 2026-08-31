// src/lib/server/quality/brand-safety.ts
// Blocked terms list per site (config in sites table) — flag or replace

export interface BrandSafetyHit {
  term: string;
  count: number;
  action: 'flag' | 'replace';
  replacement?: string;
}

export interface BrandSafetyResult {
  hits: BrandSafetyHit[];
  flagged: boolean;
  content: string;
}

export interface BrandSafetyConfig {
  blocked_terms: Array<{ term: string; action?: 'flag' | 'replace'; replacement?: string }>;
}

export const defaultBrandSafetyConfig: BrandSafetyConfig = {
  blocked_terms: [],
};

// Read config from site config_json, default empty
export function parseBrandSafetyConfig(config: Record<string, unknown>): BrandSafetyConfig {
  const raw = config.brand_safety;
  if (!raw || typeof raw !== 'object') return defaultBrandSafetyConfig;

  const blocked = Array.isArray((raw as { blocked_terms?: unknown }).blocked_terms)
    ? ((raw as { blocked_terms: Array<unknown> }).blocked_terms ?? [])
        .filter(
          (t): t is { term: string } =>
            typeof t === 'object' &&
            t !== null &&
            typeof (t as { term?: unknown }).term === 'string',
        )
        .map((t) => {
          const item = t as { term: string; action?: string; replacement?: unknown };
          return {
            term: item.term,
            action: item.action === 'replace' ? ('replace' as const) : ('flag' as const),
            replacement: item.replacement ? String(item.replacement) : undefined,
          };
        })
    : [];

  return { blocked_terms: blocked };
}

export function checkBrandSafety(content: string, config: BrandSafetyConfig): BrandSafetyResult {
  const hits: BrandSafetyHit[] = [];
  let result = content;
  let flagged = false;

  const lower = content.toLowerCase();
  for (const item of config.blocked_terms) {
    const termLower = item.term.toLowerCase();
    if (!lower.includes(termLower)) continue;

    const count = countOccurrences(lower, termLower);
    const action = item.action ?? 'flag';
    if (action === 'replace' && item.replacement) {
      // Replace case-preserving-ish: do global replace on original content
      result = result.replace(new RegExp(escapeRegExp(item.term), 'gi'), item.replacement);
    } else {
      flagged = true;
    }
    hits.push({ term: item.term, count, action, replacement: item.replacement });
  }

  return { hits, flagged, content: result };
}

function countOccurrences(text: string, term: string): number {
  let count = 0;
  let idx = 0;
  for (;;) {
    idx = text.indexOf(term, idx);
    if (idx === -1) break;
    count++;
    idx += term.length;
  }
  return count;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
