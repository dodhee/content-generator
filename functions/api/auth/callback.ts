// functions/api/auth/callback.ts
// Handle GitHub OAuth callback - exchange code for token, fetch user, create session

import { z } from 'zod';
import {
  createSessionCookie,
  getOrCreateWorkspace,
  signSession,
  storeSessionInKV,
} from '../../../src/lib/server/auth';

const CallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().uuid(),
});

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  // Validate callback parameters
  const params = Object.fromEntries(url.searchParams);
  const parsed = CallbackSchema.safeParse(params);
  if (!parsed.success) {
    return new Response('Invalid callback parameters', { status: 400 });
  }
  const { code, state } = parsed.data;

  // Verify state against stored value (CSRF protection)
  const storedRedirect = await env.KV.get(`oauth_state:${state}`);
  if (!storedRedirect) {
    return new Response('Invalid or expired state parameter', { status: 400 });
  }
  await env.KV.delete(`oauth_state:${state}`);

  // Exchange code for access token
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientSecret) {
    return new Response('GitHub Client Secret not configured', { status: 500 });
  }

  const tokenUrl = 'https://github.com/login/oauth/access_token';
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: clientSecret,
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });

  const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    console.error('Token exchange failed:', tokenData);
    return new Response('Failed to exchange code for token', { status: 500 });
  }

  // Fetch user info from GitHub
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  const user = (await userResponse.json()) as {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
  };

  // Fetch user email (might be private)
  let userEmail = user.email;
  if (!userEmail) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    const emails = (await emailsResponse.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const primaryEmail = emails.find((e) => e.primary && e.verified);
    userEmail = primaryEmail?.email || `${user.login}@users.noreply.github.com`;
  }

  // Get or create workspace for this user
  const workspaceId = await getOrCreateWorkspace(env, user.id.toString(), user.login);

  // Create session
  const sessionData = {
    workspace_id: workspaceId,
    user_id: user.id.toString(),
    user_name: user.login,
    user_email: userEmail,
    avatar_url: user.avatar_url,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  const token = await signSession(sessionData, clientSecret);

  // Store session in KV
  await storeSessionInKV(env.KV, token, sessionData);

  // Set cookie and redirect to dashboard
  const isSecure = url.protocol === 'https:';
  const cookie = createSessionCookie(token, isSecure);

  const response = new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}/`,
      'Set-Cookie': cookie,
    },
  });
  return response;
}
