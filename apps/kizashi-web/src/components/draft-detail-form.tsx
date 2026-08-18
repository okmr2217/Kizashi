"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, type Draft, type Group, type Project } from "@/lib/api";
import { StarRating } from "@/components/star-rating";
import { StatusBadge } from "@/components/status-badge";
import { STATUS_LABELS } from "@/lib/format";

const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

const selectClass =
  "rounded-lg border border-kz-border bg-kz-paper-dim px-2.5 py-2 text-[13px] text-kz-ink-soft outline-none focus:border-kz-accent";

export function DraftDetailForm({
  draft,
  groups,
  projects,
}: {
  draft: Draft;
  groups: Group[];
  projects: Project[];
}) {
  const router = useRouter();
  const [content, setContent] = useState(draft.content);
  const [groupId, setGroupId] = useState(draft.group_id ?? "");
  const [projectId, setProjectId] = useState(draft.project_id ?? "");
  const [status, setStatus] = useState(draft.status);
  const [rating, setRating] = useState<number | null>(draft.rating);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty =
    content !== draft.content ||
    groupId !== (draft.group_id ?? "") ||
    projectId !== (draft.project_id ?? "") ||
    status !== draft.status ||
    rating !== draft.rating;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.updateDraft(draft.id, {
        content,
        group_id: groupId || null,
        project_id: projectId || null,
        status,
        rating,
      });
      setSavedAt(Date.now());
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  async function updateRating(next: number | null) {
    setRating(next);
    setError(null);
    try {
      await api.updateDraft(draft.id, { rating: next });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "評価の更新に失敗しました");
    }
  }

  async function handleDelete() {
    if (!confirm("このDraftを削除しますか？")) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteDraft(draft.id);
      router.push("/drafts");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "削除に失敗しました");
      setDeleting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.3fr_1fr]">
      <div className="rounded-xl border border-kz-border bg-kz-surface p-4">
        <h4 className="mb-2.5 text-[12.5px] font-semibold uppercase tracking-wide text-kz-muted">
          本文
        </h4>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-kz-border bg-kz-paper-dim px-3 py-2.5 text-[13.5px] text-kz-ink outline-none focus:border-kz-accent"
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-kz-ink-soft">グループ</span>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className={selectClass}
            >
              <option value="">未設定</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-kz-ink-soft">プロジェクト</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={selectClass}
            >
              <option value="">未設定</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded-lg bg-kz-accent px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-kz-red px-4 py-2 text-[13px] font-semibold text-kz-red transition-colors hover:bg-kz-red-soft disabled:opacity-50"
          >
            {deleting ? "削除中..." : "削除する"}
          </button>
          {!dirty && savedAt && (
            <span className="text-[13px] font-medium text-kz-accent">保存しました</span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-kz-border bg-kz-surface p-4">
        <h4 className="mb-3 text-[12.5px] font-semibold uppercase tracking-wide text-kz-muted">
          評価 &amp; ステータス
        </h4>
        <div className="mb-3 flex items-center justify-between">
          <StarRating value={rating} onChange={updateRating} size="lg" />
          <StatusBadge status={status} />
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-kz-ink-soft">ステータスを変更</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Draft["status"])}
            className={selectClass}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
