"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Group, ThreadsAccount } from "@/lib/api";
import { STATUS_LABELS } from "@/lib/format";

const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

export function DraftFilters({
  groups,
  threadsAccounts,
}: {
  groups: Group[];
  threadsAccounts: ThreadsAccount[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accountId, setAccountId] = useState(searchParams.get("account_id") ?? "");
  const [groupId, setGroupId] = useState(searchParams.get("group_id") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [ratingMin, setRatingMin] = useState(searchParams.get("rating_min") ?? "");

  function apply() {
    const params = new URLSearchParams();
    if (accountId) params.set("account_id", accountId);
    if (groupId) params.set("group_id", groupId);
    if (status) params.set("status", status);
    if (ratingMin) params.set("rating_min", ratingMin);
    router.push(`/drafts?${params.toString()}`);
  }

  function reset() {
    setAccountId("");
    setGroupId("");
    setStatus("");
    setRatingMin("");
    router.push("/drafts");
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">アカウント</span>
        <select
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">すべて</option>
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
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="">すべて</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">ステータス</span>
        <select
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">すべて</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">評価（以上）</span>
        <select
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          value={ratingMin}
          onChange={(e) => setRatingMin(e.target.value)}
        >
          <option value="">指定なし</option>
          {[1, 2, 3, 4, 5].map((r) => (
            <option key={r} value={r}>
              {r}以上
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={apply}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          絞り込む
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          リセット
        </button>
      </div>
    </div>
  );
}
