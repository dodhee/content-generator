// functions/api/generate/[id].ts
// GET /api/generate/:id — check job status

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
      const queueId = env.QUEUE.idFromName('generation-queue');
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

    // Fallback: check generation_queue table
    const job = await env.DB.prepare('SELECT * FROM generation_queue WHERE id = ?')
      .bind(jobId)
      .first<{
        id: string;
        article_id: string;
        status: string;
        model_name: string | null;
        prompt_data: string | null;
        result_json: string | null;
        error_message: string | null;
        retry_count: number;
        max_retries: number;
        created_at: string;
        started_at: string | null;
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

    // If job completed, include article outline
    let outline = null;
    if (job.status === 'completed' && job.result_json) {
      try {
        outline = JSON.parse(job.result_json);
      } catch {
        // ignore parse error
      }
    }

    return new Response(JSON.stringify({ ...job, outline }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
};
