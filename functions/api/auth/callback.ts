// functions/api/auth/callback.ts
// Handle GitHub OAuth callback - exchange code for token, fetch user, create session

import { z } from 'zod';
import type { Env } from '../../../src/env';
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

  const params = Object.fromEntries(url.searchParams);
  const parsed = CallbackSchema.safeParse(params);
  if (!parsed.success) {
    return new Response('Invalid callback parameters', { status: 400 });
  }
  const { code, state } = parsed.data;

  const storedRedirect = await env.KV.get(`oauth_state:${state}`);
  if (!storedRedirect) {
    return new Response('Invalid or expired state parameter', { status: 400 });
  }
  await env.KV.delete(`oauth_state:${state}`);

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

  const tokenText = await tokenResponse.text();
  let tokenData: { access_token?: string; error?: string };
  try {
    tokenData = JSON.parse(tokenText);
  } catch {
    const contentType = tokenResponse.headers.get('content-type') || 'unknown';
    console.error('Token exchange failed - invalid JSON:', {
      status: tokenResponse.status,
      contentType,
      bodyPreview: tokenText.slice(0, 200),
    });
    return new Response(
      JSON.stringify({
        error: 'Token exchange failed',
        upstream_status: tokenResponse.status,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!tokenResponse.ok || !tokenData.access_token) {
    const contentType = tokenResponse.headers.get('content-type') || 'unknown';
    console.error('Token exchange failed:', {
      status: tokenResponse.status,
      contentType,
      body: tokenText,
    });
    return new Response(
      JSON.stringify({
        error: 'Token exchange failed',
        upstream_status: tokenResponse.status,
        upstream_body: tokenText,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `token ${tokenData.access_token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!userResponse.ok) {
    const userErrorText = await userResponse.text();
    console.error('GitHub /user API failed:', {
      status: userResponse.status,
      body: userErrorText,
    });
    return new Response(
      JSON.stringify({
        error: 'Upstream GitHub API error',
        upstream_status: userResponse.status,
        upstream_body: userErrorText,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const userText = await userResponse.text();
  let user: {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
  };
  try {
    user = JSON.parse(userText);
  } catch {
    console.error('GitHub /user API returned invalid JSON:', {
      bodyPreview: userText.slice(0, 200),
    });
    return new Response(
      JSON.stringify({
        error: 'Upstream GitHub API error',
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let userEmail: string | null = user.email ?? null;
  if (!userEmail) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `token ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!emailsResponse.ok) {
      const emailsErrorText = await emailsResponse.text();
      console.error('GitHub /user/emails API failed:', {
        status: emailsResponse.status,
        body: emailsErrorText,
      });
      return new Response(
        JSON.stringify({
          error: 'Upstream GitHub API error',
          upstream_status: emailsResponse.status,
          upstream_body: emailsErrorText,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const emailsText = await emailsResponse.text();
    let emails: Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    try {
      emails = JSON.parse(emailsText);
    } catch {
      console.error('GitHub /user/emails API returned invalid JSON:', {
        bodyPreview: emailsText.slice(0, 200),
      });
      return new Response(
        JSON.stringify({
          error: 'Upstream GitHub API error',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const primaryEmail = emails.find((e) => e.primary && e.verified);
    userEmail = primaryEmail?.email ?? null;
  }

  const workspaceId = await getOrCreateWorkspace(env, user.id.toString(), user.login);

  const sessionData = {
    workspace_id: workspaceId,
    user_id: user.id.toString(),
    user_name: user.login,
    user_email: userEmail ?? `${user.login}@users.noreply.github.com`,
    avatar_url: user.avatar_url,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  const token = await signSession(sessionData, clientSecret);
  await storeSessionInKV(env.KV, token, sessionData);

  const isSecure = url.protocol === 'https:';
  const cookie = createSessionCookie(token, isSecure);

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${url.origin}/`,
      'Set-Cookie': cookie,
    },
  });
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  return onRequestGet(context);
}
