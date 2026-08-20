"use client";

import { useState } from "react";
import { api, ApiError, type ProjectFile } from "@/lib/api";

const fieldClass =
  "w-full rounded-lg border border-kz-border bg-kz-paper-dim px-3 py-2 text-[13.5px] text-kz-ink outline-none focus:border-kz-accent";

interface ProjectFileFormProps {
  projectId: string;
  file?: ProjectFile;
  onDone: () => void;
  onCancel?: () => void;
}

export function ProjectFileForm({ projectId, file, onDone, onCancel }: ProjectFileFormProps) {
  const [title, setTitle] = useState(file?.title ?? "");
  const [contentMarkdown, setContentMarkdown] = useState(file?.content_markdown ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (file) {
        await api.updateProjectFile(projectId, file.id, {
          title,
          content_markdown: contentMarkdown,
        });
      } else {
        await api.createProjectFile(projectId, { title, content_markdown: contentMarkdown });
        setTitle("");
        setContentMarkdown("");
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">タイトル</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">
          本文（Markdown）
        </label>
        <textarea
          value={contentMarkdown}
          onChange={(e) => setContentMarkdown(e.target.value)}
          rows={8}
          className={`${fieldClass} font-kz-mono`}
        />
      </div>

      {error && <p className="text-[12.5px] text-kz-red">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-kz-accent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "保存中..." : "保存"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-kz-border px-3 py-1.5 text-[12.5px] text-kz-ink-soft hover:border-kz-accent"
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
