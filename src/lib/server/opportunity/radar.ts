// src/lib/server/opportunity/radar.ts
// Content Opportunity Radar — trend + holiday scan, scoring, outline preview

import { callRouter } from '../ai/router';
import type { Env } from '../db/index';

const GEO_MAP: Record<string, string> = {
  ID: 'ID',
  US: 'US',
  Global: '',
};

const INTENT_KEYWORDS: Record<string, RegExp[]> = {
  informational: [
    /how\s+to/i,
    /what\s+is/i,
    /guide/i,
    /tips/i,
    /tutorial/i,
    /ways\s+to/i,
    /examples?\s+of/i,
    /explain/i,
    /overview/i,
  ],
  commercial: [
    /best/i,
    /review/i,
    /vs\b/i,
    /comparison/i,
    /top\s+\d+/i,
    /price/i,
    /cost/i,
    /vs\s+/i,
    /cheap/i,
    /affordable/i,
  ],
  transactional: [
    /buy/i,
    /discount/i,
    /coupon/i,
    /deal/i,
    /for\s+sale/i,
    /order/i,
    /shop/i,
    /near\s+me/i,
    /delivery/i,
  ],
};

const INTENT_KEYS = ['informational', 'commercial', 'transactional'] as const;
type IntentKey = (typeof INTENT_KEYS)[number];

const ANGLE_TEMPLATES: Record<IntentKey, (kw: string) => string> = {
  informational: (kw) =>
    `Complete guide to ${kw} — from basics to expert tips every beginner should know`,
  commercial: (kw) => `${kw} in 2026: top picks compared — which one fits your needs?`,
  transactional: (kw) => `Best ${kw} deals: where to buy, what to pay, and how to save`,
};

export interface TrendItem {
  keyword: string;
  traffic: number;
  pubDate: string;
  snippet: string;
}

export interface HolidayItem {
  name: string;
  date: string;
  countryCode: string;
}

export interface RadarOpportunity {
  keyword: string;
  trendScore: number;
  searchIntent: 'informational' | 'commercial' | 'transactional';
  suggestedAngle: string;
  outlinePreview: string;
  source: 'trends' | 'holiday' | 'both';
  traffic: number;
  holidayName?: string;
  holidayDate?: string;
}

export interface RadarResult {
  opportunities: RadarOpportunity[];
  generatedAt: string;
  niche: string;
  geo: string;
}

// --- Fetch Google Trends RSS ---

export async function fetchTrends(geo: string): Promise<TrendItem[]> {
  const geoCode = GEO_MAP[geo] ?? '';
  const url = geoCode
    ? `https://trends.google.com/trending/rss?geo=${geoCode}`
    : 'https://trends.google.com/trending/rss';

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContentGenerator/1.0)' },
  });
  if (!res.ok) {
    console.warn(`Trends RSS fetch failed: ${res.status}`);
    return [];
  }

  const xml = await res.text();
  return parseTrendsRss(xml);
}

function parseTrendsRss(xml: string): TrendItem[] {
  const items: TrendItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;

  for (;;) {
    const match = itemRegex.exec(xml);
    if (!match) break;
    const block = match[1] as string;
    const title =
      block.match(/<title>(?:<!\[CDATA\[)?(.+?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? '';
    if (!title) continue;

    const trafficRaw =
      block.match(
        /<ht:approx_traffic>(?:<!\[CDATA\[)?(.+?)(?:\]\]>)?<\/ht:approx_traffic>/i,
      )?.[1] ?? '';
    const traffic = parseTraffic(trafficRaw);

    const pubDate = block.match(/<pubDate>(.+?)<\/pubDate>/i)?.[1] ?? '';
    const snippet =
      block.match(/<description>(?:<!\[CDATA\[)?(.+?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() ??
      '';

    items.push({ keyword: title, traffic, pubDate, snippet });
  }

  return items;
}

function parseTraffic(raw: string): number {
  const cleaned = raw.replace(/[+,]/g, '').trim();
  const num = Number(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

// --- Fetch Holiday Calendar ---

export async function fetchHolidays(geo: string): Promise<HolidayItem[]> {
  const geoCode = GEO_MAP[geo] ?? '';
  if (!geoCode) return [];

  const year = new Date().getFullYear();
  // Nager.Date public API — no key needed
  const url = `https://date.nager.at/api/v3/publicholidays/${year}/${geoCode}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.warn(`Holiday API fetch failed: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as Array<{ name: string; date: string; countryCode: string }>;
    // Filter upcoming holidays (next 60 days)
    const now = new Date();
    const cutoff = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    return data.filter((h) => {
      const d = new Date(h.date);
      return d >= now && d <= cutoff;
    });
  } catch {
    return [];
  }
}

// --- Scoring ---

function classifyIntent(keyword: string): IntentKey {
  for (const [intent, patterns] of Object.entries(INTENT_KEYWORDS)) {
    for (const p of patterns) {
      if (p.test(keyword)) return intent as IntentKey;
    }
  }
  return 'informational';
}

function angleFor(intent: IntentKey, keyword: string): string {
  return ANGLE_TEMPLATES[intent]?.(keyword) ?? keyword;
}

function keywordRelevance(keyword: string, niche: string): number {
  if (!niche) return 0.5;
  const nicheWords = niche.toLowerCase().split(/\s+/);
  const kw = keyword.toLowerCase();
  const matches = nicheWords.filter((w) => kw.includes(w) || w.includes(kw));
  return Math.min(1, matches.length / nicheWords.length);
}

function scoreRecency(pubDate: string): number {
  if (!pubDate) return 0.5;
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return 0.5;
  const hoursAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 24) return 1;
  if (hoursAgo < 72) return 0.7;
  if (hoursAgo < 168) return 0.4;
  return 0.2;
}

function scoreTraffic(traffic: number, maxTraffic: number): number {
  if (maxTraffic === 0) return 0.5;
  return Math.min(1, traffic / maxTraffic);
}

function scoreOpportunity(item: TrendItem, niche: string, maxTraffic: number): number {
  const t = scoreTraffic(item.traffic, maxTraffic) * 0.4;
  const r = scoreRecency(item.pubDate) * 0.3;
  const rel = keywordRelevance(item.keyword, niche) * 0.2;
  return t + r + rel + 0.1; // base bias
}

// --- Outline Preview (batch AI call) ---

export async function generateOutlinePreviews(
  env: Env,
  opportunities: RadarOpportunity[],
  niche: string,
): Promise<RadarOpportunity[]> {
  const batch = opportunities.slice(0, 10);
  if (batch.length === 0) return opportunities;

  const prompt = `Generate a brief outline preview (title + 3-4 section headings) for each keyword below.
Return JSON: an array of {keyword: string, outline: string} objects.
Keep each outline under 200 chars. Niche: ${niche}.

Keywords: ${batch.map((o) => `${o.keyword} (${o.searchIntent})`).join(', ')}`;

  try {
    const response = await callRouter(env, {
      model: 'anthropic/claude-3.5-haiku',
      messages: [
        {
          role: 'system',
          content:
            'You are an SEO content strategist. Output valid JSON only — no markdown, no explanation.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response.content;
    const outlines = JSON.parse(jsonStr) as Array<{ keyword: string; outline: string }>;

    const map = new Map(outlines.map((o) => [o.keyword.toLowerCase(), o.outline]));
    for (const opp of batch) {
      opp.outlinePreview = map.get(opp.keyword.toLowerCase()) ?? opp.suggestedAngle;
    }
  } catch {
    // Fallback: use suggested angle as outline preview
    for (const opp of batch) {
      opp.outlinePreview = opp.suggestedAngle;
    }
  }

  return opportunities;
}

// --- Main Radar Scan ---

export async function scanOpportunities(
  env: Env,
  niche: string,
  geo: string,
): Promise<RadarResult> {
  const [trends, holidays] = await Promise.all([fetchTrends(geo), fetchHolidays(geo)]);

  const maxTraffic = trends.reduce((max, t) => Math.max(max, t.traffic), 0);
  const now = new Date().toISOString();

  const opportunities: RadarOpportunity[] = [];

  // Score trends
  for (const t of trends) {
    const score = scoreOpportunity(t, niche, maxTraffic);
    const intent = classifyIntent(t.keyword);
    opportunities.push({
      keyword: t.keyword,
      trendScore: Number(score.toFixed(3)),
      searchIntent: intent,
      suggestedAngle: angleFor(intent, t.keyword),
      outlinePreview: '',
      source: 'trends',
      traffic: t.traffic,
    });
  }

  // Add holidays as opportunities
  for (const h of holidays) {
    const kw = `${h.name} 2026`;
    const intent = classifyIntent(kw);
    const score = 0.7 + keywordRelevance(kw, niche) * 0.3; // holidays get base 0.7
    opportunities.push({
      keyword: kw,
      trendScore: Number(score.toFixed(3)),
      searchIntent: intent,
      suggestedAngle: angleFor(intent, `${h.name} celebration`),
      outlinePreview: '',
      source: 'holiday',
      traffic: 0,
      holidayName: h.name,
      holidayDate: h.date,
    });
  }

  // Sort by score descending, deduplicate by keyword
  const seen = new Set<string>();
  const deduped = opportunities
    .sort((a, b) => b.trendScore - a.trendScore)
    .filter((o) => {
      const key = o.keyword.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);

  // Generate outline previews for top 10
  const withPreviews = await generateOutlinePreviews(env, deduped, niche);

  return {
    opportunities: withPreviews,
    generatedAt: now,
    niche,
    geo,
  };
}
