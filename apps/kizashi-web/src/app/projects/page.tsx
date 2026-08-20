"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Group, type Project } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

const fieldClass =
  "w-full rounded-lg border border-kz-border bg-kz-paper-dim px-3 py-2 text-[13.5px] text-kz-ink outline-none focus:border-kz-accent";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ projects }, { groups }] = await Promise.all([
        api.listProjects(),
        api.listGroups(),
      ]);
      setProjects(projects);
      setGroups(groups);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError("プロジェクトの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    load();
  }, [load]);

  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

  async function remove(id: string, name: string) {
    if (!window.confirm(`プロジェクト「${name}」を削除します。参照ファイルもすべて削除されます。よろしいですか？`)) {
      return;
    }
    try {
      await api.deleteProject(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "削除に失敗しました");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-kz-serif text-2xl font-bold text-kz-ink">プロジェクト管理</h1>
        <p className="mt-1 text-[13.5px] text-kz-ink-soft">
          AI生成時に参照させるMarkdownファイル群をまとめるプロジェクトを管理します。
        </p>
      </div>

      <NewProjectForm groups={groups} onCreated={load} />

      {loading && !projects && <p className="text-[13.5px] text-kz-muted">読み込み中...</p>}

      {error && (
        <p className="rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
          {error}
        </p>
      )}

      {projects && (
        projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-kz-border bg-kz-surface px-8 py-12 text-center text-[13.5px] text-kz-muted">
            まだプロジェクトがありません
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-kz-border bg-kz-surface p-4 transition-colors hover:border-kz-accent"
              >
                <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-kz-ink">{project.name}</p>
                  <p className="mt-1 text-[12.5px] text-kz-muted">
                    {project.default_group_id && groupNameById.get(project.default_group_id)
                      ? `デフォルトグループ: ${groupNameById.get(project.default_group_id)}`
                      : "デフォルトグループ: 未設定"}
                    {" ・ "}
                    作成: {formatDateTime(project.created_at)}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => remove(project.id, project.name)}
                  className="rounded-lg border border-kz-red px-3 py-1.5 text-[12.5px] text-kz-red hover:bg-kz-red-soft"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function NewProjectForm({ groups, onCreated }: { groups: Group[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [defaultGroupId, setDefaultGroupId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit rounded-lg bg-kz-accent px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        ＋ プロジェクトを新規作成
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("プロジェクト名を入力してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createProject({ name, default_group_id: defaultGroupId || null });
      setName("");
      setDefaultGroupId("");
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
        <h2 className="text-[16px] font-bold text-kz-ink">プロジェクトを新規作成</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-kz-muted hover:text-kz-ink"
        >
          閉じる
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">プロジェクト名</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">
          デフォルトグループ（任意）
        </label>
        <select
          value={defaultGroupId}
          onChange={(e) => setDefaultGroupId(e.target.value)}
          className={fieldClass}
        >
          <option value="">未設定</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
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
