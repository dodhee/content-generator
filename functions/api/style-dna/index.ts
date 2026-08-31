// functions/api/style-dna/index.ts
// Style DNA analysis API: POST /analyze, GET /status, POST /reanalyze

import type { Env } from '../../../src/env';
import { analyzeSiteStyle, saveStyleDNA } from '../../../src/lib/server/ai/style-dna';
import { validateSession } from '../../../src/lib/server/auth';

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const method = request.method;
  const url = new URL(request.url);
  const siteId = url.searchParams.get('site_id');

  const secret = env.GITHUB_CLIENT_SECRET ?? '';
  const sessionResult = await validateSession(request, env, secret);
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  if (!siteId) {
    return new Response(JSON.stringify({ error: 'site_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify site belongs to workspace
  const siteRes = await env.DB.prepare('SELECT * FROM sites WHERE id = ? AND workspace_id = ?')
    .bind(siteId, workspaceId)
    .first<{ id: string; wp_style_dna: string | null }>();

  if (!siteRes) {
    return new Response(JSON.stringify({ error: 'Site not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    if (method === 'POST' && url.pathname.endsWith('/analyze')) {
      // Trigger analysis
      const result = await analyzeSiteStyle(env, siteId, 150);
      await saveStyleDNA(env, siteId, result);

      return new Response(JSON.stringify({ success: true, result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'POST' && url.pathname.endsWith('/reanalyze')) {
      // Force re-analysis (same as analyze)
      const result = await analyzeSiteStyle(env, siteId, 150);
      await saveStyleDNA(env, siteId, result);

      return new Response(JSON.stringify({ success: true, result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'GET') {
      // Get current status
      const hasDNA = !!siteRes.wp_style_dna;
      let parsed: {
        examples: unknown[];
        patterns: unknown;
        analyzedAt: string;
        postCount: number;
      } | null = null;

      if (hasDNA) {
        try {
          parsed = JSON.parse(siteRes.wp_style_dna);
        } catch {
          parsed = null;
        }
      }

      return new Response(
        JSON.stringify({
          site_id: siteId,
          has_dna: hasDNA,
          dna: parsed,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
