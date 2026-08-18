import { Hono } from "hono";
import { generateId, createGroupInputSchema, updateGroupInputSchema, type Group } from "kizashi-core";
import type { Env, AppVariables } from "../types";
import { notFound, zodErrorResponse } from "../lib/errors";

export const groupsRoute = new Hono<{ Bindings: Env; Variables: AppVariables }>();

groupsRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM groups WHERE user_id = ? ORDER BY created_at DESC"
  )
    .bind(userId)
    .all<Group>();
  return c.json({ groups: results });
});

groupsRoute.post("/", async (c) => {
  const userId = c.get("userId");
  const parsed = createGroupInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return zodErrorResponse(c, parsed.error);

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

groupsRoute.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const parsed = updateGroupInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return zodErrorResponse(c, parsed.error);

  const existing = await c.env.DB.prepare(
    "SELECT * FROM groups WHERE id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .first<Group>();
  if (!existing) return notFound(c, "group");

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

groupsRoute.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM groups WHERE id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .first();
  if (!existing) return notFound(c, "group");

  await c.env.DB.prepare("DELETE FROM groups WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return c.body(null, 204);
});
