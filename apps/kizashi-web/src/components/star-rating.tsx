"use client";

import { clsx } from "clsx";

export function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange?: (rating: number | null) => void;
  disabled?: boolean;
}) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled || !onChange}
          aria-label={`${star}点`}
          onClick={() => onChange?.(value === star ? null : star)}
          className={clsx(
            "text-2xl leading-none transition-colors",
            value && star <= value ? "text-amber-400" : "text-zinc-300 dark:text-zinc-600",
            onChange && !disabled && "cursor-pointer hover:text-amber-400",
            !onChange && "cursor-default"
          )}
        >
          {"★"}
        </button>
      ))}
      {value != null && (
        <span className="ml-1 text-sm text-zinc-500 dark:text-zinc-400">{value} / 5</span>
      )}
    </div>
  );
}
