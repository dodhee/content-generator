// functions/api/auth/logout.ts
// Destroy session and clear cookie

import {
  createExpiredSessionCookie,
  deleteSessionFromKV,
  getSessionFromCookie,
} from '../../../src/lib/server/auth';

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const cookieHeader = request.headers.get('Cookie');
  const token = getSessionFromCookie(cookieHeader);

  if (token) {
    await deleteSessionFromKV(env.KV, token);
  }

  const isSecure = new URL(request.url).protocol === 'https:';
  const cookie = createExpiredSessionCookie(isSecure);

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${new URL(request.url).origin}/`,
      'Set-Cookie': cookie,
    },
  });
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  return onRequestPost(context);
}
