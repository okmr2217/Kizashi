"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Group, ThreadsAccount } from "@/lib/api";
import { STATUS_LABELS } from "@/lib/format";

const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

const selectClass =
  "rounded-full border border-kz-border bg-kz-surface px-3 py-1.5 text-[12.5px] text-kz-ink-soft outline-none focus:border-kz-accent";

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
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={selectClass}
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        aria-label="アカウント"
      >
        <option value="">アカウント: すべて</option>
        {threadsAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.display_name ?? a.threads_user_id}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        aria-label="グループ"
      >
        <option value="">グループ: すべて</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        aria-label="ステータス"
      >
        <option value="">ステータス: すべて</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={ratingMin}
        onChange={(e) => setRatingMin(e.target.value)}
        aria-label="評価"
      >
        <option value="">評価: 指定なし</option>
        {[1, 2, 3, 4, 5].map((r) => (
          <option key={r} value={r}>
            ★{r}以上
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={apply}
        className="rounded-lg bg-kz-accent px-4 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        絞り込む
      </button>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg border border-kz-border bg-kz-surface px-4 py-1.5 text-[13px] font-semibold text-kz-ink transition-colors hover:bg-kz-surface-2"
      >
        リセット
      </button>
    </div>
  );
}
