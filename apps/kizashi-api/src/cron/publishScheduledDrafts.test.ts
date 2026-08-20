import { env } from "cloudflare:workers";
import { encryptToken, generateId } from "kizashi-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publishScheduledDraftsJob } from "./publishScheduledDrafts";

// threadsClient.ts はグローバルfetchを直接呼ぶため、Threads Graph APIへの実HTTP呼び出しを
// URLパターンでルーティングするフェイクfetchに差し替える（vi.mockは@cloudflare/vitest-pluginの
// Workers実行環境では相対import先を差し替えられないため使わない）。
interface FetchState {
  quotaUsage: number;
  quotaTotal: number;
  publishShouldFail: boolean;
  calledUrls: string[];
}

let fetchState: FetchState;

function installFetchStub() {
  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    fetchState.calledUrls.push(`${init?.method ?? "GET"} ${url.pathname}`);

    if (url.pathname.endsWith("/threads_publishing_limit")) {
      return new Response(
        JSON.stringify({
          data: [
            {
              quota_usage: fetchState.quotaUsage,
              config: { quota_total: fetchState.quotaTotal },
            },
          ],
        }),
        { status: 200 }
      );
    }
    if (url.pathname.endsWith("/threads_publish")) {
      if (fetchState.publishShouldFail) {
        return new Response("publish failed", { status: 500 });
      }
      return new Response(JSON.stringify({ id: "threads_post_1" }), { status: 200 });
    }
    if (url.pathname.endsWith("/threads")) {
      return new Response(JSON.stringify({ id: "container_1" }), { status: 200 });
    }
    throw new Error(`unexpected fetch to ${url.toString()}`);
  });
  vi.stubGlobal("fetch", stub);
}

interface DraftRow {
  id: string;
  status: string;
  can_publish_after_parent: number;
  failure_reason: string | null;
  threads_post_id: string | null;
}

async function createUser(): Promise<string> {
  const userId = generateId("user");
  await env.DB.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
    .bind(userId, `${userId}@example.com`, "dummy-hash")
    .run();
  return userId;
}

async function createThreadsAccount(userId: string, isActive = 1): Promise<string> {
  const accountId = generateId("account");
  const encrypted = await encryptToken(env.TOKEN_ENCRYPTION_KEY, "dummy-access-token");
  await env.DB.prepare(
    `INSERT INTO threads_accounts
      (id, user_id, threads_user_id, access_token_encrypted, token_expires_at, is_active)
     VALUES (?, ?, ?, ?, datetime('now', '+60 days'), ?)`
  )
    .bind(accountId, userId, `threads_user_${accountId}`, encrypted, isActive)
    .run();
  return accountId;
}

async function createDraft(params: {
  userId: string;
  accountId: string;
  parentDraftId?: string | null;
  status?: string;
  canPublishAfterParent?: number;
  scheduledAt?: string;
}): Promise<string> {
  const draftId = generateId("draft");
  await env.DB.prepare(
    `INSERT INTO drafts
      (id, user_id, threads_account_id, parent_draft_id, content, status, scheduled_at, can_publish_after_parent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      draftId,
      params.userId,
      params.accountId,
      params.parentDraftId ?? null,
      "test content",
      params.status ?? "scheduled",
      params.scheduledAt ?? "2000-01-01T00:00:00.000Z",
      params.canPublishAfterParent ?? 0
    )
    .run();
  return draftId;
}

async function getDraft(id: string): Promise<DraftRow> {
  const row = await env.DB.prepare("SELECT * FROM drafts WHERE id = ?").bind(id).first<DraftRow>();
  if (!row) throw new Error(`draft ${id} not found`);
  return row;
}

beforeEach(async () => {
  await env.DB.exec("DELETE FROM drafts");
  await env.DB.exec("DELETE FROM threads_accounts");
  await env.DB.exec("DELETE FROM users");
  fetchState = { quotaUsage: 0, quotaTotal: 250, publishShouldFail: false, calledUrls: [] };
  installFetchStub();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publishScheduledDraftsJob", () => {
  it("親を持たないDraftは正常投稿されpublishedになる", async () => {
    const userId = await createUser();
    const accountId = await createThreadsAccount(userId);
    const draftId = await createDraft({ userId, accountId });

    await publishScheduledDraftsJob(env);

    const draft = await getDraft(draftId);
    expect(draft.status).toBe("published");
    expect(draft.threads_post_id).toBe("threads_post_1");
  });

  it("親投稿が成功した直後、直下の子Draftがready_to_publishになる（イベント駆動）", async () => {
    const userId = await createUser();
    const accountId = await createThreadsAccount(userId);
    const parentId = await createDraft({ userId, accountId });
    const childId = await createDraft({
      userId,
      accountId,
      parentDraftId: parentId,
      status: "scheduled",
      canPublishAfterParent: 0,
    });

    await publishScheduledDraftsJob(env);

    const parent = await getDraft(parentId);
    const child = await getDraft(childId);
    expect(parent.status).toBe("published");
    expect(child.status).toBe("ready_to_publish");
    expect(child.can_publish_after_parent).toBe(1);
  });

  it("親投稿が失敗した場合、親と直下の子がfailedになり子のfailure_reasonに親IDが含まれる", async () => {
    fetchState.publishShouldFail = true;

    const userId = await createUser();
    const accountId = await createThreadsAccount(userId);
    const parentId = await createDraft({ userId, accountId });
    const childId = await createDraft({
      userId,
      accountId,
      parentDraftId: parentId,
      status: "scheduled",
      canPublishAfterParent: 0,
    });

    await publishScheduledDraftsJob(env);

    const parent = await getDraft(parentId);
    const child = await getDraft(childId);
    expect(parent.status).toBe("failed");
    expect(child.status).toBe("failed");
    expect(child.failure_reason).toContain(parentId);
  });

  it("日次クォータに到達しているアカウントのDraftは投稿がスキップされる", async () => {
    fetchState.quotaUsage = 250;

    const userId = await createUser();
    const accountId = await createThreadsAccount(userId);
    const draftId = await createDraft({ userId, accountId });

    await publishScheduledDraftsJob(env);

    expect(fetchState.calledUrls.some((u) => u.endsWith("/threads_publish"))).toBe(false);
    const draft = await getDraft(draftId);
    expect(draft.status).toBe("scheduled");
  });

  it("連携解除済み(is_active=0)アカウントのDraftはfailedになり、Threads APIは呼ばれない", async () => {
    const userId = await createUser();
    const accountId = await createThreadsAccount(userId, 0);
    const draftId = await createDraft({ userId, accountId });

    await publishScheduledDraftsJob(env);

    expect(fetchState.calledUrls).toHaveLength(0);
    const draft = await getDraft(draftId);
    expect(draft.status).toBe("failed");
  });
});
