"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  MessageSquarePlus,
  Pencil,
  Plus,
  Star,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { AddMilestoneDialog } from "./add-milestone-dialog";
import { AddDeliverableDialog } from "./add-deliverable-dialog";
import { EditMilestoneDialog } from "./edit-milestone-dialog";
import { EditDeliverableDialog } from "./edit-deliverable-dialog";
import { ActorStamp } from "./actor-stamp";
import {
  reorderDeliverables,
  reorderMilestones,
} from "@/app/(dashboard)/journey/actions";
import type { ClientProgressMap } from "./progress-map";
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
  /** Deliverable ids with a write in flight. */
  pendingIds?: Set<string>;
  onToggleDeliverable?: (
    deliverable: JourneyDeliverable,
    nextDone: boolean,
  ) => void;
  /** Client mode only — opens the shared note editor for one deliverable. */
  onOpenNote?: (deliverable: JourneyDeliverable) => void;
}

interface NodeData {
  milestone: JourneyMilestone;
  cumulativeDay: number;
}

interface MilestoneStat {
  /** Share of all deliverables ticked — drives the progress bar. */
  pct: number;
  /**
   * Every *required* deliverable ticked. `required` is documented as "must be
   * done before milestone is complete", so completion honours it rather than
   * demanding the optional ones too.
   */
  complete: boolean;
}

export function Timeline({
  milestones,
  deliverables,
  mode,
  clientName,
  progress,
  loadingProgress = false,
  pendingIds,
  onToggleDeliverable,
  onOpenNote,
}: TimelineProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(
    milestones[0]?.id ?? null,
  );
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [addDeliverableFor, setAddDeliverableFor] = useState<string | null>(
    null,
  );
  // Ids, not snapshots: the row is re-derived from props on every render, so a
  // refresh landing while a dialog is open shows current values rather than a
  // copy taken when it was opened.
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(
    null,
  );
  const [editingDeliverableId, setEditingDeliverableId] = useState<
    string | null
  >(null);
  const [reordering, setReordering] = useState(false);

  const isClient = mode === "client";

  const nodes: NodeData[] = useMemo(() => {
    let runningTotal = 0;
    return milestones.map((m) => {
      const nodeDay = runningTotal;
      runningTotal += m.default_duration_days ?? 0;
      return { milestone: m, cumulativeDay: nodeDay };
    });
  }, [milestones]);

  // Per-milestone stats for the selected client (client mode only).
  const milestoneStats = useMemo(() => {
    const map: Record<string, MilestoneStat> = {};
    if (!isClient || !progress) return map;
    for (const m of milestones) {
      const items = deliverables.filter((d) => d.milestone_id === m.id);
      if (items.length === 0) {
        map[m.id] = { pct: 0, complete: false };
        continue;
      }
      const done = items.filter((d) => progress[d.id]?.done).length;
      const required = items.filter((d) => d.required);
      const gating = required.length > 0 ? required : items;
      map[m.id] = {
        pct: Math.round((done / items.length) * 100),
        complete: gating.every((d) => progress[d.id]?.done),
      };
    }
    return map;
  }, [isClient, progress, milestones, deliverables]);

  const expandedIndex = expandedId
    ? milestones.findIndex((m) => m.id === expandedId)
    : -1;
  const expandedMilestone = expandedIndex >= 0 ? milestones[expandedIndex] : null;
  const expandedDeliverables = expandedMilestone
    ? deliverables.filter((d) => d.milestone_id === expandedMilestone.id)
    : [];

  const editingMilestone =
    milestones.find((m) => m.id === editingMilestoneId) ?? null;
  const editingDeliverable =
    deliverables.find((d) => d.id === editingDeliverableId) ?? null;

  /**
   * Move one item and rewrite the whole list's positions.
   *
   * Absolute `sort_order = 0..n-1` rather than swapping two values: nothing in
   * the schema stops duplicate or gappy positions (the numeric field in the
   * edit dialogs can create them), and a swap would preserve the mess.
   */
  function swapped(ids: string[], from: number, to: number): string[] {
    return ids.map((id, i) => (i === from ? ids[to] : i === to ? ids[from] : id));
  }

  async function moveMilestone(from: number, delta: number) {
    const to = from + delta;
    if (reordering || to < 0 || to >= milestones.length) return;

    setReordering(true);
    const result = await reorderMilestones(
      swapped(
        milestones.map((m) => m.id),
        from,
        to,
      ),
    );
    setReordering(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  async function moveDeliverable(from: number, delta: number) {
    const to = from + delta;
    if (
      reordering ||
      !expandedMilestone ||
      to < 0 ||
      to >= expandedDeliverables.length
    ) {
      return;
    }

    setReordering(true);
    const result = await reorderDeliverables({
      milestoneId: expandedMilestone.id,
      orderedIds: swapped(
        expandedDeliverables.map((d) => d.id),
        from,
        to,
      ),
    });
    setReordering(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto pb-3">
        <div className="flex items-stretch min-w-max gap-0 px-1">
          {nodes.map((node, idx) => {
            const isExpanded = expandedId === node.milestone.id;
            const isLast = idx === nodes.length - 1;
            const stat = milestoneStats[node.milestone.id];
            const pct = stat?.pct ?? 0;
            const complete = isClient && Boolean(stat?.complete);
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
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => moveMilestone(expandedIndex, -1)}
                  disabled={reordering || expandedIndex <= 0}
                  aria-label={`Move ${expandedMilestone.name} earlier`}
                  title="Move earlier"
                >
                  <ArrowLeft className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => moveMilestone(expandedIndex, 1)}
                  disabled={
                    reordering || expandedIndex >= milestones.length - 1
                  }
                  aria-label={`Move ${expandedMilestone.name} later`}
                  title="Move later"
                >
                  <ArrowRight className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setEditingMilestoneId(expandedMilestone.id)}
                  aria-label={`Edit ${expandedMilestone.name}`}
                  title="Edit or delete milestone"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddDeliverableFor(expandedMilestone.id)}
                >
                  <Plus className="size-3.5" />
                  Deliverable
                </Button>
              </div>
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
                {expandedDeliverables.map((d, index) => {
                  const row = isClient ? progress?.[d.id] : undefined;
                  const checked = Boolean(row?.done);
                  const pending = Boolean(pendingIds?.has(d.id));
                  return (
                    <li
                      key={d.id}
                      className={cn(
                        "flex items-start gap-3 rounded-md border border-border/60 bg-background/50 px-3 py-2 transition-opacity",
                        pending && "opacity-60",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!isClient || loadingProgress || pending}
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
                        {/* Attribution stays silent on untouched deliverables —
                            ActorStamp renders nothing without a name. */}
                        {isClient && (
                          <ActorStamp
                            name={row?.updatedByName ?? null}
                            type={row?.updatedByType ?? null}
                            at={row?.updatedAt ?? null}
                            className="mt-1"
                          />
                        )}
                        {isClient && row?.notes && (
                          <p className="mt-1.5 flex items-start gap-1.5 rounded-md border border-[color:var(--color-brand-mist)]/25 bg-[color:var(--color-brand-slate)]/20 px-2 py-1 text-xs text-foreground/90">
                            <StickyNote
                              className="mt-px size-3 shrink-0 text-[color:var(--color-brand-mist)]"
                              aria-hidden
                            />
                            <span className="min-w-0 break-words">
                              {row.notes}
                            </span>
                          </p>
                        )}
                      </div>
                      {isClient && onOpenNote && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => onOpenNote(d)}
                          aria-label={
                            row?.notes
                              ? `Edit note on ${d.title}`
                              : `Add note on ${d.title}`
                          }
                          title={row?.notes ? "Edit note" : "Add note"}
                        >
                          <MessageSquarePlus className="size-3.5" />
                        </Button>
                      )}
                      {!isClient && (
                        <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => moveDeliverable(index, -1)}
                            disabled={reordering || index === 0}
                            aria-label={`Move ${d.title} up`}
                            title="Move up"
                          >
                            <ArrowUp className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => moveDeliverable(index, 1)}
                            disabled={
                              reordering ||
                              index === expandedDeliverables.length - 1
                            }
                            aria-label={`Move ${d.title} down`}
                            title="Move down"
                          >
                            <ArrowDown className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditingDeliverableId(d.id)}
                            aria-label={`Edit ${d.title}`}
                            title="Edit or delete deliverable"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </div>
                      )}
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
          />
          <AddDeliverableDialog
            open={addDeliverableFor !== null}
            onOpenChange={(o) => !o && setAddDeliverableFor(null)}
            milestoneId={addDeliverableFor}
          />
          {/* Mounted only while editing and keyed by id, so each form starts
              from the row it is actually editing. */}
          {editingMilestone && (
            <EditMilestoneDialog
              key={editingMilestone.id}
              milestone={editingMilestone}
              onClose={() => setEditingMilestoneId(null)}
            />
          )}
          {editingDeliverable && (
            <EditDeliverableDialog
              key={editingDeliverable.id}
              deliverable={editingDeliverable}
              onClose={() => setEditingDeliverableId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
