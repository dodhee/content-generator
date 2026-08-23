import { z } from 'zod';

export const calendarSlotSchema = z.object({
  workspace_id: z.string().min(1),
  site_id: z.string().optional(),
  article_id: z.string().optional(),
  slot_datetime: z.string().datetime(), // ISO
  slot_type: z.enum(['generation', 'publish', 'manual']).default('manual'),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z
    .object({
      freq: z.enum(['daily', 'weekly', 'monthly']),
      interval: z.number().int().positive().default(1),
      days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(), // for weekly
      day_of_month: z.number().int().min(1).max(31).optional(), // for monthly
    })
    .optional(),
});

export const calendarSlotUpdateSchema = calendarSlotSchema.partial();

export type CalendarSlot = z.infer<typeof calendarSlotSchema>;
export type CalendarSlotUpdate = z.infer<typeof calendarSlotUpdateSchema>;

export interface CalendarSlotRow {
  id: string;
  workspace_id: string;
  site_id: string | null;
  article_id: string | null;
  slot_datetime: string;
  slot_type: string;
  is_recurring: boolean;
  recurrence_rule: string | null;
  created_at: string | null;
  updated_at: string | null;
}
