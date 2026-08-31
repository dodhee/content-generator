// src/lib/server/cms/blogger.ts
// Blogger API v3 client — OAuth2 token refresh, create/update post, verify

import type { ArticleRow } from '../types/article';

const GOOGLE_OAUTH_URL = 'https://oauth2.googleapis.com/token';
const BLOGGER_API_BASE = 'https://www.googleapis.com/blogger/v3';

export interface BloggerConfig {
  blogger_blog_id: string;
  blogger_refresh_token: string;
  google_client_id: string;
  google_client_secret: string;
}

interface BloggerPostResponse {
  id: string;
  url: string;
  published: string;
  updated: string;
  title: string;
  content: string;
  labels?: string[];
}

// ── OAuth2 token refresh ──────────────────────────────────────────

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch(GOOGLE_OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Blogger token refresh failed: ${err}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ── Markdown → HTML (mirrors wordpress.ts) ────────────────────────

function mdToHtml(md: string): string {
  let html = md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
    .replace(/\*(.*?)\*/gim, '<i>$1</i>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');

  // Wrap paragraphs (lines not already wrapped in block tags)
  const blockTags = /^<\/?(h[1-6]|ul|ol|li|p|div|table|pre|blockquote|img)/i;
  html = html
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (blockTags.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');

  return html;
}

// ── Create post via Blogger API v3 ────────────────────────────────

async function createPost(
  accessToken: string,
  blogId: string,
  post: {
    title: string;
    content: string;
    labels?: string[];
    published?: string;
  },
): Promise<BloggerPostResponse> {
  const body: Record<string, unknown> = {
    kind: 'blogger#post',
    title: post.title,
    content: post.content,
  };

  if (post.labels && post.labels.length > 0) {
    body.labels = post.labels;
  }

  // Blogger API uses `publishDate` for scheduling; `published` sets the timestamp
  if (post.published) {
    body.published = post.published;
  }

  const res = await fetch(`${BLOGGER_API_BASE}/blogs/${blogId}/posts/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg =
      (errBody as { error?: { message?: string } }).error?.message ||
      `Blogger API error (${res.status})`;
    throw new Error(msg);
  }

  return res.json() as Promise<BloggerPostResponse>;
}

// ── Post-publish verification ─────────────────────────────────────

interface VerifyResult {
  success: boolean;
  canonicalMatch: boolean;
  indexable: boolean;
}

async function verifyPost(url: string): Promise<VerifyResult> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContentGenerator/1.0)' },
    });

    if (!res.ok) {
      return { success: false, canonicalMatch: false, indexable: false };
    }

    const html = await res.text();

    // Check canonical link
    const canonicalMatch = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*\/?>/i);
    const canonicalUrl = canonicalMatch?.[1] || '';

    // Check robots meta
    const robotsMatch = html.match(/<meta[^>]*name="robots"[^>]*content="([^"]+)"[^>]*\/?>/i);
    const robotsContent = robotsMatch?.[1] || '';
    const indexable = !/\bnoindex\b/i.test(robotsContent);

    // Normalize trailing slash for comparison
    const normalizeUrl = (u: string) => u.replace(/\/+$/, '');
    const canonicalMatchOk = canonicalUrl ? normalizeUrl(canonicalUrl) === normalizeUrl(url) : true; // no canonical tag = self-canonical by default

    return {
      success: true,
      canonicalMatch: canonicalMatchOk,
      indexable,
    };
  } catch {
    return { success: false, canonicalMatch: false, indexable: false };
  }
}

// ── Extract labels from frontmatter ───────────────────────────────

function extractLabels(frontmatterJson: string | null): string[] {
  if (!frontmatterJson) return [];
  try {
    const fm = JSON.parse(frontmatterJson) as Record<string, unknown>;
    const labels: string[] = [];
    if (Array.isArray(fm.tags)) {
      for (const tag of fm.tags) {
        if (typeof tag === 'string') labels.push(tag);
      }
    }
    if (typeof fm.category === 'string') {
      // Blogger labels are lowercase; category goes first
      labels.unshift(fm.category);
    }
    // Blogger max 200 labels per post, each max 200 chars
    return labels.slice(0, 200).map((l) => l.slice(0, 200));
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────

export async function publishArticle(
  article: ArticleRow,
  config: BloggerConfig,
): Promise<{
  success: boolean;
  url?: string;
  error?: string;
  verify?: VerifyResult;
}> {
  try {
    const accessToken = await refreshAccessToken(
      config.blogger_refresh_token,
      config.google_client_id,
      config.google_client_secret,
    );

    const htmlContent = mdToHtml(article.content_md || '');
    const labels = extractLabels(article.frontmatter_json);

    const postBody: {
      title: string;
      content: string;
      labels?: string[];
      published?: string;
    } = {
      title: article.title || 'Untitled',
      content: htmlContent,
    };

    if (labels.length > 0) {
      postBody.labels = labels;
    }

    // Set published date for both scheduling and post dating
    if (article.scheduled_for) {
      postBody.published = new Date(article.scheduled_for).toISOString();
    }

    const result = await createPost(accessToken, config.blogger_blog_id, postBody);

    // Post-publish verification (AC-04): status 200, canonical match, indexable
    const verify = await verifyPost(result.url);

    return {
      success: true,
      url: result.url,
      verify,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
