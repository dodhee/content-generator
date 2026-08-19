// src/lib/server/auth.ts
// Session management utilities for GitHub OAuth

// Session payload stored in KV
export interface SessionData {
  workspace_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  avatar_url: string;
  created_at: string;
  expires_at: string;
}

// Cookie options
const COOKIE_NAME = 'cg_session';
const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const HMAC_ALGO = 'SHA-256';

/**
 * Sign a session token with HMAC-SHA256
 */
export async function signSession(data: SessionData, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: HMAC_ALGO },
    false,
    ['sign', 'verify'],
  );

  const payload = JSON.stringify(data);
  const signature = await crypto.subtle.sign(HMAC_ALGO, key, encoder.encode(payload));
  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${btoa(payload)}.${sigBase64}`;
}

/**
 * Verify and decode a session token
 */
export async function verifySession(token: string, secret: string): Promise<SessionData | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const payloadB64 = parts[0];
    const sigBase64 = parts[1];
    if (!payloadB64 || !sigBase64) return null;

    const payload = JSON.parse(atob(payloadB64)) as SessionData;
    const expectedSig = await signSession(payload, secret);
    const expectedParts = expectedSig.split('.');
    if (expectedParts.length !== 2) return null;
    const expectedSigB64 = expectedParts[1];
    if (!expectedSigB64) return null;

    // Constant-time comparison
    if (sigBase64.length !== expectedSigB64.length) return null;
    let diff = 0;
    for (let i = 0; i < sigBase64.length; i++) {
      diff |= sigBase64.charCodeAt(i) ^ expectedSigB64.charCodeAt(i);
    }
    if (diff !== 0) return null;

    // Check expiry
    if (new Date(payload.expires_at) < new Date()) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Create session cookie string
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
 * Get session from KV (with caching hint)
 */
export async function getSessionFromKV(
  kv: KVNamespace,
  token: string,
  secret: string,
): Promise<SessionData | null> {
  // First verify HMAC signature
  const payload = await verifySession(token, secret);
  if (!payload) return null;

  // Then check KV for revocation/expiry
  const stored = (await kv.get(`session:${token}`)) as SessionData | null;
  if (!stored) return null;

  // Verify stored data matches payload
  if (stored.workspace_id !== payload.workspace_id) return null;
  if (new Date(stored.expires_at) < new Date()) {
    await kv.delete(`session:${token}`);
    return null;
  }

  return stored;
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
 * Get or create workspace for user (on first login)
 */
export async function getOrCreateWorkspace(
  env: { DB: D1Database; KV: KVNamespace },
  userId: string,
  userName: string,
): Promise<string> {
  // Check if user already has workspace
  const existing = await env.DB.prepare('SELECT id FROM workspaces WHERE id = ?')
    .bind(`ws_${userId}`)
    .first();

  if (existing) return `ws_${userId}`;

  // Create new workspace
  const workspaceId = `ws_${userId}`;
  await env.DB.prepare(`
    INSERT INTO workspaces (id, name, description, default_lang, timezone)
    VALUES (?, ?, ?, 'id', 'Asia/Jakarta')
  `)
    .bind(workspaceId, `${userName}'s Workspace`, 'Auto-created on first login')
    .run();

  return workspaceId;
}

/**
 * Validate session and attach to request
 */
export async function validateSession(
  request: Request,
  env: { DB: D1Database; KV: KVNamespace },
  secret: string,
): Promise<{ user: SessionData; workspaceId: string } | Response> {
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

  const session = await getSessionFromKV(env.KV, token, secret);
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
