import { z } from "zod";
import { generateId } from "./ids";

export const DRAFT_STATUSES = [
  "draft",
  "scheduled",
  "ready_to_publish",
  "published",
  "failed",
] as const;

export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export interface Draft {
  id: string;
  user_id: string;
  threads_account_id: string;
  group_id: string | null;
  project_id: string | null;
  parent_draft_id: string | null;
  content: string;
  status: DraftStatus;
  rating: number | null;
  scheduled_at: string | null;
  can_publish_after_parent: number;
  published_at: string | null;
  threads_post_id: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const createDraftInputSchema = z.object({
  threads_account_id: z.string().min(1),
  group_id: z.string().min(1).nullish(),
  project_id: z.string().min(1).nullish(),
  parent_draft_id: z.string().min(1).nullish(),
  content: z.string().min(1, "content is required"),
  rating: z.number().int().min(1).max(5).nullish(),
});

export type CreateDraftInput = z.infer<typeof createDraftInputSchema>;

export const updateDraftInputSchema = z.object({
  group_id: z.string().min(1).nullish(),
  project_id: z.string().min(1).nullish(),
  content: z.string().min(1).optional(),
  rating: z.number().int().min(1).max(5).nullish(),
  status: z.enum(DRAFT_STATUSES).optional(),
});

export type UpdateDraftInput = z.infer<typeof updateDraftInputSchema>;

export const scheduleDraftInputSchema = z.object({
  scheduled_at: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "scheduled_at must be a valid ISO datetime"),
  parent_draft_id: z.string().min(1).nullish(),
});

export type ScheduleDraftInput = z.infer<typeof scheduleDraftInputSchema>;

export const listDraftsQuerySchema = z.object({
  account_id: z.string().min(1).optional(),
  group_id: z.string().min(1).optional(),
  status: z.enum(DRAFT_STATUSES).optional(),
  rating_min: z.coerce.number().int().min(1).max(5).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type ListDraftsQuery = z.infer<typeof listDraftsQuerySchema>;

export interface DraftDb {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results: T[] }>;
    };
  };
}

/**
 * Shared manual-draft-creation logic, reused by kizashi-api and kizashi-mcp
 * so both entry points write drafts through the same validation/DB path.
 */
export async function createDraft(
  db: DraftDb,
  userId: string,
  input: CreateDraftInput
): Promise<Draft> {
  const id = generateId("draft");
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO drafts (
        id, user_id, threads_account_id, group_id, project_id, parent_draft_id,
        content, status, rating, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      input.threads_account_id,
      input.group_id ?? null,
      input.project_id ?? null,
      input.parent_draft_id ?? null,
      input.content,
      input.rating ?? null,
      now,
      now
    )
    .run();

  const draft = await db
    .prepare(`SELECT * FROM drafts WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<Draft>();

  if (!draft) {
    throw new Error("failed to load created draft");
  }
  return draft;
}
