// functions/api/opportunity/queue.ts
// POST /api/opportunity/queue — queue 5 articles from radar opportunities

import type { Env } from '../../../src/env';
import type { ArticleRow } from '../../../src/lib/server/articles';
import { createArticle } from '../../../src/lib/server/articles';
import { logAudit } from '../../../src/lib/server/audit';
import { validateSession } from '../../../src/lib/server/auth';

interface QueueRequest {
  siteId: string;
  opportunities: Array<{
    keyword: string;
    searchIntent: string;
    suggestedAngle: string;
    outlinePreview: string;
  }>;
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;

  const secret = env.GITHUB_CLIENT_SECRET ?? '';
  const sessionResult = await validateSession(request, env, secret);
  if (sessionResult instanceof Response) return sessionResult;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = (await request.json()) as QueueRequest;
    const { siteId, opportunities } = body;

    if (!siteId) {
      return new Response(JSON.stringify({ error: 'siteId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const session = sessionResult;
    const workspaceId = session.user.workspace_id;

    // Verify site belongs to workspace
    const site = await env.DB.prepare('SELECT * FROM sites WHERE id = ?')
      .bind(siteId)
      .first<{ workspace_id: string }>();

    if (!site || site.workspace_id !== workspaceId) {
      return new Response(JSON.stringify({ error: 'Site not found or forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Take top 5, or fewer if less provided
    const batch = opportunities.slice(0, 5);
    const created: ArticleRow[] = [];

    for (const opp of batch) {
      const article = await createArticle(env.DB, {
        workspace_id: workspaceId,
        site_id: siteId,
        title: opp.suggestedAngle,
        intent: opp.searchIntent as 'informational' | 'commercial' | 'transactional',
        niche: opp.keyword,
        tone_preset: 'professional',
      });

      // Schedule for future: spread over next 5 weekdays
      const scheduleDate = nextWeekday(created.length + 1);
      await env.DB.prepare(
        `UPDATE articles SET scheduled_for = ?, status = 'queued', updated_at = datetime('now') WHERE id = ?`,
      )
        .bind(scheduleDate, article.id)
        .run();

      // Enqueue to generation queue
      const jobId = `job_${crypto.randomUUID()}`;
      await env.DB.prepare(
        `INSERT INTO generation_queue (id, article_id, status, prompt_data, retry_count, max_retries, created_at)
         VALUES (?, ?, 'queued', ?, 0, 3, datetime('now'))`,
      )
        .bind(
          jobId,
          article.id,
          JSON.stringify({ article_id: article.id, topic: opp.keyword, intent: opp.searchIntent }),
        )
        .run();

      const queueId = env.QUEUE.idFromName('generation-queue');
      const queueStub = env.QUEUE.get(queueId) as unknown as {
        fetch: (url: string, options: RequestInit) => Promise<Response>;
      };
      await queueStub.fetch('http://do/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          article_id: article.id,
          prompt: { article_id: article.id, topic: opp.keyword },
        }),
      });

      // Re-fetch with updated status
      const updated = await env.DB.prepare('SELECT * FROM articles WHERE id = ?')
        .bind(article.id)
        .first<ArticleRow>();
      if (updated) created.push(updated);
    }

    await logAudit(env.DB, {
      workspaceId,
      siteId,
      action: 'radar_queue',
      details: { count: batch.length, opportunities: batch.map((o) => o.keyword) },
    });

    return new Response(JSON.stringify({ queued: created.length, articles: created }), {
      status: 201,
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

function nextWeekday(offset: number): string {
  const d = new Date();
  let added = 0;
  while (added < offset) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.toISOString().split('T')[0] as string;
}
