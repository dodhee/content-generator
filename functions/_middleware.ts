// functions/_middleware.ts
// Auth middleware - protects all /api/* routes except /api/auth/*

import { validateSession } from '../src/lib/server/auth';

export async function onRequest(context: {
  request: Request;
  env: Env;
  next: (request?: Request) => Promise<Response>;
}): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (
    url.pathname.startsWith('/api/auth/') ||
    url.pathname === '/api/health' ||
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/favicon')
  ) {
    return next();
  }

  if (url.pathname.startsWith('/api/')) {
    const sessionSecret = env.GITHUB_CLIENT_SECRET;
    if (!sessionSecret) {
      return new Response(JSON.stringify({ error: 'Auth not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await validateSession(request, env, sessionSecret);

    if (result instanceof Response) {
      const errorResponse = new Response(result.body, {
        status: result.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': url.origin,
          'Access-Control-Allow-Credentials': 'true',
        },
      });
      return errorResponse;
    }

    const newHeaders = new Headers(request.headers);
    newHeaders.set('X-User-Id', result.user.user_id);
    newHeaders.set('X-Workspace-Id', result.user.workspace_id);
    newHeaders.set('X-User-Name', result.user.user_name);

    const modifiedRequest = new Request(request, {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      redirect: request.redirect,
    });

    return next(modifiedRequest);
  }

  return next();
}
