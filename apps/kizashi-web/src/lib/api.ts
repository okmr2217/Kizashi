const API_BASE_URL = process.env.NEXT_PUBLIC_KIZASHI_API_URL ?? "http://localhost:8787";
const SESSION_COOKIE_NAME = "kizashi_session";

export type DraftStatus =
  | "draft"
  | "scheduled"
  | "ready_to_publish"
  | "published"
  | "failed";

export interface Draft {
  id: string;
  user_id: string;
  threads_account_id: string | null;
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

export interface EngagementSnapshot {
  id: string;
  draft_id: string;
  snapshot_stage: "1h" | "24h" | "72h" | "7d";
  fetched_at: string;
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
  fetch_failed: number;
}

export interface Group {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  default_group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThreadsAccount {
  id: string;
  threads_user_id: string;
  display_name: string | null;
  token_expires_at: string;
  is_active: number;
  created_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  title: string;
  content_markdown: string;
  created_at: string;
  updated_at: string;
}

export interface GroupRatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface GroupStats {
  group_id: string;
  draft_count: number;
  rated_draft_count: number;
  average_rating: number | null;
  rating_distribution: GroupRatingDistribution;
  confirmed_engagement_draft_count: number;
  average_views: number | null;
  average_likes: number | null;
  average_replies: number | null;
  average_reposts: number | null;
  average_quotes: number | null;
}

export const API_KEY_SCOPES = ["drafts:read", "drafts:write", "projects:read"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export interface ApiKeySummary {
  id: string;
  user_id: string;
  name: string;
  scopes: ApiKeyScope[];
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
  }
}

async function serverCookieHeader(): Promise<string | undefined> {
  if (typeof window !== "undefined") return undefined;
  // Server Components/Actions run on the API's behalf but fetch() does not
  // forward the browser's cookies automatically, so re-attach the session
  // cookie from the incoming request here for SSR data fetching.
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const session = store.get(SESSION_COOKIE_NAME);
  return session ? `${SESSION_COOKIE_NAME}=${session.value}` : undefined;
}

async function getServerFetcher(): Promise<typeof fetch | undefined> {
  if (typeof window !== "undefined") return undefined;
  // On Cloudflare Workers, calling the API's *.workers.dev URL via the global
  // fetch() triggers Cloudflare error 1042 (Workers cannot fetch another
  // Cloudflare-proxied origin directly). Route through the service binding
  // instead; falls back to undefined for `next dev`, where no binding exists.
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const api = (env as { API?: { fetch: typeof fetch } }).API;
    return api ? api.fetch.bind(api) : undefined;
  } catch {
    return undefined;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieHeader = await serverCookieHeader();
  const fetcher = (await getServerFetcher()) ?? fetch;

  const res = await fetcher(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let details: unknown;
    try {
      details = await res.json();
    } catch {
      // ignore body parse failure
    }
    throw new ApiError(`Request to ${path} failed with ${res.status}`, res.status, details);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export interface DraftFilters {
  account_id?: string;
  group_id?: string;
  status?: DraftStatus;
  rating_min?: number;
}

export function buildDraftQuery(filters: DraftFilters): string {
  const params = new URLSearchParams();
  if (filters.account_id) params.set("account_id", filters.account_id);
  if (filters.group_id) params.set("group_id", filters.group_id);
  if (filters.status) params.set("status", filters.status);
  if (filters.rating_min) params.set("rating_min", String(filters.rating_min));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  listDrafts: (filters: DraftFilters = {}) =>
    request<{ drafts: Draft[] }>(`/drafts${buildDraftQuery(filters)}`),
  getDraft: (id: string) =>
    request<{ draft: Draft; engagement_snapshots: EngagementSnapshot[] }>(`/drafts/${id}`),
  createDraft: (input: {
    group_id?: string | null;
    project_id?: string | null;
    content: string;
    rating?: number | null;
  }) =>
    request<{ draft: Draft }>("/drafts", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateDraft: (
    id: string,
    input: Partial<{
      content: string;
      group_id: string | null;
      project_id: string | null;
      rating: number | null;
      status: DraftStatus;
    }>
  ) =>
    request<{ draft: Draft }>(`/drafts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteDraft: (id: string) =>
    request<void>(`/drafts/${id}`, { method: "DELETE" }),

  listGroups: () => request<{ groups: Group[] }>("/groups"),
  createGroup: (input: { name: string; description?: string | null }) =>
    request<{ group: Group }>("/groups", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateGroup: (id: string, input: Partial<{ name: string; description: string | null }>) =>
    request<{ group: Group }>(`/groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteGroup: (id: string) => request<void>(`/groups/${id}`, { method: "DELETE" }),
  getGroupStats: (id: string) => request<{ stats: GroupStats }>(`/groups/${id}/stats`),

  listProjects: () => request<{ projects: Project[] }>("/projects"),
  createProject: (input: { name: string; default_group_id?: string | null }) =>
    request<{ project: Project }>("/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProject: (
    id: string,
    input: Partial<{ name: string; default_group_id: string | null }>
  ) =>
    request<{ project: Project }>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" }),

  listProjectFiles: (projectId: string) =>
    request<{ files: ProjectFile[] }>(`/projects/${projectId}/files`),
  createProjectFile: (projectId: string, input: { title: string; content_markdown: string }) =>
    request<{ file: ProjectFile }>(`/projects/${projectId}/files`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateProjectFile: (
    projectId: string,
    fileId: string,
    input: Partial<{ title: string; content_markdown: string }>
  ) =>
    request<{ file: ProjectFile }>(`/projects/${projectId}/files/${fileId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteProjectFile: (projectId: string, fileId: string) =>
    request<void>(`/projects/${projectId}/files/${fileId}`, { method: "DELETE" }),

  listThreadsAccounts: () =>
    request<{ accounts: ThreadsAccount[] }>("/threads-accounts"),
  deleteThreadsAccount: (id: string) =>
    request<{ ok: true }>(`/threads-accounts/${id}`, { method: "DELETE" }),

  listApiKeys: () => request<{ api_keys: ApiKeySummary[] }>("/api-keys"),
  createApiKey: (input: { name: string; scopes: ApiKeyScope[] }) =>
    request<{ api_key: ApiKeySummary; key: string }>("/api-keys", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteApiKey: (id: string) => request<void>(`/api-keys/${id}`, { method: "DELETE" }),

  signup: (input: { email: string; password: string }) =>
    request<{ id: string; email: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  login: (input: { email: string; password: string }) =>
    request<{ id: string; email: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
};

export { ApiError };
