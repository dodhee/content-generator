// functions/api/generate/section.ts
// POST /api/generate/section — generate single section content (streaming)

import type { Env } from '../../../src/env';
import { recordUsage, resolveModel } from '../../../src/lib/server/ai/router';
import { validateSession } from '../../../src/lib/server/auth';

interface SectionGenerateRequest {
  article_id: string;
  section_id: string;
  heading: string;
  level: 2 | 3;
  outline: {
    title: string;
    description?: string;
    sections: Array<{ heading: string; level: number; key_points: string[]; target_words: number }>;
    suggested_tags?: string[];
    suggested_categories?: string[];
  };
  model_override?: string;
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const method = request.method;

  const sessionResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET ?? '');
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  if (method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body: SectionGenerateRequest = await request.json();
    const { article_id, section_id, heading, level, outline, model_override } = body;

    // Verify article belongs to workspace
    const articleRes = await env.DB.prepare('SELECT * FROM articles WHERE id = ?')
      .bind(article_id)
      .first<{ workspace_id: string; site_id: string; intent: string }>();

    if (!articleRes || articleRes.workspace_id !== workspaceId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get site config for model + style DNA
    const siteRes = await env.DB.prepare('SELECT * FROM sites WHERE id = ?')
      .bind(articleRes.site_id)
      .first<{ ai_model_default: string; wp_style_dna: string | null }>();

    const model = resolveModel(model_override, articleRes.intent, siteRes?.ai_model_default);
    const styleDna = siteRes?.wp_style_dna;

    // Build section generation prompt
    const contextSections = outline.sections
      .filter((s) => s.id !== section_id)
      .map((s) => `${'#'.repeat(s.level)} ${s.heading}: ${s.key_points.join(', ')}`)
      .join('\n\n');

    const system = `You are an expert SEO content writer. Write a single section for an article.
Context: The full article outline is provided. Write ONLY the requested section.
Heading: ${heading} (Level ${level})
Target words: ~${Math.max(200, Math.floor(outline.sections.find((s) => s.id === section_id)?.target_words || 500))}
Style: Professional, informative, SEO-optimized.
${styleDna ? `\nStyle DNA (follow closely):\n${styleDna}` : ''}

Other sections context:
${contextSections}

Write the section content in markdown format. Do NOT include the heading in your output - just the body content.`;

    const user = `Write the section: "${heading}"`;

    // Stream the response
    const baseUrl = env.NINE_ROUTER_BASE_URL || 'https://9router.codevx.web.id';
    const apiKey = env.NINE_ROUTER_API_KEY;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const start = Date.now();
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`9Router error: ${response.status} - ${error}`);
    }

    // Record usage when the stream finishes (tokens unavailable from raw SSE passthrough)
    const responseBody = response.body;
    if (!responseBody) throw new Error('Empty stream response');
    const reader = responseBody.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          await recordUsage(env, {
            workspaceId: articleRes.workspace_id,
            siteId: articleRes.site_id,
            articleId: article_id,
            model,
            action: 'generate_section',
            durationMs: Date.now() - start,
            success: true,
          });
          return;
        }
        controller.enqueue(value);
      },
      cancel() {
        reader.cancel();
      },
    });

    // Return streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
