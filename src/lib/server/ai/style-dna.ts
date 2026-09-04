// src/lib/server/ai/style-dna.ts
// Style DNA: crawl site content, extract brand voice patterns, generate few-shot examples.
// Result stored as JSON string in sites.wp_style_dna — consumed by router.ts generateOutline().

import type { Env } from '../db/index';
import { callRouter } from './router';

const MAX_POSTS = 200;
const AI_TIMEOUT_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;
const SITEMAP_FETCH_LIMIT = 30;
const FEW_SHOT_COUNT = 5;
const MIN_CONTENT_LENGTH = 100; // lower threshold: 100 chars enough for pattern analysis

export interface StyleExample {
  title: string;
  content: string;
}

export interface StylePatterns {
  avgSentenceLength: number;
  vocabDiversity: number;
  commonTransitions: string[];
  headingDepth: number;
  ctaPatterns: string[];
  paragraphLength: number;
  toneMarkers: string[];
}

export interface StyleDnaData {
  examples: StyleExample[];
  patterns: StylePatterns;
  analyzedAt: string;
  postCount: number;
}

interface PostContent {
  title: string;
  content: string;
  headings: number[];
}

interface SiteSource {
  type: string;
  wp_url: string;
  github_repo: string;
  github_branch: string;
  github_content_path: string;
  ai_model_default: string;
}

const TRANSITIONS = [
  'however',
  'therefore',
  'moreover',
  'furthermore',
  'meanwhile',
  'nevertheless',
  'nonetheless',
  'consequently',
  'additionally',
  'in addition',
  'for example',
  'for instance',
  'in fact',
  'as a result',
  'on the other hand',
  'in conclusion',
  'first',
  'second',
  'third',
  'finally',
  'next',
  'then',
  'later',
  'also',
  'although',
  'because',
  'since',
  'while',
  'thus',
  'hence',
  'accordingly',
];

const CTA_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'subscribe', re: /subscribe|sign up|join our|newsletter/gi },
  { label: 'read more', re: /read more|read on|continue reading|keep reading/gi },
  { label: 'learn more', re: /learn more|find out more|discover more/gi },
  { label: 'contact', re: /contact us|get in touch|reach out/gi },
  { label: 'download', re: /download|free (guide|ebook|checklist)/gi },
  { label: 'buy', re: /buy now|order now|shop now|get yours/gi },
  { label: 'share', re: /share this|spread the word|share on/gi },
];

// ---- fetch helpers ----

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// ---- text utils ----

function htmlToText(html: string): string {
  // Detect CF challenge page
  if (/challenge-platform|Just a moment|Enable JavaScript/i.test(html.slice(0, 2000))) {
    return '';
  }
  let t = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  t = t.replace(
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_, level: string, inner: string) =>
      `${'#'.repeat(Number(level))} ${inner.replace(/<[^>]+>/g, '').trim()}\n`,
  );
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<\/p>|<\/div>|<\/li>|<\/tr>/gi, '\n');
  t = t.replace(/<[^>]+>/g, ' ');
  t = t
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");
  return t
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function markdownToText(md: string): string {
  let t = md.replace(/^---[\s\S]*?^---\s*/m, '');
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  t = t.replace(/^(#{1,6})\s+(.+)$/gm, '$1 $2\n');
  t = t.replace(/[*_`>~]/g, '');
  return t
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractHtmlHeadings(html: string): number[] {
  return Array.from(html.matchAll(/<h([1-6])[^>]*>/gi), (m) => Number(m[1])).filter(
    (n) => n >= 1 && n <= 6,
  );
}

function extractMarkdownHeadings(md: string): number[] {
  return Array.from(md.matchAll(/^#{1,6}\s+/gm), (m) => (m[0].match(/#/g) ?? []).length).filter(
    (n) => n >= 1 && n <= 6,
  );
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function wordCount(text: string): number {
  return tokenize(text).length;
}

function splitSentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+/g) ?? []).map((s) => s.trim()).filter((s) => s.length > 1);
}

function mean(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---- crawlers (fail-open) ----

async function crawlWordPress(
  wpUrl: string,
  maxPosts: number,
): Promise<{ posts: PostContent[]; source: 'wp-rest' | 'sitemap' }> {
  const base = wpUrl.replace(/\/+$/, '');
  const posts: PostContent[] = [];
  try {
    for (let page = 1; page <= Math.ceil(maxPosts / 100); page++) {
      const url = `${base}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=title,content&orderby=date&order=desc`;
      const res = await withTimeout(fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StyleDNA/1.0)' },
      }), FETCH_TIMEOUT_MS);
      if (!res.ok) throw new Error(`WP REST HTTP ${res.status}`);
      const data = (await res.json()) as Array<{
        title?: { rendered?: string };
        content?: { rendered?: string };
      }>;
      if (!Array.isArray(data) || data.length === 0) break;
      for (const p of data) {
        const html = p.content?.rendered ?? '';
        const content = htmlToText(html);
        if (content.trim().length > MIN_CONTENT_LENGTH) {
          posts.push({
            title: p.title?.rendered || 'Untitled',
            content,
            headings: extractHtmlHeadings(html),
          });
        }
      }
      if (data.length < 100) break;
    }
  } catch (err) {
    console.warn('style-dna: WP REST crawl failed', err);
    posts.length = 0;
  }
  if (posts.length === 0) {
    const sitemapPosts = await crawlSitemap(base);
    if (sitemapPosts.length > 0) return { posts: sitemapPosts, source: 'sitemap' };
  }
  return { posts: posts.slice(0, maxPosts), source: 'wp-rest' };
}

async function fetchSitemapUrls(base: string): Promise<string[]> {
  const sitemapPaths = [
    '/sitemap.xml',
    '/sitemap-index.xml',
    '/sitemap_index.xml',
    '/sitemap/sitemap.xml',
    '/sitemap.xml.gz',
  ];
  for (const sp of sitemapPaths) {
    try {
      const res = await withTimeout(fetch(`${base}${sp}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StyleDNA/1.0)' },
      }), FETCH_TIMEOUT_MS);
      if (!res.ok) continue;
      const xml = await res.text();
      // Check if sitemap index (points to other sitemaps)
      const isIndex = /<sitemapindex/i.test(xml);
      if (isIndex) {
        const subSitemaps = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g), (m) => m[1]).filter((u): u is string => !!u);
        const allUrls: string[] = [];
        for (const sub of subSitemaps.slice(0, 5)) {
          try {
            const subRes = await withTimeout(fetch(sub!, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StyleDNA/1.0)' },
            }), FETCH_TIMEOUT_MS);
            if (!subRes.ok) continue;
            const subXml = await subRes.text();
            const urls = Array.from(subXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g), (m) => m[1]).filter((u): u is string => !!u);
            allUrls.push(...urls);
          } catch { /* skip sub-sitemap */ }
        }
        if (allUrls.length > 0) return allUrls;
      }
      const urls = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g), (m) => m[1]).filter((u): u is string => !!u);
      if (urls.length > 0) return urls;
    } catch { /* try next path */ }
  }
  return [];
}

async function fetchRssContent(base: string): Promise<PostContent[]> {
  const rssPaths = ['/rss.xml', '/feed.xml', '/rss/', '/feed/'];
  for (const rp of rssPaths) {
    try {
      const res = await withTimeout(fetch(`${base}${rp}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) StyleDNA/1.0' },
      }), FETCH_TIMEOUT_MS);
      if (!res.ok) continue;
      const xml = await res.text();
      const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));
      if (items.length === 0) continue;

      const posts: PostContent[] = [];
      for (const match of items) {
        const itemXml = match[1];
        if (!itemXml) continue;
        const title = itemXml.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? 'Untitled';
        // Try content:encoded first (full content), fallback to description
        let content = itemXml.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1] ?? '';
        if (!content || content.length < 50) {
          content = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? '';
          // Decode HTML entities in description
          content = content.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'");
        }
        const text = htmlToText(content);
        if (text.trim().length > MIN_CONTENT_LENGTH) {
          posts.push({ title, content: text, headings: [] });
        }
      }
      if (posts.length > 0) return posts;
    } catch { /* try next path */ }
  }
  return [];
} // end fetchRssContent

async function crawlSitemap(base: string): Promise<PostContent[]> {
  try {
    const urls = await fetchSitemapUrls(base);
    const postUrls = urls
      .filter((u) => {
        const path = u.replace(/\/+$/, '');
        if (path === base) return false;
        if (/(tag|category|author|page|feed|wp-content|wp-json|\.xml)/i.test(path)) return false;
        return true;
      })
      .slice(0, SITEMAP_FETCH_LIMIT);

    if (postUrls.length === 0) {
      // Fallback to RSS content extraction (no CF challenge)
      return fetchRssContent(base);
    }

    const pages = await Promise.all(
      postUrls.map(async (u) => {
        try {
          const pageRes = await withTimeout(fetch(u, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StyleDNA/1.0)' },
          }), FETCH_TIMEOUT_MS);
          const html = await pageRes.text();
          const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? 'Untitled';
          return { title, content: htmlToText(html), headings: extractHtmlHeadings(html) };
        } catch {
          return null;
        }
      }),
    );
    return pages.filter((p): p is PostContent => p !== null && p.content.trim().length > MIN_CONTENT_LENGTH);
  } catch (err) {
    console.warn('style-dna: sitemap crawl failed', err);
    return [];
  }
}

async function crawlGitHub(repo: string, branch: string, path: string): Promise<PostContent[]> {
  try {
    const headers = { Accept: 'application/vnd.github+json' };
    const res = await withTimeout(
      fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`, { headers }),
      FETCH_TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
    const files = (await res.json()) as Array<{
      name?: string;
      type?: string;
      download_url?: string | null;
    }>;
    const mdFiles = (Array.isArray(files) ? files : [])
      .filter((f) => f.type === 'file' && /\.(md|mdx)$/i.test(f.name ?? ''))
      .slice(0, MAX_POSTS);

    const posts = await Promise.all(
      mdFiles.map(async (f) => {
        try {
          if (!f.download_url) return null;
          const rawRes = await withTimeout(fetch(f.download_url), FETCH_TIMEOUT_MS);
          const raw = await rawRes.text();
          return {
            title: f.name ?? 'Untitled',
            content: markdownToText(raw),
            headings: extractMarkdownHeadings(raw),
          };
        } catch {
          return null;
        }
      }),
    );
    return posts.filter((p): p is PostContent => p !== null && p.content.trim().length > MIN_CONTENT_LENGTH);
  } catch (err) {
    console.warn('style-dna: GitHub crawl failed', err);
    return [];
  }
}

async function crawlAll(
  site: SiteSource,
  maxPosts: number,
): Promise<{ posts: PostContent[]; source: string }> {
  if (site.github_repo) {
    return {
      posts: await crawlGitHub(site.github_repo, site.github_branch, site.github_content_path),
      source: 'github',
    };
  }
  if (site.wp_url) {
    const base = site.wp_url.replace(/\/+$/, '');
    const result = await crawlWordPress(base, maxPosts);
    if (result.posts.length > 0) return result;
    // Final fallback: try RSS content extraction (handles Astro/static sites behind CF)
    const rssPosts = await fetchRssContent(base);
    if (rssPosts.length > 0) return { posts: rssPosts, source: 'rss' };
    return { posts: [], source: 'none' };
  }
  return { posts: [], source: 'none' };
}

// ---- pattern extraction ----

function countTransitions(sentences: string[]): string[] {
  const counts = new Map<string, number>();
  for (const s of sentences) {
    const start = s.toLowerCase().replace(/^[^a-z']+/, '');
    const firstWord = start.match(/^[a-z'-]+/)?.[0] ?? '';
    const firstTwo = start.split(/\s+/).slice(0, 2).join(' ');
    for (const t of TRANSITIONS) {
      if (firstWord === t || firstTwo === t) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);
}

function detectCtas(text: string): string[] {
  return CTA_PATTERNS.filter(({ re }) => text.match(re)).map(({ label }) => label);
}

function detectToneMarkers(text: string): string[] {
  const markers: string[] = [];
  const exclaims = (text.match(/!/g) ?? []).length;
  const questions = (text.match(/\?/g) ?? []).length;
  const casual = (
    text.match(/\b(i'm|you're|gonna|wanna|awesome|amazing|crazy|literally|honestly)\b/gi) ?? []
  ).length;
  const firstPerson = (text.match(/\b(i|we|my|our)\b/gi) ?? []).length;
  if (exclaims > 15) markers.push('emphatic');
  if (questions > 10) markers.push('inquisitive');
  if (casual > 12) markers.push('casual');
  if (firstPerson > 25) markers.push('personal');
  if (markers.length === 0) markers.push('professional');
  return markers;
}

function extractPatterns(posts: PostContent[]): StylePatterns {
  const sample = posts.slice(0, 100);
  const allText = sample.map((p) => p.content).join('\n\n');

  const sentences = splitSentences(allText);
  const avgSentenceLength = round1(mean(sentences.map((s) => wordCount(s))));

  const paragraphs = allText.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  // Sentences per paragraph (paragraph text length / mean sentence length)
  const avgParagraphWords = mean(paragraphs.map((p) => wordCount(p)));
  const paragraphLength = round1(avgSentenceLength > 0 ? avgParagraphWords / avgSentenceLength : 0);

  const vocabWindow = allText.slice(0, 20000);
  const vocabWords = tokenize(vocabWindow);
  const vocabDiversity = round2(
    vocabWords.length > 0 ? new Set(vocabWords).size / vocabWords.length : 0,
  );

  // H2/H3 per post
  const h2h3PerPost = sample.map((p) => p.headings.filter((h) => h === 2 || h === 3).length);
  const headingDepth = round1(mean(h2h3PerPost));

  return {
    avgSentenceLength,
    vocabDiversity,
    commonTransitions: countTransitions(sentences),
    headingDepth,
    ctaPatterns: detectCtas(allText),
    paragraphLength,
    toneMarkers: detectToneMarkers(allText),
  };
}

// ---- few-shot generation ----

async function generateFewShot(
  env: Env,
  site: SiteSource,
  posts: PostContent[],
  patterns: StylePatterns,
): Promise<StyleExample[]> {
  const samples = [...posts]
    .sort((a, b) => wordCount(b.content) - wordCount(a.content))
    .slice(0, FEW_SHOT_COUNT);
  const sampleText = samples
    .map((p) => `Title: ${p.title}\n${p.content.slice(0, 1200)}`)
    .join('\n\n---\n\n');

  const system =
    "You are a brand voice analyst. You study a website's existing content and write few-shot examples that faithfully mimic its writing style.";
  const user = `Extracted style patterns from the site's content:
${JSON.stringify(patterns, null, 2)}

Sample excerpts from ${samples.length} representative posts:
${sampleText}

Write ${FEW_SHOT_COUNT} few-shot examples that reproduce this site's voice, vocabulary, sentence rhythm, and structure. For each example "title" is a realistic article title in this style, and "content" is 2-3 short paragraphs (150-250 words) opening an article in the exact same style.

Return ONLY valid JSON: {"examples": [{"title": "string", "content": "string"}]}`;

  try {
    const response = await withTimeout(
      callRouter(env, {
        model: site.ai_model_default || '9router-claude-writer',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
      AI_TIMEOUT_MS,
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in model response');
    const parsed = JSON.parse(jsonMatch[0]) as {
      examples?: Array<{ title?: unknown; content?: unknown }>;
    };
    const examples = Array.isArray(parsed.examples) ? parsed.examples : [];
    return examples
      .filter(
        (e) =>
          typeof e.title === 'string' &&
          typeof e.content === 'string' &&
          e.title.length > 0 &&
          e.content.length > 50,
      )
      .map((e) => ({ title: e.title as string, content: e.content as string }))
      .slice(0, FEW_SHOT_COUNT);
  } catch (err) {
    console.warn('style-dna: few-shot generation failed, using top posts as examples', err);
    // Fail-open: use top posts as deterministic examples so DNA stays usable
    return samples.map((s) => ({ title: s.title, content: s.content.slice(0, 600) }));
  }
}

// ---- orchestrator ----

async function loadSite(env: Env, siteId: string): Promise<SiteSource | null> {
  const row = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(siteId).first<{
    type: string;
    wp_url: string | null;
    github_repo: string | null;
    github_branch: string | null;
    github_content_path: string | null;
    ai_model_default: string | null;
    config_json: string | null;
  }>();
  if (!row) return null;

  let config: Record<string, unknown> = {};
  if (row.config_json) {
    try {
      config = JSON.parse(row.config_json) as Record<string, unknown>;
    } catch {
      config = {};
    }
  }

  const str = (v: unknown): string => (typeof v === 'string' && v.length > 0 ? v : '');
  return {
    type: row.type,
    wp_url: str(row.wp_url || config.wp_url),
    github_repo: str(row.github_repo || config.github_repo),
    github_branch: str(row.github_branch || config.github_branch) || 'main',
    github_content_path:
      str(row.github_content_path || config.github_content_path) || 'src/content/posts',
    ai_model_default: row.ai_model_default || '9router-claude-writer',
  };
}

/**
 * Crawl site content and build the full Style DNA (patterns + few-shot examples).
 * Throws on fatal errors (site not found, no readable content); external fetches fail-open.
 */
export async function analyzeSiteStyle(
  env: Env,
  siteId: string,
  maxPosts = 150,
): Promise<StyleDnaData> {
  const site = await loadSite(env, siteId);
  if (!site) throw new Error('Site not found');

  const { posts } = await crawlAll(site, maxPosts);
  if (posts.length === 0) throw new Error('No readable content found for this site');

  const patterns = extractPatterns(posts);
  const examples = await generateFewShot(env, site, posts, patterns);

  return {
    examples,
    patterns,
    analyzedAt: new Date().toISOString(),
    postCount: posts.length,
  };
}

/**
 * Persist Style DNA to sites.wp_style_dna as a JSON string.
 */
export async function saveStyleDNA(env: Env, siteId: string, dna: StyleDnaData): Promise<void> {
  await env.DB.prepare(
    "UPDATE sites SET wp_style_dna = ?, updated_at = datetime('now') WHERE id = ?",
  )
    .bind(JSON.stringify(dna), siteId)
    .run();
}
