"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipForward, X, Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Section {
  key: string;
  label: string;
  budgetSec: number;
  description: string;
}

const SECTIONS: Section[] = [
  { key: "segue",     label: "Segue",                budgetSec: 5 * 60,  description: "Each person: 1 personal + 1 business good news. Stay connected." },
  { key: "scorecard", label: "Scorecard",            budgetSec: 5 * 60,  description: "Each KPI: on-track or off-track. NO discussion. Off-track → Issue." },
  { key: "rocks",     label: "Rock Review",          budgetSec: 5 * 60,  description: "Each Rock owner: on-track or off-track. NO discussion. Off-track → Issue." },
  { key: "headlines", label: "Customer/Employee Headlines", budgetSec: 5 * 60, description: "One-sentence updates. If needs discussion → Issue." },
  { key: "todos",     label: "To-Do Review",         budgetSec: 5 * 60,  description: "Done / not done. Carry over or drop to Issues." },
  { key: "ids",       label: "IDS — Identify, Discuss, Solve", budgetSec: 60 * 60, description: "Top 3 issues. Identify root cause → discuss → solve forever." },
  { key: "conclude",  label: "Conclude",             budgetSec: 5 * 60,  description: "Recap To-Dos. Everyone rates the meeting 1-10. Target ≥ 8." },
];

function fmt(sec: number): string {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RunMeetingModal({ open, onOpenChange }: Props) {
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [elapsed, setElapsed] = useState<number[]>(Array(SECTIONS.length).fill(0));
  const [running, setRunning] = useState(false);
  const [newTodo, setNewTodo] = useState("");
  const [newHeadline, setNewHeadline] = useState("");
  const [newIssue, setNewIssue] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [ratingComment, setRatingComment] = useState("");
  const [finishing, setFinishing] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when modal opens
  useEffect(() => {
    if (open && !meetingId) {
      void startMeeting();
    }
    if (!open) {
      setMeetingId(null);
      setActiveIdx(0);
      setElapsed(Array(SECTIONS.length).fill(0));
      setRunning(false);
      setRating(null);
      setRatingComment("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Timer
  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = [...prev];
          next[activeIdx] = (next[activeIdx] ?? 0) + 1;
          return next;
        });
      }, 1000);
      return () => {
        if (tickRef.current) clearInterval(tickRef.current);
      };
    }
  }, [running, activeIdx]);

  async function startMeeting() {
    const supabase = createClient();
    const today = new Date();
    const { data, error } = await supabase
      .from("meetings")
      .insert({
        org_id: "creait",
        title: `L10 — ${today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
        meeting_type: "level_10",
        scheduled_at: today.toISOString(),
        source: "manual",
      })
      .select()
      .single();
    if (error) {
      toast.error(`Couldn't start meeting: ${error.message}`);
      return;
    }
    if (data) {
      setMeetingId((data as { id: string }).id);
      setRunning(true);
      toast.success("Meeting started. Segue first — share good news.");
    }
  }

  function next() {
    if (activeIdx < SECTIONS.length - 1) {
      setActiveIdx(activeIdx + 1);
      toast.info(`→ ${SECTIONS[activeIdx + 1].label}`);
    } else {
      setRunning(false);
    }
  }

  async function addTodo() {
    if (!newTodo.trim() || !meetingId) return;
    const supabase = createClient();
    const due = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const { error } = await supabase.from("cc_todos").insert({
      org_id: "creait",
      meeting_id: meetingId,
      title: newTodo.trim(),
      due_date: due,
    });
    if (error) toast.error(error.message);
    else {
      setNewTodo("");
      toast.success("To-Do added (due in 7 days)");
    }
  }

  async function addHeadline() {
    if (!newHeadline.trim() || !meetingId) return;
    const supabase = createClient();
    const { error } = await supabase.from("cc_headlines").insert({
      org_id: "creait",
      meeting_id: meetingId,
      category: "general",
      text: newHeadline.trim(),
    });
    if (error) toast.error(error.message);
    else {
      setNewHeadline("");
      toast.success("Headline captured");
    }
  }

  async function addIssue() {
    if (!newIssue.trim() || !meetingId) return;
    const supabase = createClient();
    const { error } = await supabase.from("ids_items").insert({
      org_id: "creait",
      meeting_id: meetingId,
      title: newIssue.trim(),
      status: "open",
      priority: 5,
    });
    if (error) toast.error(error.message);
    else {
      setNewIssue("");
      toast.success("Issue added to IDS");
    }
  }

  async function finishMeeting() {
    if (!meetingId || rating === null) {
      toast.error("Capture meeting rating first");
      return;
    }
    setFinishing(true);
    const supabase = createClient();
    const agendaState = SECTIONS.reduce<Record<string, { durationSec: number; budgetSec: number }>>((acc, s, i) => {
      acc[s.key] = { durationSec: elapsed[i] ?? 0, budgetSec: s.budgetSec };
      return acc;
    }, {});
    const { error: mErr } = await supabase
      .from("meetings")
      .update({ rating, agenda_state: agendaState, updated_at: new Date().toISOString() })
      .eq("id", meetingId);
    const { error: rErr } = await supabase.from("cc_meeting_ratings").insert({
      meeting_id: meetingId,
      rating,
      comment: ratingComment.trim() || null,
      rater_name: "Self",
    });
    setFinishing(false);
    if (mErr || rErr) {
      toast.error((mErr ?? rErr)?.message ?? "Save failed");
      return;
    }
    toast.success(`Meeting saved — rated ${rating}/10`);
    onOpenChange(false);
  }

  const section = SECTIONS[activeIdx];
  const elapsedHere = elapsed[activeIdx] ?? 0;
  const pct = Math.min(100, Math.round((elapsedHere / section.budgetSec) * 100));
  const overBudget = elapsedHere > section.budgetSec;
  const totalElapsed = elapsed.reduce((a, b) => a + b, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Level 10 Meeting</span>
            <span className="text-xs font-normal text-muted-foreground">
              Total: {fmt(totalElapsed)} / 90:00
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Section nav strip */}
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1 py-1">
          {SECTIONS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={cn(
                "shrink-0 px-2 py-1 text-[10px] rounded border transition-colors whitespace-nowrap",
                i === activeIdx
                  ? "bg-[color:var(--color-brand-electric)] text-white border-transparent"
                  : i < activeIdx
                  ? "bg-[color:var(--color-brand-success)]/15 text-[color:var(--color-brand-success)] border-transparent"
                  : "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)] border-border",
              )}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </div>

        {/* Active section */}
        <div className="space-y-3 pt-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{section.label}</h3>
              <span className={cn(
                "text-sm font-mono",
                overBudget ? "text-[color:var(--color-brand-danger)]" : "text-foreground",
              )}>
                {fmt(elapsedHere)} / {fmt(section.budgetSec)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
            <Progress value={pct} className={cn("h-1 mt-2", overBudget && "[&>div]:bg-[color:var(--color-brand-danger)]")} />
          </div>

          {/* Per-section quick capture */}
          {section.key === "headlines" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="One-sentence headline (customer / employee / market)…"
                  value={newHeadline}
                  onChange={(e) => setNewHeadline(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHeadline(); } }}
                />
                <Button onClick={addHeadline} disabled={!newHeadline.trim()}>Add</Button>
              </div>
            </div>
          )}

          {section.key === "ids" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Issue (one sentence)…"
                  value={newIssue}
                  onChange={(e) => setNewIssue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addIssue(); } }}
                />
                <Button onClick={addIssue} disabled={!newIssue.trim()}>Add Issue</Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Identify root cause → discuss until clear → solve permanently. Off-topic? Make it a To-Do.</p>
            </div>
          )}

          {section.key === "conclude" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Rate the meeting (1-10)</label>
                <div className="flex gap-1.5 mt-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={cn(
                        "size-8 rounded text-xs font-medium border transition-colors",
                        rating === n
                          ? n >= 8
                            ? "bg-[color:var(--color-brand-success)] text-white border-transparent"
                            : n >= 5
                            ? "bg-[color:var(--color-brand-warning)] text-white border-transparent"
                            : "bg-[color:var(--color-brand-danger)] text-white border-transparent"
                          : "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)] border-border hover:border-[color:var(--color-brand-electric)]",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {rating !== null && rating < 8 && (
                  <p className="text-[11px] text-[color:var(--color-brand-warning)] mt-1">EOS target is 8+. What would have made it better?</p>
                )}
              </div>
              <Textarea
                placeholder="Notes (optional) — what would have made this an 8+?"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                className="min-h-16"
              />
            </div>
          )}

          {/* Universal: capture To-Do */}
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Quick capture To-Do (7-day default)</p>
            <div className="flex gap-2">
              <Input
                placeholder="To-Do title…"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTodo(); } }}
              />
              <Button variant="outline" onClick={addTodo} disabled={!newTodo.trim()}>+ To-Do</Button>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRunning((r) => !r)}
          >
            {running ? <><Pause className="size-3.5" /> Pause</> : <><Play className="size-3.5" /> Resume</>}
          </Button>
          {activeIdx < SECTIONS.length - 1 ? (
            <Button onClick={next}>
              <SkipForward className="size-3.5" />
              Next: {SECTIONS[activeIdx + 1].label}
            </Button>
          ) : (
            <Button onClick={finishMeeting} disabled={finishing || rating === null}>
              <Star className="size-3.5" />
              {finishing ? "Saving…" : "Finish & Save Meeting"}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="size-3.5" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
