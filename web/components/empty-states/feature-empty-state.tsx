"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

interface FeatureEmptyStateProps {
  /** Lucide icon element, e.g. <Users className="size-5" />. */
  icon?: ReactNode;
  /** What this thing is called. */
  title: string;
  /** One or two sentences: what it is and why it matters. */
  description: string;
  /** Concrete situations that should make the operator open this page. */
  useWhen?: string[];
  /** The primary way to put the first row in. */
  action?: EmptyStateAction;
  /** Optional escape hatch (e.g. "Show the empty board"). */
  secondaryAction?: EmptyStateAction;
  /** Small print under the buttons — provenance, caveats, links. */
  footnote?: ReactNode;
  /** Tighter padding for in-card / in-column use. */
  compact?: boolean;
  className?: string;
}

/**
 * The empty state used across Command Center feature pages.
 *
 * Rule this component exists to enforce: a page with no rows still has to
 * explain itself — what it is, when you'd use it, and how to start. A blank
 * grid is never acceptable.
 */
export function FeatureEmptyState({
  icon,
  title,
  description,
  useWhen,
  action,
  secondaryAction,
  footnote,
  compact = false,
  className,
}: FeatureEmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-charcoal)]/25",
        compact ? "p-4" : "p-6 sm:p-8",
        className
      )}
    >
      <div className="mx-auto flex max-w-xl flex-col items-start gap-3">
        {icon && (
          <div className="flex size-9 items-center justify-center rounded-lg bg-[color:var(--color-brand-electric)]/12 text-[color:var(--color-brand-electric)]">
            {icon}
          </div>
        )}

        <div className="space-y-1.5">
          <h3
            className={cn(
              "font-semibold",
              compact ? "text-sm" : "text-base sm:text-lg"
            )}
          >
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>

        {useWhen && useWhen.length > 0 && (
          <div className="w-full space-y-1.5 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Open this when
            </p>
            <ul className="space-y-1">
              {useWhen.map((line) => (
                <li
                  key={line}
                  className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 size-1 shrink-0 rounded-full bg-[color:var(--color-brand-electric)]"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(action || secondaryAction) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {action && (
              <Button size="sm" onClick={action.onClick}>
                {action.icon}
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                size="sm"
                variant="outline"
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.icon}
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}

        {footnote && (
          <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground/80">
            {footnote}
          </p>
        )}
      </div>
    </div>
  );
}
