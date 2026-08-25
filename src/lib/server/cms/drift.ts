// src/lib/server/cms/drift.ts
// Drift detection: fetch published content from WP, compare with source

import type { ArticleRow } from '../types/article';

interface DriftResult {
  articleId: string;
  title: string;
  status: 'match' | 'divergent' | 'error';
  diff?: string;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export async function checkArticleDrift(
  article: ArticleRow,
  siteWpUrl: string,
): Promise<DriftResult> {
  const title = article.title ?? 'Untitled';
  const articleId = article.id;

  if (!article.published_url || !article.content_md) {
    return { articleId, title, status: 'error' };
  }

  try {
    // Extract slug from published_url (last path segment)
    const url = new URL(article.published_url);
    const pathSegments = url.pathname.split('/').filter((s) => s);
    const slug = pathSegments[pathSegments.length - 1];

    if (!slug) {
      return { articleId, title, status: 'error' };
    }

    // Fetch from WP REST API
    const wpApiUrl = `${siteWpUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=content,link`;
    const res = await fetch(wpApiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      return { articleId, title, status: 'error' };
    }

    const posts = (await res.json()) as Array<{ content: { rendered: string } }>;
    if (!posts.length || !posts[0]?.content?.rendered) {
      return { articleId, title, status: 'error' };
    }

    const publishedContent = posts[0].content.rendered;

    // Normalize and compare
    const normalizedSource = normalizeWhitespace(article.content_md);
    const normalizedPublished = normalizeWhitespace(publishedContent);

    if (normalizedSource === normalizedPublished) {
      return { articleId, title, status: 'match' };
    }

    // Divergent: create diff snippet
    const sourceSnippet = normalizedSource.slice(0, 200);
    const publishedSnippet = normalizedPublished.slice(0, 200);
    const diff = `Source: ${sourceSnippet}... | Published: ${publishedSnippet}...`;

    return { articleId, title, status: 'divergent', diff };
  } catch {
    return { articleId, title, status: 'error' };
  }
}
