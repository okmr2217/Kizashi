import { Hono } from "hono";
import {
  createDraft,
  createDraftInputSchema,
  updateDraftInputSchema,
  listDraftsQuerySchema,
  scheduleDraftInputSchema,
  generateDraftInputSchema,
  createDraftGenerationJob,
  getDraftGenerationJob,
  runDraftGeneration,
  type Draft,
} from "kizashi-core";
import type { Env } from "../env";
import { requireAuth } from "../middleware/auth";

type Variables = { userId: string };

const drafts = new Hono<{ Bindings: Env; Variables: Variables }>();

drafts.use("*", requireAuth);

drafts.post("/generate", async (c) => {
  const userId = c.get("userId");
  const parsed = generateDraftInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);
  const input = parsed.data;

  if (input.group_id) {
    const group = await c.env.DB.prepare("SELECT id FROM groups WHERE id = ? AND user_id = ?")
      .bind(input.group_id, userId)
      .first();
    if (!group) return c.json({ error: "group_not_found" }, 400);
  }

  if (input.project_id) {
    const project = await c.env.DB.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?")
      .bind(input.project_id, userId)
      .first();
    if (!project) return c.json({ error: "project_not_found" }, 400);
  }

  const job = await createDraftGenerationJob(c.env.DB, userId, input);

  c.executionCtx.waitUntil(
    runDraftGeneration(
      { db: c.env.DB, anthropicApiKey: c.env.ANTHROPIC_API_KEY, anthropicModel: c.env.ANTHROPIC_MODEL },
      job.id,
      userId,
      input
    )
  );

  return c.json({ job_id: job.id, status: job.status }, 202);
});

drafts.get("/generate/:jobId", async (c) => {
  const userId = c.get("userId");
  const jobId = c.req.param("jobId");

  const job = await getDraftGenerationJob(c.env.DB, userId, jobId);
  if (!job) return c.json({ error: "not_found" }, 404);

  return c.json({
    job_id: job.id,
    status: job.status,
    progress_message: job.progress_message,
    draft_id: job.draft_id,
    error_message: job.error_message,
  });
});

drafts.get("/", async (c) => {
  const userId = c.get("userId");
  const parsed = listDraftsQuerySchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);
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

drafts.post("/", async (c) => {
  const userId = c.get("userId");
  const parsed = createDraftInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);

  const draft = await createDraft(c.env.DB, userId, parsed.data);
  return c.json({ draft }, 201);
});

drafts.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const draft = await c.env.DB.prepare("SELECT * FROM drafts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<Draft>();
  if (!draft) return c.json({ error: "not_found" }, 404);

  const { results: snapshots } = await c.env.DB.prepare(
    "SELECT * FROM draft_engagement_snapshots WHERE draft_id = ? ORDER BY snapshot_stage"
  )
    .bind(id)
    .all();

  return c.json({ draft, engagement_snapshots: snapshots });
});

drafts.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare("SELECT * FROM drafts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<Draft>();
  if (!existing) return c.json({ error: "not_found" }, 404);

  const parsed = updateDraftInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);
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

drafts.post("/:id/schedule", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare("SELECT * FROM drafts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<Draft>();
  if (!existing) return c.json({ error: "not_found" }, 404);

  const parsed = scheduleDraftInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);
  const { threads_account_id, scheduled_at, parent_draft_id } = parsed.data;

  const account = await c.env.DB.prepare("SELECT id FROM threads_accounts WHERE id = ? AND user_id = ?")
    .bind(threads_account_id, userId)
    .first();
  if (!account) return c.json({ error: "threads_account_not_found" }, 400);

  let canPublishAfterParent = 1;
  let status: Draft["status"] = "scheduled";

  if (parent_draft_id) {
    if (parent_draft_id === id) {
      return c.json({ error: "validation_error", details: "parent_draft_id must not reference itself" }, 400);
    }

    const parent = await c.env.DB.prepare("SELECT * FROM drafts WHERE id = ? AND user_id = ?")
      .bind(parent_draft_id, userId)
      .first<Draft>();
    if (!parent) return c.json({ error: "parent_draft_not_found" }, 400);
    if (parent.threads_account_id !== threads_account_id) {
      return c.json({ error: "validation_error", details: "parent_draft_id must belong to the same threads account" }, 400);
    }
    if (parent.parent_draft_id === id) {
      return c.json({ error: "validation_error", details: "parent_draft_id must not create a cycle" }, 400);
    }

    if (parent.status === "published" && parent.threads_post_id) {
      canPublishAfterParent = 1;
      status = "ready_to_publish";
    } else {
      canPublishAfterParent = 0;
      status = "scheduled";
    }
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE drafts SET status = ?, threads_account_id = ?, scheduled_at = ?, parent_draft_id = ?, can_publish_after_parent = ?,
       failure_reason = NULL, published_at = NULL, threads_post_id = NULL, updated_at = ?
     WHERE id = ? AND user_id = ?`
  )
    .bind(status, threads_account_id, scheduled_at, parent_draft_id ?? null, canPublishAfterParent, now, id, userId)
    .run();

  const draft = await c.env.DB.prepare("SELECT * FROM drafts WHERE id = ?")
    .bind(id)
    .first<Draft>();
  return c.json({ draft });
});

drafts.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare("SELECT id FROM drafts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first();
  if (!existing) return c.json({ error: "not_found" }, 404);

  await c.env.DB.prepare("DELETE FROM drafts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return c.body(null, 204);
});

export default drafts;
