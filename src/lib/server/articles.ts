// src/lib/server/articles.ts
// Article CRUD queries for D1 + versioning

import {
  VALID_TRANSITIONS,
  articleCreateSchema,
  articleIntentSchema,
  articleStatusSchema,
  articleStatusTransitionSchema,
  articleUpdateSchema,
} from './types/article';
import type {
  ArticleCreate,
  ArticleIntent,
  ArticleRow,
  ArticleStatus,
  ArticleStatusTransition,
  ArticleUpdate,
  ArticleVersionRow,
} from './types/article';

// Simple UUID generator (using crypto.randomUUID if available)
function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function listArticles(
  db: D1Database,
  workspaceId: string,
  filters?: { site_id?: string; status?: string },
): Promise<ArticleRow[]> {
  let query = 'SELECT * FROM articles WHERE workspace_id = ?';
  const params: unknown[] = [workspaceId];

  if (filters?.site_id) {
    query += ' AND site_id = ?';
    params.push(filters.site_id);
  }
  if (filters?.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  query += ' ORDER BY created_at DESC';

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<ArticleRow>();
  return result.results || [];
}

export async function createArticle(db: D1Database, data: ArticleCreate): Promise<ArticleRow> {
  const validated = articleCreateSchema.parse(data);
  const id = generateId('art');

  await db
    .prepare(
      `INSERT INTO articles (
        id, workspace_id, site_id, title, slug, status, intent, target_words,
        niche, tone_preset, ai_model_used, content_md, frontmatter_json,
        outline_json, version
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, NULL, NULL, NULL, 1)`,
    )
    .bind(
      id,
      validated.workspace_id,
      validated.site_id,
      validated.title ?? null,
      validated.slug ?? null,
      validated.intent ?? null,
      validated.target_words ?? null,
      validated.niche ?? null,
      validated.tone_preset ?? null,
      validated.ai_model ?? null,
    )
    .run();

  // Insert version 1
  await db
    .prepare(
      `INSERT INTO article_versions (article_id, version, frontmatter_json, content_md, changed_by)
       VALUES (?, 1, NULL, NULL, 'user')`,
    )
    .bind(id)
    .run();

  const created = await getArticleById(db, id);
  if (!created) throw new Error('Failed to create article');
  return created;
}

export async function getArticleById(db: D1Database, id: string): Promise<ArticleRow | null> {
  const result = await db
    .prepare('SELECT * FROM articles WHERE id = ?')
    .bind(id)
    .first<ArticleRow>();
  return result || null;
}

export async function getArticleVersions(
  db: D1Database,
  articleId: string,
): Promise<ArticleVersionRow[]> {
  const result = await db
    .prepare('SELECT * FROM article_versions WHERE article_id = ? ORDER BY version DESC')
    .bind(articleId)
    .all<ArticleVersionRow>();
  return result.results || [];
}

export async function updateArticle(
  db: D1Database,
  id: string,
  data: ArticleUpdate,
  actor: 'user' | 'system' = 'user',
): Promise<ArticleRow | null> {
  const validated = articleUpdateSchema.parse(data);
  const current = await getArticleById(db, id);
  if (!current) return null;

  const newVersion = current.version + 1;

  // Build dynamic update
  const updates: string[] = [];
  const params: unknown[] = [];

  if (validated.title !== undefined) {
    updates.push('title = ?');
    params.push(validated.title);
  }
  if (validated.slug !== undefined) {
    updates.push('slug = ?');
    params.push(validated.slug);
  }
  if (validated.intent !== undefined) {
    updates.push('intent = ?');
    params.push(validated.intent);
  }
  if (validated.target_words !== undefined) {
    updates.push('target_words = ?');
    params.push(validated.target_words);
  }
  if (validated.niche !== undefined) {
    updates.push('niche = ?');
    params.push(validated.niche);
  }
  if (validated.tone_preset !== undefined) {
    updates.push('tone_preset = ?');
    params.push(validated.tone_preset);
  }
  if (validated.ai_model !== undefined) {
    updates.push('ai_model_used = ?');
    params.push(validated.ai_model);
  }
  if (validated.content_md !== undefined) {
    updates.push('content_md = ?');
    params.push(validated.content_md);
  }
  if (validated.frontmatter_json !== undefined) {
    updates.push('frontmatter_json = ?');
    params.push(validated.frontmatter_json);
  }
  if (validated.outline_json !== undefined) {
    updates.push('outline_json = ?');
    params.push(validated.outline_json);
  }

  if (updates.length === 0) return current;

  updates.push('version = ?');
  params.push(newVersion);
  updates.push("updated_at = datetime('now')");
  params.push(id);

  await db
    .prepare(`UPDATE articles SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  // Insert new version snapshot
  const updated = await getArticleById(db, id);
  if (updated) {
    await db
      .prepare(
        `INSERT INTO article_versions (article_id, version, frontmatter_json, content_md, changed_by)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(id, newVersion, updated.frontmatter_json, updated.content_md, actor)
      .run();
  }

  return getArticleById(db, id);
}

export async function transitionArticleStatus(
  db: D1Database,
  id: string,
  newStatus: ArticleStatus,
): Promise<ArticleRow | null> {
  const current = await getArticleById(db, id);
  if (!current) return null;

  const valid = VALID_TRANSITIONS[current.status as keyof typeof VALID_TRANSITIONS];
  if (!valid || !valid.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${current.status} to ${newStatus}`);
  }

  const updates = ['status = ?', "updated_at = datetime('now')"];
  const params: unknown[] = [newStatus];

  if (newStatus === 'published') {
    updates.push("published_at = datetime('now')");
  }

  params.push(id);

  await db
    .prepare(`UPDATE articles SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  return getArticleById(db, id);
}

export async function softDeleteArticle(db: D1Database, id: string): Promise<boolean> {
  await db
    .prepare("UPDATE articles SET status = 'deleted', updated_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();

  await db.prepare('DELETE FROM article_versions WHERE article_id = ?').bind(id).run();

  return true;
}

// Re-export schemas for API handlers
export {
  articleCreateSchema,
  articleUpdateSchema,
  articleStatusSchema,
  articleIntentSchema,
  articleStatusTransitionSchema,
  VALID_TRANSITIONS,
};
export type {
  ArticleCreate,
  ArticleUpdate,
  ArticleStatus,
  ArticleIntent,
  ArticleStatusTransition,
  ArticleRow,
  ArticleVersionRow,
};
