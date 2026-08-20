"use client";

import { useState } from "react";
import { api, ApiError, type Draft, type ThreadsAccount } from "@/lib/api";

const fieldSelectClass =
  "rounded-lg border border-kz-border bg-kz-paper-dim px-2.5 py-2 text-[13px] text-kz-ink-soft outline-none focus:border-kz-accent disabled:opacity-60";

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduleDraftModal({
  draft,
  threadsAccounts,
  drafts,
  onScheduled,
  onClose,
}: {
  draft: Draft;
  threadsAccounts: ThreadsAccount[];
  drafts: Draft[];
  onScheduled: () => void;
  onClose: () => void;
}) {
  const activeAccounts = threadsAccounts.filter((a) => a.is_active === 1);

  const [threadsAccountId, setThreadsAccountId] = useState(draft.threads_account_id ?? "");
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocalValue(draft.scheduled_at));
  const [parentDraftId, setParentDraftId] = useState(draft.parent_draft_id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentCandidates = drafts.filter(
    (d) =>
      d.id !== draft.id &&
      d.threads_account_id === threadsAccountId &&
      (d.status === "scheduled" || d.status === "ready_to_publish" || d.status === "published")
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!threadsAccountId) {
      setError("投稿先のThreadsアカウントを選択してください");
      return;
    }
    if (!scheduledAt) {
      setError("予約日時を選択してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.scheduleDraft(draft.id, {
        threads_account_id: threadsAccountId,
        scheduled_at: new Date(scheduledAt).toISOString(),
        parent_draft_id: parentDraftId || null,
      });
      onScheduled();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "予約設定に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="kz-shadow flex w-full max-w-lg flex-col gap-4 rounded-xl border border-kz-border bg-kz-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-kz-ink">予約投稿を設定</h2>
            <p className="mt-0.5 text-[12.5px] text-kz-muted">
              投稿先アカウントと日時を指定します。リプライとして投稿する場合は返信先も選んでください
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-sm text-kz-muted hover:text-kz-ink disabled:opacity-40"
          >
            閉じる
          </button>
        </div>

        {activeAccounts.length === 0 ? (
          <p className="rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
            連携済みのThreadsアカウントがありません。先にアカウント連携を行ってください
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-kz-ink-soft">投稿先Threadsアカウント</span>
              <select
                value={threadsAccountId}
                onChange={(e) => {
                  setThreadsAccountId(e.target.value);
                  setParentDraftId("");
                }}
                disabled={submitting}
                className={fieldSelectClass}
              >
                <option value="">選択してください</option>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name ?? a.threads_user_id}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-kz-ink-soft">予約日時</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={submitting}
                className={fieldSelectClass}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-kz-ink-soft">リプライ先Draft（任意）</span>
              <select
                value={parentDraftId}
                onChange={(e) => setParentDraftId(e.target.value)}
                disabled={submitting || !threadsAccountId}
                className={fieldSelectClass}
              >
                <option value="">通常投稿（リプライしない）</option>
                {parentCandidates.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.content.slice(0, 40)}
                  </option>
                ))}
              </select>
              {!threadsAccountId && (
                <span className="text-[11.5px] text-kz-muted">
                  先に投稿先アカウントを選ぶとリプライ先の候補が表示されます
                </span>
              )}
            </label>

            {error && (
              <p className="rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
                {error}
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-kz-accent px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "予約中..." : "予約する"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
