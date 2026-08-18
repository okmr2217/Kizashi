import { z } from "zod";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  default_group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  title: string;
  content_markdown: string;
  created_at: string;
  updated_at: string;
}

export const createProjectInputSchema = z.object({
  name: z.string().min(1),
  default_group_id: z.string().min(1).nullish(),
});
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export const updateProjectInputSchema = z.object({
  name: z.string().min(1).optional(),
  default_group_id: z.string().min(1).nullish(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;

export const createProjectFileInputSchema = z.object({
  title: z.string().min(1),
  content_markdown: z.string().default(""),
});
export type CreateProjectFileInput = z.infer<typeof createProjectFileInputSchema>;

export const updateProjectFileInputSchema = z.object({
  title: z.string().min(1).optional(),
  content_markdown: z.string().optional(),
});
export type UpdateProjectFileInput = z.infer<typeof updateProjectFileInputSchema>;
