"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, type Group, type Project } from "@/lib/api";

const POLL_INTERVAL_MS = 1500;

const fieldSelectClass =
  "rounded-lg border border-kz-border bg-kz-paper-dim px-2.5 py-2 text-[13px] text-kz-ink-soft outline-none focus:border-kz-accent";

type Phase = "idle" | "processing" | "failed";

export function GenerateDraftModal({
  groups,
  projects,
  onGenerated,
}: {
  groups: Group[];
  projects: Project[];
  onGenerated: (draftId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [groupId, setGroupId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }

  function reset() {
    stopPolling();
    setPrompt("");
    setGroupId("");
    setProjectId("");
    setPhase("idle");
    setProgressMessage(null);
    setError(null);
  }

  function close() {
    reset();
    setOpen(false);
  }

  function pollJob(jobId: string) {
    pollRef.current = setTimeout(async () => {
      try {
        const job = await api.getGenerationJob(jobId);
        setProgressMessage(job.progress_message);
        if (job.status === "completed" && job.draft_id) {
          stopPolling();
          onGenerated(job.draft_id);
          close();
          return;
        }
        if (job.status === "failed") {
          stopPolling();
          setPhase("failed");
          setError(job.error_message ?? "生成に失敗しました");
          return;
        }
        pollJob(jobId);
      } catch (err) {
        stopPolling();
        setPhase("failed");
        setError(err instanceof ApiError ? err.message : "生成状況の取得に失敗しました");
      }
    }, POLL_INTERVAL_MS);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) {
      setError("プロンプトを入力してください");
      return;
    }
    setError(null);
    setPhase("processing");
    setProgressMessage("生成を開始しています...");
    try {
      const res = await api.generateDraft({
        group_id: groupId || null,
        project_id: projectId || null,
        prompt,
      });
      pollJob(res.job_id);
    } catch (err) {
      setPhase("failed");
      setError(err instanceof ApiError ? err.message : "生成の開始に失敗しました");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-kz-accent px-4 py-2 text-[13px] font-semibold text-kz-accent transition-opacity hover:opacity-80"
      >
        ✨ AIでDraftを生成
      </button>
    );
  }

  const submitting = phase === "processing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="kz-shadow flex w-full max-w-lg flex-col gap-4 rounded-xl border border-kz-border bg-kz-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-kz-ink">AIでDraftを生成</h2>
            <p className="mt-0.5 text-[12.5px] text-kz-muted">
              プロンプトを入力すると、AIが過去の実績や参照ファイルを踏まえてDraftを生成します
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="text-sm text-kz-muted hover:text-kz-ink disabled:opacity-40"
          >
            閉じる
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">
              プロンプト
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="どんな投稿を作りたいか入力してください"
              rows={4}
              disabled={submitting}
              className="w-full rounded-lg border border-kz-border bg-kz-paper-dim px-3 py-2.5 text-[13.5px] text-kz-ink outline-none focus:border-kz-accent disabled:opacity-60"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-kz-ink-soft">グループ</span>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                disabled={submitting}
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
                disabled={submitting}
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

          {submitting && (
            <p className="flex items-center gap-2 rounded-lg border border-kz-border bg-kz-paper-dim px-3 py-2 text-[13px] text-kz-ink-soft">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-kz-accent border-t-transparent" />
              {progressMessage ?? "生成中..."}
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-kz-accent px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "生成中..." : "生成する"}
            </button>
            {phase === "failed" && (
              <button
                type="button"
                onClick={() => {
                  setPhase("idle");
                  setError(null);
                }}
                className="text-[13px] font-semibold text-kz-accent hover:underline"
              >
                リトライ
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
