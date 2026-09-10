"use client";

import { useState } from "react";
import { Plus, Pencil, Trash, UserPlus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { cn } from "@/lib/utils";
import { PeopleAnalyzer } from "./people-analyzer";
import { personName, type Person } from "@/lib/authorship";
import type {
  TeamSeat,
  SeatAssignment,
  GwcRating,
} from "@/lib/supabase/types";

interface Props {
  members: Person[];
  seats: TeamSeat[];
  assignments: SeatAssignment[];
}

const GWC_LABEL: Record<GwcRating, string> = {
  plus: "+",
  plus_minus: "±",
  minus: "−",
  unknown: "?",
};

const GWC_STYLE: Record<GwcRating, string> = {
  plus: "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)] border-[color:var(--color-brand-success)]/40",
  plus_minus: "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)] border-[color:var(--color-brand-warning)]/40",
  minus: "bg-[color:var(--color-brand-danger)]/20 text-[color:var(--color-brand-danger)] border-[color:var(--color-brand-danger)]/40",
  unknown: "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)] border-border",
};

const GWC_CYCLE: Record<GwcRating, GwcRating> = {
  unknown: "plus",
  plus: "plus_minus",
  plus_minus: "minus",
  minus: "unknown",
};

function parseResponsibilities(seat: TeamSeat): string[] {
  const r = seat.responsibilities;
  if (Array.isArray(r)) return r.filter((x): x is string => typeof x === "string");
  return [];
}

export function SeatsBoard({ members, seats, assignments }: Props) {
  const [editingSeat, setEditingSeat] = useState<TeamSeat | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [assignSeatId, setAssignSeatId] = useState<string | null>(null);

  async function deleteSeat(id: string) {
    if (!confirm("Delete this seat? (Assignments will be removed.)")) return;
    const supabase = createClient();
    // Select the row back: a refused DELETE matches zero rows and still
    // reports success.
    const { data, error } = await supabase.from("cc_team_seats").delete().eq("id", id).select("id");
    if (error) toast.error(error.message);
    else if (!data || data.length === 0) toast.error("Couldn't delete that seat — the change was rejected.");
    else toast.success("Seat deleted");
  }

  async function cycleGwc(assignmentId: string, field: "gwc_get" | "gwc_want" | "gwc_capacity", current: GwcRating) {
    const next = GWC_CYCLE[current];
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cc_seat_assignments")
      .update({ [field]: next, updated_at: new Date().toISOString() })
      .eq("id", assignmentId)
      .select("id");
    if (error) toast.error(error.message);
    else if (!data || data.length === 0) toast.error("Couldn't save that GWC rating — the change was rejected.");
  }

  async function unassign(assignmentId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cc_seat_assignments")
      .delete()
      .eq("id", assignmentId)
      .select("id");
    if (error) toast.error(error.message);
    else if (!data || data.length === 0) toast.error("Couldn't remove that assignment — the change was rejected.");
    else toast.success("Removed from seat");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Accountability Chart</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            EOS rule: <strong>functions first, people second.</strong> Define the seat (function + 3-5 responsibilities), then put the right person in it.
            Rate each person on <strong>GWC</strong> — Get it / Want it / Capacity — click any badge to cycle ? → + → ± → −.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="size-4" />
          Add Seat
        </Button>
      </div>

      {seats.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <p className="text-sm font-medium">No seats yet</p>
            <p className="text-xs text-muted-foreground">
              EOS standard: Visionary, Integrator, Sales & Marketing, Operations, Finance/Admin.
              Customize all titles + responsibilities to your business.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {seats.map((seat) => {
            const seatAssignments = assignments.filter((a) => a.seat_id === seat.id);
            const responsibilities = parseResponsibilities(seat);
            return (
              <Card key={seat.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base">{seat.title}</h3>
                      {seat.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{seat.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edit seat" onClick={() => setEditingSeat(seat)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete seat" onClick={() => deleteSeat(seat.id)}>
                        <Trash className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {responsibilities.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Responsibilities</p>
                      <ul className="text-xs space-y-0.5">
                        {responsibilities.map((r, i) => (
                          <li key={i} className="text-[color:var(--color-brand-mist)]">• {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="border-t border-border pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">People in this seat ({seatAssignments.length})</p>
                      <Button variant="ghost" size="sm" onClick={() => setAssignSeatId(seat.id)}>
                        <UserPlus className="size-3" />
                        Assign
                      </Button>
                    </div>
                    {seatAssignments.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No one assigned. EOS says: open seat — recruit or reassign.</p>
                    ) : (
                      <ul className="space-y-2">
                        {seatAssignments.map((a) => {
                          const m = members.find((x) => x.id === a.member_id);
                          return (
                            <li key={a.id} className="flex items-center gap-2 text-xs">
                              <span className="size-6 rounded-full bg-[color:var(--color-brand-slate)] flex items-center justify-center text-[10px] font-medium">
                                {(m ? personName(m) : "??").slice(0, 2).toUpperCase()}
                              </span>
                              <span className="flex-1 truncate">{m ? personName(m) : "Unknown"}</span>
                              <button
                                type="button"
                                onClick={() => cycleGwc(a.id, "gwc_get", a.gwc_get)}
                                className={cn("size-6 rounded border text-xs font-bold transition-colors", GWC_STYLE[a.gwc_get])}
                                title={`Get it: ${a.gwc_get}`}
                              >
                                G{GWC_LABEL[a.gwc_get]}
                              </button>
                              <button
                                type="button"
                                onClick={() => cycleGwc(a.id, "gwc_want", a.gwc_want)}
                                className={cn("size-6 rounded border text-xs font-bold transition-colors", GWC_STYLE[a.gwc_want])}
                                title={`Want it: ${a.gwc_want}`}
                              >
                                W{GWC_LABEL[a.gwc_want]}
                              </button>
                              <button
                                type="button"
                                onClick={() => cycleGwc(a.id, "gwc_capacity", a.gwc_capacity)}
                                className={cn("size-6 rounded border text-xs font-bold transition-colors", GWC_STYLE[a.gwc_capacity])}
                                title={`Capacity: ${a.gwc_capacity}`}
                              >
                                C{GWC_LABEL[a.gwc_capacity]}
                              </button>
                              <Button variant="ghost" size="icon" aria-label="Remove from seat" onClick={() => unassign(a.id)}>
                                <X className="size-3" />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {seats.length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">People Analyzer</p>
          <PeopleAnalyzer members={members} seats={seats} assignments={assignments} />
        </div>
      )}

      <SeatEditorDialog
        open={editingSeat !== null || showNew}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSeat(null);
            setShowNew(false);
          }
        }}
        seat={editingSeat}
      />

      <AssignMemberDialog
        open={assignSeatId !== null}
        onOpenChange={(open) => { if (!open) setAssignSeatId(null); }}
        seatId={assignSeatId}
        members={members}
        existingAssignments={assignments}
      />
    </div>
  );
}

// ----------- Seat editor dialog -----------
function SeatEditorDialog({
  open,
  onOpenChange,
  seat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seat: TeamSeat | null;
}) {
  const orgId = useActiveOrgId();
  const [title, setTitle] = useState(seat?.title ?? "");
  const [description, setDescription] = useState(seat?.description ?? "");
  const [respText, setRespText] = useState(
    seat ? parseResponsibilities(seat).join("\n") : "",
  );
  const [submitting, setSubmitting] = useState(false);

  // Reset state when dialog opens with different seat
  useState(() => {
    if (seat) {
      setTitle(seat.title);
      setDescription(seat.description ?? "");
      setRespText(parseResponsibilities(seat).join("\n"));
    } else {
      setTitle("");
      setDescription("");
      setRespText("");
    }
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    setSubmitting(true);
    const responsibilities = respText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const supabase = createClient();
    if (seat) {
      // Select the row back: a refused UPDATE matches zero rows and still
      // reports success.
      const { data, error } = await supabase
        .from("cc_team_seats")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          responsibilities,
          updated_at: new Date().toISOString(),
        })
        .eq("id", seat.id)
        .eq("org_id", orgId)
        .select("id");
      setSubmitting(false);
      if (error) toast.error(error.message);
      else if (!data || data.length === 0) toast.error("Couldn't save that seat — the change was rejected.");
      else {
        toast.success("Seat updated");
        onOpenChange(false);
      }
    } else {
      const { error } = await supabase.from("cc_team_seats").insert({
        org_id: orgId,
        title: title.trim(),
        description: description.trim() || null,
        responsibilities,
        sort_order: 999,
      });
      setSubmitting(false);
      if (error) toast.error(error.message);
      else {
        toast.success("Seat added");
        onOpenChange(false);
        setTitle("");
        setDescription("");
        setRespText("");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{seat ? `Edit: ${seat.title}` : "Add Seat"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Operations, Visionary, Sales Lead"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-14"
              placeholder="One-sentence summary of what this seat owns"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Responsibilities (one per line — 3-5 ideal)</label>
            <Textarea
              value={respText}
              onChange={(e) => setRespText(e.target.value)}
              className="min-h-28 font-mono text-xs"
              placeholder={"Client onboarding\nCREAIT OS builds\nClient success\nQuality control"}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : seat ? "Update Seat" : "Add Seat"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ----------- Assign member dialog -----------
function AssignMemberDialog({
  open,
  onOpenChange,
  seatId,
  members,
  existingAssignments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seatId: string | null;
  members: Person[];
  existingAssignments: SeatAssignment[];
}) {
  const [memberId, setMemberId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const alreadyAssigned = new Set(existingAssignments.filter((a) => a.seat_id === seatId).map((a) => a.member_id));
  const available = members.filter((m) => !alreadyAssigned.has(m.id));

  async function handleSubmit() {
    if (!memberId || !seatId) return;
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("cc_seat_assignments").insert({
      seat_id: seatId,
      member_id: memberId,
      gwc_get: "unknown",
      gwc_want: "unknown",
      gwc_capacity: "unknown",
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Assigned");
      onOpenChange(false);
      setMemberId("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to Seat</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone is already in this seat.</p>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Pick a team member</label>
              <Select value={memberId} onValueChange={(v) => typeof v === "string" && setMemberId(v)}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {available.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{personName(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" onClick={handleSubmit} disabled={!memberId || submitting}>
              {submitting ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
