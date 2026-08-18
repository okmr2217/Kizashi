import { z } from "zod";

export interface Group {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const createGroupInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
});
export type CreateGroupInput = z.infer<typeof createGroupInputSchema>;

export const updateGroupInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullish(),
});
export type UpdateGroupInput = z.infer<typeof updateGroupInputSchema>;
