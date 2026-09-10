"use client";

import { useState } from "react";
import { Plus, GripVertical, Dice5 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FeatureEmptyState } from "@/components/empty-states/feature-empty-state";
import { cn } from "@/lib/utils";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import type { StrategicBet, StrategicBetStatus } from "@/lib/supabase/types";

interface StrategicBetsProps {
  bets: StrategicBet[];
  onChange: (next: StrategicBet[]) => void;
}

const STATUS_OPTIONS: { value: StrategicBetStatus; label: string }[] = [
  { value: "exploring", label: "Exploring" },
  { value: "validating", label: "Validating" },
  { value: "committed", label: "Committed" },
  { value: "dropped", label: "Dropped" },
];

const STATUS_STYLES: Record<StrategicBetStatus, string> = {
  exploring:
    "bg-[color:var(--color-brand-violet)]/20 text-[color:var(--color-brand-violet)]",
  validating:
    "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)]",
  committed:
    "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]",
  dropped:
    "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]",
};

interface DraftBet {
  title: string;
  hypothesis: string;
  evidence: string;
  status: StrategicBetStatus;
}

const EMPTY_DRAFT: DraftBet = {
  title: "",
  hypothesis: "",
  evidence: "",
  status: "exploring",
};

function BetCard({ bet }: { bet: StrategicBet }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: bet.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-slate)]/40 p-4 flex gap-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="shrink-0 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing pt-0.5"
      >
        <GripVertical className="size-4" />
      </button>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h3 className="text-base font-semibold">{bet.title}</h3>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              STATUS_STYLES[bet.status]
            )}
          >
            {bet.status}
          </span>
        </div>

        {bet.hypothesis && (
          <div className="text-sm">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5">
              Hypothesis
            </span>
            <p className="whitespace-pre-wrap leading-relaxed">{bet.hypothesis}</p>
          </div>
        )}

        {bet.evidence && (
          <div className="text-sm">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-0.5">
              Evidence
            </span>
            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {bet.evidence}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function StrategicBets({ bets, onChange }: StrategicBetsProps) {
  const orgId = useActiveOrgId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<DraftBet>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function openDialog() {
    setDraft(EMPTY_DRAFT);
    setError(null);
    setDialogOpen(true);
  }

  async function saveBet() {
    if (!draft.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const nextSort =
      bets.reduce((max, b) => Math.max(max, b.sort_order), -1) + 1;

    const payload = {
      org_id: orgId,
      title: draft.title.trim(),
      hypothesis: draft.hypothesis.trim() || null,
      evidence: draft.evidence.trim() || null,
      status: draft.status,
      sort_order: nextSort,
    };

    const { data, error: insertError } = await supabase
      .from("strategic_bets")
      .insert(payload)
      .select()
      .single();

    setSaving(false);
    if (insertError || !data) {
      setError(insertError?.message ?? "Failed to save bet.");
      return;
    }
    onChange([...bets, data as StrategicBet]);
    setDialogOpen(false);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = bets.findIndex((b) => b.id === active.id);
    const newIndex = bets.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(bets, oldIndex, newIndex).map((b, idx) => ({
      ...b,
      sort_order: idx,
    }));
    const previous = bets;
    onChange(reordered);

    // Persist new sort_order for affected rows. Update in parallel, selecting
    // each row back: a refused UPDATE matches zero rows and reports success.
    const supabase = createClient();
    const results = await Promise.all(
      reordered.map((b) =>
        supabase
          .from("strategic_bets")
          .update({
            sort_order: b.sort_order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", b.id)
          .eq("org_id", orgId)
          .select("id")
      )
    );
    const failed = results.find((r) => r.error || !r.data || r.data.length === 0);
    if (failed) {
      onChange(previous);
      toast.error(failed.error?.message ?? "Couldn't save the new order — the change was rejected.");
    }
  }

  const ids = bets.map((b) => b.id);

  return (
    <div className="space-y-4">
      {bets.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openDialog}>
            <Plus className="size-3.5" />
            Add Bet
          </Button>
        </div>
      )}

      {bets.length === 0 ? (
        <FeatureEmptyState
          icon={<Dice5 className="size-5" />}
          title="No strategic bets recorded"
          description="A bet is a belief the plan depends on, written down before you find out whether it was right: the hypothesis, the evidence so far, and whether it is still exploring, being validated, or committed. Writing them down is what stops a quarter of work resting on an assumption nobody remembers making."
          useWhen={[
            "You just made a call the whole quarter depends on — write it down while the reasoning is fresh.",
            "Evidence arrives that moves a bet from exploring to validating, or kills it outright.",
            "Quarterly planning — re-read every committed bet and ask whether it still holds.",
          ]}
          action={{
            label: "Record the first bet",
            onClick: openDialog,
            icon: <Plus className="size-3.5" />,
          }}
        />
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {bets.map((bet) => (
                <BetCard key={bet.id} bet={bet} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Strategic Bet</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bet-title">Title *</Label>
              <Input
                id="bet-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Ship a productized GHL onboarding"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bet-hypothesis">Hypothesis</Label>
              <Textarea
                id="bet-hypothesis"
                value={draft.hypothesis}
                onChange={(e) =>
                  setDraft({ ...draft, hypothesis: e.target.value })
                }
                placeholder="We believe X because Y."
                className="min-h-20 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bet-evidence">Evidence</Label>
              <Textarea
                id="bet-evidence"
                value={draft.evidence}
                onChange={(e) =>
                  setDraft({ ...draft, evidence: e.target.value })
                }
                placeholder="Signals collected so far."
                className="min-h-20 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bet-status">Status</Label>
              <select
                id="bet-status"
                value={draft.status}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    status: e.target.value as StrategicBetStatus,
                  })
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-xs text-[color:var(--color-brand-danger)]">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={saveBet} disabled={saving}>
              {saving ? "Saving…" : "Save Bet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
