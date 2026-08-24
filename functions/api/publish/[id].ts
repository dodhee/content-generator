// functions/api/publish/[id].ts
// GET /api/publish/:id — check publish job status
// PATCH /api/publish/:id/retry — requeue failed job

import { getArticleById } from '../../../src/lib/server/articles';
import { validateSession } from '../../../src/lib/server/auth';

export const onRequest = async (context: {
  request: Request;
  env: Env;
  params?: { id: string };
}): Promise<Response> => {
  const env: Env = context.env;
  const request = context.request;
  const method = request.method;
  const jobId = context.params?.id;

  if (!jobId) {
    return new Response(JSON.stringify({ error: 'Missing job ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET ?? '');
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  if (method === 'GET') {
    // Try to get from Durable Object first
    try {
      const queueId = env.QUEUE.idFromName('publish-queue');
      const queueStub = env.QUEUE.get(queueId) as unknown as {
        fetch: (url: string, options: RequestInit) => Promise<Response>;
      };
      const response = await queueStub.fetch(`http://do/status/${jobId}`, {
        method: 'GET',
      });
      if (response.ok) {
        const job = await response.json();
        return new Response(JSON.stringify(job), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch {
      // Fall through to DB check
    }

    // Fallback: check publish_queue table
    const job = await env.DB.prepare('SELECT * FROM publish_queue WHERE id = ?').bind(jobId).first<{
      id: string;
      article_id: string;
      site_id: string;
      status: string;
      scheduled_for: string | null;
      payload_json: string | null;
      response_json: string | null;
      error_message: string | null;
      retry_count: number;
      max_retries: number;
      created_at: string;
      processed_at: string | null;
      completed_at: string | null;
    }>();

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify article belongs to workspace
    const article = await getArticleById(env.DB, job.article_id);
    if (!article || article.workspace_id !== workspaceId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(job), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (method === 'PATCH') {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const isRetry = pathParts[pathParts.length - 1] === 'retry';

    if (!isRetry) {
      return new Response('Method not allowed', { status: 405 });
    }

    // Get job from DB
    const job = await env.DB.prepare('SELECT * FROM publish_queue WHERE id = ?').bind(jobId).first<{
      id: string;
      article_id: string;
      site_id: string;
      status: string;
      scheduled_for: string | null;
      payload_json: string | null;
      response_json: string | null;
      error_message: string | null;
      retry_count: number;
      max_retries: number;
      created_at: string;
      processed_at: string | null;
      completed_at: string | null;
    }>();

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify article belongs to workspace
    const article = await getArticleById(env.DB, job.article_id);
    if (!article || article.workspace_id !== workspaceId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Only allow retry for failed jobs
    if (job.status !== 'failed') {
      return new Response(JSON.stringify({ error: 'Only failed jobs can be retried' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Reset job status to pending
    await env.DB.prepare(
      'UPDATE publish_queue SET status = ?, retry_count = 0, error_message = NULL, processed_at = NULL, completed_at = NULL WHERE id = ?',
    )
      .bind('pending', jobId)
      .run();

    // Update article status to queued
    await env.DB.prepare('UPDATE articles SET status = ? WHERE id = ?')
      .bind('queued', job.article_id)
      .run();

    // Re-enqueue to DO publish-queue
    try {
      const queueId = env.QUEUE.idFromName('publish-queue');
      const queueStub = env.QUEUE.get(queueId) as unknown as {
        fetch: (url: string, options: RequestInit) => Promise<Response>;
      };
      await queueStub.fetch('http://do/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, article_id: job.article_id, site_id: job.site_id }),
      });
    } catch {
      // If DO enqueue fails, job stays in DB as pending — will be picked up by cron
    }

    return new Response(JSON.stringify({ job_id: jobId, status: 'pending' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
};
