"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  api,
  ApiError,
  type Draft,
  type DraftStatus,
  type Group,
  type Project,
  type ThreadsAccount,
} from "@/lib/api";
import { DraftFilters } from "@/components/draft-filters";
import { NewDraftForm } from "@/components/new-draft-form";
import { StatusBadge } from "@/components/status-badge";
import { StarRating } from "@/components/star-rating";
import { formatDateTime } from "@/lib/format";

interface DraftsData {
  drafts: Draft[];
  groups: Group[];
  projects: Project[];
  threadsAccounts: ThreadsAccount[];
}

export default function DraftsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
          <p className="text-[13.5px] text-kz-muted">読み込み中...</p>
        </div>
      }
    >
      <DraftsPageInner />
    </Suspense>
  );
}

function DraftsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  const [data, setData] = useState<DraftsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams(query);
    const filters = {
      account_id: params.get("account_id") ?? undefined,
      group_id: params.get("group_id") ?? undefined,
      status: (params.get("status") as DraftStatus | null) ?? undefined,
      rating_min: params.get("rating_min") ? Number(params.get("rating_min")) : undefined,
    };
    try {
      const [draftsRes, groupsRes, projectsRes, accountsRes] = await Promise.all([
        api.listDrafts(filters),
        api.listGroups(),
        api.listProjects(),
        api.listThreadsAccounts(),
      ]);
      setData({
        drafts: draftsRes.drafts,
        groups: groupsRes.groups,
        projects: projectsRes.projects,
        threadsAccounts: accountsRes.accounts,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError("Draftの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [query, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial + filter-driven data fetch
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (loading && !data) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <p className="text-[13.5px] text-kz-muted">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <p className="rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
          {error}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const { drafts, groups, projects, threadsAccounts } = data;
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-kz-serif text-2xl font-bold text-kz-ink">Draft一覧</h1>
        <p className="mt-1 text-[13.5px] text-kz-ink-soft">
          AIが提案した投稿案（Draft）を一覧で管理します。手入力での作成・編集・評価ができます。
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DraftFilters groups={groups} threadsAccounts={threadsAccounts} />
      </div>

      <NewDraftForm
        groups={groups}
        projects={projects}
        threadsAccounts={threadsAccounts}
        onCreated={load}
      />

      {drafts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-kz-border bg-kz-surface px-8 py-12 text-center text-[13.5px] text-kz-muted">
          条件に一致するDraftがありません
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <Link
                href={`/drafts/${draft.id}`}
                className="grid grid-cols-1 gap-2 rounded-xl border border-kz-border bg-kz-surface p-4 transition-colors hover:border-kz-accent sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="line-clamp-2 whitespace-pre-wrap text-[13.5px] text-kz-ink">
                    {draft.content}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {draft.group_id && groupNameById.get(draft.group_id) && (
                      <span className="rounded bg-kz-surface-2 px-1.5 py-0.5 text-[11px] text-kz-muted">
                        {groupNameById.get(draft.group_id)}
                      </span>
                    )}
                  </div>
                </div>
                <StarRating value={draft.rating} size="sm" />
                <StatusBadge status={draft.status} />
                <span className="whitespace-nowrap font-kz-mono text-xs text-kz-muted">
                  {draft.scheduled_at ? formatDateTime(draft.scheduled_at) : formatDateTime(draft.updated_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
