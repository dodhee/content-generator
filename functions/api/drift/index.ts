// functions/api/drift/index.ts
// GET /api/drift — check drift for up to 3 published articles

import { validateSession } from '../../../src/lib/server/auth';
import { checkArticleDrift } from '../../../src/lib/server/cms/drift';
import type { ArticleRow } from '../../../src/lib/server/types/article';

interface SiteConfig {
  wp_url?: string;
}

export const onRequestGet = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const env: Env = context.env;
  const request = context.request;

  const sessionResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET ?? '');
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  try {
    // Query up to 3 published articles with site config
    const rows = await env.DB.prepare(
      `SELECT a.*, s.config_json
       FROM articles a
       JOIN sites s ON a.site_id = s.id
       WHERE a.workspace_id = ?
         AND a.status = 'published'
         AND a.published_url IS NOT NULL
       LIMIT 3`,
    )
      .bind(workspaceId)
      .all();

    if (!rows.results) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check drift for each article in parallel
    const checks = rows.results.map(async (row: unknown) => {
      const article = row as ArticleRow & { config_json: string | null };

      let wpUrl = '';
      if (article.config_json) {
        try {
          const config = JSON.parse(article.config_json) as SiteConfig;
          wpUrl = config.wp_url ?? '';
        } catch {
          wpUrl = '';
        }
      }

      if (!wpUrl) {
        return {
          articleId: article.id,
          title: article.title ?? 'Untitled',
          status: 'error' as const,
        };
      }

      return checkArticleDrift(article, wpUrl);
    });

    const results = await Promise.all(checks);

    return new Response(JSON.stringify(results), {
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
