// functions/api/generate/article.ts
// POST /api/generate/article — save completed article with markdown + frontmatter

import type { Env } from '../../../src/env';
import { validateSession } from '../../../src/lib/server/auth';

interface SaveArticleRequest {
  article_id: string;
  title: string;
  description?: string;
  content_md: string;
  frontmatter_json: string;
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const method = request.method;

  const secret = env.GITHUB_CLIENT_SECRET ?? '';
  const sessionResult = await validateSession(request, env, secret);
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  if (method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body: SaveArticleRequest = await request.json();
    const { article_id, title, description, content_md, frontmatter_json } = body;

    // Verify article exists and belongs to workspace
    const articleRes = await env.DB.prepare('SELECT * FROM articles WHERE id = ?')
      .bind(article_id)
      .first<{ workspace_id: string; site_id: string; status: string }>();

    if (!articleRes || articleRes.workspace_id !== workspaceId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate frontmatter JSON
    try {
      JSON.parse(frontmatter_json);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid frontmatter JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update article with generated content
    await env.DB.prepare(
      `UPDATE articles 
       SET title = ?, description = ?, content_md = ?, frontmatter_json = ?, status = 'ready', updated_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(title, description ?? null, content_md, frontmatter_json, article_id)
      .run();

    // Create version history entry
    await env.DB.prepare(
      `INSERT INTO article_versions (id, article_id, title, description, content_md, frontmatter_json, version_number, created_at)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(version_number), 0) + 1 FROM article_versions WHERE article_id = ?), datetime('now'))`,
    )
      .bind(
        `ver_${crypto.randomUUID()}`,
        article_id,
        title,
        description ?? null,
        content_md,
        frontmatter_json,
        article_id,
      )
      .run();

    // Log audit
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, workspace_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, 'generate_complete', 'article', ?, ?, datetime('now'))`,
    )
      .bind(
        `audit_${crypto.randomUUID()}`,
        workspaceId,
        article_id,
        JSON.stringify({ title, word_count: content_md.split(/\s+/).length }),
      )
      .run();

    return new Response(JSON.stringify({ success: true, article_id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
