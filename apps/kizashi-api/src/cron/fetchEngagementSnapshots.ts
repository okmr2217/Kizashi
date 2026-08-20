// エンゲージメントスナップショット取得ジョブ。
// 投稿後 1h/24h/72h/7d の各タイミングでthreads_manage_insightsを叩き、
// draft_engagement_snapshots に時系列スナップショットとして保存する（上書きではなく各ステージ1レコード）。
// 7dスナップショットは「確定値」としてAIフィードバックに使う値のため、取得後は再取得しない。
// 取得失敗時は同一ジョブ内で3回までリトライし、それでも失敗したら fetch_failed を立てて記録する
// （このDBフラグがdraftsのfailure_reasonと同様の「通知」手段。現状は自動再試行の通知UIは無いため、
// 　Draft詳細/グループ実績画面から利用者が気づける状態にする）。
// 参照: docs/Kizashi 設計書 v1.md 「2. 実測エンゲージメントデータ設計」
import {
  decryptToken,
  saveEngagementSnapshot,
  ENGAGEMENT_SNAPSHOT_STAGES,
  ENGAGEMENT_SNAPSHOT_OFFSET_MS,
  CONFIRMED_ENGAGEMENT_SNAPSHOT_STAGE,
  type Draft,
  type EngagementSnapshotStage,
} from "kizashi-core";
import type { Env } from "../env";
import { fetchThreadsMediaInsights } from "../lib/threadsClient";

interface ThreadsAccountRow {
  access_token_encrypted: string;
}

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const BATCH_LIMIT = 100;

// 7d確定値の取得を過ぎたDraftはこれ以上対象にならないため、
// 7d猶予 + 1日のマージンより古い投稿は候補から外して毎回のスキャン件数を抑える。
const CANDIDATE_WINDOW_MS = ENGAGEMENT_SNAPSHOT_OFFSET_MS[CONFIRMED_ENGAGEMENT_SNAPSHOT_STAGE] + 24 * 60 * 60 * 1000;

export async function fetchEngagementSnapshotsJob(env: Env): Promise<void> {
  const now = Date.now();
  const earliestPublishedAt = new Date(now - CANDIDATE_WINDOW_MS).toISOString();

  const { results: candidates } = await env.DB.prepare(
    `SELECT * FROM drafts
     WHERE status = 'published' AND threads_post_id IS NOT NULL AND published_at >= ?
     ORDER BY published_at ASC
     LIMIT ?`
  )
    .bind(earliestPublishedAt, BATCH_LIMIT)
    .all<Draft>();

  for (const draft of candidates) {
    const publishedAtMs = Date.parse(draft.published_at as string);

    for (const stage of ENGAGEMENT_SNAPSHOT_STAGES) {
      const dueAtMs = publishedAtMs + ENGAGEMENT_SNAPSHOT_OFFSET_MS[stage];
      if (now < dueAtMs) continue; // まだこのステージの取得タイミングに達していない

      const existing = await env.DB.prepare(
        `SELECT id FROM draft_engagement_snapshots WHERE draft_id = ? AND snapshot_stage = ?`
      )
        .bind(draft.id, stage)
        .first<{ id: string }>();
      // 既にこのステージのレコードがあれば、成功済み・リトライ済み失敗のどちらでも再取得しない
      // （publishScheduledDraftsJobの「一度failedになったdraftはcron対象から外れる」方針と同じ）
      if (existing) continue;

      await fetchAndSaveStage(env, draft, stage);
    }
  }
}

async function fetchAndSaveStage(env: Env, draft: Draft, stage: EngagementSnapshotStage): Promise<void> {
  const account = await env.DB.prepare(`SELECT access_token_encrypted FROM threads_accounts WHERE id = ?`)
    .bind(draft.threads_account_id)
    .first<ThreadsAccountRow>();

  if (!account) {
    await markFetchFailed(env, draft, stage, "threadsアカウントが見つかりません");
    return;
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const accessToken = await decryptToken(env.TOKEN_ENCRYPTION_KEY, account.access_token_encrypted);
      const metrics = await fetchThreadsMediaInsights({
        mediaId: draft.threads_post_id as string,
        accessToken,
      });
      await saveEngagementSnapshot(env.DB, {
        draftId: draft.id,
        stage,
        fetchedAt: new Date().toISOString(),
        metrics,
        fetchFailed: false,
      });
      return;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }

  await markFetchFailed(env, draft, stage, String(lastError));
}

async function markFetchFailed(
  env: Env,
  draft: Draft,
  stage: EngagementSnapshotStage,
  reason: string
): Promise<void> {
  await saveEngagementSnapshot(env.DB, {
    draftId: draft.id,
    stage,
    fetchedAt: new Date().toISOString(),
    metrics: null,
    fetchFailed: true,
  });
  console.error(
    `engagement snapshot fetch failed for draft ${draft.id} stage ${stage} after ${MAX_ATTEMPTS} attempts: ${reason}`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
