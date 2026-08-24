import { z } from 'zod';

export const publishRequestSchema = z.object({
  article_id: z.string().min(1),
  site_id: z.string().min(1).optional(),
});

export const publishQueueItemSchema = z.object({
  id: z.string(),
  article_id: z.string(),
  site_id: z.string(),
  status: z.enum(['pending', 'processing', 'success', 'failed', 'retry']),
  scheduled_for: z.string().nullable().optional(),
  payload_json: z.string().nullable().optional(),
  response_json: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  retry_count: z.number().int().default(0),
  max_retries: z.number().int().default(3),
  created_at: z.string(),
  processed_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});

export const publishQueueListResponseSchema = z.array(publishQueueItemSchema);

export type PublishRequest = z.infer<typeof publishRequestSchema>;
export type PublishQueueItem = z.infer<typeof publishQueueItemSchema>;
export type PublishQueueListResponse = z.infer<typeof publishQueueListResponseSchema>;
