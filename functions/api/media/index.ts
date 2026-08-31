// functions/api/media/index.ts
// Media API: POST /generate, POST /upload, GET /list

import type { Env } from '../../../src/env';
import { generateImage, listImages, uploadImage } from '../../../src/lib/server/ai/image';
import { validateSession } from '../../../src/lib/server/auth';

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const method = request.method;
  const url = new URL(request.url);

  const secret = env.GITHUB_CLIENT_SECRET ?? '';
  const sessionResult = await validateSession(request, env, secret);
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  try {
    if (method === 'POST' && url.pathname.endsWith('/generate')) {
      // Generate AI image
      const body = await request.json();
      const { prompt, article_id, topic, width, height, model } = body;

      if (!prompt || typeof prompt !== 'string') {
        return new Response(JSON.stringify({ error: 'prompt required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const result = await generateImage(env, workspaceId, {
        prompt,
        articleId: article_id,
        topic,
        width,
        height,
        model,
      });

      return new Response(JSON.stringify({ image: result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'POST' && url.pathname.endsWith('/upload')) {
      // Upload file to R2
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const articleId = formData.get('article_id') as string | null;

      if (!file) {
        return new Response(JSON.stringify({ error: 'file required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        return new Response(JSON.stringify({ error: 'File must be an image' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Limit file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'File too large (max 10MB)' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const result = await uploadImage(env, workspaceId, articleId || undefined, file);

      return new Response(JSON.stringify({ image: result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'GET') {
      // List images
      const articleId = url.searchParams.get('article_id') || undefined;
      const limit = Number.parseInt(url.searchParams.get('limit') || '50', 10);

      const images = await listImages(env, workspaceId, articleId, limit);

      return new Response(JSON.stringify({ images }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Media API error:', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
