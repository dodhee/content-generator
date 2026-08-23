// functions/api/calendar/index.ts
// GET /api/calendar — list slots grouped by week

import { validateSession } from '../../../src/lib/server/auth';
import { listCalendarSlots } from '../../../src/lib/server/calendar';

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

  if (method === 'GET') {
    const url = new URL(request.url);
    const month = url.searchParams.get('month') ?? undefined;
    const siteId = url.searchParams.get('site_id') ?? undefined;
    const slotType = url.searchParams.get('slot_type') ?? undefined;

    const slots = await listCalendarSlots(env.DB, workspaceId, {
      month,
      site_id: siteId,
      slot_type: slotType,
    });

    // Group by week (Monday-Sunday)
    const weeks: Record<string, { week_start: string; week_end: string; slots: typeof slots }> = {};

    for (const slot of slots) {
      const date = new Date(slot.slot_datetime);
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon...
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() + mondayOffset);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const key = weekStart.toISOString().split('T')[0] as string;
      if (!weeks[key]) {
        weeks[key] = {
          week_start: weekStart.toISOString(),
          week_end: weekEnd.toISOString(),
          slots: [],
        };
      }
      (weeks[key] as { slots: typeof slots }).slots.push(slot);
    }

    const weekArray = Object.values(weeks).sort((a, b) => a.week_start.localeCompare(b.week_start));

    return new Response(JSON.stringify({ weeks: weekArray }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
};
