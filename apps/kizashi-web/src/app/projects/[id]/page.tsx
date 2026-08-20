"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Group, type Project, type ProjectFile } from "@/lib/api";
import { ProjectFileForm } from "@/components/project-file-form";
import { formatDateTime } from "@/lib/format";

const fieldClass =
  "w-full rounded-lg border border-kz-border bg-kz-paper-dim px-3 py-2 text-[13.5px] text-kz-ink outline-none focus:border-kz-accent";

interface ProjectDetailData {
  project: Project;
  files: ProjectFile[];
  groups: Group[];
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [data, setData] = useState<ProjectDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ projects }, { files }, { groups }] = await Promise.all([
        api.listProjects(),
        api.listProjectFiles(id),
        api.listGroups(),
      ]);
      const project = projects.find((p) => p.id === id);
      if (!project) {
        setError("プロジェクトが見つかりませんでした");
        return;
      }
      setData({ project, files, groups });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        setError("プロジェクトが見つかりませんでした");
        return;
      }
      setError("読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount/id change
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
        <p className="text-[13.5px] text-kz-muted">読み込み中...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
        <Link href="/projects" className="text-sm text-kz-muted hover:text-kz-ink">
          ← プロジェクト一覧に戻る
        </Link>
        <p className="rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
          {error ?? "読み込みに失敗しました"}
        </p>
      </div>
    );
  }

  const { project, files, groups } = data;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <Link href="/projects" className="text-sm text-kz-muted hover:text-kz-ink">
        ← プロジェクト一覧に戻る
      </Link>

      <ProjectSettingsForm project={project} groups={groups} onChanged={load} />

      <div>
        <h2 className="text-[16px] font-bold text-kz-ink">参照ファイル</h2>
        <p className="mt-1 text-[13px] text-kz-ink-soft">
          AI生成時に参照させるMarkdownファイルを管理します。
        </p>
      </div>

      <NewFileForm projectId={project.id} onCreated={load} />

      {files.length === 0 ? (
        <p className="rounded-xl border border-dashed border-kz-border bg-kz-surface px-8 py-12 text-center text-[13.5px] text-kz-muted">
          まだ参照ファイルがありません
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {files.map((file) => (
            <FileRow key={file.id} projectId={project.id} file={file} onChanged={load} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectSettingsForm({
  project,
  groups,
  onChanged,
}: {
  project: Project;
  groups: Group[];
  onChanged: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [defaultGroupId, setDefaultGroupId] = useState(project.default_group_id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("プロジェクト名を入力してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateProject(project.id, { name, default_group_id: defaultGroupId || null });
      setSaved(true);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="kz-shadow flex flex-col gap-4 rounded-xl border border-kz-border bg-kz-surface p-5"
    >
      <h1 className="font-kz-serif text-2xl font-bold text-kz-ink">プロジェクト詳細</h1>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">プロジェクト名</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">
          デフォルトグループ
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

      <p className="font-kz-mono text-xs text-kz-muted">
        作成: {formatDateTime(project.created_at)} / 更新: {formatDateTime(project.updated_at)}
      </p>

      {error && <p className="text-[12.5px] text-kz-red">{error}</p>}
      {saved && !error && <p className="text-[12.5px] text-kz-accent-ink">保存しました</p>}

      <div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-kz-accent px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "保存中..." : "保存する"}
        </button>
      </div>
    </form>
  );
}

function NewFileForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit rounded-lg bg-kz-accent px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        ＋ ファイルを新規作成
      </button>
    );
  }

  return (
    <div className="kz-shadow rounded-xl border border-kz-border bg-kz-surface p-5">
      <ProjectFileForm
        projectId={projectId}
        onDone={() => {
          setOpen(false);
          onCreated();
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

function FileRow({
  projectId,
  file,
  onChanged,
}: {
  projectId: string;
  file: ProjectFile;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`ファイル「${file.title}」を削除します。よろしいですか？`)) return;
    try {
      await api.deleteProjectFile(projectId, file.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "削除に失敗しました");
    }
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-kz-border bg-kz-surface p-4">
        <ProjectFileForm
          projectId={projectId}
          file={file}
          onDone={() => {
            setEditing(false);
            onChanged();
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-kz-border bg-kz-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-kz-ink">{file.title}</p>
          <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[13px] text-kz-ink-soft">
            {file.content_markdown || "(本文なし)"}
          </p>
          <p className="mt-1.5 font-kz-mono text-xs text-kz-muted">
            更新: {formatDateTime(file.updated_at)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-kz-border px-3 py-1.5 text-[12.5px] text-kz-ink-soft hover:border-kz-accent"
          >
            編集
          </button>
          <button
            type="button"
            onClick={remove}
            className="rounded-lg border border-kz-red px-3 py-1.5 text-[12.5px] text-kz-red hover:bg-kz-red-soft"
          >
            削除
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-[12.5px] text-kz-red">{error}</p>}
    </li>
  );
}
