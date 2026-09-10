"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createPrepSession } from "@/lib/prep-actions";
import { REVEAL_HELP, REVEAL_LABELS, type PrepReveal } from "@/lib/prep-types";
import { MEETING_AGENDAS, type MeetingType } from "@/lib/meeting-agendas";
import { defaultPrepQuestions, PREP_MEETING_TYPES } from "@/lib/prep-questions";
import { personName, type Person } from "@/lib/authorship";

export function CreatePrepDialog({ people }: { people: Person[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MeetingType>("quarterly");
  const [reveal, setReveal] = useState<PrepReveal>("after_all");
  const [dueAt, setDueAt] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(people.map((p) => p.id)));
  const [creating, setCreating] = useState(false);

  const questionCount = defaultPrepQuestions(type).length;

  function toggle(id: string, on: boolean) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function create() {
    setCreating(true);
    const result = await createPrepSession({
      meetingType: type,
      reveal,
      dueAt: dueAt ? new Date(`${dueAt}T23:59:00`).toISOString() : null,
      participantIds: Array.from(chosen),
    });
    setCreating(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    toast.success("Prep session created — send everyone the link.");
    router.push(`/prep/${result.data.id}`);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <ClipboardList className="size-4" />
        New prep session
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New prep session</DialogTitle>
            <DialogDescription>
              Everyone answers the same questions alone before the meeting. The room then spends its time on the
              disagreements instead of the warm-up.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Meeting this is prep for</p>
              <Select value={type} onValueChange={(v) => typeof v === "string" && setType(v as MeetingType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PREP_MEETING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {MEETING_AGENDAS[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{questionCount} questions in this set.</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Who answers</p>
              <ul className="grid grid-cols-2 gap-1.5">
                {people.map((p) => {
                  const on = chosen.has(p.id);
                  return (
                    <li key={p.id}>
                      <label
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm cursor-pointer transition-colors",
                          on
                            ? "border-[color:var(--color-brand-electric)]/60 bg-[color:var(--color-brand-electric)]/10"
                            : "border-border",
                        )}
                      >
                        <Checkbox checked={on} onCheckedChange={(v) => toggle(p.id, v === true)} />
                        <span className="truncate">{personName(p)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">When answers become visible</p>
              <Select value={reveal} onValueChange={(v) => typeof v === "string" && setReveal(v as PrepReveal)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(REVEAL_LABELS) as PrepReveal[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {REVEAL_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{REVEAL_HELP[reveal]}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Answers due by (optional)</p>
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={() => void create()} disabled={creating || chosen.size === 0}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
