"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, type Group, type Project, type ThreadsAccount } from "@/lib/api";

export function NewDraftForm({
  groups,
  projects,
  threadsAccounts,
}: {
  groups: Group[];
  projects: Project[];
  threadsAccounts: ThreadsAccount[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [accountId, setAccountId] = useState(threadsAccounts[0]?.id ?? "");
  const [groupId, setGroupId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        + Draftを新規作成
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) {
      setError("Threadsアカウントを選択してください");
      return;
    }
    if (!content.trim()) {
      setError("本文を入力してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createDraft({
        threads_account_id: accountId,
        group_id: groupId || null,
        project_id: projectId || null,
        content,
      });
      setContent("");
      setGroupId("");
      setProjectId("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "作成に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Draftを新規作成
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          閉じる
        </button>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="投稿本文を入力"
        rows={4}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      />

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Threadsアカウント</span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">選択してください</option>
            {threadsAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.display_name ?? a.threads_user_id}
              </option>
            ))}
          </select>
        </label>

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
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitting ? "作成中..." : "作成する"}
        </button>
      </div>
    </form>
  );
}
