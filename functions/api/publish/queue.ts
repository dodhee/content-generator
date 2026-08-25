// functions/api/publish/queue.ts
// GET /api/publish/queue — list publish queue items

import { validateSession } from '../../../src/lib/server/auth';

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

  const items = await env.DB.prepare(
    `SELECT pq.*, a.title AS article_title FROM publish_queue pq
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
};
