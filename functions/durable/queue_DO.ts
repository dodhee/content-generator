// functions/durable/queue_DO.ts
// Durable Object: Generation Queue

import type { Env } from '../../src/lib/server/db/index';

declare global {
  interface DurableObjectState {
    storage: DurableObjectStorage;
    waitUntil(promise: Promise<unknown>): void;
  }
  interface DurableObjectStorage {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<boolean>;
    list(): Promise<[string, unknown][]>;
  }
}

export class Queue {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/enqueue') {
      const body = await request.json();
      const { job_id, article_id, prompt } = body;

      await this.state.storage.put(`job:${job_id}`, {
        id: job_id,
        article_id,
        status: 'queued',
        prompt_data: JSON.stringify(prompt),
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
      });

      // Add to processing queue (simple list)
      const queue = (await this.state.storage.get<string[]>('queue:list')) || [];
      queue.push(job_id);
      await this.state.storage.put('queue:list', queue);

      // Trigger processing
      this.state.waitUntil(this.processQueue());

      return new Response(JSON.stringify({ job_id }), { status: 201 });
    }

    if (pathname === '/process') {
      await this.processQueue();
      return new Response('ok');
    }

    if (pathname.startsWith('/status/')) {
      const jobId = pathname.split('/')[2];
      const job = await this.state.storage.get(`job:${jobId}`);
      if (!job) {
        return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404 });
      }
      return new Response(JSON.stringify(job), { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  }

  async processQueue(): Promise<void> {
    const queue = (await this.state.storage.get<string[]>('queue:list')) || [];
    if (queue.length === 0) return;

    const jobId = queue[0];
    const job = await this.state.storage.get<{
      id: string;
      article_id: string;
      status: string;
      prompt_data: string;
      retry_count: number;
      max_retries: number;
      created_at: string;
      started_at?: string;
      completed_at?: string;
      error_message?: string;
      result_json?: string;
      model_name?: string;
    }>(`job:${jobId}`);

    if (!job || job.status !== 'queued') {
      // Remove stale job from queue
      queue.shift();
      await this.state.storage.put('queue:list', queue);
      return;
    }

    try {
      // Update job status to processing
      job.status = 'processing';
      job.started_at = new Date().toISOString();
      await this.state.storage.put(`job:${jobId}`, job);

      // Update article status in D1
      await this.env.DB.prepare(
        `UPDATE articles SET status = 'generating', updated_at = datetime('now') WHERE id = ?`,
      )
        .bind(job.article_id)
        .run();

      // Call AI generation
      const { generateOutline } = await import('../../src/lib/server/ai/router');
      const prompt = JSON.parse(job.prompt_data);
      const outline = await generateOutline(this.env, job.article_id, prompt);

      // Job completed successfully
      job.status = 'completed';
      job.result_json = JSON.stringify(outline);
      job.completed_at = new Date().toISOString();
      job.model_name = prompt.model_override || '9router-claude-writer';
      await this.state.storage.put(`job:${jobId}`, job);

      // Update article in D1 (already done in generateOutline, but ensure status)
      await this.env.DB.prepare(
        `UPDATE articles SET status = 'outline', outline_json = ?, updated_at = datetime('now') WHERE id = ?`,
      )
        .bind(JSON.stringify(outline), job.article_id)
        .run();

      // Record usage stats
      await this.env.DB.prepare(
        `INSERT INTO usage_stats (workspace_id, site_id, model_name, action, tokens_input, tokens_output, estimated_cost_usd, duration_ms, success, recorded_at)
         SELECT a.workspace_id, a.site_id, ?, 'generate', 0, 0, 0, 0, 1, datetime('now')
         FROM articles a WHERE a.id = ?`,
      )
        .bind(job.model_name, job.article_id)
        .run();
    } catch (err) {
      job.retry_count++;
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (job.retry_count >= job.max_retries) {
        job.status = 'failed';
        job.error_message = errorMessage;
        job.completed_at = new Date().toISOString();

        // Update article status to failed
        await this.env.DB.prepare(
          `UPDATE articles SET status = 'failed', updated_at = datetime('now') WHERE id = ?`,
        )
          .bind(job.article_id)
          .run();
      } else {
        job.status = 'queued'; // requeue for retry
      }
      await this.state.storage.put(`job:${jobId}`, job);
    } finally {
      // Remove from queue head and process next
      queue.shift();
      await this.state.storage.put('queue:list', queue);

      // Process next job if any
      if (queue.length > 0) {
        this.state.waitUntil(this.processQueue());
      }
    }
  }
}
