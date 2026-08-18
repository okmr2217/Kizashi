"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, type Draft, type Group, type Project } from "@/lib/api";
import { StarRating } from "@/components/star-rating";
import { STATUS_LABELS } from "@/lib/format";

const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">評価</span>
        <StarRating value={rating} onChange={updateRating} />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">本文</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">グループ</span>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">未設定</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">プロジェクト</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">未設定</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">ステータス</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Draft["status"])}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          {deleting ? "削除中..." : "削除する"}
        </button>
        {!dirty && savedAt && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">保存しました</span>
        )}
      </div>
    </div>
  );
}
