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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DeleteImpactNotice } from "./delete-impact-notice";
import {
  deleteDeliverable,
  getDeliverableDeleteImpact,
  updateDeliverable,
  type DeliverableDeleteImpact,
} from "@/app/(dashboard)/journey/actions";
import type { JourneyDeliverable } from "@/lib/supabase/types";

interface Props {
  deliverable: JourneyDeliverable;
  /** Open straight on the delete confirmation instead of the edit form. */
  initialMode?: "edit" | "delete";
  onClose: () => void;
}

/**
 * Edit or delete one deliverable.
 *
 * Mounted only while a deliverable is selected and keyed by id by the caller,
 * so the form starts from the row being edited every time.
 *
 * `journey_deliverables` carries no `org_id` — every write here goes through a
 * server action that resolves ownership via the parent milestone first.
 */
export function EditDeliverableDialog({
  deliverable,
  initialMode = "edit",
  onClose,
}: Props) {
  const router = useRouter();

  const [mode, setMode] = useState<"edit" | "delete">(initialMode);
  const [title, setTitle] = useState(deliverable.title);
  const [description, setDescription] = useState(deliverable.description ?? "");
  const [required, setRequired] = useState(deliverable.required);
  const [sortOrder, setSortOrder] = useState(String(deliverable.sort_order));
  const [submitting, setSubmitting] = useState(false);

  const [impact, setImpact] = useState<DeliverableDeleteImpact | null>(null);
  const [impactError, setImpactError] = useState<string | null>(null);

  /** Clears the last answer so the confirm can't show a stale count. */
  function openDelete() {
    setImpact(null);
    setImpactError(null);
    setMode("delete");
  }

  // Fetched when delete opens, not reused from the page — the counts have to
  // describe the database as it is at the moment of confirming.
  useEffect(() => {
    if (mode !== "delete") return;
    let cancelled = false;
    void getDeliverableDeleteImpact(deliverable.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setImpact(result.data);
      else setImpactError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, deliverable.id]);

  const trimmedTitle = title.trim();
  const parsedOrder = Number.parseInt(sortOrder, 10);
  const orderValid = Number.isFinite(parsedOrder) && parsedOrder >= 0;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmedTitle || submitting) return;
    if (!orderValid) {
      toast.error("Position must be a whole number, 0 or higher");
      return;
    }

    setSubmitting(true);
    const result = await updateDeliverable({
      id: deliverable.id,
      title: trimmedTitle,
      description,
      required,
      sortOrder: parsedOrder,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onClose();
    router.refresh();
    toast.success("Deliverable updated");
  }

  async function handleDelete() {
    if (!impact || submitting) return;

    setSubmitting(true);
    const result = await deleteDeliverable({
      id: deliverable.id,
      acknowledged: { trackedRows: impact.trackedRows },
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onClose();
    router.refresh();
    toast.success(
      result.data.deletedJourneyRows > 0
        ? `Deliverable deleted, along with ${result.data.deletedJourneyRows} tracked client row(s)`
        : "Deliverable deleted",
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {mode === "edit" ? (
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Edit deliverable</DialogTitle>
              <DialogDescription>
                Changes apply to the template. Ticks already recorded against
                this deliverable are kept.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Title{" "}
                <span className="text-[color:var(--color-brand-danger)]">*</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Snapshot loaded into sub-account"
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
                placeholder="What does done look like?"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Required</p>
                <p className="text-xs text-muted-foreground">
                  Must be done before the milestone counts as complete.
                </p>
              </div>
              <Switch
                checked={required}
                onCheckedChange={(c) => setRequired(c === true)}
                disabled={submitting}
              />
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
                className="sm:max-w-[10rem]"
              />
              <p className="text-[11px] text-muted-foreground">
                Lowest number sits first within this milestone.
              </p>
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
                Delete deliverable
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
                disabled={submitting || !trimmedTitle || !orderValid}
              >
                {submitting ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Delete “{deliverable.title}”?</DialogTitle>
              <DialogDescription>
                Read what this removes before you confirm — client ticks are
                deleted with it, not kept.
              </DialogDescription>
            </DialogHeader>

            {impactError ? (
              <div className="rounded-lg border border-[color:var(--color-brand-warning)]/35 bg-[color:var(--color-brand-warning)]/8 p-3.5 text-xs leading-relaxed text-foreground/90">
                Couldn&rsquo;t work out what this would delete: {impactError}.
                Nothing has been deleted — close this and try again rather than
                deleting blind.
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
