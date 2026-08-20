import { env } from "cloudflare:workers";
import { generateId } from "kizashi-core";
import { beforeEach, describe, expect, it } from "vitest";
import { reconcileParentCompletionJob } from "./reconcileParentCompletion";

interface DraftRow {
  id: string;
  status: string;
  can_publish_after_parent: number;
  failure_reason: string | null;
}

async function createUser(): Promise<string> {
  const userId = generateId("user");
  await env.DB.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
    .bind(userId, `${userId}@example.com`, "dummy-hash")
    .run();
  return userId;
}

async function createDraft(params: {
  userId: string;
  parentDraftId?: string | null;
  status: string;
  canPublishAfterParent?: number;
}): Promise<string> {
  const draftId = generateId("draft");
  await env.DB.prepare(
    `INSERT INTO drafts (id, user_id, parent_draft_id, content, status, can_publish_after_parent)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      draftId,
      params.userId,
      params.parentDraftId ?? null,
      "test content",
      params.status,
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
  await env.DB.exec("DELETE FROM users");
});

describe("reconcileParentCompletionJob", () => {
  it("親がpublished・子がscheduled(can_publish_after_parent=0)の場合、子をready_to_publishにする", async () => {
    const userId = await createUser();
    const parentId = await createDraft({ userId, status: "published" });
    const childId = await createDraft({
      userId,
      parentDraftId: parentId,
      status: "scheduled",
      canPublishAfterParent: 0,
    });

    await reconcileParentCompletionJob(env);

    const child = await getDraft(childId);
    expect(child.status).toBe("ready_to_publish");
    expect(child.can_publish_after_parent).toBe(1);
  });

  it("親がfailedの場合、scheduled/ready_to_publishの子をfailedにする", async () => {
    const userId = await createUser();
    const failedParentId = await createDraft({ userId, status: "failed" });
    const scheduledChildId = await createDraft({
      userId,
      parentDraftId: failedParentId,
      status: "scheduled",
    });
    const readyChildId = await createDraft({
      userId,
      parentDraftId: failedParentId,
      status: "ready_to_publish",
      canPublishAfterParent: 1,
    });

    await reconcileParentCompletionJob(env);

    expect((await getDraft(scheduledChildId)).status).toBe("failed");
    expect((await getDraft(readyChildId)).status).toBe("failed");
  });

  it("親が未確定(draft)のままの子は変化しない（誤発火しない）", async () => {
    const userId = await createUser();
    const pendingParentId = await createDraft({ userId, status: "draft" });
    const childId = await createDraft({
      userId,
      parentDraftId: pendingParentId,
      status: "scheduled",
      canPublishAfterParent: 0,
    });

    await reconcileParentCompletionJob(env);

    const child = await getDraft(childId);
    expect(child.status).toBe("scheduled");
    expect(child.can_publish_after_parent).toBe(0);
  });

  it("既にcan_publish_after_parent=1の子は対象外のままステータスも変化しない", async () => {
    const userId = await createUser();
    const parentId = await createDraft({ userId, status: "published" });
    const childId = await createDraft({
      userId,
      parentDraftId: parentId,
      status: "ready_to_publish",
      canPublishAfterParent: 1,
    });

    await reconcileParentCompletionJob(env);

    const child = await getDraft(childId);
    expect(child.status).toBe("ready_to_publish");
  });
});
