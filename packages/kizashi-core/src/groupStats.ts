import { CONFIRMED_ENGAGEMENT_SNAPSHOT_STAGE } from "./engagementSnapshots";

export interface GroupStatsDb {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
    };
  };
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
  // 「確定値」（7日後スナップショット）が取得済みのDraft数。平均インプレッション等はこの母数のみで算出する。
  confirmed_engagement_draft_count: number;
  average_views: number | null;
  average_likes: number | null;
  average_replies: number | null;
  average_reposts: number | null;
  average_quotes: number | null;
}

interface DraftAggregateRow {
  draft_count: number;
  rated_draft_count: number;
  average_rating: number | null;
  rating_1: number;
  rating_2: number;
  rating_3: number;
  rating_4: number;
  rating_5: number;
}

interface EngagementAggregateRow {
  confirmed_engagement_draft_count: number;
  average_views: number | null;
  average_likes: number | null;
  average_replies: number | null;
  average_reposts: number | null;
  average_quotes: number | null;
}

/**
 * グループ単位の実績サマリー（平均インプレッション・評価分布など）。
 * 参照: docs/Kizashi 設計書 v1.md 「4. API設計」GET /groups/:id/stats
 *
 * インプレッション等の平均値は「確定値」（CONFIRMED_ENGAGEMENT_SNAPSHOT_STAGE = 7日後スナップショット）
 * のみを母数にする。1h/24h/72hの途中経過値は日々変動するため平均に混ぜるとサマリーの意味が揺らぐため。
 */
export async function getGroupEngagementStats(
  db: GroupStatsDb,
  userId: string,
  groupId: string
): Promise<GroupStats> {
  const draftAgg = await db
    .prepare(
      `SELECT
        COUNT(*) AS draft_count,
        COUNT(rating) AS rated_draft_count,
        AVG(rating) AS average_rating,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS rating_1,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS rating_2,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS rating_3,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS rating_4,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS rating_5
      FROM drafts
      WHERE user_id = ? AND group_id = ?`
    )
    .bind(userId, groupId)
    .first<DraftAggregateRow>();

  const engagementAgg = await db
    .prepare(
      `SELECT
        COUNT(*) AS confirmed_engagement_draft_count,
        AVG(s.views) AS average_views,
        AVG(s.likes) AS average_likes,
        AVG(s.replies) AS average_replies,
        AVG(s.reposts) AS average_reposts,
        AVG(s.quotes) AS average_quotes
      FROM draft_engagement_snapshots s
      JOIN drafts d ON d.id = s.draft_id
      WHERE d.user_id = ? AND d.group_id = ?
        AND s.snapshot_stage = ?
        AND s.fetch_failed = 0`
    )
    .bind(userId, groupId, CONFIRMED_ENGAGEMENT_SNAPSHOT_STAGE)
    .first<EngagementAggregateRow>();

  return {
    group_id: groupId,
    draft_count: draftAgg?.draft_count ?? 0,
    rated_draft_count: draftAgg?.rated_draft_count ?? 0,
    average_rating: draftAgg?.average_rating ?? null,
    rating_distribution: {
      1: draftAgg?.rating_1 ?? 0,
      2: draftAgg?.rating_2 ?? 0,
      3: draftAgg?.rating_3 ?? 0,
      4: draftAgg?.rating_4 ?? 0,
      5: draftAgg?.rating_5 ?? 0,
    },
    confirmed_engagement_draft_count: engagementAgg?.confirmed_engagement_draft_count ?? 0,
    average_views: engagementAgg?.average_views ?? null,
    average_likes: engagementAgg?.average_likes ?? null,
    average_replies: engagementAgg?.average_replies ?? null,
    average_reposts: engagementAgg?.average_reposts ?? null,
    average_quotes: engagementAgg?.average_quotes ?? null,
  };
}
