// functions/api/publish/blogger.ts
// POST /api/publish/blogger — publish article to Blogger via API v3
// OAuth2 token refresh automatic; no secret ever returned in response

import { getArticleById } from '../../../src/lib/server/articles';
import { validateSession } from '../../../src/lib/server/auth';
import { publishArticle as publishToBlogger } from '../../../src/lib/server/cms/blogger';
import { getSiteById } from '../../../src/lib/server/sites';
import { publishRequestSchema } from '../../../src/types/publish';

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const env: Env = context.env;
  const request = context.request;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const sessionResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET ?? '');
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  try {
    const body = await request.json();
    const data = publishRequestSchema.parse(body);

    // Verify article belongs to workspace
    const article = await getArticleById(env.DB, data.article_id);
    if (!article) {
      return new Response(JSON.stringify({ error: 'Article not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (article.workspace_id !== workspaceId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check article can be published
    const validStatuses = ['ready', 'scheduled'];
    if (!validStatuses.includes(article.status)) {
      return new Response(
        JSON.stringify({ error: `Cannot publish: article status is ${article.status}` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Resolve site
    const siteId = data.site_id || article.site_id;
    const site = await getSiteById(env.DB, siteId);
    if (!site || site.type !== 'blogger') {
      return new Response(JSON.stringify({ error: 'Invalid Blogger site configuration' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse config (internal, never returned in response)
    const config = (site.config_json ? JSON.parse(site.config_json) : {}) as Record<
      string,
      unknown
    >;
    if (!config.blogger_blog_id || !config.blogger_refresh_token) {
      return new Response(
        JSON.stringify({ error: 'Blogger credentials not configured' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const result = await publishToBlogger(article, {
      blogger_blog_id: String(config.blogger_blog_id),
      blogger_refresh_token: String(config.blogger_refresh_token),
      google_client_id: env.GOOGLE_CLIENT_ID ?? '',
      google_client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
    });

    if (!result.success) {
      // Record error on article
      await env.DB.prepare(
        `UPDATE articles SET status = 'failed', publish_error = ?, updated_at = datetime('now') WHERE id = ?`,
      )
        .bind(result.error ?? 'Unknown error', article.id)
        .run();

      return new Response(JSON.stringify({ success: false, error: result.error }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Success — mark published
    await env.DB.prepare(
      `UPDATE articles SET status = 'published', published_url = ?, published_at = datetime('now'), publish_error = NULL, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(result.url ?? null, article.id)
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        article_id: article.id,
        url: result.url,
        verify: result.verify ?? null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
