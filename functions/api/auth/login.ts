// functions/api/auth/login.ts
// Initiate GitHub OAuth flow

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { env } = context;
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response('GitHub Client ID not configured', { status: 500 });
  }

  const state = crypto.randomUUID();
  const redirectUri = 'https://apps.codevx.web.id/api/auth/callback';

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'repo,user:email');

  await env.KV.put(`oauth_state:${state}`, state, { expirationTtl: 600 });

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
    },
  });
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  return onRequestGet(context);
}
