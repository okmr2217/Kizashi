import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kizashi",
  description: "Threads投稿のAI生成・リスト管理・予約投稿ツール",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=Shippori+Mincho:wght@500;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body className="flex min-h-full flex-col bg-kz-paper font-kz-sans leading-[1.75] text-kz-ink antialiased">
        <header className="border-b border-kz-border bg-kz-surface">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3">
            <Link href="/drafts" className="flex items-center gap-2.5 text-[15px] font-bold">
              <span className="relative inline-block h-[22px] w-[22px] rounded-md bg-kz-accent">
                <span className="absolute inset-[6px] rounded-[2px] bg-kz-paper" />
              </span>
              Kizashi
            </Link>
            <nav className="text-sm">
              <Link
                href="/drafts"
                className="border-b-2 border-kz-accent pb-0.5 font-semibold text-kz-ink"
              >
                Draft一覧
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex flex-1 flex-col bg-kz-paper-dim">{children}</main>
      </body>
    </html>
  );
}
