// src/lib/server/sites.ts
// Site CRUD queries for D1

import { z } from 'zod';

export const siteTypeSchema = z.enum(['wordpress', 'blogger', 'astro', 'webhook']);

export const siteConfigSchema = z.object({
  wp_url: z.string().url().optional(),
  wp_username: z.string().optional(),
  wp_app_password: z.string().optional(),
  blogger_blog_id: z.string().optional(),
  blogger_refresh_token: z.string().optional(),
  github_repo: z.string().optional(),
  github_branch: z.string().optional(),
  github_installation_id: z.string().optional(),
  webhook_url: z.string().url().optional(),
  webhook_secret: z.string().optional(),
  default_category: z.string().optional(),
  default_tags: z.array(z.string()).optional(),
});

export const siteSchema = z.object({
  name: z.string().min(1).max(100),
  type: siteTypeSchema,
  config: siteConfigSchema,
  is_active: z.boolean().default(true),
});

export const siteUpdateSchema = siteSchema.partial();

export interface SiteRow {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  config_json: string | null;
  is_active: number;
  last_published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function maskSecrets(config: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...config };
  const secretKeys = [
    'wp_app_password',
    'blogger_refresh_token',
    'webhook_secret',
    'github_installation_id',
  ];
  for (const key of secretKeys) {
    if (masked[key]) {
      masked[key] = '***';
    }
  }
  return masked;
}

export async function getSiteById(db: D1Database, id: string): Promise<SiteRow | null> {
  const result = await db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first<SiteRow>();
  return result || null;
}

export async function getSiteByIdWithConfig(
  db: D1Database,
  id: string,
): Promise<{ row: SiteRow; config: Record<string, unknown> } | null> {
  const row = await getSiteById(db, id);
  if (!row) return null;
  const config = row.config_json ? JSON.parse(row.config_json) : {};
  return { row, config: maskSecrets(config) };
}

export async function listSites(
  db: D1Database,
  workspaceId: string,
): Promise<Array<{ row: SiteRow; config: Record<string, unknown> }>> {
  const result = await db
    .prepare('SELECT * FROM sites WHERE workspace_id = ? ORDER BY created_at DESC')
    .bind(workspaceId)
    .all<SiteRow>();

  return (result.results || []).map((row) => {
    const config = row.config_json ? JSON.parse(row.config_json) : {};
    return { row, config: maskSecrets(config) };
  });
}

export async function createSite(
  db: D1Database,
  workspaceId: string,
  id: string,
  data: z.infer<typeof siteSchema>,
): Promise<SiteRow> {
  await db
    .prepare(
      'INSERT INTO sites (id, workspace_id, name, type, config_json, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      workspaceId,
      data.name,
      data.type,
      JSON.stringify(data.config),
      data.is_active ? 1 : 0,
    )
    .run();

  const created = await getSiteById(db, id);
  if (!created) throw new Error('Failed to create site');
  return created;
}

export async function updateSite(
  db: D1Database,
  id: string,
  data: z.infer<typeof siteUpdateSchema>,
): Promise<SiteRow | null> {
  const current = await getSiteById(db, id);
  if (!current) return null;

  const name = data.name ?? current.name;
  const type = data.type ?? current.type;
  const config = data.config !== undefined ? JSON.stringify(data.config) : current.config_json;
  const is_active = data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active;

  await db
    .prepare(
      "UPDATE sites SET name = ?, type = ?, config_json = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(name, type, config, is_active, id)
    .run();

  return getSiteById(db, id);
}

export async function deleteSite(db: D1Database, id: string): Promise<boolean> {
  await db.prepare('DELETE FROM calendar_slots WHERE site_id = ?').bind(id).run();
  await db.prepare('DELETE FROM articles WHERE site_id = ?').bind(id).run();

  const res = await db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
  return res.success;
}
