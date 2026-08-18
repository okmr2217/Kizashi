// 予約投稿実行ジョブ。
// 対象: 親を持たないDraft、または can_publish_after_parent=1 のDraftのうち scheduled_at を過ぎたもの。
// 参照: docs/Kizashi 要件定義書 v3.md 「3.4 予約投稿機能」
import { decryptToken, type Draft } from "kizashi-core";
import type { Env } from "../env";
import { createThreadsTextContainer, fetchPublishingLimit, publishThreadsContainer } from "../lib/threadsClient";

interface ThreadsAccountRow {
  id: string;
  threads_user_id: string;
  access_token_encrypted: string;
  is_active: number;
}

const BATCH_LIMIT = 50;

export async function publishScheduledDraftsJob(env: Env): Promise<void> {
  const now = new Date().toISOString();

  const { results: candidates } = await env.DB.prepare(
    `SELECT * FROM drafts
     WHERE status IN ('scheduled', 'ready_to_publish')
       AND scheduled_at IS NOT NULL AND scheduled_at <= ?
       AND (parent_draft_id IS NULL OR can_publish_after_parent = 1)
     ORDER BY scheduled_at ASC
     LIMIT ?`
  )
    .bind(now, BATCH_LIMIT)
    .all<Draft>();

  const quotaCache = new Map<string, { quotaUsage: number; quotaTotal: number }>();

  for (const draft of candidates) {
    const account = await env.DB.prepare(
      "SELECT id, threads_user_id, access_token_encrypted, is_active FROM threads_accounts WHERE id = ?"
    )
      .bind(draft.threads_account_id)
      .first<ThreadsAccountRow>();

    if (!account || !account.is_active) {
      await markPublishFailed(env, draft, "threadsアカウントが連携解除されているため投稿できません");
      continue;
    }

    let quota = quotaCache.get(account.id);
    if (!quota) {
      try {
        const accessToken = await decryptToken(env.TOKEN_ENCRYPTION_KEY, account.access_token_encrypted);
        quota = await fetchPublishingLimit({ threadsUserId: account.threads_user_id, accessToken });
        quotaCache.set(account.id, quota);
      } catch (err) {
        console.error(`publishing limit fetch failed for account ${account.id}: ${String(err)}`);
        continue; // クォータ確認自体が失敗した場合はこのランでは投稿しない
      }
    }

    if (quota.quotaUsage >= quota.quotaTotal) {
      continue; // このアカウントは日次上限に到達済み。次回Cronで再評価
    }

    try {
      const accessToken = await decryptToken(env.TOKEN_ENCRYPTION_KEY, account.access_token_encrypted);
      let replyToId: string | undefined;
      if (draft.parent_draft_id) {
        const parent = await env.DB.prepare("SELECT threads_post_id FROM drafts WHERE id = ?")
          .bind(draft.parent_draft_id)
          .first<{ threads_post_id: string | null }>();
        replyToId = parent?.threads_post_id ?? undefined;
      }

      const container = await createThreadsTextContainer({
        threadsUserId: account.threads_user_id,
        accessToken,
        text: draft.content,
        replyToId,
      });
      const published = await publishThreadsContainer({
        threadsUserId: account.threads_user_id,
        accessToken,
        creationId: container.id,
      });

      const publishedAt = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE drafts SET status = 'published', threads_post_id = ?, published_at = ?, failure_reason = NULL, updated_at = ?
         WHERE id = ?`
      )
        .bind(published.id, publishedAt, publishedAt, draft.id)
        .run();

      quota.quotaUsage += 1;

      // イベント駆動: 親投稿が確定した直後に直下の子を「投稿可能」にする
      await env.DB.prepare(
        `UPDATE drafts SET can_publish_after_parent = 1, status = 'ready_to_publish', updated_at = ?
         WHERE parent_draft_id = ? AND status = 'scheduled'`
      )
        .bind(publishedAt, draft.id)
        .run();
    } catch (err) {
      await markPublishFailed(env, draft, String(err));
    }
  }
}

async function markPublishFailed(env: Env, draft: Draft, reason: string): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(`UPDATE drafts SET status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?`)
    .bind(reason, now, draft.id)
    .run();

  // イベント駆動: 親投稿の失敗が確定した直後に直下の子を投稿保留にする
  await env.DB.prepare(
    `UPDATE drafts SET status = 'failed', failure_reason = ?, updated_at = ?
     WHERE parent_draft_id = ? AND status IN ('scheduled', 'ready_to_publish')`
  )
    .bind(`親Draft(id=${draft.id})の投稿失敗によりスキップされました: ${reason}`, now, draft.id)
    .run();
}
