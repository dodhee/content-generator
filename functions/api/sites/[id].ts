// functions/api/sites/[id].ts
// GET /api/sites/:id, PATCH /api/sites/:id, DELETE /api/sites/:id

import { validateSession } from '../../../src/lib/server/auth';
import {
  deleteSite,
  getSiteByIdWithConfig,
  siteUpdateSchema,
  updateSite,
} from '../../../src/lib/server/sites';

export const onRequest = async (context: {
  request: Request;
  env: Env;
  params?: { id: string };
}): Promise<Response> => {
  const env: Env = context.env;
  const request = context.request;
  const method = request.method;
  const siteId = context.params?.id;
  if (!siteId) {
    return new Response(JSON.stringify({ error: 'Missing site ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET ?? '');
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  const site = await getSiteByIdWithConfig(env.DB, siteId);
  if (!site) {
    return new Response(JSON.stringify({ error: 'Site not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (site.row.workspace_id !== workspaceId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (method === 'GET') {
    return new Response(JSON.stringify(site), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (method === 'PATCH') {
    try {
      const body = await request.json();
      const data = siteUpdateSchema.parse(body);
      const updated = await updateSite(env.DB, siteId, data);
      if (!updated) {
        return new Response(JSON.stringify({ error: 'Site not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const updatedWithConfig = await getSiteByIdWithConfig(env.DB, siteId);
      return new Response(JSON.stringify(updatedWithConfig), {
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
    const deleted = await deleteSite(env.DB, siteId);
    if (!deleted) {
      return new Response(JSON.stringify({ error: 'Site not found' }), {
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
