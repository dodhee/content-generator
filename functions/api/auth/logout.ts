// functions/api/auth/logout.ts
// Destroy session and clear cookie

import {
  createExpiredSessionCookie,
  deleteSessionFromKV,
  getSessionFromCookie,
} from '../../../src/lib/server/auth';

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  // Extract session token from cookie
  const cookieHeader = request.headers.get('Cookie');
  const token = getSessionFromCookie(cookieHeader);

  // Delete session from KV if exists
  if (token) {
    await deleteSessionFromKV(env.KV, token);
  }

  // Clear cookie
  const isSecure = url.protocol === 'https:';
  const cookie = createExpiredSessionCookie(isSecure);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
}
