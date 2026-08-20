"use client";

import { useState } from "react";
import { api, ApiError, type Draft, type ThreadsAccount } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ScheduleDraftModal } from "@/components/schedule-draft-modal";

export function ScheduleSection({
  draft,
  threadsAccounts,
  drafts,
  onChanged,
}: {
  draft: Draft;
  threadsAccounts: ThreadsAccount[];
  drafts: Draft[];
  onChanged: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelSchedule() {
    if (!confirm("予約を解除しますか？リプライ先として設定していたDraftの予約も連動して解除されます")) return;
    setCancelling(true);
    setError(null);
    try {
      await api.cancelSchedule(draft.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "予約の解除に失敗しました");
    } finally {
      setCancelling(false);
    }
  }

  if (draft.status === "published") {
    return (
      <div className="rounded-xl border border-kz-border bg-kz-surface p-4">
        <h4 className="mb-2.5 text-[12.5px] font-semibold uppercase tracking-wide text-kz-muted">
          投稿情報
        </h4>
        <p className="text-[13.5px] text-kz-ink-soft">
          投稿日時: <span className="font-kz-mono text-kz-ink">{formatDateTime(draft.published_at)}</span>
        </p>
        {draft.threads_post_id && (
          <p className="mt-1 text-[13.5px] text-kz-ink-soft">
            Threads投稿ID: <span className="font-kz-mono text-kz-ink">{draft.threads_post_id}</span>
          </p>
        )}
      </div>
    );
  }

  const account = threadsAccounts.find((a) => a.id === draft.threads_account_id);
  const parent = drafts.find((d) => d.id === draft.parent_draft_id);
  const isScheduled = draft.status === "scheduled" || draft.status === "ready_to_publish";

  return (
    <div className="rounded-xl border border-kz-border bg-kz-surface p-4">
      <h4 className="mb-2.5 text-[12.5px] font-semibold uppercase tracking-wide text-kz-muted">
        予約投稿
      </h4>

      {draft.status === "failed" && draft.failure_reason && (
        <p className="mb-3 rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
          {draft.failure_reason}
        </p>
      )}

      {isScheduled ? (
        <div className="flex flex-col gap-1.5 text-[13.5px] text-kz-ink-soft">
          <p>
            投稿先: <span className="text-kz-ink">{account?.display_name ?? account?.threads_user_id ?? "-"}</span>
          </p>
          <p>
            予約日時: <span className="font-kz-mono text-kz-ink">{formatDateTime(draft.scheduled_at)}</span>
          </p>
          {draft.parent_draft_id && (
            <p>
              リプライ先:{" "}
              <span className="text-kz-ink">
                {parent ? parent.content.slice(0, 40) : draft.parent_draft_id}
              </span>
            </p>
          )}
          {draft.status === "ready_to_publish" && (
            <p className="text-kz-amber">親の投稿が完了しました。予約日時になり次第投稿されます</p>
          )}
          {draft.status === "scheduled" && draft.parent_draft_id && (
            <p className="text-kz-muted">親Draftの投稿完了を待っています</p>
          )}
        </div>
      ) : (
        <p className="text-[13.5px] text-kz-muted">まだ予約されていません</p>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-kz-accent px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          {isScheduled ? "予約を変更" : draft.status === "failed" ? "再度予約する" : "予約する"}
        </button>
        {isScheduled && (
          <button
            type="button"
            onClick={cancelSchedule}
            disabled={cancelling}
            className="rounded-lg border border-kz-red px-4 py-2 text-[13px] font-semibold text-kz-red transition-colors hover:bg-kz-red-soft disabled:opacity-50"
          >
            {cancelling ? "解除中..." : "予約を解除"}
          </button>
        )}
      </div>

      {modalOpen && (
        <ScheduleDraftModal
          draft={draft}
          threadsAccounts={threadsAccounts}
          drafts={drafts}
          onScheduled={onChanged}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
