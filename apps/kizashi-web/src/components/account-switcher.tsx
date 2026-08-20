"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, type ThreadsAccount } from "@/lib/api";

const STORAGE_KEY = "kizashi_selected_account_id";

export function AccountSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accounts, setAccounts] = useState<ThreadsAccount[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listThreadsAccounts()
      .then((res) => {
        if (!cancelled) setAccounts(res.accounts);
      })
      .catch((err) => {
        if (!cancelled && !(err instanceof ApiError && err.status === 401)) {
          setAccounts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const accountIdFromUrl = searchParams.get("account_id") ?? "";
  const selected =
    pathname === "/drafts"
      ? accountIdFromUrl
      : (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY)) || "";

  function handleChange(value: string) {
    if (typeof window !== "undefined") {
      if (value) {
        window.localStorage.setItem(STORAGE_KEY, value);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    const params = new URLSearchParams(pathname === "/drafts" ? searchParams.toString() : "");
    if (value) {
      params.set("account_id", value);
    } else {
      params.delete("account_id");
    }
    const qs = params.toString();
    router.push(`/drafts${qs ? `?${qs}` : ""}`);
  }

  if (!accounts || accounts.length === 0) return null;

  return (
    <select
      aria-label="Threadsアカウント切り替え"
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-full border border-kz-border bg-kz-surface px-3 py-1.5 text-[12.5px] text-kz-ink-soft outline-none focus:border-kz-accent"
    >
      <option value="">すべてのアカウント</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.display_name ?? a.threads_user_id}
        </option>
      ))}
    </select>
  );
}
