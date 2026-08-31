// functions/api/publish/astro.ts
// POST /api/publish/astro — publish article to Astro/Git repo via GitHub App
// JWT → installation token → commit → workflow dispatch → poll deploy

import { getArticleById } from '../../../src/lib/server/articles';
import { validateSession } from '../../../src/lib/server/auth';
import { publishArticle as publishToAstro } from '../../../src/lib/server/cms/astro';
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
    if (!site || site.type !== 'astro') {
      return new Response(JSON.stringify({ error: 'Invalid Astro site configuration' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse config (internal, never returned in response)
    const config = (site.config_json ? JSON.parse(site.config_json) : {}) as Record<
      string,
      unknown
    >;
    if (!config.github_repo || !config.github_installation_id) {
      return new Response(
        JSON.stringify({ error: 'GitHub repo or installation ID not configured' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const result = await publishToAstro(
      article,
      {
        github_repo: String(config.github_repo),
        github_branch: String(config.github_branch ?? 'main'),
        github_content_path: String(config.github_content_path ?? 'src/content/posts'),
        github_installation_id: String(config.github_installation_id),
        github_workflow_file: config.github_workflow_file
          ? String(config.github_workflow_file)
          : undefined,
        live_url: config.live_url ? String(config.live_url) : undefined,
      },
      {
        GITHUB_APP_ID: env.GITHUB_APP_ID ?? '',
        GITHUB_APP_PRIVATE_KEY: env.GITHUB_APP_PRIVATE_KEY ?? '',
      },
    );

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
        deploy_url: result.deployUrl ?? null,
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
