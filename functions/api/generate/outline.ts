// functions/api/generate/outline.ts
// POST /api/generate/outline — generate outline for article

import type { Env } from '../../../src/env';
import { generateOutline } from '../../../src/lib/server/ai/router';
import { validateSession } from '../../../src/lib/server/auth';
import { type GenerateRequest, generateRequestSchema } from '../../../src/types/generate';

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const method = request.method;

  const secret = env.GITHUB_CLIENT_SECRET ?? '';
  const sessionResult = await validateSession(request, env, secret);
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  if (method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body: GenerateRequest = await request.json();
    const data = generateRequestSchema.parse(body);

    // Verify article exists and belongs to workspace
    const articleRes = await env.DB.prepare('SELECT * FROM articles WHERE id = ?')
      .bind(data.article_id)
      .first<{ workspace_id: string; site_id: string; status: string }>();

    if (!articleRes || articleRes.workspace_id !== workspaceId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const validStatuses = ['draft', 'outline', 'review'];
    if (!validStatuses.includes(articleRes.status)) {
      return new Response(
        JSON.stringify({ error: `Cannot generate: article status is ${articleRes.status}` }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Generate outline using existing router function
    const outline = await generateOutline(env, data.article_id, data);

    return new Response(JSON.stringify({ outline }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
