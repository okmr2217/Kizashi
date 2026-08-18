import { Hono } from "hono";
import {
  generateId,
  createProjectInputSchema,
  updateProjectInputSchema,
  createProjectFileInputSchema,
  updateProjectFileInputSchema,
  type Project,
  type ProjectFile,
} from "kizashi-core";
import type { Env } from "../env";
import { requireAuth } from "../middleware/auth";

type Variables = { userId: string };

const projects = new Hono<{ Bindings: Env; Variables: Variables }>();

projects.use("*", requireAuth);

async function getOwnedProject(env: Env, userId: string, id: string) {
  return env.DB.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<Project>();
}

projects.get("/", async (c) => {
  const userId = c.get("userId");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC"
  )
    .bind(userId)
    .all<Project>();
  return c.json({ projects: results });
});

projects.post("/", async (c) => {
  const userId = c.get("userId");
  const parsed = createProjectInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);

  const id = generateId("project");
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    "INSERT INTO projects (id, user_id, name, default_group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, userId, parsed.data.name, parsed.data.default_group_id ?? null, now, now)
    .run();

  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first<Project>();
  return c.json({ project }, 201);
});

projects.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const parsed = updateProjectInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);

  const existing = await getOwnedProject(c.env, userId, id);
  if (!existing) return c.json({ error: "not_found" }, 404);

  const name = parsed.data.name ?? existing.name;
  const defaultGroupId =
    parsed.data.default_group_id !== undefined
      ? parsed.data.default_group_id
      : existing.default_group_id;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "UPDATE projects SET name = ?, default_group_id = ?, updated_at = ? WHERE id = ? AND user_id = ?"
  )
    .bind(name, defaultGroupId, now, id, userId)
    .run();

  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first<Project>();
  return c.json({ project });
});

projects.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await getOwnedProject(c.env, userId, id);
  if (!existing) return c.json({ error: "not_found" }, 404);

  await c.env.DB.prepare("DELETE FROM project_files WHERE project_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return c.body(null, 204);
});

projects.get("/:id/files", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const project = await getOwnedProject(c.env, userId, id);
  if (!project) return c.json({ error: "not_found" }, 404);

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM project_files WHERE project_id = ? ORDER BY created_at DESC"
  )
    .bind(id)
    .all<ProjectFile>();
  return c.json({ files: results });
});

projects.post("/:id/files", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const project = await getOwnedProject(c.env, userId, id);
  if (!project) return c.json({ error: "not_found" }, 404);

  const parsed = createProjectFileInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);

  const fileId = generateId("pfile");
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    "INSERT INTO project_files (id, project_id, title, content_markdown, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(fileId, id, parsed.data.title, parsed.data.content_markdown, now, now)
    .run();

  const file = await c.env.DB.prepare("SELECT * FROM project_files WHERE id = ?")
    .bind(fileId)
    .first<ProjectFile>();
  return c.json({ file }, 201);
});

projects.patch("/:id/files/:fileId", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const fileId = c.req.param("fileId");

  const project = await getOwnedProject(c.env, userId, id);
  if (!project) return c.json({ error: "not_found" }, 404);

  const existing = await c.env.DB.prepare(
    "SELECT * FROM project_files WHERE id = ? AND project_id = ?"
  )
    .bind(fileId, id)
    .first<ProjectFile>();
  if (!existing) return c.json({ error: "not_found" }, 404);

  const parsed = updateProjectFileInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);

  const title = parsed.data.title ?? existing.title;
  const contentMarkdown = parsed.data.content_markdown ?? existing.content_markdown;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "UPDATE project_files SET title = ?, content_markdown = ?, updated_at = ? WHERE id = ? AND project_id = ?"
  )
    .bind(title, contentMarkdown, now, fileId, id)
    .run();

  const file = await c.env.DB.prepare("SELECT * FROM project_files WHERE id = ?")
    .bind(fileId)
    .first<ProjectFile>();
  return c.json({ file });
});

projects.delete("/:id/files/:fileId", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const fileId = c.req.param("fileId");

  const project = await getOwnedProject(c.env, userId, id);
  if (!project) return c.json({ error: "not_found" }, 404);

  const existing = await c.env.DB.prepare(
    "SELECT id FROM project_files WHERE id = ? AND project_id = ?"
  )
    .bind(fileId, id)
    .first();
  if (!existing) return c.json({ error: "not_found" }, 404);

  await c.env.DB.prepare("DELETE FROM project_files WHERE id = ? AND project_id = ?")
    .bind(fileId, id)
    .run();
  return c.body(null, 204);
});

export default projects;
