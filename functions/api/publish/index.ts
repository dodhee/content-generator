// functions/api/publish/index.ts
// POST /api/publish — enqueue publish job (or dispatch direct for Blogger)
// GET /api/publish/queue — list publish queue items

import { getArticleById } from '../../../src/lib/server/articles';
import { validateSession } from '../../../src/lib/server/auth';
import { publishArticle as publishToAstro } from '../../../src/lib/server/cms/astro';
import { publishArticle as publishToBlogger } from '../../../src/lib/server/cms/blogger';
import { getSiteById } from '../../../src/lib/server/sites';
import { type PublishRequest, publishRequestSchema } from '../../../src/types/publish';

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const env: Env = context.env;
  const request = context.request;
  const method = request.method;

  const sessionResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET ?? '');
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  if (method === 'POST') {
    try {
      const body = await request.json();
      const data = publishRequestSchema.parse(body);

      // Verify article exists and belongs to workspace
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

      // Check if article can be published
      const validStatuses = ['ready', 'scheduled'];
      if (!validStatuses.includes(article.status)) {
        return new Response(
          JSON.stringify({ error: `Cannot publish: article status is ${article.status}` }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const siteId = data.site_id || article.site_id;
      const scheduledFor = article.scheduled_for;

      if (scheduledFor && new Date(scheduledFor) > new Date()) {
        // Already scheduled, just return
        return new Response(JSON.stringify({ job_id: article.id, status: 'scheduled' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Blogger publishes synchronously (token refresh + API call)
      const site = await getSiteById(env.DB, siteId);

      // Optional quality gates (enabled per-site via config_json.quality_gates)
      if (site?.config_json) {
        const siteCfg = JSON.parse(site.config_json) as Record<string, unknown>;
        const qg = (siteCfg.quality_gates ?? {}) as Record<string, unknown>;
        if (qg.enabled === true) {
          const { runQualityGates } = await import('../../../src/lib/server/quality/index');
          const content = article.content_md ?? '';
          const gatesResult = await runQualityGates(article.id, siteId, content, env, {
            skipPlagiarism: qg.skip_plagiarism === true,
            skipAiDetection: qg.skip_ai_detection === true,
            skipReadability: qg.skip_readability === true,
            skipFactCheck: qg.skip_fact_check === true,
            skipBrandSafety: qg.skip_brand_safety === true,
            plagiarismThreshold:
              typeof qg.plagiarism_threshold === 'number' ? qg.plagiarism_threshold : undefined,
            readabilityLang: qg.readability_lang === 'id' ? 'id' : 'en',
            readabilityNiche:
              typeof qg.readability_niche === 'string' ? qg.readability_niche : undefined,
          });
          if (!gatesResult.passed) {
            return new Response(
              JSON.stringify({
                error: 'Quality gates failed',
                quality: gatesResult,
              }),
              {
                status: 422,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }
        }

        // Optional compliance injections (enabled per-site via config_json.compliance)
        const complianceCfg = (siteCfg.compliance ?? {}) as Record<string, unknown>;
        if (complianceCfg.enabled === true) {
          const { runComplianceChecks } = await import('../../../src/lib/server/compliance/index');
          const content = article.content_md ?? '';
          const complianceResult = await runComplianceChecks(article.id, siteId, content, env);
          if (complianceResult.content !== content) {
            article.content_md = complianceResult.content;
            await env.DB.prepare(
              `UPDATE articles SET content_md = ?, updated_at = datetime('now') WHERE id = ?`,
            )
              .bind(complianceResult.content, article.id)
              .run();
          }
        }
      }

      if (site?.type === 'blogger') {
        if (!site.config_json) {
          return new Response(JSON.stringify({ error: 'Invalid Blogger site configuration' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const config = JSON.parse(site.config_json) as Record<string, unknown>;

        const result = await publishToBlogger(article, {
          blogger_blog_id: String(config.blogger_blog_id ?? ''),
          blogger_refresh_token: String(config.blogger_refresh_token ?? ''),
          google_client_id: env.GOOGLE_CLIENT_ID ?? '',
          google_client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
        });

        if (!result.success) {
          await env.DB.prepare(
            `UPDATE articles SET status = 'failed', publish_error = ?, updated_at = datetime('now') WHERE id = ?`,
          )
            .bind(result.error ?? 'Unknown error', article.id)
            .run();

          return new Response(JSON.stringify({ success: false, error: result.error }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        await env.DB.prepare(
          `UPDATE articles SET status = 'published', published_url = ?, published_at = datetime('now'), publish_error = NULL, updated_at = datetime('now') WHERE id = ?`,
        )
          .bind(result.url ?? null, article.id)
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            article_id: article.id,
            url: result.url,
            verify: result.verify ?? null,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      // Astro/Git publishes synchronously (commit + deploy + poll)
      if (site?.type === 'astro') {
        if (!site.config_json) {
          return new Response(JSON.stringify({ error: 'Invalid Astro site configuration' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const config = JSON.parse(site.config_json) as Record<string, unknown>;

        if (!config.github_repo || !config.github_installation_id) {
          return new Response(
            JSON.stringify({ error: 'GitHub repo or installation ID not configured' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        const result = await publishToAstro(
          article,
          {
            github_repo: String(config.github_repo),
            github_branch: String(config.github_branch ?? 'main'),
            github_content_path: String(config.github_content_path ?? 'src/content/posts'),
            github_installation_id: String(config.github_installation_id),
            github_workflow_file: config.github_workflow_file
              ? String(config.github_workflow_file)
              : undefined,
            live_url: config.live_url ? String(config.live_url) : undefined,
          },
          {
            GITHUB_APP_ID: env.GITHUB_APP_ID ?? '',
            GITHUB_APP_PRIVATE_KEY: env.GITHUB_APP_PRIVATE_KEY ?? '',
          },
        );

        if (!result.success) {
          await env.DB.prepare(
            `UPDATE articles SET status = 'failed', publish_error = ?, updated_at = datetime('now') WHERE id = ?`,
          )
            .bind(result.error ?? 'Unknown error', article.id)
            .run();

          return new Response(JSON.stringify({ success: false, error: result.error }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        await env.DB.prepare(
          `UPDATE articles SET status = 'published', published_url = ?, published_at = datetime('now'), publish_error = NULL, updated_at = datetime('now') WHERE id = ?`,
        )
          .bind(result.url ?? null, article.id)
          .run();

        return new Response(
          JSON.stringify({
            success: true,
            article_id: article.id,
            url: result.url,
            deploy_url: result.deployUrl ?? null,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      // Create publish queue entry
      const jobId = `pub_${crypto.randomUUID()}`;
      await env.DB.prepare(
        `INSERT INTO publish_queue (id, article_id, site_id, status, created_at)
         VALUES (?, ?, ?, 'pending', datetime('now'))`,
      )
        .bind(jobId, data.article_id, siteId)
        .run();

      // Enqueue to Durable Object (Assuming same approach as generation-queue)
      // Note: Architecture says Durable Object: Generation Queue. Need to check if publish also needs DO.
      // Assuming DO for publish based on generation-queue pattern.
      const queueId = env.QUEUE.idFromName('publish-queue');
      const queueStub = env.QUEUE.get(queueId) as unknown as {
        fetch: (url: string, options: RequestInit) => Promise<Response>;
      };
      await queueStub.fetch('http://do/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, article_id: data.article_id, site_id: siteId }),
      });

      // Update article status to 'publishing'
      await env.DB.prepare(
        `UPDATE articles SET status = 'publishing', updated_at = datetime('now') WHERE id = ?`,
      )
        .bind(data.article_id)
        .run();

      return new Response(JSON.stringify({ job_id: jobId, status: 'queued' }), {
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
  }

  if (method === 'GET') {
    const url = new URL(request.url);
    const workspaceIdParam = url.searchParams.get('workspace_id');

    if (workspaceIdParam !== workspaceId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const items = await env.DB.prepare(
      `SELECT pq.* FROM publish_queue pq
       JOIN articles a ON pq.article_id = a.id
       WHERE a.workspace_id = ?
       ORDER BY pq.created_at DESC`,
    )
      .bind(workspaceId)
      .all();

    return new Response(JSON.stringify(items.results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
};
