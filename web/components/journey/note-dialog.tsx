"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { addClientNote } from "@/app/(dashboard)/journey/actions";
import type { JourneyDeliverable } from "@/lib/supabase/types";

interface Props {
  clientId: string;
  clientName: string;
  /** Null → the note is about the client as a whole. */
  deliverable: JourneyDeliverable | null;
  /** Existing deliverable note, so editing doesn't start from blank. */
  initialBody: string;
  onClose: () => void;
  /** Fires after a successful write so the caller can refresh immediately. */
  onSaved: () => void;
}

const MAX_LENGTH = 2000;

/**
 * How a teammate leaves context — "waiting on their logo files".
 *
 * Mounted only while open and keyed by target by the caller, so the draft
 * always starts from the note being edited and never follows you to the next
 * deliverable.
 */
export function NoteDialog({
  clientId,
  clientName,
  deliverable,
  initialBody,
  onClose,
  onSaved,
}: Props) {
  const [body, setBody] = useState(initialBody);
  const [submitting, setSubmitting] = useState(false);

  const isDeliverableNote = deliverable !== null;
  const hadNote = initialBody.trim().length > 0;
  const trimmed = body.trim();
  // An existing deliverable note can be emptied to retract it; a new note,
  // and any client-scoped note, has to actually say something.
  const clearing = isDeliverableNote && hadNote && trimmed.length === 0;
  const canSubmit = !submitting && (trimmed.length > 0 || clearing);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    const result = await addClientNote({
      clientId,
      body,
      deliverableId: deliverable?.id ?? null,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    onSaved();
    onClose();

    // The note is on the deliverable; only its feed entry failed. Saying
    // "saved" alone would hide a hole in the log the team relies on.
    if (result.data.activityError) {
      toast.error(
        `Note saved, but the activity log entry failed: ${result.data.activityError}`,
      );
      return;
    }
    toast.success(clearing ? "Note cleared" : "Note added");
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {isDeliverableNote
                ? "Note on deliverable"
                : `Note on ${clientName}`}
            </DialogTitle>
            <DialogDescription>
              {isDeliverableNote
                ? `“${deliverable.title}” — the whole team sees this next to the checkbox.`
                : "Leave context for a teammate: what you're waiting on, what changed, what's next."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Textarea
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MAX_LENGTH}
              rows={4}
              placeholder="Waiting on their logo files before we can build the landing page."
            />
            <p className="text-right text-[10px] tabular-nums text-muted-foreground">
              {body.length}/{MAX_LENGTH}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? "Saving…" : clearing ? "Clear note" : "Save note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
