"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, API_KEY_SCOPES, ApiError, type ApiKeyScope, type ApiKeySummary } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

const SCOPE_LABELS: Record<ApiKeyScope, string> = {
  "drafts:read": "Draft閲覧",
  "drafts:write": "Draft作成",
  "projects:read": "プロジェクト閲覧",
};

export default function ApiKeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { api_keys } = await api.listApiKeys();
      setKeys(api_keys);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError("APIキーの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    load();
  }, [load]);

  async function revoke(id: string, name: string) {
    if (!window.confirm(`APIキー「${name}」を失効させます。よろしいですか？`)) return;
    try {
      await api.deleteApiKey(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "失効に失敗しました");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-kz-serif text-2xl font-bold text-kz-ink">APIキー管理</h1>
        <p className="mt-1 text-[13.5px] text-kz-ink-soft">
          外部AI（Claude/ChatGPT等）からMCP経由でKizashiを操作するためのAPIキーを発行・管理します。
        </p>
      </div>

      <NewApiKeyForm onCreated={load} />

      {loading && !keys && <p className="text-[13.5px] text-kz-muted">読み込み中...</p>}

      {error && (
        <p className="rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
          {error}
        </p>
      )}

      {keys && (
        keys.length === 0 ? (
          <p className="rounded-xl border border-dashed border-kz-border bg-kz-surface px-8 py-12 text-center text-[13.5px] text-kz-muted">
            まだAPIキーがありません
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {keys.map((key) => {
              const revoked = key.revoked_at !== null;
              return (
                <li
                  key={key.id}
                  className={`rounded-xl border p-4 ${
                    revoked ? "border-kz-border bg-kz-paper-dim opacity-60" : "border-kz-border bg-kz-surface"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-kz-ink">{key.name}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {key.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="rounded bg-kz-surface-2 px-1.5 py-0.5 text-[11px] text-kz-muted"
                          >
                            {SCOPE_LABELS[scope] ?? scope}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1.5 font-kz-mono text-xs text-kz-muted">
                        作成: {formatDateTime(key.created_at)}
                        {" ・ "}
                        最終使用: {key.last_used_at ? formatDateTime(key.last_used_at) : "未使用"}
                        {revoked && ` ・ 失効: ${formatDateTime(key.revoked_at)}`}
                      </p>
                    </div>
                    {!revoked && (
                      <button
                        type="button"
                        onClick={() => revoke(key.id, key.name)}
                        className="shrink-0 rounded-lg border border-kz-red px-3 py-1.5 text-[12.5px] text-kz-red hover:bg-kz-red-soft"
                      >
                        失効させる
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
}

function NewApiKeyForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiKeyScope[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  function toggleScope(scope: ApiKeyScope) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  if (issuedKey) {
    return (
      <div className="kz-shadow flex flex-col gap-3 rounded-xl border border-kz-accent bg-kz-accent-soft p-5">
        <p className="text-[13.5px] font-semibold text-kz-accent-ink">
          APIキーを発行しました。このキーは今だけ表示されます。必ずここでコピーしてください。
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-kz-border bg-kz-paper px-3 py-2">
          <code className="flex-1 select-all break-all font-kz-mono text-[12.5px] text-kz-ink">
            {issuedKey}
          </code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(issuedKey)}
            className="shrink-0 rounded-lg border border-kz-border px-2.5 py-1 text-[12px] text-kz-ink-soft hover:border-kz-accent"
          >
            コピー
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setIssuedKey(null);
            setName("");
            setScopes([]);
            setOpen(false);
          }}
          className="w-fit rounded-lg bg-kz-accent px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90"
        >
          閉じる
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit rounded-lg bg-kz-accent px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        ＋ APIキーを発行
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("キー名を入力してください");
      return;
    }
    if (scopes.length === 0) {
      setError("スコープを1つ以上選択してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { key } = await api.createApiKey({ name, scopes });
      setIssuedKey(key);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "発行に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="kz-shadow flex flex-col gap-4 rounded-xl border border-kz-border bg-kz-surface p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-kz-ink">APIキーを発行</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-kz-muted hover:text-kz-ink"
        >
          閉じる
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">キー名</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: Claude Desktop用"
          className="w-full rounded-lg border border-kz-border bg-kz-paper-dim px-3 py-2 text-[13.5px] text-kz-ink outline-none focus:border-kz-accent"
        />
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">スコープ</span>
        <div className="flex flex-col gap-1.5">
          {API_KEY_SCOPES.map((scope) => (
            <label key={scope} className="flex items-center gap-2 text-[13px] text-kz-ink-soft">
              <input
                type="checkbox"
                checked={scopes.includes(scope)}
                onChange={() => toggleScope(scope)}
              />
              {SCOPE_LABELS[scope]}（{scope}）
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-kz-accent px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "発行中..." : "発行する"}
        </button>
      </div>
    </form>
  );
}
