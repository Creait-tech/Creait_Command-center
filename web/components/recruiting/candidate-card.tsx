"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Candidate, CandidateStage } from "@/lib/supabase/types";

interface CandidateCardProps {
  candidate: Candidate;
  onClick?: () => void;
}

// Stage-colored left border (and matching subtle wash). Tokens come from
// app/globals.css.
const STAGE_BORDER: Record<CandidateStage, string> = {
  applied: "border-l-[color:var(--color-brand-mist)]",
  screening: "border-l-[color:var(--color-brand-electric)]",
  interview: "border-l-[color:var(--color-brand-warning)]",
  offer: "border-l-[color:var(--color-brand-violet)]",
  hired: "border-l-[color:var(--color-brand-success)]",
  rejected: "border-l-[color:var(--color-brand-danger)]",
  withdrew: "border-l-[color:var(--color-brand-mist)]",
};

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  const ms = Date.now() - then;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function dayLabel(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "1 day";
  return `${n} days`;
}

export function CandidateCard({ candidate, onClick }: CandidateCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: candidate.id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  const days = daysSince(candidate.updated_at);
  const rating = Math.max(0, Math.min(5, candidate.rating ?? 0));

  // We attach the drag listeners to the card body. The outer wrapper
  // captures clicks so we can still open the detail modal. dnd-kit
  // ignores plain clicks under the default activation distance.
  function handleClick(e: React.MouseEvent) {
    // If we somehow got here mid-drag, swallow it.
    if (isDragging) {
      e.preventDefault();
      return;
    }
    onClick?.();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group touch-none cursor-grab active:cursor-grabbing select-none",
        "rounded-lg border border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-charcoal)]",
        "border-l-4 p-3 shadow-sm transition-colors",
        "hover:border-[color:var(--color-brand-mist)] hover:bg-[color:var(--color-brand-slate)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-electric)]",
        STAGE_BORDER[candidate.stage],
        isDragging && "ring-2 ring-[color:var(--color-brand-electric)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight text-[color:var(--color-brand-paper)]">
          {candidate.full_name}
        </p>
        {candidate.source && (
          <span className="shrink-0 rounded-full bg-[color:var(--color-brand-fog)]/60 px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-brand-mist)]">
            {candidate.source}
          </span>
        )}
      </div>

      {candidate.role_applying_for && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
          {candidate.role_applying_for}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-0.5"
          aria-label={`Rating ${rating} of 5`}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                "size-3",
                i < rating
                  ? "fill-[color:var(--color-brand-gold)] text-[color:var(--color-brand-gold)]"
                  : "text-[color:var(--color-brand-fog)]"
              )}
            />
          ))}
        </div>
        <span className="text-[10px] uppercase tracking-wide text-[color:var(--color-brand-mist)]">
          {dayLabel(days)} in stage
        </span>
      </div>
    </div>
  );
}
