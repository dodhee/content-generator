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

  // Skip auth for:
  // - Static assets (handled by Astro)
  // - /api/auth/* routes (public)
  // - Health checks
  if (
    url.pathname.startsWith('/api/auth/') ||
    url.pathname === '/api/health' ||
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/favicon')
  ) {
    return next();
  }

  // Protect all /api/* routes
  if (url.pathname.startsWith('/api/')) {
    const sessionSecret = env.GITHUB_CLIENT_SECRET;
    if (!sessionSecret) {
      return new Response(JSON.stringify({ error: 'Auth not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await validateSession(request, env, sessionSecret);

    // If validateSession returns Response, it's an error (401)
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

    // Attach user and workspace to request headers for downstream handlers
    const newHeaders = new Headers(request.headers);
    newHeaders.set('X-User-Id', result.user.user_id);
    newHeaders.set('X-Workspace-Id', result.workspaceId);
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
