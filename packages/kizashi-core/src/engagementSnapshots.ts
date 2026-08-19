import { generateId } from "./ids";

// 参照: docs/Kizashi 設計書 v1.md 「2. 実測エンゲージメントデータ設計」
export const ENGAGEMENT_SNAPSHOT_STAGES = ["1h", "24h", "72h", "7d"] as const;
export type EngagementSnapshotStage = (typeof ENGAGEMENT_SNAPSHOT_STAGES)[number];

/**
 * 7日後のスナップショットは「確定値」としてAIフィードバックに使用し、以降は再取得しない。
 * '7d' を直接文字列比較すると意図が埋もれるため、この定数経由で参照する。
 */
export const CONFIRMED_ENGAGEMENT_SNAPSHOT_STAGE: EngagementSnapshotStage = "7d";

export const ENGAGEMENT_SNAPSHOT_OFFSET_MS: Record<EngagementSnapshotStage, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "72h": 72 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export interface EngagementMetrics {
  views: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  quotes: number | null;
}

export interface EngagementSnapshot extends EngagementMetrics {
  id: string;
  draft_id: string;
  snapshot_stage: EngagementSnapshotStage;
  fetched_at: string;
  fetch_failed: number;
}

export interface EngagementSnapshotDb {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results: T[] }>;
    };
  };
}

/**
 * draft_engagement_snapshots への書き込み処理。
 * UNIQUE(draft_id, snapshot_stage) のため同一ステージへの書き込みはupsertする
 * （取得成功時の保存・リトライ失敗時のfetch_failed記録の両方をこの1関数で扱う）。
 */
export async function saveEngagementSnapshot(
  db: EngagementSnapshotDb,
  params: {
    draftId: string;
    stage: EngagementSnapshotStage;
    fetchedAt: string;
    metrics: EngagementMetrics | null; // 取得成功時の実測値。取得失敗時はnull
    fetchFailed: boolean;
  }
): Promise<EngagementSnapshot> {
  const id = generateId("engsnap");
  const metrics = params.metrics ?? { views: null, likes: null, replies: null, reposts: null, quotes: null };

  await db
    .prepare(
      `INSERT INTO draft_engagement_snapshots (
        id, draft_id, snapshot_stage, fetched_at, views, likes, replies, reposts, quotes, fetch_failed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(draft_id, snapshot_stage) DO UPDATE SET
        fetched_at = excluded.fetched_at,
        views = excluded.views,
        likes = excluded.likes,
        replies = excluded.replies,
        reposts = excluded.reposts,
        quotes = excluded.quotes,
        fetch_failed = excluded.fetch_failed`
    )
    .bind(
      id,
      params.draftId,
      params.stage,
      params.fetchedAt,
      metrics.views,
      metrics.likes,
      metrics.replies,
      metrics.reposts,
      metrics.quotes,
      params.fetchFailed ? 1 : 0
    )
    .run();

  const snapshot = await db
    .prepare(`SELECT * FROM draft_engagement_snapshots WHERE draft_id = ? AND snapshot_stage = ?`)
    .bind(params.draftId, params.stage)
    .first<EngagementSnapshot>();

  if (!snapshot) {
    throw new Error("failed to load saved engagement snapshot");
  }
  return snapshot;
}
