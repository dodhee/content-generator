import { z } from 'zod';

export const siteCreateSchema = z.object({
  workspace_id: z.string().min(1),
  name: z.string().min(1).max(200),
  type: z.enum(['wordpress', 'blogger', 'astro', 'custom']),
  wp_url: z.string().url().optional(),
  wp_username: z.string().optional(),
  wp_app_password: z.string().optional(),
  blogger_blog_id: z.string().optional(),
  github_repo: z.string().optional(),
  github_branch: z.string().default('main'),
  github_content_path: z.string().default('src/content/posts'),
  ai_model_default: z.string().optional(),
  tone_preset: z.string().optional(),
  custom_webhook_url: z.string().url().optional(),
  custom_secret: z.string().optional(),
});

export const siteUpdateSchema = siteCreateSchema.partial();

export type SiteCreate = z.infer<typeof siteCreateSchema>;
export type SiteUpdate = z.infer<typeof siteUpdateSchema>;

export interface SiteRow {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  wp_url: string | null;
  wp_username: string | null;
  wp_app_password: string | null;
  blogger_blog_id: string | null;
  github_repo: string | null;
  github_branch: string | null;
  github_content_path: string | null;
  ai_model_default: string | null;
  tone_preset: string | null;
  custom_webhook_url: string | null;
  custom_secret: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_sync_at: string | null;
  is_active: number | null;
}
