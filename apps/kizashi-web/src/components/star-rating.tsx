"use client";

import { clsx } from "clsx";

export function StarRating({
  value,
  onChange,
  disabled,
  size = "md",
}: {
  value: number | null;
  onChange?: (rating: number | null) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const stars = [1, 2, 3, 4, 5];
  const sizeClass = size === "lg" ? "text-xl" : size === "sm" ? "text-xs" : "text-base";

  return (
    <div className="flex items-center gap-0.5">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled || !onChange}
          aria-label={`${star}点`}
          onClick={() => onChange?.(value === star ? null : star)}
          className={clsx(
            sizeClass,
            "leading-none tracking-[1px] transition-colors",
            value && star <= value ? "text-amber" : "text-border",
            onChange && !disabled && "cursor-pointer hover:text-amber",
            !onChange && "cursor-default"
          )}
        >
          {"★"}
        </button>
      ))}
      {value != null && (
        <span className="ml-1.5 font-mono text-xs text-muted">{value} / 5</span>
      )}
    </div>
  );
}
