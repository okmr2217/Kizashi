import { Hono } from "hono";
import { generateId, createGroupInputSchema, updateGroupInputSchema, type Group } from "kizashi-core";
import type { Env } from "../env";
import { requireAuth } from "../middleware/auth";

type Variables = { userId: string };

const groups = new Hono<{ Bindings: Env; Variables: Variables }>();

groups.use("*", requireAuth);

groups.get("/", async (c) => {
  const userId = c.get("userId");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM groups WHERE user_id = ? ORDER BY created_at DESC"
  )
    .bind(userId)
    .all<Group>();
  return c.json({ groups: results });
});

groups.post("/", async (c) => {
  const userId = c.get("userId");
  const parsed = createGroupInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);

  const id = generateId("group");
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    "INSERT INTO groups (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, userId, parsed.data.name, parsed.data.description ?? null, now, now)
    .run();

  const group = await c.env.DB.prepare("SELECT * FROM groups WHERE id = ?")
    .bind(id)
    .first<Group>();
  return c.json({ group }, 201);
});

groups.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const parsed = updateGroupInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);

  const existing = await c.env.DB.prepare(
    "SELECT * FROM groups WHERE id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .first<Group>();
  if (!existing) return c.json({ error: "not_found" }, 404);

  const name = parsed.data.name ?? existing.name;
  const description =
    parsed.data.description !== undefined ? parsed.data.description : existing.description;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "UPDATE groups SET name = ?, description = ?, updated_at = ? WHERE id = ? AND user_id = ?"
  )
    .bind(name, description, now, id, userId)
    .run();

  const group = await c.env.DB.prepare("SELECT * FROM groups WHERE id = ?")
    .bind(id)
    .first<Group>();
  return c.json({ group });
});

groups.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM groups WHERE id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .first();
  if (!existing) return c.json({ error: "not_found" }, 404);

  await c.env.DB.prepare("DELETE FROM groups WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return c.body(null, 204);
});

export default groups;
