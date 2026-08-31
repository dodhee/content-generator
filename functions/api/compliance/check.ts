// functions/api/compliance/check.ts
// POST /api/compliance/check — run compliance checks on article

import { z } from 'zod';
import { getArticleById } from '../../../src/lib/server/articles';
import { validateSession } from '../../../src/lib/server/auth';
import { runComplianceChecks } from '../../../src/lib/server/compliance/index';

const checkSchema = z.object({
  article_id: z.string().min(1),
});

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const env: Env = context.env;
  const request = context.request;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const sessionResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET ?? '');
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  try {
    const body = await request.json();
    const data = checkSchema.parse(body);

    const article = await getArticleById(env.DB, data.article_id);
    if (!article) {
      return new Response(JSON.stringify({ error: 'Article not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (article.workspace_id !== workspaceId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const content = article.content_md ?? '';
    if (!content) {
      return new Response(JSON.stringify({ error: 'Article has no content yet' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await runComplianceChecks(article.id, article.site_id, content, env, request);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
