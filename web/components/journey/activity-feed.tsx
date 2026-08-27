"use client";

import { Bot, CheckCircle2, MessageSquarePlus, RotateCcw, StickyNote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fullTimestamp, initialsOf, timeAgo } from "./journey-format";
import type { CcClientActivity, ClientActivityKind } from "@/lib/supabase/types";

interface Props {
  activity: CcClientActivity[];
  /** deliverable_id → title, so the feed can say *what* was ticked. */
  deliverableTitles: Record<string, string>;
  loading: boolean;
  onAddNote: () => void;
}

const KIND_ICON: Record<ClientActivityKind, LucideIcon> = {
  deliverable_completed: CheckCircle2,
  deliverable_reopened: RotateCcw,
  note: StickyNote,
  status_change: RotateCcw,
  proposal_accepted: CheckCircle2,
  proposal_rejected: RotateCcw,
};

const KIND_TINT: Record<ClientActivityKind, string> = {
  deliverable_completed: "text-[color:var(--color-brand-success)]",
  deliverable_reopened: "text-[color:var(--color-brand-warning)]",
  note: "text-[color:var(--color-brand-mist)]",
  status_change: "text-[color:var(--color-brand-mist)]",
  proposal_accepted: "text-[color:var(--color-brand-success)]",
  proposal_rejected: "text-[color:var(--color-brand-warning)]",
};

/** The verb, as a teammate would read it in a standup. */
function summarise(
  entry: CcClientActivity,
  deliverableTitles: Record<string, string>,
): string {
  const target = entry.deliverable_id
    ? deliverableTitles[entry.deliverable_id]
    : undefined;

  switch (entry.kind) {
    case "deliverable_completed":
      return target ? `Completed “${target}”` : "Completed a deliverable";
    case "deliverable_reopened":
      return target ? `Reopened “${target}”` : "Reopened a deliverable";
    case "note":
      return target ? `Note on “${target}”` : "Note";
    case "status_change":
      return entry.body ?? "Changed status";
    case "proposal_accepted":
      return target ? `Accepted a suggestion on “${target}”` : "Accepted a suggestion";
    case "proposal_rejected":
      return target ? `Dismissed a suggestion on “${target}”` : "Dismissed a suggestion";
    default:
      return "Updated";
  }
}

/** Body text worth repeating under the summary line — notes, mostly. */
function detailOf(entry: CcClientActivity): string | null {
  if (!entry.body) return null;
  if (entry.kind === "status_change") return null; // already the summary
  return entry.body;
}

export function ActivityFeed({
  activity,
  deliverableTitles,
  loading,
  onAddNote,
}: Props) {
  return (
    <aside className="flex min-w-0 flex-col rounded-lg border border-border bg-card/60">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Activity</h3>
          <p className="text-[11px] text-muted-foreground">
            Shared across the team, live
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onAddNote}>
          <MessageSquarePlus className="size-3.5" />
          Note
        </Button>
      </header>

      <div className="max-h-[32rem] overflow-y-auto px-2 py-2">
        {loading && activity.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Loading activity…
          </p>
        ) : activity.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            Nothing logged yet. Ticking a deliverable or leaving a note shows up
            here for everyone.
          </p>
        ) : (
          <ol className="space-y-1">
            {activity.map((entry) => {
              const isAgent = entry.actor_type === "agent";
              const Icon = KIND_ICON[entry.kind] ?? StickyNote;
              const detail = detailOf(entry);
              return (
                <li
                  key={entry.id}
                  className="flex gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-background/60"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      isAgent
                        ? "bg-[color:var(--color-brand-aqua)]/15 text-[color:var(--color-brand-aqua)]"
                        : "bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)]",
                    )}
                    aria-hidden
                  >
                    {isAgent ? (
                      <Bot className="size-3.5" />
                    ) : (
                      initialsOf(entry.actor_name)
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          isAgent &&
                            "text-[color:var(--color-brand-aqua)]",
                        )}
                      >
                        {entry.actor_name}
                      </span>
                      {isAgent && (
                        <span className="rounded-full bg-[color:var(--color-brand-aqua)]/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-brand-aqua)]">
                          agent
                        </span>
                      )}
                      <span
                        className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground"
                        title={fullTimestamp(entry.created_at)}
                      >
                        {timeAgo(entry.created_at)}
                      </span>
                    </div>

                    <p className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Icon
                        className={cn(
                          "mt-px size-3 shrink-0",
                          KIND_TINT[entry.kind],
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 break-words">
                        {summarise(entry, deliverableTitles)}
                      </span>
                    </p>

                    {detail && (
                      <p className="mt-1 rounded-md border-l-2 border-[color:var(--color-brand-mist)]/40 bg-background/60 px-2 py-1 text-xs break-words text-foreground/90">
                        {detail}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>
  );
}
