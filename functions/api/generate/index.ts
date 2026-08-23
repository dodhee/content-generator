// functions/api/generate/index.ts
// POST /api/generate — enqueue generation job

import { getArticleById } from '../../../src/lib/server/articles';
import { validateSession } from '../../../src/lib/server/auth';
import { type GenerateRequest, generateRequestSchema } from '../../../src/types/generate';

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
      const data = generateRequestSchema.parse(body);

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

      // Check if article can be generated (status in valid states)
      const validStatuses = ['draft', 'outline', 'review'];
      if (!validStatuses.includes(article.status)) {
        return new Response(
          JSON.stringify({ error: `Cannot generate: article status is ${article.status}` }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      // Create generation queue entry
      const jobId = `job_${crypto.randomUUID()}`;
      await env.DB.prepare(
        `INSERT INTO generation_queue (id, article_id, status, prompt_data, retry_count, max_retries, created_at)
         VALUES (?, ?, 'queued', ?, 0, 3, datetime('now'))`,
      )
        .bind(jobId, data.article_id, JSON.stringify(data))
        .run();

      // Enqueue to Durable Object
      const queueId = env.QUEUE.idFromName('generation-queue');
      const queueStub = env.QUEUE.get(queueId) as unknown as {
        fetch: (url: string, options: RequestInit) => Promise<Response>;
      };
      await queueStub.fetch('http://do/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, article_id: data.article_id, prompt: data }),
      });

      // Update article status to 'generating'
      await env.DB.prepare(
        `UPDATE articles SET status = 'generating', updated_at = datetime('now') WHERE id = ?`,
      )
        .bind(data.article_id)
        .run();

      return new Response(JSON.stringify({ job_id: jobId }), {
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
