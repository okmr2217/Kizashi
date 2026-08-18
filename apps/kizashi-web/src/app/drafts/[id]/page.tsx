import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { DraftDetailForm } from "@/components/draft-detail-form";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

interface DraftDetailPageProps {
  params: Promise<{ id: string }>;
}

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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Link href="/drafts" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Draft一覧に戻る
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Draft詳細</h1>
          <StatusBadge status={draft.status} />
        </div>
        <p className="text-xs text-zinc-400">
          作成: {formatDateTime(draft.created_at)} / 更新: {formatDateTime(draft.updated_at)}
        </p>
      </div>

      <DraftDetailForm draft={draft} groups={groups} projects={projects} />

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          実測エンゲージメント
        </h2>
        {snapshots.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            まだスナップショットはありません（投稿後に自動取得されます）
          </p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="text-zinc-500 dark:text-zinc-400">
                <th className="py-1 pr-4">タイミング</th>
                <th className="py-1 pr-4">views</th>
                <th className="py-1 pr-4">likes</th>
                <th className="py-1 pr-4">replies</th>
                <th className="py-1 pr-4">reposts</th>
                <th className="py-1 pr-4">quotes</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-1 pr-4">{s.snapshot_stage}</td>
                  <td className="py-1 pr-4">{s.fetch_failed ? "-" : s.views ?? "-"}</td>
                  <td className="py-1 pr-4">{s.fetch_failed ? "-" : s.likes ?? "-"}</td>
                  <td className="py-1 pr-4">{s.fetch_failed ? "-" : s.replies ?? "-"}</td>
                  <td className="py-1 pr-4">{s.fetch_failed ? "-" : s.reposts ?? "-"}</td>
                  <td className="py-1 pr-4">{s.fetch_failed ? "-" : s.quotes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
