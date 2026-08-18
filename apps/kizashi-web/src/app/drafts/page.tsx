import Link from "next/link";
import { api, type DraftStatus } from "@/lib/api";
import { DraftFilters } from "@/components/draft-filters";
import { NewDraftForm } from "@/components/new-draft-form";
import { StatusBadge } from "@/components/status-badge";
import { StarRating } from "@/components/star-rating";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

interface DraftsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function DraftsPage({ searchParams }: DraftsPageProps) {
  const params = await searchParams;
  const filters = {
    account_id: firstValue(params.account_id),
    group_id: firstValue(params.group_id),
    status: firstValue(params.status) as DraftStatus | undefined,
    rating_min: params.rating_min ? Number(firstValue(params.rating_min)) : undefined,
  };

  const [{ drafts }, { groups }, { projects }, { threads_accounts: threadsAccounts }] =
    await Promise.all([
      api.listDrafts(filters),
      api.listGroups(),
      api.listProjects(),
      api.listThreadsAccounts(),
    ]);

  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Draft一覧</h1>
      </div>

      <NewDraftForm groups={groups} projects={projects} threadsAccounts={threadsAccounts} />
      <DraftFilters groups={groups} threadsAccounts={threadsAccounts} />

      {drafts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          条件に一致するDraftがありません
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <Link
                href={`/drafts/${draft.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={draft.status} />
                    {draft.group_id && groupNameById.get(draft.group_id) && (
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {groupNameById.get(draft.group_id)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400">
                    {formatDateTime(draft.updated_at)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                  {draft.content}
                </p>
                <div className="mt-2">
                  <StarRating value={draft.rating} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
