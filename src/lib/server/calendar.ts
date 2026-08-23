// src/lib/server/calendar.ts
// Calendar CRUD queries for D1

import {
  type CalendarSlot,
  type CalendarSlotRow,
  type CalendarSlotUpdate,
  calendarSlotSchema,
  calendarSlotUpdateSchema,
} from '../../types/calendar';

export {
  calendarSlotSchema,
  calendarSlotUpdateSchema,
  type CalendarSlot,
  type CalendarSlotUpdate,
  type CalendarSlotRow,
};

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function listCalendarSlots(
  db: D1Database,
  workspaceId: string,
  filters?: { month?: string; site_id?: string; slot_type?: string },
): Promise<CalendarSlotRow[]> {
  let query = 'SELECT * FROM calendar_slots WHERE workspace_id = ?';
  const params: unknown[] = [workspaceId];

  if (filters?.month) {
    // month format: "2025-01"
    const [yearStr, monthStr] = filters.month.split('-') as [string, string];
    const year = Number(yearStr);
    const month = Number(monthStr);
    const start = `${year}-${monthStr.padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).getDate();
    const end = `${year}-${monthStr.padStart(2, '0')}-${endDate}`;
    query += ' AND slot_datetime >= ? AND slot_datetime <= ?';
    params.push(start, end);
  }
  if (filters?.site_id) {
    query += ' AND site_id = ?';
    params.push(filters.site_id);
  }
  if (filters?.slot_type) {
    query += ' AND slot_type = ?';
    params.push(filters.slot_type);
  }
  query += ' ORDER BY slot_datetime ASC';

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<CalendarSlotRow>();
  return (result.results || []).map((row) => ({
    ...row,
    is_recurring: Boolean(row.is_recurring),
    recurrence_rule: row.recurrence_rule ? JSON.parse(row.recurrence_rule) : null,
  }));
}

export async function getCalendarSlotById(
  db: D1Database,
  id: string,
): Promise<CalendarSlotRow | null> {
  const result = await db
    .prepare('SELECT * FROM calendar_slots WHERE id = ?')
    .bind(id)
    .first<CalendarSlotRow>();
  if (!result) return null;
  return {
    ...result,
    is_recurring: Boolean(result.is_recurring),
    recurrence_rule: result.recurrence_rule ? JSON.parse(result.recurrence_rule) : null,
  };
}

export async function createCalendarSlot(
  db: D1Database,
  data: CalendarSlot,
): Promise<CalendarSlotRow> {
  const validated = calendarSlotSchema.parse(data);
  const id = generateId('slot');

  await db
    .prepare(
      `INSERT INTO calendar_slots (id, workspace_id, site_id, article_id, slot_datetime, slot_type, is_recurring, recurrence_rule)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      validated.workspace_id,
      validated.site_id ?? null,
      validated.article_id ?? null,
      validated.slot_datetime,
      validated.slot_type,
      validated.is_recurring ? 1 : 0,
      validated.recurrence_rule ? JSON.stringify(validated.recurrence_rule) : null,
    )
    .run();

  const created = await getCalendarSlotById(db, id);
  if (!created) throw new Error('Failed to create calendar slot');
  return created;
}

export async function updateCalendarSlot(
  db: D1Database,
  id: string,
  data: CalendarSlotUpdate,
): Promise<CalendarSlotRow | null> {
  const validated = calendarSlotUpdateSchema.parse(data);
  const current = await getCalendarSlotById(db, id);
  if (!current) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (validated.site_id !== undefined) {
    updates.push('site_id = ?');
    params.push(validated.site_id);
  }
  if (validated.article_id !== undefined) {
    updates.push('article_id = ?');
    params.push(validated.article_id);
  }
  if (validated.slot_datetime !== undefined) {
    updates.push('slot_datetime = ?');
    params.push(validated.slot_datetime);
  }
  if (validated.slot_type !== undefined) {
    updates.push('slot_type = ?');
    params.push(validated.slot_type);
  }
  if (validated.is_recurring !== undefined) {
    updates.push('is_recurring = ?');
    params.push(validated.is_recurring ? 1 : 0);
  }
  if (validated.recurrence_rule !== undefined) {
    updates.push('recurrence_rule = ?');
    params.push(validated.recurrence_rule ? JSON.stringify(validated.recurrence_rule) : null);
  }

  if (updates.length === 0) return current;

  updates.push("updated_at = datetime('now')");
  params.push(id);

  await db
    .prepare(`UPDATE calendar_slots SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  return getCalendarSlotById(db, id);
}

export async function deleteCalendarSlot(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM calendar_slots WHERE id = ?').bind(id).run();
  return result.success;
}
