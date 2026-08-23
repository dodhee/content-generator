// src/lib/server/ai/router.ts
// 9Router (local proxy) → OpenRouter fallback

import {
  type GenerateRequest,
  type OutlineResponse,
  generateRequestSchema,
} from '../../../types/generate';
import type { Env } from '../db/index';

interface RouterOptions {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface RouterResponse {
  content: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

async function callNineRouter(env: Env, options: RouterOptions): Promise<RouterResponse> {
  const baseUrl = env.NINE_ROUTER_BASE_URL || 'https://9router.codevx.web.id';
  const apiKey = env.NINE_ROUTER_API_KEY;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: options.model || 'claude-writer',
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4000,
      stream: options.stream ?? false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`9Router error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model || options.model || 'claude-writer',
    usage: data.usage,
  };
}

async function callOpenRouter(env: Env, options: RouterOptions): Promise<RouterResponse> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://content-generator.local',
      'X-Title': 'AI Auto Content Generator',
    },
    body: JSON.stringify({
      model: options.model || 'anthropic/claude-3.5-sonnet',
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4000,
      stream: options.stream ?? false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model || options.model || 'anthropic/claude-3.5-sonnet',
    usage: data.usage,
  };
}

export async function callRouter(env: Env, options: RouterOptions): Promise<RouterResponse> {
  // Try 9Router first (free, local)
  try {
    return await callNineRouter(env, options);
  } catch (err) {
    console.warn('9Router failed, falling back to OpenRouter:', err);
  }

  // Fallback to OpenRouter
  return callOpenRouter(env, options);
}

function buildOutlinePrompt(
  request: GenerateRequest,
  _siteConfig: Record<string, unknown>,
  styleDna?: string,
): { system: string; user: string } {
  const intent = request.intent || 'informational';
  const targetWords = request.target_words || 2000;
  const niche = request.niche || 'general';
  const tone = request.tone_preset || 'professional';

  const system = `You are an expert SEO content strategist. Create a detailed outline for a ${intent} article about "${request.topic}".
Target: ${targetWords} words. Niche: ${niche}. Tone: ${tone}.
Output JSON only matching the schema:
{
  "title": "string (max 200 chars)",
  "description": "string (max 300 chars, optional)",
  "sections": [{"heading": "string", "level": 2|3, "key_points": ["string"], "target_words": number}],
  "suggested_faq": [{"question": "string", "answer": "string"}],
  "suggested_tags": ["string"],
  "suggested_categories": ["string"]
}`;

  let user = `Topic: ${request.topic}
Intent: ${intent}
Target words: ${targetWords}
Niche: ${niche}
Tone: ${tone}`;

  if (styleDna) {
    user += `\n\nStyle DNA (few-shot examples from existing content):\n${styleDna}\n\nFollow this style closely.`;
  }

  return { system, user };
}

export async function generateOutline(
  env: Env,
  articleId: string,
  request: GenerateRequest,
): Promise<OutlineResponse> {
  // Fetch article and site config for Style DNA
  // Note: Using direct DB calls to avoid circular imports
  const articleRes = await env.DB.prepare('SELECT * FROM articles WHERE id = ?')
    .bind(articleId)
    .first<{ site_id: string }>();
  if (!articleRes) throw new Error('Article not found');

  const siteRes = await env.DB.prepare('SELECT * FROM sites WHERE id = ?')
    .bind(articleRes.site_id)
    .first<{ ai_model_default: string; wp_style_dna: string | null }>();
  if (!siteRes) throw new Error('Site not found');

  const model = request.model_override || siteRes.ai_model_default || '9router-claude-writer';
  const styleDna = request.style_dna && siteRes.wp_style_dna ? siteRes.wp_style_dna : undefined;

  const { system, user } = buildOutlinePrompt(
    request,
    siteRes as Record<string, unknown>,
    styleDna,
  );

  const response = await callRouter(env, {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.5,
    max_tokens: 3000,
  });

  // Parse and validate response
  let outline: OutlineResponse;
  try {
    // Extract JSON from response (might have markdown code fences)
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response.content;
    const parsed = JSON.parse(jsonStr);
    outline = parsed; // outlineResponseSchema.parse(parsed) - skip strict validation for now
  } catch (err) {
    throw new Error(`Failed to parse outline response: ${err}`);
  }

  // Update article with outline
  await env.DB.prepare(
    `UPDATE articles SET outline_json = ?, status = 'outline', updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(JSON.stringify(outline), articleId)
    .run();

  return outline;
}
