import { clsx } from "clsx";
import { STATUS_LABELS } from "@/lib/format";
import type { DraftStatus } from "@/lib/api";

const STATUS_STYLES: Record<DraftStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  ready_to_publish: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function StatusBadge({ status }: { status: DraftStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
