// functions/api/articles/[id].ts
// GET /api/articles/:id, PUT /api/articles/:id, PATCH /api/articles/:id/status, DELETE /api/articles/:id

import {
  getArticleById,
  getArticleVersions,
  softDeleteArticle,
  transitionArticleStatus,
  updateArticle,
} from '../../../src/lib/server/articles';
import { logAudit } from '../../../src/lib/server/audit';
import { validateSession } from '../../../src/lib/server/auth';
import {
  type ArticleStatus,
  articleStatusTransitionSchema,
  articleUpdateSchema,
} from '../../../src/lib/server/types/article';

export const onRequest = async (context: {
  request: Request;
  env: Env;
  params?: { id: string };
}): Promise<Response> => {
  const env: Env = context.env;
  const request = context.request;
  const method = request.method;
  const articleId = context.params?.id;

  if (!articleId) {
    return new Response(JSON.stringify({ error: 'Missing article ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET ?? '');
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  const article = await getArticleById(env.DB, articleId);
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

  if (method === 'GET') {
    const versions = await getArticleVersions(env.DB, articleId);
    return new Response(JSON.stringify({ ...article, versions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (method === 'PUT') {
    try {
      const body = await request.json();
      const data = articleUpdateSchema.parse(body);
      const updated = await updateArticle(env.DB, articleId, data, 'user');
      if (!updated) {
        return new Response(JSON.stringify({ error: 'Article not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      await logAudit(env.DB, {
        workspaceId,
        articleId,
        action: 'edited',
        actor: session.user.user_name,
      });
      return new Response(JSON.stringify(updated), {
        status: 200,
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

  if (method === 'PATCH') {
    const url = new URL(request.url);
    // Check if it's status transition endpoint
    if (url.pathname.endsWith('/status')) {
      try {
        const body = await request.json();
        const data = articleStatusTransitionSchema.parse(body);
        const updated = await transitionArticleStatus(
          env.DB,
          articleId,
          data.status as ArticleStatus,
        );
        if (!updated) {
          return new Response(JSON.stringify({ error: 'Article not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        await logAudit(env.DB, {
          workspaceId,
          articleId,
          action: `status:${data.status}`,
          actor: session.user.user_name,
        });
        return new Response(JSON.stringify(updated), {
          status: 200,
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
    // Fallback to regular update if not /status
    try {
      const body = await request.json();
      const data = articleUpdateSchema.parse(body);
      const updated = await updateArticle(env.DB, articleId, data, 'user');
      if (!updated) {
        return new Response(JSON.stringify({ error: 'Article not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      await logAudit(env.DB, {
        workspaceId,
        articleId,
        action: 'edited',
        actor: session.user.user_name,
      });
      return new Response(JSON.stringify(updated), {
        status: 200,
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

  if (method === 'DELETE') {
    const deleted = await softDeleteArticle(env.DB, articleId);
    if (!deleted) {
      return new Response(JSON.stringify({ error: 'Article not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    await logAudit(env.DB, {
      workspaceId,
      articleId,
      action: 'deleted',
      actor: session.user.user_name,
    });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
};
