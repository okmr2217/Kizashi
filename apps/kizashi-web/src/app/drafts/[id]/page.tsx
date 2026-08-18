import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { DraftDetailForm } from "@/components/draft-detail-form";
import { StatusBadge } from "@/components/status-badge";
import { EngagementChart } from "@/components/engagement-chart";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

interface DraftDetailPageProps {
  params: Promise<{ id: string }>;
}

const STAT_LABELS: Record<string, string> = {
  views: "インプレッション",
  likes: "いいね",
  replies: "返信",
  reposts: "リポスト",
  quotes: "引用",
};

export default async function DraftDetailPage({ params }: DraftDetailPageProps) {
  const { id } = await params;

  let data;
  try {
    const [draftResult, { groups }, { projects }] = await Promise.all([
      api.getDraft(id),
      api.listGroups(),
      api.listProjects(),
    ]);
    data = { ...draftResult, groups, projects };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const { draft, engagement_snapshots: snapshots, groups, projects } = data;
  const latest = [...snapshots].sort((a, b) => (a.fetched_at < b.fetched_at ? 1 : -1))[0];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <Link href="/drafts" className="text-sm text-muted hover:text-ink">
          ← Draft一覧に戻る
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl font-bold text-ink">Draft詳細</h1>
          <StatusBadge status={draft.status} />
        </div>
        <p className="font-mono text-xs text-muted">
          作成: {formatDateTime(draft.created_at)} / 更新: {formatDateTime(draft.updated_at)}
        </p>
      </div>

      <DraftDetailForm draft={draft} groups={groups} projects={projects} />

      <div className="rounded-xl border border-border bg-surface p-4">
        <h4 className="mb-3 text-[12.5px] font-semibold uppercase tracking-wide text-muted">
          実測エンゲージメント
        </h4>
        {snapshots.length === 0 ? (
          <p className="text-[13.5px] text-muted">
            まだスナップショットはありません（投稿後に自動取得されます）
          </p>
        ) : (
          <>
            <EngagementChart snapshots={snapshots} />
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2.5">
              {(["views", "likes", "replies", "reposts", "quotes"] as const).map((key) => (
                <div key={key} className="flex justify-between text-xs text-ink-soft">
                  <span>{STAT_LABELS[key]}</span>
                  <b className="font-mono font-semibold text-ink">
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
