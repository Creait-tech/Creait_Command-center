"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { AddMilestoneDialog } from "./add-milestone-dialog";
import { AddDeliverableDialog } from "./add-deliverable-dialog";
import type { ClientProgressMap } from "./journey-view";
import type {
  JourneyMilestone,
  JourneyDeliverable,
} from "@/lib/supabase/types";

interface TimelineProps {
  milestones: JourneyMilestone[];
  deliverables: JourneyDeliverable[];
  mode: "template" | "client";
  clientName?: string;
  /** Client mode only — keyed by deliverable_id. */
  progress?: ClientProgressMap;
  loadingProgress?: boolean;
  onToggleDeliverable?: (
    deliverable: JourneyDeliverable,
    nextDone: boolean,
  ) => void;
}

interface NodeData {
  milestone: JourneyMilestone;
  cumulativeDay: number;
}

export function Timeline({
  milestones,
  deliverables,
  mode,
  clientName,
  progress,
  loadingProgress = false,
  onToggleDeliverable,
}: TimelineProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(
    milestones[0]?.id ?? null,
  );
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [addDeliverableFor, setAddDeliverableFor] = useState<string | null>(
    null,
  );

  const isClient = mode === "client";

  const nodes: NodeData[] = useMemo(() => {
    let runningTotal = 0;
    return milestones.map((m) => {
      const nodeDay = runningTotal;
      runningTotal += m.default_duration_days ?? 0;
      return { milestone: m, cumulativeDay: nodeDay };
    });
  }, [milestones]);

  // Per-milestone completion % for the selected client (client mode only).
  const milestonePct = useMemo(() => {
    const map: Record<string, number> = {};
    if (!isClient || !progress) return map;
    for (const m of milestones) {
      const items = deliverables.filter((d) => d.milestone_id === m.id);
      if (items.length === 0) {
        map[m.id] = 0;
        continue;
      }
      const done = items.filter((d) => progress[d.id]?.done).length;
      map[m.id] = Math.round((done / items.length) * 100);
    }
    return map;
  }, [isClient, progress, milestones, deliverables]);

  const expandedMilestone = expandedId
    ? milestones.find((m) => m.id === expandedId)
    : null;
  const expandedDeliverables = expandedMilestone
    ? deliverables.filter((d) => d.milestone_id === expandedMilestone.id)
    : [];

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto pb-3">
        <div className="flex items-stretch min-w-max gap-0 px-1">
          {nodes.map((node, idx) => {
            const isExpanded = expandedId === node.milestone.id;
            const isLast = idx === nodes.length - 1;
            const pct = milestonePct[node.milestone.id] ?? 0;
            const complete = isClient && pct === 100;
            return (
              <div key={node.milestone.id} className="flex items-start">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : node.milestone.id)
                  }
                  className="flex flex-col items-center gap-2 w-40 px-2 group focus:outline-none"
                >
                  <div className="relative flex items-center justify-center">
                    <div
                      className={cn(
                        "size-12 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                        "ring-2 ring-transparent group-hover:ring-[color:var(--color-brand-electric)]/40",
                        complete
                          ? "bg-[color:var(--color-brand-success)] text-white"
                          : isExpanded
                            ? "bg-[color:var(--color-brand-electric)] text-white"
                            : "bg-[color:var(--color-brand-slate)] text-white",
                      )}
                    >
                      D{node.cumulativeDay}
                    </div>
                    {/* Aha-moment star slot — lit when this milestone is fully done */}
                    <Star
                      className={cn(
                        "absolute -top-2 -right-2 size-3.5 transition-opacity",
                        complete
                          ? "text-[color:var(--color-brand-success)] opacity-100"
                          : "text-[color:var(--color-brand-fog)] opacity-0",
                      )}
                      aria-hidden
                    />
                  </div>
                  <div className="flex flex-col items-center text-center gap-0.5">
                    <p className="text-xs font-semibold leading-tight line-clamp-2">
                      {node.milestone.name}
                    </p>
                    {node.milestone.default_duration_days != null && (
                      <p className="text-[10px] text-muted-foreground">
                        +{node.milestone.default_duration_days}d
                      </p>
                    )}
                  </div>
                  {isClient && (
                    <div className="w-full px-2">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-[color:var(--color-brand-slate)]/40">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            complete
                              ? "bg-[color:var(--color-brand-success)]"
                              : "bg-[color:var(--color-brand-electric)]",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-center text-[10px] tabular-nums text-muted-foreground">
                        {pct}%
                      </p>
                    </div>
                  )}
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      isExpanded &&
                        "rotate-180 text-[color:var(--color-brand-electric)]",
                    )}
                  />
                </button>
                {!isLast && (
                  <div className="flex items-center pt-6">
                    <div className="w-10 border-t-2 border-[color:var(--color-brand-fog)]" />
                  </div>
                )}
              </div>
            );
          })}

          {!isClient && (
            <div className="flex items-center pl-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddMilestoneOpen(true)}
                className="mt-3"
              >
                <Plus className="size-3.5" />
                Milestone
              </Button>
            </div>
          )}
        </div>
      </div>

      {expandedMilestone && (
        <div className="rounded-lg border border-border bg-card/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {expandedMilestone.name}
                </h2>
                {isClient && clientName && (
                  <span className="text-xs text-muted-foreground">
                    · {clientName}
                  </span>
                )}
              </div>
              {expandedMilestone.description && (
                <p className="text-sm text-muted-foreground">
                  {expandedMilestone.description}
                </p>
              )}
            </div>
            {!isClient && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddDeliverableFor(expandedMilestone.id)}
              >
                <Plus className="size-3.5" />
                Deliverable
              </Button>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {expandedDeliverables.length === 0 ? (
              <p className="text-xs italic text-muted-foreground px-1">
                {isClient
                  ? "No deliverables defined for this milestone yet. Add them in Template View."
                  : 'No deliverables yet. Add the first one to define what "done" looks like for this milestone.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {expandedDeliverables.map((d) => {
                  const checked = isClient
                    ? Boolean(progress?.[d.id]?.done)
                    : false;
                  return (
                    <li
                      key={d.id}
                      className="flex items-start gap-3 rounded-md border border-border/60 bg-background/50 px-3 py-2"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!isClient || loadingProgress}
                        onCheckedChange={(c) => {
                          if (isClient && onToggleDeliverable) {
                            onToggleDeliverable(d, c === true);
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={cn(
                              "text-sm font-medium",
                              checked &&
                                "line-through text-muted-foreground",
                            )}
                          >
                            {d.title}
                          </p>
                          {d.required && (
                            <span className="rounded-full bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)] text-[10px] font-medium px-2 py-0.5">
                              required
                            </span>
                          )}
                        </div>
                        {d.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {d.description}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {!isClient && (
        <>
          <AddMilestoneDialog
            open={addMilestoneOpen}
            onOpenChange={setAddMilestoneOpen}
            nextSortOrder={milestones.length}
            onAdded={() => router.refresh()}
          />
          <AddDeliverableDialog
            open={addDeliverableFor !== null}
            onOpenChange={(o) => !o && setAddDeliverableFor(null)}
            milestoneId={addDeliverableFor}
            nextSortOrder={expandedDeliverables.length}
            onAdded={() => router.refresh()}
          />
        </>
      )}
    </div>
  );
}
