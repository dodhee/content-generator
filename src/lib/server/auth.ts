// src/lib/server/auth.ts
// Session management utilities for GitHub OAuth

export interface SessionData {
  workspace_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  avatar_url: string;
  created_at: string;
  expires_at: string;
}

export interface ValidatedSession {
  user: SessionData;
  workspaceId: string;
}

const COOKIE_NAME = 'cg_session';
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const HMAC_ALGO = 'HMAC';
const HMAC_HASH = 'SHA-256';

/**
 * Get or create a workspace for a GitHub user
 */
export async function getOrCreateWorkspace(
  env: { DB: D1Database; KV: KVNamespace },
  githubId: string,
  githubLogin: string,
): Promise<string> {
  const workspaceId = `ws_${githubId}`;

  const existing = await env.DB.prepare('SELECT id FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first<{ id: string }>();

  if (existing) {
    return existing.id;
  }

  await env.DB.prepare(
    'INSERT INTO workspaces (id, name, description, default_lang, timezone) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(workspaceId, `${githubLogin}'s workspace`, null, 'id', 'Asia/Jakarta')
    .run();

  return workspaceId;
}

/**
 * Sign session data with HMAC
 */
export async function signSession(data: SessionData, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: HMAC_HASH },
    false,
    ['sign'],
  );

  const payload = JSON.stringify(data);
  const signature = await crypto.subtle.sign(HMAC_ALGO, key, encoder.encode(payload));
  const sigArray = Array.from(new Uint8Array(signature));
  const sigBase64 = btoa(String.fromCharCode(...sigArray));

  const payloadB64 = btoa(payload);
  return `${payloadB64}.${sigBase64}`;
}

/**
 * Verify session token and return session data
 */
export async function verifySession(token: string, secret: string): Promise<SessionData | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const payloadB64 = parts[0];
    const sigBase64 = parts[1];
    if (!payloadB64 || !sigBase64) return null;

    const payloadStr = atob(payloadB64);
    const payload = JSON.parse(payloadStr) as SessionData;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: HMAC_HASH },
      false,
      ['sign'],
    );

    const expectedSig = await crypto.subtle.sign(HMAC_ALGO, key, encoder.encode(payloadStr));
    const expectedArray = Array.from(new Uint8Array(expectedSig));
    const expectedBase64 = btoa(String.fromCharCode(...expectedArray));

    // Constant-time comparison
    if (sigBase64.length !== expectedBase64.length) return null;
    let diff = 0;
    for (let i = 0; i < sigBase64.length; i++) {
      diff |= sigBase64.charCodeAt(i) ^ expectedBase64.charCodeAt(i);
    }
    if (diff !== 0) return null;

    if (new Date(payload.expires_at) < new Date()) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Create Set-Cookie header for session
 */
export function createSessionCookie(token: string, isSecure: boolean): string {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}

/**
 * Create expired session cookie (for logout)
 */
export function createExpiredSessionCookie(isSecure: boolean): string {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}

/**
 * Extract session token from cookie header
 */
export function getSessionFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? (match[1] ?? null) : null;
}

/**
 * Store session in KV
 */
export async function storeSessionInKV(
  kv: KVNamespace,
  token: string,
  data: SessionData,
): Promise<void> {
  await kv.put(`session:${token}`, JSON.stringify(data), { expirationTtl: SESSION_TTL_SECONDS });
}

/**
 * Delete session from KV
 */
export async function deleteSessionFromKV(kv: KVNamespace, token: string): Promise<void> {
  await kv.delete(`session:${token}`);
}

/**
 * Validate session from request cookie
 */
export async function validateSession(
  request: Request,
  _env: { DB: D1Database; KV: KVNamespace },
  secret: string,
): Promise<ValidatedSession | Response> {
  const cookieHeader = request.headers.get('Cookie');
  const token = getSessionFromCookie(cookieHeader);

  if (!token) {
    return new Response(
      JSON.stringify({
        error: 'Authentication required',
        redirect_to: '/api/auth/login',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const session = await verifySession(token, secret);
  if (!session) {
    return new Response(
      JSON.stringify({
        error: 'Session expired or invalid',
        redirect_to: '/api/auth/login',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return { user: session, workspaceId: session.workspace_id };
}
