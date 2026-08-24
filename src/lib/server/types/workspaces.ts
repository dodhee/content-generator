import { z } from 'zod';

export const workspaceCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  default_lang: z.string().optional(),
  timezone: z.string().optional(),
});

export const workspaceUpdateSchema = workspaceCreateSchema.partial();

export type WorkspaceCreate = z.infer<typeof workspaceCreateSchema>;
export type WorkspaceUpdate = z.infer<typeof workspaceUpdateSchema>;

export interface WorkspaceRow {
  id: string;
  name: string;
  description: string | null;
  default_lang: string | null;
  timezone: string | null;
  created_at: string | null;
  updated_at: string | null;
}
