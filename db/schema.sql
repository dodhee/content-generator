-- D1 migrations/schema.sql
-- Run: npm run db:push (via migrations/ folder)

-- Workspaces (top-level isolation)
CREATE TABLE workspaces (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  default_lang  TEXT DEFAULT 'id',
  timezone      TEXT DEFAULT 'Asia/Jakarta',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- Sites (connected CMS targets)
CREATE TABLE sites (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('wordpress', 'blogger', 'astro', 'custom')),
  -- WP fields
  wp_url          TEXT,
  wp_username     TEXT,
  wp_app_password TEXT,  -- encrypted, stored in KV
  -- Blogger fields
  blogger_blog_id TEXT,
  blogger_refresh_token TEXT, -- encrypted, stored in KV
  -- Astro/Git fields
  github_repo     TEXT,
  github_branch   TEXT DEFAULT 'main',
  github_content_path TEXT DEFAULT 'src/content/posts',
  github_app_id   INTEGER,
  github_installation_id INTEGER,
  -- Custom webhook
  custom_webhook_url TEXT,
  custom_secret   TEXT,
  -- Common
  default_category TEXT,
  default_author   TEXT,
  canonical_prefix TEXT,
  ai_model_default TEXT DEFAULT '9router-claude-writer',
  tone_preset      TEXT DEFAULT 'professional',
  wp_style_dna     TEXT,  -- few-shot examples JSON
  wp_style_vector  BLOB,  -- embedding vector (future: Vectorize)
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now')),
  last_sync_at    TEXT,
  is_active       INTEGER DEFAULT 1
);

-- Articles (master record)
CREATE TABLE articles (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id),
  site_id         TEXT NOT NULL REFERENCES sites(id),
  title           TEXT,
  slug            TEXT,
  status          TEXT NOT NULL CHECK (status IN ('draft', 'outline', 'review', 'queued', 'generating', 'ready', 'scheduled', 'publishing', 'published', 'failed')),
  intent          TEXT CHECK (intent IN ('informational', 'commercial', 'transactional')),
  target_words    INTEGER,
  niche           TEXT,
  tone_preset     TEXT,
  ai_model_used   TEXT,
  content_md      TEXT,  -- full markdown
  frontmatter_json TEXT,  -- JSON string of frontmatter
  outline_json    TEXT,  -- JSON of outline steps
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now')),
  scheduled_for   TEXT,  -- ISO datetime
  published_at    TEXT,  -- ISO datetime
  published_url   TEXT,
  publish_error   TEXT,
  version         INTEGER DEFAULT 1
);

-- Article versions (history)
CREATE TABLE article_versions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id      TEXT NOT NULL REFERENCES articles(id),
  version         INTEGER NOT NULL,
  frontmatter_json TEXT,
  content_md      TEXT,
  changed_by      TEXT,  -- 'system' or 'user'
  changed_at      TEXT DEFAULT (datetime('now')),
  diff_data       TEXT  -- JSON diff summary
);

-- Generation queue (powered by Durable Object)
CREATE TABLE generation_queue (
  id              TEXT PRIMARY KEY,
  article_id      TEXT NOT NULL REFERENCES articles(id),
  status          TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  model_name      TEXT,
  prompt_data     TEXT,   -- JSON prompt
  result_json     TEXT,   -- JSON output or error
  retry_count     INTEGER DEFAULT 0,
  max_retries     INTEGER DEFAULT 3,
  created_at      TEXT DEFAULT (datetime('now')),
  started_at      TEXT,
  completed_at    TEXT,
  error_message   TEXT
);

-- Publish queue
CREATE TABLE publish_queue (
  id              TEXT PRIMARY KEY,
  article_id      TEXT NOT NULL REFERENCES articles(id),
  site_id         TEXT NOT NULL REFERENCES sites(id),
  status          TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'success', 'failed', 'retry')),
  scheduled_for   TEXT,
  payload_json    TEXT,  -- CMS-specific payload
  response_json   TEXT,  -- CMS response
  error_message   TEXT,
  retry_count     INTEGER DEFAULT 0,
  max_retries     INTEGER DEFAULT 3,
  created_at      TEXT DEFAULT (datetime('now')),
  processed_at    TEXT,
  completed_at    TEXT
);

-- Content calendar slots
CREATE TABLE calendar_slots (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL,
  site_id         TEXT,
  article_id      TEXT,
  slot_datetime   TEXT NOT NULL,  -- ISO datetime
  slot_type       TEXT CHECK (slot_type IN ('generation', 'publish', 'manual')) DEFAULT 'manual',
  is_recurring    INTEGER DEFAULT 0,
  recurrence_rule TEXT,  -- JSON: {freq: 'week', interval: 1, days: ['mon']}
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now')),
  UNIQUE(workspace_id, site_id, slot_datetime)
);

-- Audit log
CREATE TABLE audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id    TEXT,
  site_id         TEXT,
  article_id      TEXT,
  action          TEXT NOT NULL,  -- 'generated', 'edited', 'scheduled', 'published', etc
  actor           TEXT DEFAULT 'system',
  details_json    TEXT,  -- action-specific details
  created_at      TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Usage analytics
CREATE TABLE usage_stats (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id    TEXT NOT NULL,
  site_id         TEXT,
  article_id      TEXT,
  model_name      TEXT,
  action          TEXT NOT NULL,  -- 'generate', 'generate_outline', 'generate_section', 'publish', 'image_gen'
  tokens_input    INTEGER,
  tokens_output   INTEGER,
  estimated_cost_usd REAL,
  duration_ms     INTEGER,
  success         INTEGER,
  error_message   TEXT,
  recorded_at     TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Content graph (cross-site)
CREATE TABLE content_graph (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id    TEXT NOT NULL,
  source_article_id TEXT,
  target_article_id TEXT,
  relation_type   TEXT NOT NULL CHECK (relation_type IN ('mentions', 'links_to', 'related', 'duplicate_of')),
  strength        REAL DEFAULT 1.0,
  created_at      TEXT DEFAULT (datetime('now'))
);
