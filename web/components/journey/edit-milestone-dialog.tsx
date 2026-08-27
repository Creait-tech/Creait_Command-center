"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DeleteImpactNotice } from "./delete-impact-notice";
import {
  deleteMilestone,
  getMilestoneDeleteImpact,
  updateMilestone,
  type MilestoneDeleteImpact,
} from "@/app/(dashboard)/journey/actions";
import type { JourneyMilestone } from "@/lib/supabase/types";

interface Props {
  milestone: JourneyMilestone;
  /** Open straight on the delete confirmation instead of the edit form. */
  initialMode?: "edit" | "delete";
  onClose: () => void;
}

/**
 * Edit or delete one milestone.
 *
 * The caller mounts this only while a milestone is selected and keys it by id,
 * so the form always starts from the row being edited and a draft can never
 * follow you to the next milestone.
 *
 * Delete is a second step inside the same dialog rather than a separate one:
 * the impact is fetched at that moment (not from anything the page was already
 * holding) so the operator confirms against what is true now, and the counts
 * they saw are sent back with the delete to be re-checked server-side.
 */
export function EditMilestoneDialog({
  milestone,
  initialMode = "edit",
  onClose,
}: Props) {
  const router = useRouter();

  const [mode, setMode] = useState<"edit" | "delete">(initialMode);
  const [name, setName] = useState(milestone.name);
  const [description, setDescription] = useState(milestone.description ?? "");
  const [durationDays, setDurationDays] = useState(
    milestone.default_duration_days === null
      ? ""
      : String(milestone.default_duration_days),
  );
  const [sortOrder, setSortOrder] = useState(String(milestone.sort_order));
  const [submitting, setSubmitting] = useState(false);

  const [impact, setImpact] = useState<MilestoneDeleteImpact | null>(null);
  const [impactError, setImpactError] = useState<string | null>(null);

  /** Clears the last answer so the confirm can't show a stale count. */
  function openDelete() {
    setImpact(null);
    setImpactError(null);
    setMode("delete");
  }

  // Read live at the moment delete is opened. Reusing counts the page loaded
  // earlier would let the operator agree to damage that has since grown.
  useEffect(() => {
    if (mode !== "delete") return;
    let cancelled = false;
    void getMilestoneDeleteImpact(milestone.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setImpact(result.data);
      else setImpactError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, milestone.id]);

  const trimmedName = name.trim();
  const parsedOrder = Number.parseInt(sortOrder, 10);
  const orderValid = Number.isFinite(parsedOrder) && parsedOrder >= 0;
  const parsedDuration = Number.parseInt(durationDays, 10);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmedName || submitting) return;
    if (!orderValid) {
      toast.error("Position must be a whole number, 0 or higher");
      return;
    }

    setSubmitting(true);
    const result = await updateMilestone({
      id: milestone.id,
      name: trimmedName,
      description,
      durationDays:
        durationDays.trim() === "" || !Number.isFinite(parsedDuration)
          ? null
          : parsedDuration,
      sortOrder: parsedOrder,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onClose();
    router.refresh();
    toast.success("Milestone updated");
  }

  async function handleDelete() {
    if (!impact || submitting) return;

    setSubmitting(true);
    const result = await deleteMilestone({
      id: milestone.id,
      acknowledged: {
        deliverableCount: impact.deliverableCount,
        trackedRows: impact.trackedRows,
      },
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onClose();
    router.refresh();
    toast.success(
      result.data.deletedDeliverables > 0 || result.data.deletedJourneyRows > 0
        ? `Milestone deleted, along with ${result.data.deletedDeliverables} deliverable(s) and ${result.data.deletedJourneyRows} tracked client row(s)`
        : "Milestone deleted",
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {mode === "edit" ? (
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit milestone</DialogTitle>
              <DialogDescription>
                Changes apply to the template, so every client — current and
                future — sees them.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Name{" "}
                <span className="text-[color:var(--color-brand-danger)]">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kickoff Call"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happens at this milestone?"
                rows={3}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Duration (days)
                </label>
                <Input
                  type="number"
                  min="0"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="7"
                />
                <p className="text-[11px] text-muted-foreground">
                  Days after the previous milestone. Blank leaves it unset.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Position
                </label>
                <Input
                  type="number"
                  min="0"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  aria-invalid={!orderValid}
                />
                <p className="text-[11px] text-muted-foreground">
                  Lowest number sits first on the timeline.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                onClick={openDelete}
                disabled={submitting}
                className="sm:mr-auto"
              >
                <Trash2 className="size-3.5" />
                Delete milestone
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !trimmedName || !orderValid}
              >
                {submitting ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Delete “{milestone.name}”?</DialogTitle>
              <DialogDescription>
                Read what this removes before you confirm — a milestone delete
                cascades into client history.
              </DialogDescription>
            </DialogHeader>

            {impactError ? (
              <div className="rounded-lg border border-[color:var(--color-brand-warning)]/35 bg-[color:var(--color-brand-warning)]/8 p-3.5 text-xs leading-relaxed text-foreground/90">
                Couldn&rsquo;t work out what this would delete:{" "}
                {impactError}. Nothing has been deleted — close this and try
                again rather than deleting blind.
              </div>
            ) : impact ? (
              <DeleteImpactNotice impact={impact} />
            ) : (
              <p className="flex items-center gap-2 rounded-lg border border-border bg-background/50 p-3.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Checking what this would destroy…
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  initialMode === "delete" ? onClose() : setMode("edit")
                }
                disabled={submitting}
              >
                {initialMode === "delete" ? "Cancel" : "Back to editing"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={submitting || !impact}
              >
                <Trash2 className="size-3.5" />
                {submitting ? "Deleting…" : "Delete permanently"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
