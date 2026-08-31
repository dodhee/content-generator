-- US-05: add article_id to usage_stats for per-article cost tracking
ALTER TABLE usage_stats ADD COLUMN article_id TEXT;
