"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, ChevronDown } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEETING_AGENDAS, agendaBudgetSec, type MeetingType } from "@/lib/meeting-agendas";
import { startMeeting } from "@/lib/meeting-actions";
import { personName, type Person } from "@/lib/authorship";
import { cn } from "@/lib/utils";

interface StartMeetingButtonProps {
  /** Active roster; everyone is checked in by default. */
  people: Person[];
  /** The signed-in person's roster id — the default presenter. */
  currentMemberId: string | null;
}

/**
 * Every EOS meeting type, grouped the way ninety.io groups them. All eight
 * are startable: the weekly rhythm, the planning sessions, and the
 * one-to-one and company conversations.
 */
const GROUPS: Array<{ label: string; types: MeetingType[] }> = [
  { label: "Weekly rhythm", types: ["level_10", "huddle"] },
  { label: "Planning sessions", types: ["quarterly", "annual"] },
  { label: "Conversations", types: ["quarterly_conversation", "same_page", "financial", "state_of_company"] },
];

function fmtBudget(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m} min`;
}

export function StartMeetingButton({ people, currentMemberId }: StartMeetingButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MeetingType>("level_10");
  const [attendees, setAttendees] = useState<Set<string>>(() => new Set(people.map((p) => p.id)));
  const [presenterId, setPresenterId] = useState<string>(
    currentMemberId && people.some((p) => p.id === currentMemberId) ? currentMemberId : (people[0]?.id ?? ""),
  );
  const [starting, setStarting] = useState(false);

  function openFor(next: MeetingType) {
    setType(next);
    setOpen(true);
  }

  function toggleAttendee(id: string, on: boolean) {
    setAttendees((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function start() {
    const agenda = MEETING_AGENDAS[type];
    setStarting(true);
    const result = await startMeeting({
      type,
      attendeeIds: Array.from(attendees),
      presenterId: presenterId || null,
    });
    setStarting(false);
    if (!result.ok) {
      toast.error(`Couldn't start the meeting: ${result.error}`);
      return;
    }
    setOpen(false);
    toast.success(`${agenda.label} started — ${agenda.sections[0].label} first.`);
    router.push(`/level-10/meeting/${result.data.id}`);
  }

  const agenda = MEETING_AGENDAS[type];

  return (
    <>
      <div className="flex items-stretch">
        <Button onClick={() => openFor("level_10")} className="rounded-r-none">
          <Play className="size-4" />
          Start Level 10
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button className="rounded-l-none border-l border-l-white/25 px-2" />}
            aria-label="Choose a different meeting type"
          >
            <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            {GROUPS.map((group) => (
              <div key={group.label}>
                <p className="px-2 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                {group.types.map((t) => {
                  const a = MEETING_AGENDAS[t];
                  return (
                    <DropdownMenuItem
                      key={t}
                      onSelect={() => openFor(t)}
                      className="flex flex-col items-start gap-0.5 py-2"
                    >
                      <span className="text-sm font-medium">{a.label}</span>
                      <span className="text-xs text-muted-foreground">{a.cadence}</span>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Start {agenda.label}</DialogTitle>
            <DialogDescription>
              {agenda.cadence} · {agenda.sections.length} sections · {fmtBudget(agendaBudgetSec(agenda))}. Nothing is
              saved until you press Start.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Meeting</p>
              <Select value={type} onValueChange={(v) => typeof v === "string" && setType(v as MeetingType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUPS.flatMap((g) => g.types).map((t) => (
                    <SelectItem key={t} value={t}>
                      {MEETING_AGENDAS[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Who&apos;s in the room</p>
              {people.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No active team members on the roster yet — add them under Team.
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-1.5">
                  {people.map((p) => {
                    const on = attendees.has(p.id);
                    return (
                      <li key={p.id}>
                        <label
                          className={cn(
                            "flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm cursor-pointer transition-colors",
                            on ? "border-[color:var(--color-brand-electric)]/60 bg-[color:var(--color-brand-electric)]/10" : "border-border",
                          )}
                        >
                          <Checkbox checked={on} onCheckedChange={(v) => toggleAttendee(p.id, v === true)} />
                          <span className="truncate">{personName(p)}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Presenter (runs the clock)</p>
              <Select value={presenterId} onValueChange={(v) => typeof v === "string" && setPresenterId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose the presenter" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {personName(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={starting}>
              Cancel
            </Button>
            <Button onClick={() => void start()} disabled={starting || attendees.size === 0}>
              <Play className="size-4" />
              {starting ? "Starting…" : "Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
