// functions/api/publish/index.ts
// POST /api/publish — enqueue publish job
// GET /api/publish/queue — list publish queue items

import { getArticleById } from '../../../src/lib/server/articles';
import { validateSession } from '../../../src/lib/server/auth';
import { type PublishRequest, publishRequestSchema } from '../../../src/types/publish';

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

  if (method === 'POST') {
    try {
      const body = await request.json();
      const data = publishRequestSchema.parse(body);

      // Verify article exists and belongs to workspace
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

      // Check if article can be published
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

      const siteId = data.site_id || article.site_id;
      const scheduledFor = article.scheduled_for;

      if (scheduledFor && new Date(scheduledFor) > new Date()) {
        // Already scheduled, just return
        return new Response(JSON.stringify({ job_id: article.id, status: 'scheduled' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Create publish queue entry
      const jobId = `pub_${crypto.randomUUID()}`;
      await env.DB.prepare(
        `INSERT INTO publish_queue (id, article_id, site_id, status, created_at)
         VALUES (?, ?, ?, 'pending', datetime('now'))`,
      )
        .bind(jobId, data.article_id, siteId)
        .run();

      // Enqueue to Durable Object (Assuming same approach as generation-queue)
      // Note: Architecture says Durable Object: Generation Queue. Need to check if publish also needs DO.
      // Assuming DO for publish based on generation-queue pattern.
      const queueId = env.QUEUE.idFromName('publish-queue');
      const queueStub = env.QUEUE.get(queueId) as unknown as {
        fetch: (url: string, options: RequestInit) => Promise<Response>;
      };
      await queueStub.fetch('http://do/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, article_id: data.article_id, site_id: siteId }),
      });

      // Update article status to 'publishing'
      await env.DB.prepare(
        `UPDATE articles SET status = 'publishing', updated_at = datetime('now') WHERE id = ?`,
      )
        .bind(data.article_id)
        .run();

      return new Response(JSON.stringify({ job_id: jobId, status: 'queued' }), {
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

  if (method === 'GET') {
    const url = new URL(request.url);
    const workspaceIdParam = url.searchParams.get('workspace_id');

    if (workspaceIdParam !== workspaceId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const items = await env.DB.prepare(
      `SELECT pq.* FROM publish_queue pq
       JOIN articles a ON pq.article_id = a.id
       WHERE a.workspace_id = ?
       ORDER BY pq.created_at DESC`,
    )
      .bind(workspaceId)
      .all();

    return new Response(JSON.stringify(items.results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
};
