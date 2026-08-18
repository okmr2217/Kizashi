import { clsx } from "clsx";
import { STATUS_LABELS } from "@/lib/format";
import type { DraftStatus } from "@/lib/api";

const STATUS_STYLES: Record<DraftStatus, string> = {
  draft: "bg-kz-surface-2 text-kz-muted",
  scheduled: "bg-kz-blue-soft text-kz-blue",
  ready_to_publish: "bg-kz-amber-soft text-kz-amber",
  published: "bg-kz-accent-soft text-kz-accent-ink",
  failed: "bg-kz-red-soft text-kz-red",
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
