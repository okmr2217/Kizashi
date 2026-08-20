"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { AccountSwitcher } from "@/components/account-switcher";
import { LogoutButton } from "@/components/logout-button";

export function HeaderNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link
        href="/drafts"
        className="border-b-2 border-kz-accent pb-0.5 font-semibold text-kz-ink"
      >
        Draft一覧
      </Link>
      <Link href="/groups" className="text-kz-muted hover:text-kz-ink">
        グループ
      </Link>
      <Link href="/projects" className="text-kz-muted hover:text-kz-ink">
        プロジェクト
      </Link>
      <Link href="/api-keys" className="text-kz-muted hover:text-kz-ink">
        APIキー
      </Link>
      <Link href="/onboarding" className="text-kz-muted hover:text-kz-ink">
        アカウント連携
      </Link>
      <Suspense fallback={null}>
        <AccountSwitcher />
      </Suspense>
      <LogoutButton />
    </nav>
  );
}
