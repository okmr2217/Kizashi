"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Group, type GroupStats } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

const fieldClass =
  "w-full rounded-lg border border-kz-border bg-kz-paper-dim px-3 py-2 text-[13.5px] text-kz-ink outline-none focus:border-kz-accent";

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { groups } = await api.listGroups();
      setGroups(groups);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError("グループの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-kz-serif text-2xl font-bold text-kz-ink">グループ管理</h1>
        <p className="mt-1 text-[13.5px] text-kz-ink-soft">
          Draftをテーマ単位でまとめるグループを作成・編集・削除します。
        </p>
      </div>

      <NewGroupForm onCreated={load} />

      {loading && !groups && <p className="text-[13.5px] text-kz-muted">読み込み中...</p>}

      {error && (
        <p className="rounded-lg border border-kz-red bg-kz-red-soft px-3 py-2 text-[13px] text-kz-red">
          {error}
        </p>
      )}

      {groups && (
        groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-kz-border bg-kz-surface px-8 py-12 text-center text-[13.5px] text-kz-muted">
            まだグループがありません
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {groups.map((group) => (
              <GroupRow key={group.id} group={group} onChanged={load} />
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function NewGroupForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit rounded-lg bg-kz-accent px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        ＋ グループを新規作成
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("グループ名を入力してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createGroup({ name, description: description || null });
      setName("");
      setDescription("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "作成に失敗しました");
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
        <h2 className="text-[16px] font-bold text-kz-ink">グループを新規作成</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-kz-muted hover:text-kz-ink"
        >
          閉じる
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">グループ名</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-kz-ink-soft">説明（任意）</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={fieldClass}
        />
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
          {submitting ? "作成中..." : "作成する"}
        </button>
      </div>
    </form>
  );
}

function GroupRow({ group, onChanged }: { group: Group; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("グループ名を入力してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.updateGroup(group.id, { name, description: description || null });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    if (!window.confirm(`グループ「${group.name}」を削除します。よろしいですか？`)) return;
    try {
      await api.deleteGroup(group.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "削除に失敗しました");
    }
  }

  async function toggleStats() {
    if (statsOpen) {
      setStatsOpen(false);
      return;
    }
    setStatsOpen(true);
    if (!stats) {
      setStatsLoading(true);
      try {
        const { stats: fetched } = await api.getGroupStats(group.id);
        setStats(fetched);
      } catch {
        setError("実績の取得に失敗しました");
      } finally {
        setStatsLoading(false);
      }
    }
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-kz-border bg-kz-surface p-4">
        <form onSubmit={saveEdit} className="flex flex-col gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={fieldClass}
          />
          {error && <p className="text-[12.5px] text-kz-red">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-kz-accent px-3 py-1.5 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-kz-border px-3 py-1.5 text-[12.5px] text-kz-ink-soft hover:border-kz-accent"
            >
              キャンセル
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-kz-border bg-kz-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-kz-ink">{group.name}</p>
          {group.description && (
            <p className="mt-1 whitespace-pre-wrap text-[13px] text-kz-ink-soft">
              {group.description}
            </p>
          )}
          <p className="mt-1.5 font-kz-mono text-xs text-kz-muted">
            作成: {formatDateTime(group.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={toggleStats}
            className="rounded-lg border border-kz-border px-3 py-1.5 text-[12.5px] text-kz-ink-soft hover:border-kz-accent"
          >
            {statsOpen ? "実績を閉じる" : "実績を見る"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-kz-border px-3 py-1.5 text-[12.5px] text-kz-ink-soft hover:border-kz-accent"
          >
            編集
          </button>
          <button
            type="button"
            onClick={remove}
            className="rounded-lg border border-kz-red px-3 py-1.5 text-[12.5px] text-kz-red hover:bg-kz-red-soft"
          >
            削除
          </button>
        </div>
      </div>

      {error && !editing && <p className="mt-2 text-[12.5px] text-kz-red">{error}</p>}

      {statsOpen && (
        <div className="mt-3 border-t border-kz-border pt-3">
          {statsLoading ? (
            <p className="text-[12.5px] text-kz-muted">読み込み中...</p>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12.5px] text-kz-ink-soft sm:grid-cols-3">
              <StatItem label="Draft数" value={stats.draft_count} />
              <StatItem label="評価済み" value={stats.rated_draft_count} />
              <StatItem
                label="平均評価"
                value={stats.average_rating !== null ? stats.average_rating.toFixed(2) : "-"}
              />
              <StatItem
                label="平均インプレッション（確定値）"
                value={stats.average_views !== null ? Math.round(stats.average_views) : "-"}
              />
              <StatItem
                label="平均いいね（確定値）"
                value={stats.average_likes !== null ? Math.round(stats.average_likes) : "-"}
              />
              <StatItem label="確定値取得件数" value={stats.confirmed_engagement_draft_count} />
            </div>
          ) : (
            <p className="text-[12.5px] text-kz-muted">実績データがありません</p>
          )}
        </div>
      )}
    </li>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <b className="font-kz-mono font-semibold text-kz-ink">{value}</b>
    </div>
  );
}
