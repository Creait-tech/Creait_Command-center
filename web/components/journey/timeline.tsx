"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { AddMilestoneDialog } from "./add-milestone-dialog";
import { AddDeliverableDialog } from "./add-deliverable-dialog";
import type {
  JourneyMilestone,
  JourneyDeliverable,
} from "@/lib/supabase/types";

interface TimelineProps {
  milestones: JourneyMilestone[];
  deliverables: JourneyDeliverable[];
  mode: "template" | "client";
  clientName?: string;
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
}: TimelineProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(
    milestones[0]?.id ?? null,
  );
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [addDeliverableFor, setAddDeliverableFor] = useState<string | null>(
    null,
  );

  const nodes: NodeData[] = useMemo(() => {
    let runningTotal = 0;
    return milestones.map((m) => {
      const nodeDay = runningTotal;
      runningTotal += m.default_duration_days ?? 0;
      return { milestone: m, cumulativeDay: nodeDay };
    });
  }, [milestones]);

  const expandedMilestone = expandedId
    ? milestones.find((m) => m.id === expandedId)
    : null;
  const expandedDeliverables = expandedMilestone
    ? deliverables.filter((d) => d.milestone_id === expandedMilestone.id)
    : [];

  const ghosted = mode === "client";

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto pb-3">
        <div className="flex items-stretch min-w-max gap-0 px-1">
          {nodes.map((node, idx) => {
            const isExpanded = expandedId === node.milestone.id;
            const isLast = idx === nodes.length - 1;
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
                        isExpanded
                          ? "bg-[color:var(--color-brand-electric)] text-white"
                          : "bg-[color:var(--color-brand-slate)] text-white",
                      )}
                    >
                      D{node.cumulativeDay}
                    </div>
                    {/* Aha-moment star slot — Phase 3 leaves unmarked */}
                    <Star
                      className="absolute -top-2 -right-2 size-3.5 text-[color:var(--color-brand-fog)] opacity-0"
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
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180 text-[color:var(--color-brand-electric)]",
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
                {mode === "client" && clientName && (
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddDeliverableFor(expandedMilestone.id)}
            >
              <Plus className="size-3.5" />
              Deliverable
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {expandedDeliverables.length === 0 ? (
              <p className="text-xs italic text-muted-foreground px-1">
                No deliverables yet. Add the first one to define what "done"
                looks like for this milestone.
              </p>
            ) : (
              <ul className="space-y-2">
                {expandedDeliverables.map((d) => (
                  <li
                    key={d.id}
                    className={cn(
                      "flex items-start gap-3 rounded-md border border-border/60 bg-background/50 px-3 py-2",
                      ghosted && "opacity-60",
                    )}
                  >
                    <Checkbox
                      checked={false}
                      disabled
                      className={cn(ghosted && "opacity-70")}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{d.title}</p>
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
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

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
    </div>
  );
}
