import { z } from 'zod';

export const articleStatusSchema = z.enum([
  'draft',
  'outline',
  'review',
  'queued',
  'generating',
  'ready',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'deleted',
]);

export const articleIntentSchema = z.enum(['informational', 'commercial', 'transactional']);

export const articleCreateSchema = z.object({
  workspace_id: z.string().min(1),
  site_id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  slug: z.string().max(250).optional(),
  intent: articleIntentSchema.optional(),
  target_words: z.number().int().positive().optional(),
  niche: z.string().optional(),
  tone_preset: z.string().optional(),
  ai_model: z.string().optional(),
});

export const articleUpdateSchema = articleCreateSchema.partial().extend({
  content_md: z.string().optional(),
  frontmatter_json: z.string().optional(),
  outline_json: z.string().optional(),
});

export const articleStatusTransitionSchema = z.object({
  status: articleStatusSchema,
});

// Valid transitions (per PRD US-08)
export const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['outline', 'deleted'],
  outline: ['review', 'draft', 'deleted'],
  review: ['queued', 'outline', 'deleted'],
  queued: ['generating', 'review', 'deleted'],
  generating: ['ready', 'failed', 'queued'],
  ready: ['scheduled', 'queued', 'review', 'deleted'],
  scheduled: ['publishing', 'ready', 'deleted'],
  publishing: ['published', 'failed', 'scheduled'],
  published: ['scheduled', 'deleted'], // republish/schedule
  failed: ['queued', 'review', 'deleted'],
  deleted: [], // terminal
};

export type ArticleStatus = z.infer<typeof articleStatusSchema>;
export type ArticleIntent = z.infer<typeof articleIntentSchema>;
export type ArticleCreate = z.infer<typeof articleCreateSchema>;
export type ArticleUpdate = z.infer<typeof articleUpdateSchema>;
export type ArticleStatusTransition = z.infer<typeof articleStatusTransitionSchema>;

export interface ArticleRow {
  id: string;
  workspace_id: string;
  site_id: string;
  title: string | null;
  slug: string | null;
  status: string;
  intent: string | null;
  target_words: number | null;
  niche: string | null;
  tone_preset: string | null;
  ai_model_used: string | null;
  content_md: string | null;
  frontmatter_json: string | null;
  outline_json: string | null;
  created_at: string | null;
  updated_at: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  published_url: string | null;
  publish_error: string | null;
  version: number;
}

export interface ArticleVersionRow {
  id: number;
  article_id: string;
  version: number;
  frontmatter_json: string | null;
  content_md: string | null;
  changed_by: string | null;
  changed_at: string | null;
  diff_data: string | null;
}
