// functions/_worker.ts
// Cloudflare Pages Functions entry point

import { onRequest } from './_middleware';

import * as authCallback from './api/auth/callback';
import * as authLogin from './api/auth/login';
import * as authLogout from './api/auth/logout';
import * as sitesId from './api/sites/[id]';
import * as sitesIndex from './api/sites/index';
import * as workspacesId from './api/workspaces/[id]';
import * as workspacesIndex from './api/workspaces/index';

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path.startsWith('/api/')) {
    if (path === '/api/auth/login' && method === 'GET')
      return authLogin.onRequestGet({ request, env });
    if (path === '/api/auth/callback' && method === 'GET')
      return authCallback.onRequestGet({ request, env });
    if (path === '/api/auth/callback' && method === 'POST')
      return authCallback.onRequestPost({ request, env });
    if (path === '/api/auth/logout' && (method === 'POST' || method === 'GET'))
      return authLogout.onRequestPost({ request, env });

    if (path === '/api/health' && method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (path === '/api/workspaces' && method === 'GET')
      return workspacesIndex.onRequest({ request, env });
    if (path === '/api/workspaces' && method === 'POST')
      return workspacesIndex.onRequest({ request, env });
    const wsMatch = path.match(/^\/api\/workspaces\/([^/]+)$/);
    if (wsMatch) {
      return workspacesId.onRequest({ request, env, params: { id: wsMatch[1] ?? '' } });
    }

    if (path === '/api/sites' && method === 'GET') return sitesIndex.onRequest({ request, env });
    if (path === '/api/sites' && method === 'POST') return sitesIndex.onRequest({ request, env });
    const siteMatch = path.match(/^\/api\/sites\/([^/]+)$/);
    if (siteMatch) {
      return sitesId.onRequest({ request, env, params: { id: siteMatch[1] ?? '' } });
    }

    return new Response(JSON.stringify({ error: 'API route not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Not found', { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const result = await onRequest({
      request,
      env,
      next: async (modifiedRequest?: Request) => {
        return route(modifiedRequest ?? request, env);
      },
    });

    return result;
  },
};
