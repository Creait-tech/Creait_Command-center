"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestoneId: string | null;
  nextSortOrder: number;
  onAdded: () => void;
}

export function AddDeliverableDialog({
  open,
  onOpenChange,
  milestoneId,
  nextSortOrder,
  onAdded,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !milestoneId) return;
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("journey_deliverables").insert({
      milestone_id: milestoneId,
      title: title.trim(),
      description: description.trim() || null,
      required,
      sort_order: nextSortOrder,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setDescription("");
    setRequired(true);
    onOpenChange(false);
    onAdded();
    toast.success("Deliverable added");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Deliverable</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Title{" "}
              <span className="text-[color:var(--color-brand-danger)]">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Signed contract"
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
                Must be done before milestone is complete.
              </p>
            </div>
            <Switch
              checked={required}
              onCheckedChange={(c) => setRequired(c === true)}
              disabled={submitting}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim() || !milestoneId}
            >
              {submitting ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
