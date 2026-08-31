// functions/api/analytics/models.ts
// GET /api/analytics/models — cost/token report per model, site, article (US-05 AC-04)
//
// Query params (all optional, filtered by session workspace):
//   ?site_id=<id>     — scope to a site
//   ?article_id=<id>  — scope to an article
//   ?month=YYYY-MM    — scope to a month (default: current month)
//   ?group=model|site|article — grouping (default: model)
//
// Response shape:
//   { month, group, rows: [{ name, calls, success_calls, tokens_input, tokens_output,
//                           estimated_cost_usd, avg_duration_ms }], total_cost_usd }

import type { Env } from '../../../src/env';
import { validateSession } from '../../../src/lib/server/auth';

const MONTH_RE = /^\d{4}-\d{2}$/;
const GROUPS = ['model', 'site', 'article'] as const;
type Group = (typeof GROUPS)[number];

const GROUP_BY: Record<Group, { select: string; name: string }> = {
  model: {
    select: `COALESCE(u.model_name, 'unknown') AS name`,
    name: 'u.model_name',
  },
  site: {
    select: `COALESCE(s.name, 'unknown') AS name`,
    name: 's.name',
  },
  article: {
    select: `COALESCE(a.title, u.article_id, 'unknown') AS name`,
    name: 'a.title',
  },
};

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const url = new URL(request.url);

  const sessionResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET ?? '');
  if (sessionResult instanceof Response) return sessionResult;
  const workspaceId = sessionResult.workspaceId;

  const siteId = url.searchParams.get('site_id') ?? undefined;
  const articleId = url.searchParams.get('article_id') ?? undefined;
  const groupParam = url.searchParams.get('group') ?? 'model';
  const monthParam = url.searchParams.get('month') ?? undefined;

  if (!GROUPS.includes(groupParam as Group)) {
    return new Response(JSON.stringify({ error: `group must be one of: ${GROUPS.join(', ')}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (monthParam && !MONTH_RE.test(monthParam)) {
    return new Response(JSON.stringify({ error: 'month must be YYYY-MM' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const group = groupParam as Group;
  const g = GROUP_BY[group];

  // Validate site belongs to workspace if provided
  if (siteId) {
    const site = await env.DB.prepare('SELECT id FROM sites WHERE id = ? AND workspace_id = ?')
      .bind(siteId, workspaceId)
      .first<{ id: string }>();
    if (!site) {
      return new Response(JSON.stringify({ error: 'Site not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Build month range. Defaults to current month.
  // recorded_at is stored as 'YYYY-MM-DD HH:MM:SS', so prefix-range string comparison works.
  const month = monthParam ?? new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const nextMonth = new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 7);
  const start = `${month}-01`;
  const end = `${nextMonth}-01`;

  const siteFilter = siteId ? 'AND u.site_id = ?' : '';
  const articleFilter = articleId ? 'AND u.article_id = ?' : '';

  const rows = await env.DB.prepare(
    `SELECT ${g.select} AS name,
            COUNT(*) AS calls,
            SUM(CASE WHEN u.success = 1 THEN 1 ELSE 0 END) AS success_calls,
            COALESCE(SUM(u.tokens_input), 0) AS tokens_input,
            COALESCE(SUM(u.tokens_output), 0) AS tokens_output,
            COALESCE(SUM(u.estimated_cost_usd), 0) AS estimated_cost_usd,
            COALESCE(AVG(u.duration_ms), 0) AS avg_duration_ms
     FROM usage_stats u
     LEFT JOIN sites s ON s.id = u.site_id
     LEFT JOIN articles a ON a.id = u.article_id
     WHERE u.workspace_id = ?
       AND u.recorded_at >= ?
       AND u.recorded_at < ?
       ${siteFilter}
       ${articleFilter}
     GROUP BY ${g.name}
     ORDER BY estimated_cost_usd DESC`,
  )
    .bind(workspaceId, start, end, ...(siteId ? [siteId] : []), ...(articleId ? [articleId] : []))
    .all<{
      name: string;
      calls: number;
      success_calls: number;
      tokens_input: number;
      tokens_output: number;
      estimated_cost_usd: number;
      avg_duration_ms: number;
    }>();

  const total = rows.results.reduce((sum, r) => sum + r.estimated_cost_usd, 0);

  return new Response(
    JSON.stringify({
      month,
      group,
      rows: rows.results,
      total_cost_usd: total,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
