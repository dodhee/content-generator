// functions/api/workspaces/index.ts
// GET /api/workspaces, POST /api/workspaces

import { validateSession } from '../../../src/lib/server/auth';
import {
  createWorkspace,
  listWorkspaces,
  workspaceSchema,
} from '../../../src/lib/server/workspaces';

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
  const userId = session.user.user_id;

  if (method === 'GET') {
    const workspaces = await listWorkspaces(env.DB, userId);
    return new Response(JSON.stringify(workspaces), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (method === 'POST') {
    try {
      const body = await request.json();
      const data = workspaceSchema.parse(body);
      const wsId = `ws_${userId}`;
      const created = await createWorkspace(env.DB, wsId, data);
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
