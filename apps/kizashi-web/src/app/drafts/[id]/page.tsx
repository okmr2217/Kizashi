"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  api,
  ApiError,
  type Draft,
  type EngagementSnapshot,
  type Group,
  type Project,
  type ThreadsAccount,
} from "@/lib/api";
import { DraftDetailForm } from "@/components/draft-detail-form";
import { StatusBadge } from "@/components/status-badge";
import { EngagementChart } from "@/components/engagement-chart";
import { ScheduleSection } from "@/components/schedule-section";
import { formatDateTime } from "@/lib/format";

const STAT_LABELS: Record<string, string> = {
  views: "インプレッション",
  likes: "いいね",
  replies: "返信",
  reposts: "リポスト",
  quotes: "引用",
};

interface DraftDetailData {
  draft: Draft;
  snapshots: EngagementSnapshot[];
  groups: Group[];
  projects: Project[];
  threadsAccounts: ThreadsAccount[];
  drafts: Draft[];
}

export default function DraftDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [data, setData] = useState<DraftDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [draftResult, { groups }, { projects }, { accounts }, { drafts }] = await Promise.all([
        api.getDraft(id),
        api.listGroups(),
        api.listProjects(),
        api.listThreadsAccounts(),
        api.listDrafts(),
      ]);
      setData({
        draft: draftResult.draft,
        snapshots: draftResult.engagement_snapshots,
        groups,
        projects,
        threadsAccounts: accounts,
        drafts,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        setError("Draftが見つかりませんでした");
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
        <Link href="/drafts" className="text-sm text-kz-muted hover:text-kz-ink">
          ← Draft一覧に戻る
        </Link>
        <p className="rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
          {error ?? "読み込みに失敗しました"}
        </p>
      </div>
    );
  }

  const { draft, snapshots, groups, projects, threadsAccounts, drafts } = data;
  const latest = [...snapshots].sort((a, b) => (a.fetched_at < b.fetched_at ? 1 : -1))[0];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <Link href="/drafts" className="text-sm text-kz-muted hover:text-kz-ink">
          ← Draft一覧に戻る
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-kz-serif text-2xl font-bold text-kz-ink">Draft詳細</h1>
          <StatusBadge status={draft.status} />
        </div>
        <p className="font-kz-mono text-xs text-kz-muted">
          作成: {formatDateTime(draft.created_at)} / 更新: {formatDateTime(draft.updated_at)}
        </p>
      </div>

      <DraftDetailForm draft={draft} groups={groups} projects={projects} onChanged={load} />

      <ScheduleSection draft={draft} threadsAccounts={threadsAccounts} drafts={drafts} onChanged={load} />

      <div className="rounded-xl border border-kz-border bg-kz-surface p-4">
        <h4 className="mb-3 text-[12.5px] font-semibold uppercase tracking-wide text-kz-muted">
          実測エンゲージメント
        </h4>
        {snapshots.length === 0 ? (
          <p className="text-[13.5px] text-kz-muted">
            まだスナップショットはありません（投稿後に自動取得されます）
          </p>
        ) : (
          <>
            <EngagementChart snapshots={snapshots} />
            <div className="mt-2 flex flex-col gap-2 border-t border-kz-border pt-2.5">
              {(["views", "likes", "replies", "reposts", "quotes"] as const).map((key) => (
                <div key={key} className="flex justify-between text-xs text-kz-ink-soft">
                  <span>{STAT_LABELS[key]}</span>
                  <b className="font-kz-mono font-semibold text-kz-ink">
                    {latest && !latest.fetch_failed ? latest[key] ?? "-" : "-"}
                  </b>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
