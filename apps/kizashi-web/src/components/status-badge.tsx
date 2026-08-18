import { clsx } from "clsx";
import { STATUS_LABELS } from "@/lib/format";
import type { DraftStatus } from "@/lib/api";

const STATUS_STYLES: Record<DraftStatus, string> = {
  draft: "bg-surface-2 text-muted",
  scheduled: "bg-blue-soft text-blue",
  ready_to_publish: "bg-amber-soft text-amber",
  published: "bg-accent-soft text-accent-ink",
  failed: "bg-red-soft text-red",
};

export function StatusBadge({ status }: { status: DraftStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
