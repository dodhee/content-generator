// functions/api/auth/login.ts
// Initiate GitHub OAuth flow

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  // GitHub OAuth configuration
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response('GitHub Client ID not configured', { status: 500 });
  }
  const redirectUri = `${url.origin}/api/auth/callback`;
  const scope = 'read:user user:email';
  const state = crypto.randomUUID();

  // Store state in KV for CSRF protection (5 min expiry)
  await env.KV.put(`oauth_state:${state}`, redirectUri, { expirationTtl: 300 });

  // Build GitHub authorization URL
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('allow_signup', 'false');

  return Response.redirect(authUrl.toString(), 302);
}
