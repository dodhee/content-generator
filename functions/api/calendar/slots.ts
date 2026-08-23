// functions/api/calendar/slots.ts
// CRUD /api/calendar/slots

import type { ArticleRow } from '../../../src/lib/server/articles';
import { validateSession } from '../../../src/lib/server/auth';
import {
  type CalendarSlot,
  type CalendarSlotUpdate,
  calendarSlotSchema,
  calendarSlotUpdateSchema,
  createCalendarSlot,
  deleteCalendarSlot,
  getCalendarSlotById,
  updateCalendarSlot,
} from '../../../src/lib/server/calendar';

export const onRequest = async (context: {
  request: Request;
  env: Env;
  params?: { id: string };
}): Promise<Response> => {
  const env: Env = context.env;
  const request = context.request;
  const method = request.method;
  const slotId = context.params?.id;

  const sessionResult = await validateSession(request, env, env.GITHUB_CLIENT_SECRET ?? '');
  if (sessionResult instanceof Response) return sessionResult;

  const session = sessionResult;
  const workspaceId = session.user.workspace_id;

  if (method === 'POST') {
    try {
      const body = await request.json();
      const data = calendarSlotSchema.parse({
        ...body,
        workspace_id: workspaceId,
      });

      // Verify article belongs to workspace if provided
      if (data.article_id) {
        const article = await env.DB.prepare('SELECT * FROM articles WHERE id = ?')
          .bind(data.article_id)
          .first<ArticleRow>();
        if (!article || article.workspace_id !== workspaceId) {
          return new Response(JSON.stringify({ error: 'Article not found or forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        // Verify site matches if both provided
        if (data.site_id && article.site_id !== data.site_id) {
          return new Response(JSON.stringify({ error: 'Article site mismatch' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      const created = await createCalendarSlot(env.DB, data);
      return new Response(JSON.stringify(created), {
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

  if (!slotId) {
    return new Response(JSON.stringify({ error: 'Missing slot ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const slot = await getCalendarSlotById(env.DB, slotId);
  if (!slot) {
    return new Response(JSON.stringify({ error: 'Slot not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (slot.workspace_id !== workspaceId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (method === 'GET') {
    return new Response(JSON.stringify(slot), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (method === 'PUT') {
    try {
      const body = await request.json();
      const data = calendarSlotUpdateSchema.parse(body);

      // Verify article ownership if changing article_id
      if (data.article_id) {
        const article = await env.DB.prepare('SELECT * FROM articles WHERE id = ?')
          .bind(data.article_id)
          .first<ArticleRow>();
        if (!article || article.workspace_id !== workspaceId) {
          return new Response(JSON.stringify({ error: 'Article not found or forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (data.site_id && article.site_id !== data.site_id) {
          return new Response(JSON.stringify({ error: 'Article site mismatch' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      const updated = await updateCalendarSlot(env.DB, slotId, data);
      if (!updated) {
        return new Response(JSON.stringify({ error: 'Slot not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(updated), {
        status: 200,
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

  if (method === 'DELETE') {
    const deleted = await deleteCalendarSlot(env.DB, slotId);
    if (!deleted) {
      return new Response(JSON.stringify({ error: 'Slot not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Method not allowed', { status: 405 });
};
