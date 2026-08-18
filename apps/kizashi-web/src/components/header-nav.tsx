"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
      <LogoutButton />
    </nav>
  );
}
