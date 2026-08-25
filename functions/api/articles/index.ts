// functions/api/articles/index.ts
// GET /api/articles, POST /api/articles

import { articleCreateSchema, createArticle, listArticles } from '../../../src/lib/server/articles';
import { logAudit } from '../../../src/lib/server/audit';
import { validateSession } from '../../../src/lib/server/auth';
import type { ArticleCreate } from '../../../src/lib/server/types/article';

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const env: Env = context.env;
  const request = context.request;
  const method = request.method;

  const sessionResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET ?? '');
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  if (method === 'GET') {
    const url = new URL(request.url);
    const siteId = url.searchParams.get('site_id') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;

    const articles = await listArticles(env.DB, workspaceId, { site_id: siteId, status });
    return new Response(JSON.stringify(articles), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (method === 'POST') {
    try {
      const body = await request.json();
      const data = articleCreateSchema.parse({
        ...body,
        workspace_id: workspaceId, // enforce ownership
      });
      const created = await createArticle(env.DB, data);
      await logAudit(env.DB, {
        workspaceId,
        articleId: created.id,
        action: 'created',
        actor: session.user.user_name,
        details: { title: data.title ?? null },
      });
      return new Response(JSON.stringify(created), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
};
