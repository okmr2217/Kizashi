import {
  DRAFT_STATUSES,
  listDraftsQuerySchema,
  createDraftInputSchema,
  createDraft,
  getGroupEngagementStats,
  type Draft,
  type Project,
  type ProjectFile,
  type ApiKeyScope,
} from "kizashi-core";
import type { Env } from "./env";

export class ToolError extends Error {
  constructor(
    message: string,
    public readonly code: "validation_error" | "not_found" = "validation_error"
  ) {
    super(message);
  }
}

export interface ToolContext {
  env: Env;
  userId: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  scope: ApiKeyScope;
  inputSchema: Record<string, unknown>;
  handler: (ctx: ToolContext, args: unknown) => Promise<unknown>;
}

async function getOwnedGroup(env: Env, userId: string, groupId: string) {
  return env.DB.prepare("SELECT id FROM groups WHERE id = ? AND user_id = ?")
    .bind(groupId, userId)
    .first();
}

async function getOwnedProject(env: Env, userId: string, projectId: string) {
  return env.DB.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?")
    .bind(projectId, userId)
    .first<Project>();
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "list_drafts",
    description: "条件フィルタ済みDraft一覧（軽量版）を取得する",
    scope: "drafts:read",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "Threadsアカウント絞り込み" },
        group_id: { type: "string", description: "グループ絞り込み" },
        status: { type: "string", enum: [...DRAFT_STATUSES] },
        rating_min: { type: "integer", minimum: 1, maximum: 5 },
        limit: { type: "integer", minimum: 1, maximum: 200 },
        offset: { type: "integer", minimum: 0 },
      },
      additionalProperties: false,
    },
    handler: async ({ env, userId }, args) => {
      const parsed = listDraftsQuerySchema.safeParse(args ?? {});
      if (!parsed.success) throw new ToolError(parsed.error.message);
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

      const { results } = await env.DB.prepare(
        `SELECT * FROM drafts WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
        .bind(...params)
        .all<Draft>();

      return { drafts: results };
    },
  },
  {
    name: "get_draft",
    description: "Draft詳細（本文・評価・全エンゲージメントスナップショット）を取得する",
    scope: "drafts:read",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async ({ env, userId }, args) => {
      const id = (args as { id?: unknown } | null)?.id;
      if (typeof id !== "string" || id.length === 0) {
        throw new ToolError("id is required");
      }

      const draft = await env.DB.prepare("SELECT * FROM drafts WHERE id = ? AND user_id = ?")
        .bind(id, userId)
        .first<Draft>();
      if (!draft) throw new ToolError("draft not found", "not_found");

      const { results: engagement_snapshots } = await env.DB.prepare(
        "SELECT * FROM draft_engagement_snapshots WHERE draft_id = ? ORDER BY snapshot_stage"
      )
        .bind(id)
        .all();

      return { draft, engagement_snapshots };
    },
  },
  {
    name: "get_group_stats",
    description: "グループ単位の実績サマリー（評価分布・確定エンゲージメント平均値）を取得する",
    scope: "drafts:read",
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string" },
      },
      required: ["group_id"],
      additionalProperties: false,
    },
    handler: async ({ env, userId }, args) => {
      const groupId = (args as { group_id?: unknown } | null)?.group_id;
      if (typeof groupId !== "string" || groupId.length === 0) {
        throw new ToolError("group_id is required");
      }

      const group = await getOwnedGroup(env, userId, groupId);
      if (!group) throw new ToolError("group not found", "not_found");

      const stats = await getGroupEngagementStats(env.DB, userId, groupId);
      return { stats };
    },
  },
  {
    name: "list_projects",
    description: "プロジェクト一覧＋参照ファイルタイトル一覧を取得する",
    scope: "projects:read",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async ({ env, userId }) => {
      const { results: projects } = await env.DB.prepare(
        "SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC"
      )
        .bind(userId)
        .all<Project>();

      if (projects.length === 0) return { projects: [] };

      const placeholders = projects.map(() => "?").join(", ");
      const { results: files } = await env.DB.prepare(
        `SELECT id, project_id, title FROM project_files WHERE project_id IN (${placeholders}) ORDER BY created_at DESC`
      )
        .bind(...projects.map((p) => p.id))
        .all<Pick<ProjectFile, "id" | "project_id" | "title">>();

      const filesByProject = new Map<string, Array<Pick<ProjectFile, "id" | "project_id" | "title">>>();
      for (const file of files) {
        const list = filesByProject.get(file.project_id) ?? [];
        list.push(file);
        filesByProject.set(file.project_id, list);
      }

      return {
        projects: projects.map((project) => ({
          ...project,
          files: filesByProject.get(project.id) ?? [],
        })),
      };
    },
  },
  {
    name: "get_project_file",
    description: "参照ファイルのMarkdown本文を取得する",
    scope: "projects:read",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        file_id: { type: "string" },
      },
      required: ["project_id", "file_id"],
      additionalProperties: false,
    },
    handler: async ({ env, userId }, args) => {
      const { project_id, file_id } = (args ?? {}) as { project_id?: unknown; file_id?: unknown };
      if (typeof project_id !== "string" || !project_id || typeof file_id !== "string" || !file_id) {
        throw new ToolError("project_id and file_id are required");
      }

      const project = await getOwnedProject(env, userId, project_id);
      if (!project) throw new ToolError("project not found", "not_found");

      const file = await env.DB.prepare(
        "SELECT * FROM project_files WHERE id = ? AND project_id = ?"
      )
        .bind(file_id, project_id)
        .first<ProjectFile>();
      if (!file) throw new ToolError("project file not found", "not_found");

      return { file };
    },
  },
  {
    name: "create_draft",
    description: "Draftを新規作成する（書き込み系）",
    scope: "drafts:write",
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "string" },
        project_id: { type: "string" },
        parent_draft_id: { type: "string" },
        content: { type: "string" },
        rating: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["content"],
      additionalProperties: false,
    },
    handler: async ({ env, userId }, args) => {
      const parsed = createDraftInputSchema.safeParse(args ?? {});
      if (!parsed.success) throw new ToolError(parsed.error.message);

      const draft = await createDraft(env.DB, userId, parsed.data);
      return { draft };
    },
  },
];

export function findTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
