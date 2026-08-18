import { Hono } from "hono";
import {
  createDraft,
  createDraftInputSchema,
  updateDraftInputSchema,
  listDraftsQuerySchema,
  type Draft,
} from "kizashi-core";
import type { Env, AppVariables } from "../types";
import { notFound, zodErrorResponse } from "../lib/errors";

export const draftsRoute = new Hono<{ Bindings: Env; Variables: AppVariables }>();

draftsRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const parsed = listDraftsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return zodErrorResponse(c, parsed.error);
  const { account_id, group_id, status, rating_min, limit = 50, offset = 0 } = parsed.data;

  const conditions = ["user_id = ?"];
  const params: unknown[] = [userId];

  if (account_id) {
    conditions.push("threads_account_id = ?");
    params.push(account_id);
  }
  if (group_id) {
    conditions.push("group_id = ?");
    params.push(group_id);
  }
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (rating_min !== undefined) {
    conditions.push("rating >= ?");
    params.push(rating_min);
  }

  const where = conditions.join(" AND ");
  params.push(limit, offset);

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM drafts WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  )
    .bind(...params)
    .all<Draft>();

  return c.json({ drafts: results });
});

draftsRoute.post("/", async (c) => {
  const userId = c.get("userId");
  const parsed = createDraftInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return zodErrorResponse(c, parsed.error);

  const draft = await createDraft(c.env.DB, userId, parsed.data);
  return c.json({ draft }, 201);
});

draftsRoute.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const draft = await c.env.DB.prepare("SELECT * FROM drafts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<Draft>();
  if (!draft) return notFound(c, "draft");

  const { results: snapshots } = await c.env.DB.prepare(
    "SELECT * FROM draft_engagement_snapshots WHERE draft_id = ? ORDER BY snapshot_stage"
  )
    .bind(id)
    .all();

  return c.json({ draft, engagement_snapshots: snapshots });
});

draftsRoute.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare("SELECT * FROM drafts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<Draft>();
  if (!existing) return notFound(c, "draft");

  const parsed = updateDraftInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return zodErrorResponse(c, parsed.error);
  const data = parsed.data;

  const content = data.content ?? existing.content;
  const groupId = data.group_id !== undefined ? data.group_id : existing.group_id;
  const projectId = data.project_id !== undefined ? data.project_id : existing.project_id;
  const rating = data.rating !== undefined ? data.rating : existing.rating;
  const status = data.status ?? existing.status;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE drafts SET content = ?, group_id = ?, project_id = ?, rating = ?, status = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(content, groupId, projectId, rating, status, now, id, userId)
    .run();

  const draft = await c.env.DB.prepare("SELECT * FROM drafts WHERE id = ?")
    .bind(id)
    .first<Draft>();
  return c.json({ draft });
});

draftsRoute.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare("SELECT id FROM drafts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first();
  if (!existing) return notFound(c, "draft");

  await c.env.DB.prepare("DELETE FROM drafts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return c.body(null, 204);
});
