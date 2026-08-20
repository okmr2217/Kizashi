"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { api, ApiError, type ThreadsAccount } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_KIZASHI_API_URL ?? "http://localhost:8787";

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-16">
          <p className="text-[13.5px] text-kz-muted">読み込み中...</p>
        </div>
      }
    >
      <OnboardingPageInner />
    </Suspense>
  );
}

function OnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const connected = searchParams.get("connected") === "1";
  const failed = searchParams.get("error") === "1";

  const [accounts, setAccounts] = useState<ThreadsAccount[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { accounts } = await api.listThreadsAccounts();
      setAccounts(accounts);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch, re-run after oauth redirect back
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  function connectThreadsAccount() {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- cross-origin navigation to the API for the Threads OAuth flow, not an internal Next.js route
    window.location.href = `${API_BASE_URL}/threads-accounts/oauth/start`;
  }

  const hasAccounts = (accounts?.length ?? 0) > 0;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="relative inline-block h-9 w-9 rounded-lg bg-kz-accent">
          <span className="absolute inset-[8px] rounded-[3px] bg-kz-paper" />
        </span>
        <h1 className="font-kz-serif text-2xl font-bold text-kz-ink">Threadsアカウント連携</h1>
        <p className="text-[13.5px] text-kz-ink-soft">
          予約投稿・実測エンゲージメント取得には、投稿先のThreadsアカウントとの連携が必要です。
        </p>
      </div>

      <div className="kz-shadow flex flex-col gap-4 rounded-xl border border-kz-border bg-kz-surface p-6">
        {failed && (
          <p className="rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
            Threadsアカウントとの連携に失敗しました。もう一度お試しください。
          </p>
        )}
        {connected && !failed && (
          <p className="rounded-lg border border-kz-accent bg-kz-accent-soft px-3 py-2 text-[13px] text-kz-accent-ink">
            Threadsアカウントを連携しました。
          </p>
        )}

        {loading ? (
          <p className="text-[13.5px] text-kz-muted">読み込み中...</p>
        ) : hasAccounts ? (
          <ul className="flex flex-col gap-2">
            {accounts!.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-kz-border bg-kz-paper-dim px-3 py-2.5 text-[13.5px] text-kz-ink"
              >
                <span>{a.display_name ?? a.threads_user_id}</span>
                <span className="font-kz-mono text-xs text-kz-muted">
                  {a.is_active ? "連携中" : "無効"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-kz-muted">
            まだ連携済みのThreadsアカウントがありません。
          </p>
        )}

        <button
          type="button"
          onClick={connectThreadsAccount}
          className="rounded-lg bg-kz-accent px-4 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Threadsアカウントを連携する
        </button>

        {hasAccounts && (
          <Link
            href="/drafts"
            className="text-center text-[12.5px] text-kz-muted hover:text-kz-ink"
          >
            Draft一覧へ進む →
          </Link>
        )}
      </div>
    </div>
  );
}
