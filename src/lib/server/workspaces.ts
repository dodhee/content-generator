// src/lib/server/workspaces.ts
// Workspace CRUD queries for D1

import { z } from 'zod';

export const workspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  default_lang: z.string().length(2).default('id'),
  timezone: z.string().default('Asia/Jakarta'),
});

export const workspaceUpdateSchema = workspaceSchema.partial();

export interface WorkspaceRow {
  id: string;
  name: string;
  description: string | null;
  default_lang: string;
  timezone: string;
  created_at: string | null;
  updated_at: string | null;
}

export async function getWorkspaceById(db: D1Database, id: string): Promise<WorkspaceRow | null> {
  const result = await db
    .prepare('SELECT * FROM workspaces WHERE id = ?')
    .bind(id)
    .first<WorkspaceRow>();
  return result || null;
}

export async function listWorkspaces(db: D1Database, userId: string): Promise<WorkspaceRow[]> {
  const result = await db
    .prepare('SELECT * FROM workspaces WHERE id = ?')
    .bind(`ws_${userId}`)
    .all<WorkspaceRow>();
  return result.results || [];
}

export async function createWorkspace(
  db: D1Database,
  id: string,
  data: z.infer<typeof workspaceSchema>,
): Promise<WorkspaceRow> {
  await db
    .prepare(
      'INSERT INTO workspaces (id, name, description, default_lang, timezone) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(id, data.name, data.description || null, data.default_lang, data.timezone)
    .run();

  const created = await getWorkspaceById(db, id);
  if (!created) throw new Error('Failed to create workspace');
  return created;
}

export async function updateWorkspace(
  db: D1Database,
  id: string,
  data: z.infer<typeof workspaceUpdateSchema>,
): Promise<WorkspaceRow | null> {
  const current = await getWorkspaceById(db, id);
  if (!current) return null;

  const name = data.name ?? current.name;
  const description = data.description ?? current.description;
  const default_lang = data.default_lang ?? current.default_lang;
  const timezone = data.timezone ?? current.timezone;

  await db
    .prepare(
      "UPDATE workspaces SET name = ?, description = ?, default_lang = ?, timezone = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(name, description, default_lang, timezone, id)
    .run();

  return getWorkspaceById(db, id);
}

export async function deleteWorkspace(db: D1Database, id: string): Promise<boolean> {
  await db.prepare('DELETE FROM audit_log WHERE workspace_id = ?').bind(id).run();
  await db.prepare('DELETE FROM usage_stats WHERE workspace_id = ?').bind(id).run();
  await db.prepare('DELETE FROM content_graph WHERE workspace_id = ?').bind(id).run();
  await db.prepare('DELETE FROM calendar_slots WHERE workspace_id = ?').bind(id).run();

  await db
    .prepare(
      'DELETE FROM publish_queue WHERE article_id IN (SELECT id FROM articles WHERE workspace_id = ?)',
    )
    .bind(id)
    .run();
  await db
    .prepare(
      'DELETE FROM generation_queue WHERE article_id IN (SELECT id FROM articles WHERE workspace_id = ?)',
    )
    .bind(id)
    .run();
  await db
    .prepare(
      'DELETE FROM article_versions WHERE article_id IN (SELECT id FROM articles WHERE workspace_id = ?)',
    )
    .bind(id)
    .run();
  await db.prepare('DELETE FROM articles WHERE workspace_id = ?').bind(id).run();
  await db.prepare('DELETE FROM sites WHERE workspace_id = ?').bind(id).run();

  const res = await db.prepare('DELETE FROM workspaces WHERE id = ?').bind(id).run();
  return res.success;
}
