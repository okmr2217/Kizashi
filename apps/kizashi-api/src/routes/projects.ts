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
import type { Env, AppVariables } from "../types";
import { notFound, zodErrorResponse } from "../lib/errors";

export const projectsRoute = new Hono<{ Bindings: Env; Variables: AppVariables }>();

async function getOwnedProject(env: Env, userId: string, id: string) {
  return env.DB.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<Project>();
}

projectsRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC"
  )
    .bind(userId)
    .all<Project>();
  return c.json({ projects: results });
});

projectsRoute.post("/", async (c) => {
  const userId = c.get("userId");
  const parsed = createProjectInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return zodErrorResponse(c, parsed.error);

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

projectsRoute.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const parsed = updateProjectInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return zodErrorResponse(c, parsed.error);

  const existing = await getOwnedProject(c.env, userId, id);
  if (!existing) return notFound(c, "project");

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

projectsRoute.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const existing = await getOwnedProject(c.env, userId, id);
  if (!existing) return notFound(c, "project");

  await c.env.DB.prepare("DELETE FROM project_files WHERE project_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return c.body(null, 204);
});

projectsRoute.get("/:id/files", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const project = await getOwnedProject(c.env, userId, id);
  if (!project) return notFound(c, "project");

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM project_files WHERE project_id = ? ORDER BY created_at DESC"
  )
    .bind(id)
    .all<ProjectFile>();
  return c.json({ files: results });
});

projectsRoute.post("/:id/files", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const project = await getOwnedProject(c.env, userId, id);
  if (!project) return notFound(c, "project");

  const parsed = createProjectFileInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return zodErrorResponse(c, parsed.error);

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

projectsRoute.patch("/:id/files/:fileId", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const fileId = c.req.param("fileId");

  const project = await getOwnedProject(c.env, userId, id);
  if (!project) return notFound(c, "project");

  const existing = await c.env.DB.prepare(
    "SELECT * FROM project_files WHERE id = ? AND project_id = ?"
  )
    .bind(fileId, id)
    .first<ProjectFile>();
  if (!existing) return notFound(c, "project_file");

  const parsed = updateProjectFileInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return zodErrorResponse(c, parsed.error);

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

projectsRoute.delete("/:id/files/:fileId", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const fileId = c.req.param("fileId");

  const project = await getOwnedProject(c.env, userId, id);
  if (!project) return notFound(c, "project");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM project_files WHERE id = ? AND project_id = ?"
  )
    .bind(fileId, id)
    .first();
  if (!existing) return notFound(c, "project_file");

  await c.env.DB.prepare("DELETE FROM project_files WHERE id = ? AND project_id = ?")
    .bind(fileId, id)
    .run();
  return c.body(null, 204);
});
