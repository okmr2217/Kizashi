import type { EngagementSnapshot } from "@/lib/api";

const STAGE_ORDER = ["1h", "24h", "72h", "7d"] as const;

export function EngagementChart({ snapshots }: { snapshots: EngagementSnapshot[] }) {
  const byStage = new Map(snapshots.map((s) => [s.snapshot_stage, s]));
  const maxViews = Math.max(1, ...snapshots.map((s) => s.views ?? 0));

  return (
    <div className="flex h-[110px] items-end gap-3.5">
      {STAGE_ORDER.map((stage) => {
        const snapshot = byStage.get(stage);
        const views = snapshot?.fetch_failed ? 0 : snapshot?.views ?? 0;
        const heightPct = snapshot && !snapshot.fetch_failed ? Math.max(6, (views / maxViews) * 100) : 4;
        return (
          <div key={stage} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div
              className="w-full max-w-[34px] rounded-t-[5px] rounded-b-[2px] bg-kz-accent data-[empty=true]:bg-kz-border"
              data-empty={!snapshot}
              style={{ height: `${heightPct}%` }}
            />
            <span className="font-kz-mono text-[10.5px] text-kz-muted">{stage}</span>
          </div>
        );
      })}
    </div>
  );
}
