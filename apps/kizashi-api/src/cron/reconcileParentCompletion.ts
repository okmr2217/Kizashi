// 親投稿完了検知ジョブ（セーフティネット）。
// 予約投稿実行ジョブは親の投稿成功/失敗が確定した直後にそのジョブ内で直下の子を更新するが、
// Worker異常終了等でその更新が漏れた場合に拾うための冪等な整合性チェック。
// 時刻ではなく「親のstatusに子が追従していない」状態のズレを見るため、CLAUDE.mdが禁止する
// 「時刻だけを見たポーリング」には当たらない。
import type { Env } from "../env";

export async function reconcileParentCompletionJob(env: Env): Promise<void> {
  const now = new Date().toISOString();

  await env.DB.prepare(
    `UPDATE drafts SET can_publish_after_parent = 1, status = 'ready_to_publish', updated_at = ?
     WHERE status = 'scheduled' AND can_publish_after_parent = 0
       AND parent_draft_id IN (SELECT id FROM drafts WHERE status = 'published')`
  )
    .bind(now)
    .run();

  await env.DB.prepare(
    `UPDATE drafts SET status = 'failed', failure_reason = '親Draftの投稿失敗によりスキップされました', updated_at = ?
     WHERE status IN ('scheduled', 'ready_to_publish')
       AND parent_draft_id IN (SELECT id FROM drafts WHERE status = 'failed')`
  )
    .bind(now)
    .run();
}
