// functions/_worker.ts
// Cloudflare Pages Functions entry point

import { onRequest } from './_middleware';

import * as authCallback from './api/auth/callback';
// Import all API handlers
import * as authLogin from './api/auth/login';
import * as authLogout from './api/auth/logout';

// Router function
async function route(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // API routes
  if (path.startsWith('/api/')) {
    // Auth routes
    if (path === '/api/auth/login' && request.method === 'GET') {
      return authLogin.onRequestGet({ request, env });
    }
    if (path === '/api/auth/callback' && request.method === 'GET') {
      return authCallback.onRequestGet({ request, env });
    }
    if (path === '/api/auth/logout' && request.method === 'POST') {
      return authLogout.onRequestPost({ request, env });
    }

    // Health check (no auth required)
    if (path === '/api/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Protected routes will be handled by middleware + specific handlers
    return new Response(JSON.stringify({ error: 'API route not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Non-API routes: serve static assets (handled by Astro automatically)
  return new Response('Not found', { status: 404 });
}

// Export the fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Run middleware first
    const middlewareResult = await onRequest({
      request,
      env,
      next: async (modifiedRequest?: Request) => {
        return route(modifiedRequest || request, env, ctx);
      },
    });

    return middlewareResult;
  },
};

// Type definitions for Env
interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  QUEUE: DurableObjectNamespace;
  NINE_ROUTER_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  next(): Promise<Response>;
}
