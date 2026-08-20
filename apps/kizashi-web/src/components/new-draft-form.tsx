"use client";

import { useState } from "react";
import { api, ApiError, type Group, type Project } from "@/lib/api";

const fieldSelectClass =
  "rounded-lg border border-kz-border bg-kz-paper-dim px-2.5 py-2 text-[13px] text-kz-ink-soft outline-none focus:border-kz-accent";

export function NewDraftForm({
  groups,
  projects,
  onCreated,
}: {
  groups: Group[];
  projects: Project[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [groupId, setGroupId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-kz-accent px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        ＋ Draftを新規作成
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError("本文を入力してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createDraft({
        group_id: groupId || null,
        project_id: projectId || null,
        content,
      });
      setContent("");
      setGroupId("");
      setProjectId("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "作成に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="kz-shadow flex flex-col gap-4 rounded-xl border border-kz-border bg-kz-surface p-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-kz-ink">Draftを新規作成</h2>
          <p className="mt-0.5 text-[12.5px] text-kz-muted">
            手入力でDraftを作成してリストに追加します
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-kz-muted hover:text-kz-ink"
        >
          閉じる
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">本文</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="投稿本文を入力"
          rows={4}
          className="w-full rounded-lg border border-kz-border bg-kz-paper-dim px-3 py-2.5 text-[13.5px] text-kz-ink outline-none focus:border-kz-accent"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-kz-ink-soft">グループ</span>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className={fieldSelectClass}
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
            className={fieldSelectClass}
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
          {submitting ? "作成中..." : "作成する"}
        </button>
      </div>
    </form>
  );
}
