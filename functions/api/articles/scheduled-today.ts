// functions/api/articles/scheduled-today.ts
// Get articles scheduled for today

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
    const result = await env.DB.prepare(
      `SELECT a.id, a.title, a.status, a.scheduled_for, s.name as site_name
       FROM articles a
       LEFT JOIN sites s ON a.site_id = s.id
       WHERE a.workspace_id = ?
         AND a.status = 'scheduled'
         AND DATE(a.scheduled_for) = DATE('now')
       ORDER BY a.scheduled_for ASC
       LIMIT 20`,
    )
      .bind(workspaceId)
      .all<{
        id: string;
        title: string;
        status: string;
        scheduled_for: string;
        site_name: string;
      }>();

    return new Response(
      JSON.stringify({ articles: result.results || [] }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Scheduled today error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch scheduled articles' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}