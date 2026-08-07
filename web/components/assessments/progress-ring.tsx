"use client";

/**
 * Session progress primitives.
 *
 * The ring is the one place in the workbench where a graphic outranks a number:
 * during a live call the facilitator reads it peripherally, and an arc is legible
 * at a glance in a way "19/30" is not. The number stays inside it so the exact
 * count is never a guess.
 */

import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  total,
  size = 52,
  stroke = 4,
  className,
  label,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  className?: string;
  /** Accessible description, e.g. "19 of 30 indicators resolved". */
  label: string;
}) {
  const safeTotal = total > 0 ? total : 1;
  const fraction = Math.min(1, Math.max(0, value / safeTotal));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const complete = value >= total;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-brand-fog)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={
            complete
              ? "var(--color-brand-success)"
              : "var(--color-brand-electric)"
          }
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dashoffset,stroke] duration-500 ease-out motion-reduce:transition-none"
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 grid place-items-center text-[13px] font-semibold tabular-nums leading-none",
          complete && "text-[color:var(--color-brand-success)]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Ten ticks — one per indicator in a pillar. Reads as "how much of this pillar
 * have we actually examined", which the pillar average alone hides.
 */
export function PillarMeter({
  scored,
  na,
  total,
  className,
}: {
  scored: number;
  na: number;
  total: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-[3px]", className)} aria-hidden>
      {Array.from({ length: total }, (_, i) => {
        const state = i < scored ? "scored" : i < scored + na ? "na" : "open";
        return (
          <span
            key={i}
            className={cn(
              "h-1 w-2.5 rounded-[1px] transition-colors duration-200 motion-reduce:transition-none",
              state === "scored" && "bg-[color:var(--color-brand-electric)]",
              state === "na" && "bg-[color:var(--color-brand-mist)]/50",
              state === "open" && "bg-[color:var(--color-brand-fog)]"
            )}
          />
        );
      })}
    </div>
  );
}
