// functions/api/dashboard/stats.ts
// Dashboard statistics API endpoint

import type { Env } from '../../../src/env';
import { validateSession } from '../../../src/lib/server/auth';

export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;
  const validationResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET);

  if (validationResult instanceof Response) {
    return validationResult;
  }

  const { workspaceId } = validationResult;

  try {
    const db = env.DB;

    // Articles last 7 days
    const articles7d = await db
      .prepare(
        `SELECT COUNT(*) as count FROM articles WHERE workspace_id = ? AND created_at >= datetime('now', '-7 days')`,
      )
      .bind(workspaceId)
      .first<{ count: number }>();

    // Articles last 30 days (for trend calculation)
    const articles30d = await db
      .prepare(
        `SELECT COUNT(*) as count FROM articles WHERE workspace_id = ? AND created_at >= datetime('now', '-30 days')`,
      )
      .bind(workspaceId)
      .first<{ count: number }>();

    // Scheduled today
    const scheduledToday = await db
      .prepare(
        `SELECT COUNT(*) as count FROM articles WHERE workspace_id = ? AND status = 'scheduled' AND DATE(scheduled_for) = DATE('now')`,
      )
      .bind(workspaceId)
      .first<{ count: number }>();

    // Failed publishes
    const failedPublishes = await db
      .prepare(
        `SELECT COUNT(*) as count FROM publish_queue WHERE status = 'failed' AND article_id IN (
          SELECT id FROM articles WHERE workspace_id = ?
        )`,
      )
      .bind(workspaceId)
      .first<{ count: number }>();

    // AI cost MTD
    const costResult = await db
      .prepare(
        `SELECT COALESCE(SUM(estimated_cost_usd), 0) as total FROM usage_stats WHERE workspace_id = ? AND recorded_at >= date('now', 'start of month')`,
      )
      .bind(workspaceId)
      .first<{ total: number }>();

    // Calculate trend
    const currentCount = articles7d?.count ?? 0;
    const previousCount = articles30d?.count ?? currentCount * 4.3; // rough estimate
    const changePct = previousCount > 0
      ? Math.round(((currentCount - previousCount / 4.3) / (previousCount / 4.3)) * 100)
      : 0;

    const stats = {
      articles_7d: {
        total: currentCount,
        change_pct: changePct > 0 ? `+${changePct}` : `${changePct}`,
      },
      scheduled_today: scheduledToday?.count ?? 0,
      failed_publishes: failedPublishes?.count ?? 0,
      cost_mtd: costResult?.total ?? 0,
    };

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch dashboard stats' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}