"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Radio, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { discardMeeting } from "@/lib/meeting-actions";
import { fmtClock, totalDurationSec } from "@/lib/meeting-progress";
import type { Meeting } from "@/lib/supabase/types";

/**
 * Shown on the Level 10 page while a meeting is running: the room is a page,
 * so closing the tab does not end the meeting. Resume takes you back in;
 * Discard deletes the record (captured items survive without the link).
 */
export function InProgressBanner({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const startedLabel = meeting.started_at
    ? new Date(meeting.started_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;
  const elapsed = fmtClock(totalDurationSec(meeting.agenda_state));

  async function discard() {
    if (!window.confirm("Discard this meeting? The record is deleted. To-dos, issues and headlines already captured are kept.")) return;
    setBusy(true);
    const result = await discardMeeting(meeting.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Meeting discarded");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[color:var(--color-brand-electric)]/50 bg-[color:var(--color-brand-electric)]/10 px-4 py-3">
      <Radio className="size-4 text-[color:var(--color-brand-electric)] animate-pulse" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{meeting.title} is in progress</p>
        <p className="text-xs text-muted-foreground">
          {startedLabel ? `Started ${startedLabel} · ` : ""}
          {elapsed} on the clock
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => void discard()} disabled={busy}>
        <Trash2 className="size-3.5" />
        Discard
      </Button>
      <Button size="sm" render={<Link href={`/level-10/meeting/${meeting.id}`} />}>
        Resume
      </Button>
    </div>
  );
}
