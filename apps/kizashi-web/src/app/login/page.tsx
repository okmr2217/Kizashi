"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "signup") {
        if (password.length < 8) {
          setError("パスワードは8文字以上で入力してください");
          setSubmitting(false);
          return;
        }
        await api.signup({ email, password });
      } else {
        await api.login({ email, password });
      }
      router.push("/drafts");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? "メールアドレスまたはパスワードが違います"
            : err.status === 409
              ? "このメールアドレスは既に登録されています"
              : "処理に失敗しました"
        );
      } else {
        setError("処理に失敗しました");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="relative inline-block h-9 w-9 rounded-lg bg-kz-accent">
            <span className="absolute inset-[8px] rounded-[3px] bg-kz-paper" />
          </span>
          <h1 className="font-kz-serif text-2xl font-bold text-kz-ink">Kizashi</h1>
          <p className="text-[13.5px] text-kz-ink-soft">
            {mode === "login"
              ? "Threads投稿の兆しを、ここから育てる。"
              : "アカウントを作成して、投稿の準備をはじめましょう。"}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="kz-shadow flex flex-col gap-4 rounded-xl border border-kz-border bg-kz-surface p-6"
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">
              メールアドレス
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-kz-border bg-kz-paper-dim px-3 py-2.5 text-[13.5px] text-kz-ink outline-none focus:border-kz-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">
              パスワード
            </label>
            <input
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8文字以上"
              className="w-full rounded-lg border border-kz-border bg-kz-paper-dim px-3 py-2.5 text-[13.5px] text-kz-ink outline-none focus:border-kz-accent"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-kz-accent px-4 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting
              ? "処理中..."
              : mode === "login"
                ? "ログイン"
                : "アカウントを作成"}
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode(mode === "login" ? "signup" : "login");
            }}
            className="text-center text-[12.5px] text-kz-muted hover:text-kz-ink"
          >
            {mode === "login"
              ? "アカウントをお持ちでない方はこちら"
              : "既にアカウントをお持ちの方はこちら"}
          </button>
        </form>
      </div>
    </div>
  );
}
