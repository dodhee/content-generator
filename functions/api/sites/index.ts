// functions/api/sites/index.ts
// GET /api/sites, POST /api/sites

import { validateSession } from '../../../src/lib/server/auth';
import { createSite, listSites, siteSchema } from '../../../src/lib/server/sites';

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
    const sites = await listSites(env.DB, workspaceId);
    return new Response(JSON.stringify(sites), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (method === 'POST') {
    try {
      const body = await request.json();
      const data = siteSchema.parse(body);
      const siteId = `site_${crypto.randomUUID()}`;
      const created = await createSite(env.DB, workspaceId, siteId, data);
      const config = created.config_json ? JSON.parse(created.config_json) : {};
      const secretKeys = [
        'wp_app_password',
        'blogger_refresh_token',
        'webhook_secret',
        'github_installation_id',
      ];
      for (const key of secretKeys) {
        if (config[key]) config[key] = '***';
      }
      return new Response(JSON.stringify({ ...created, config_json: JSON.stringify(config) }), {
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
