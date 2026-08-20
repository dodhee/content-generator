// functions/api/workspaces/[id].ts
// GET /api/workspaces/:id, PATCH /api/workspaces/:id, DELETE /api/workspaces/:id

import { validateSession } from '../../../src/lib/server/auth';
import {
  deleteWorkspace,
  getWorkspaceById,
  updateWorkspace,
  workspaceUpdateSchema,
} from '../../../src/lib/server/workspaces';

export const onRequest = async (context: {
  request: Request;
  env: Env;
  params?: { id: string };
}): Promise<Response> => {
  const env: Env = context.env;
  const request = context.request;
  const method = request.method;
  const workspaceId = context.params?.id;
  if (!workspaceId) {
    return new Response(JSON.stringify({ error: 'Missing workspace ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET ?? '');
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;

  const workspace = await getWorkspaceById(env.DB, workspaceId);
  if (!workspace) {
    return new Response(JSON.stringify({ error: 'Workspace not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (workspace.id !== session.user.workspace_id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (method === 'GET') {
    return new Response(JSON.stringify(workspace), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (method === 'PATCH') {
    try {
      const body = await request.json();
      const data = workspaceUpdateSchema.parse(body);
      const updated = await updateWorkspace(env.DB, workspaceId, data);
      if (!updated) {
        return new Response(JSON.stringify({ error: 'Workspace not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
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
    const deleted = await deleteWorkspace(env.DB, workspaceId);
    if (!deleted) {
      return new Response(JSON.stringify({ error: 'Workspace not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
};
