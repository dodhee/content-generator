import { z } from 'zod';

export const generateRequestSchema = z.object({
  article_id: z.string().min(1),
  topic: z.string().min(1).max(500),
  intent: z.enum(['informational', 'commercial', 'transactional']).optional(),
  target_words: z.number().int().positive().max(5000).optional(),
  niche: z.string().optional(),
  tone_preset: z.string().optional(),
  model_override: z.string().optional(),
  style_dna: z.boolean().default(true),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const outlineResponseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(300).optional(),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        level: z.number().int().min(2).max(3),
        key_points: z.array(z.string()),
        target_words: z.number().int().positive().optional(),
      }),
    )
    .min(1),
  suggested_faq: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    )
    .optional(),
  suggested_tags: z.array(z.string()).optional(),
  suggested_categories: z.array(z.string()).optional(),
});

export type OutlineResponse = z.infer<typeof outlineResponseSchema>;

export const generationJobSchema = z.object({
  job_id: z.string(),
  article_id: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  model_name: z.string().optional(),
  prompt_data: z.string().optional(),
  result_json: z.string().optional(),
  error_message: z.string().optional(),
  retry_count: z.number().int().default(0),
  max_retries: z.number().int().default(3),
  created_at: z.string(),
  started_at: z.string().optional(),
  completed_at: z.string().optional(),
});

export type GenerationJob = z.infer<typeof generationJobSchema>;
