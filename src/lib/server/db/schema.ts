import { sql } from 'drizzle-orm';
import { blob, check, integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  defaultLang: text('default_lang').default('id'),
  timezone: text('timezone').default('Asia/Jakarta'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const sites = sqliteTable(
  'sites',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    name: text('name').notNull(),
    type: text('type').notNull(),
    wpUrl: text('wp_url'),
    wpUsername: text('wp_username'),
    wpAppPassword: text('wp_app_password'),
    bloggerBlogId: text('blogger_blog_id'),
    bloggerRefreshToken: text('blogger_refresh_token'),
    githubRepo: text('github_repo'),
    githubBranch: text('github_branch').default('main'),
    githubContentPath: text('github_content_path').default('src/content/posts'),
    githubAppId: integer('github_app_id'),
    githubInstallationId: integer('github_installation_id'),
    customWebhookUrl: text('custom_webhook_url'),
    customSecret: text('custom_secret'),
    defaultCategory: text('default_category'),
    defaultAuthor: text('default_author'),
    canonicalPrefix: text('canonical_prefix'),
    aiModelDefault: text('ai_model_default').default('9router-claude-writer'),
    tonePreset: text('tone_preset').default('professional'),
    wpStyleDna: text('wp_style_dna'),
    wpStyleVector: blob('wp_style_vector'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
    lastSyncAt: text('last_sync_at'),
    isActive: integer('is_active').default(1),
  },
  (table) => ({
    typeCheck: check(
      'sites_type_check',
      sql`${table.type} IN ('wordpress', 'blogger', 'astro', 'custom')`,
    ),
  }),
);

export const articles = sqliteTable(
  'articles',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    siteId: text('site_id')
      .notNull()
      .references(() => sites.id),
    title: text('title'),
    slug: text('slug'),
    status: text('status').notNull(),
    intent: text('intent'),
    targetWords: integer('target_words'),
    niche: text('niche'),
    tonePreset: text('tone_preset'),
    aiModelUsed: text('ai_model_used'),
    contentMd: text('content_md'),
    frontmatterJson: text('frontmatter_json'),
    outlineJson: text('outline_json'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
    scheduledFor: text('scheduled_for'),
    publishedAt: text('published_at'),
    publishedUrl: text('published_url'),
    publishError: text('publish_error'),
    version: integer('version').default(1),
  },
  (table) => ({
    intentCheck: check(
      'articles_intent_check',
      sql`${table.intent} IN ('informational', 'commercial', 'transactional')`,
    ),
    statusCheck: check(
      'articles_status_check',
      sql`${table.status} IN ('draft', 'outline', 'review', 'queued', 'generating', 'ready', 'scheduled', 'publishing', 'published', 'failed')`,
    ),
  }),
);

export const articleVersions = sqliteTable('article_versions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  articleId: text('article_id')
    .notNull()
    .references(() => articles.id),
  version: integer('version').notNull(),
  frontmatterJson: text('frontmatter_json'),
  contentMd: text('content_md'),
  changedBy: text('changed_by'),
  changedAt: text('changed_at').default(sql`(datetime('now'))`),
  diffData: text('diff_data'),
});

export const generationQueue = sqliteTable(
  'generation_queue',
  {
    id: text('id').primaryKey(),
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id),
    status: text('status').notNull(),
    modelName: text('model_name'),
    promptData: text('prompt_data'),
    resultJson: text('result_json'),
    retryCount: integer('retry_count').default(0),
    maxRetries: integer('max_retries').default(3),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    errorMessage: text('error_message'),
  },
  (table) => ({
    statusCheck: check(
      'generation_queue_status_check',
      sql`${table.status} IN ('queued', 'processing', 'completed', 'failed')`,
    ),
  }),
);

export const publishQueue = sqliteTable(
  'publish_queue',
  {
    id: text('id').primaryKey(),
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id),
    siteId: text('site_id')
      .notNull()
      .references(() => sites.id),
    status: text('status').notNull(),
    scheduledFor: text('scheduled_for'),
    payloadJson: text('payload_json'),
    responseJson: text('response_json'),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0),
    maxRetries: integer('max_retries').default(3),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    processedAt: text('processed_at'),
    completedAt: text('completed_at'),
  },
  (table) => ({
    statusCheck: check(
      'publish_queue_status_check',
      sql`${table.status} IN ('pending', 'processing', 'success', 'failed', 'retry')`,
    ),
  }),
);

export const calendarSlots = sqliteTable(
  'calendar_slots',
  {
    id: text('id').primaryKey(),
    workspace_id: text('workspace_id').notNull(),
    site_id: text('site_id'),
    article_id: text('article_id'),
    slot_datetime: text('slot_datetime').notNull(),
    slot_type: text('slot_type').default('manual'),
    is_recurring: integer('is_recurring').default(0),
    recurrence_rule: text('recurrence_rule'),
    created_at: text('created_at').default(sql`(datetime('now'))`),
    updated_at: text('updated_at').default(sql`(datetime('now'))`),
  },
  (table) => ({
    slotTypeCheck: check(
      'calendar_slots_slot_type_check',
      sql`${table.slot_type} IN ('generation', 'publish', 'manual')`,
    ),
    workspaceSiteSlotUnique: unique('calendar_slots_workspace_site_slot_unique').on(
      table.workspace_id,
      table.site_id,
      table.slot_datetime,
    ),
  }),
);

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: text('workspace_id'),
  siteId: text('site_id'),
  articleId: text('article_id'),
  action: text('action').notNull(),
  actor: text('actor').default('system'),
  detailsJson: text('details_json'),
  createdAt: text('created_at').default(sql`(datetime('now', 'localtime'))`),
});

export const usageStats = sqliteTable('usage_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: text('workspace_id').notNull(),
  siteId: text('site_id'),
  modelName: text('model_name'),
  action: text('action').notNull(),
  tokensInput: integer('tokens_input'),
  tokensOutput: integer('tokens_output'),
  estimatedCostUsd: real('estimated_cost_usd'),
  durationMs: integer('duration_ms'),
  success: integer('success'),
  errorMessage: text('error_message'),
  recordedAt: text('recorded_at').default(sql`(datetime('now', 'localtime'))`),
});

export const contentGraph = sqliteTable(
  'content_graph',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workspaceId: text('workspace_id').notNull(),
    sourceArticleId: text('source_article_id'),
    targetArticleId: text('target_article_id'),
    relationType: text('relation_type').notNull(),
    strength: real('strength').default(1),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => ({
    relationTypeCheck: check(
      'content_graph_relation_type_check',
      sql`${table.relationType} IN ('mentions', 'links_to', 'related', 'duplicate_of')`,
    ),
  }),
);

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
