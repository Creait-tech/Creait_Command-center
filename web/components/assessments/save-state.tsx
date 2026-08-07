"use client";

/**
 * Save state.
 *
 * The workbench has always saved on every keystroke-blur and every score; it
 * just never said so, and advisors in testing didn't believe it. This is the
 * Docs/Linear convention: a quiet persistent line that names the current state,
 * loud only when it needs a decision. It never blocks and never celebrates.
 */

import { AlertTriangle, Check, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SaveState({
  status,
  onRetry,
  className,
}: {
  status: SaveStatus;
  onRetry?: () => void;
  className?: string;
}) {
  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--color-brand-danger)] transition-colors hover:bg-[color:var(--color-brand-danger)]/10",
          className
        )}
      >
        <AlertTriangle className="size-3" />
        Not saved — retry
      </button>
    );
  }

  return (
    <span
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground",
        className
      )}
    >
      {status === "saving" ? (
        <>
          <RefreshCw className="size-3 animate-spin motion-reduce:animate-none" />
          Saving…
        </>
      ) : status === "saved" ? (
        <>
          <Check className="size-3 text-[color:var(--color-brand-success)]" />
          Saved
        </>
      ) : (
        <>
          <Check className="size-3 opacity-40" />
          Up to date
        </>
      )}
    </span>
  );
}
