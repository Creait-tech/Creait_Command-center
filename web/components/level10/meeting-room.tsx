"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Pause, SkipForward, LogOut, Trash2, Star, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createHeadline, createIdsItem, createTodo, updateTodo } from "@/lib/eos-actions";
import { concludeMeeting, discardMeeting, saveMeetingProgress } from "@/lib/meeting-actions";
import { fmtClock, parseProgress, unsavedRunningSec, type MeetingProgress } from "@/lib/meeting-progress";
import { getAgenda, agendaBudgetSec, type MeetingType } from "@/lib/meeting-agendas";
import { personName, type AuthoredTodo, type Person } from "@/lib/authorship";
import type { MeetingWorkspaceData } from "@/lib/meeting-workspace";
import type { Meeting } from "@/lib/supabase/types";
import { Scorecard } from "./scorecard";
import { RocksView } from "@/components/rocks/rocks-view";
import { IdsSection } from "./ids-section";

interface Props {
  meeting: Meeting;
  workspace: MeetingWorkspaceData;
  currentMemberId: string | null;
}

/** How often the running clock is written back while nothing else changes. */
const AUTOSAVE_MS = 30_000;

/**
 * The meeting room. One page per meeting, at /level-10/meeting/<id>.
 *
 * The clock lives in the database: every section change, pause and resume
 * writes `agenda_state`, and a running clock is written every thirty
 * seconds. A refresh, a second screen, or a dropped laptop reopens the room
 * exactly where it was. Concluding freezes the timings and records a rating
 * for each person in the room.
 */
export function MeetingRoom({ meeting, workspace, currentMemberId }: Props) {
  const router = useRouter();
  const meetingType = meeting.meeting_type as MeetingType;
  const agenda = getAgenda(meetingType);
  const SECTIONS = agenda.sections;
  const totalBudgetSec = agendaBudgetSec(agenda);

  // Resume from the saved state: fold any seconds the clock ran since the
  // last save into the active section, then keep running if it was running.
  const [initial] = useState(() => {
    const saved = parseProgress(meeting.agenda_state);
    const elapsed = SECTIONS.map((s) => saved?.sections[s.key]?.durationSec ?? 0);
    const activeIdx = Math.min(saved?.activeIdx ?? 0, SECTIONS.length - 1);
    if (saved) elapsed[activeIdx] = (elapsed[activeIdx] ?? 0) + unsavedRunningSec(saved);
    return { elapsed, activeIdx, running: saved ? saved.running : true };
  });
  const [activeIdx, setActiveIdx] = useState(initial.activeIdx);
  const [elapsed, setElapsed] = useState<number[]>(initial.elapsed);
  const [running, setRunning] = useState(initial.running);

  const [newTodo, setNewTodo] = useState("");
  const [newHeadline, setNewHeadline] = useState("");
  const [newIssue, setNewIssue] = useState("");
  const [todos, setTodos] = useState<AuthoredTodo[]>(workspace.todos);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [ratingComment, setRatingComment] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const attendees: Person[] = (() => {
    const ids = new Set(meeting.attendee_ids ?? []);
    const inRoom = workspace.people.filter((p) => ids.has(p.id));
    return inRoom.length > 0 ? inRoom : workspace.people;
  })();
  const presenter = workspace.people.find((p) => p.id === meeting.presenter_id) ?? null;

  // The latest state, readable from the autosave timer without a stale closure.
  const latest = useRef({ activeIdx, elapsed, running });
  useEffect(() => {
    latest.current = { activeIdx, elapsed, running };
  });

  type Override = Partial<{ activeIdx: number; elapsed: number[]; running: boolean }>;

  function buildProgress(override?: Override): MeetingProgress {
    const s = { ...latest.current, ...override };
    return {
      v: 2,
      activeIdx: s.activeIdx,
      running: s.running,
      runningSince: s.running ? new Date().toISOString() : null,
      sections: Object.fromEntries(
        SECTIONS.map((sec, i) => [sec.key, { durationSec: s.elapsed[i] ?? 0, budgetSec: sec.budgetSec }]),
      ),
    };
  }

  async function persist(override?: Override) {
    const result = await saveMeetingProgress(meeting.id, buildProgress(override));
    if (!result.ok) toast.error(result.error);
  }

  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  });

  // Tick the active section once a second while running.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setElapsed((prev) => {
        const next = [...prev];
        next[activeIdx] = (next[activeIdx] ?? 0) + 1;
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, activeIdx]);

  // Autosave the running clock so a crash loses at most thirty seconds.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => void persistRef.current(), AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [running]);

  function goTo(idx: number) {
    if (idx < 0 || idx >= SECTIONS.length || idx === activeIdx) return;
    setActiveIdx(idx);
    void persist({ activeIdx: idx });
    if (idx > activeIdx) toast.info(`→ ${SECTIONS[idx].label}`);
  }

  function toggleRunning() {
    const next = !running;
    setRunning(next);
    void persist({ running: next });
  }

  async function addTodo() {
    if (!newTodo.trim()) return;
    const due = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const result = await createTodo({ title: newTodo, dueDate: due, meetingId: meeting.id });
    if (!result.ok) toast.error(result.error);
    else {
      setNewTodo("");
      setTodos((prev) => [...prev, result.data]);
      toast.success("To-Do added (due in 7 days)");
    }
  }

  async function toggleTodo(todo: AuthoredTodo) {
    const done = !todo.done;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done } : t)));
    const result = await updateTodo(todo.id, { done });
    if (!result.ok) {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: !done } : t)));
      toast.error(result.error);
    }
  }

  async function addHeadline() {
    if (!newHeadline.trim()) return;
    const result = await createHeadline({ text: newHeadline, category: "general", meetingId: meeting.id });
    if (!result.ok) toast.error(result.error);
    else {
      setNewHeadline("");
      toast.success("Headline captured");
    }
  }

  async function addIssue() {
    if (!newIssue.trim()) return;
    const result = await createIdsItem({ title: newIssue, priority: 5, meetingId: meeting.id });
    if (!result.ok) toast.error(result.error);
    else {
      setNewIssue("");
      toast.success("Issue added to IDS");
    }
  }

  async function conclude() {
    const entries = Object.entries(ratings).map(([memberId, rating]) => ({ memberId, rating }));
    if (entries.length === 0) {
      toast.error("Rate the meeting first — at least one person in the room.");
      return;
    }
    setFinishing(true);
    setRunning(false);
    const result = await concludeMeeting({
      id: meeting.id,
      progress: buildProgress({ running: false }),
      ratings: entries,
      comment: ratingComment,
    });
    setFinishing(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const avg = entries.reduce((a, r) => a + r.rating, 0) / entries.length;
    toast.success(`Meeting concluded — rated ${avg.toFixed(1)}/10`);
    router.refresh();
  }

  async function leave() {
    setLeaving(true);
    await persist();
    router.push("/level-10");
  }

  async function discard() {
    if (!window.confirm("Discard this meeting? The record is deleted. To-dos, issues and headlines already captured are kept.")) return;
    setLeaving(true);
    const result = await discardMeeting(meeting.id);
    if (!result.ok) {
      setLeaving(false);
      toast.error(result.error);
      return;
    }
    toast.success("Meeting discarded");
    router.push("/level-10");
  }

  const section = SECTIONS[activeIdx] ?? SECTIONS[0];
  const elapsedHere = elapsed[activeIdx] ?? 0;
  const pct = Math.min(100, Math.round((elapsedHere / section.budgetSec) * 100));
  const overBudget = elapsedHere > section.budgetSec;
  const totalElapsed = elapsed.reduce((a, b) => a + b, 0);
  const isLast = activeIdx >= SECTIONS.length - 1;
  const openTodos = todos.filter((t) => !t.done);
  const ratedCount = Object.keys(ratings).length;

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{meeting.title}</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-brand-electric)]/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-electric)]">
              <span className={cn("size-1.5 rounded-full bg-current", running && "animate-pulse")} />
              {running ? "Live" : "Paused"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {agenda.cadence} · {agenda.purpose}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {presenter ? <>Presenter <span className="text-foreground">{personName(presenter)}</span> · </> : null}
            In the room: <span className="text-foreground">{attendees.map(personName).join(", ") || "—"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono tabular-nums text-muted-foreground">
            {fmtClock(totalElapsed)} / {fmtClock(totalBudgetSec)}
          </span>
          <Button variant="outline" size="sm" onClick={toggleRunning}>
            {running ? (
              <>
                <Pause className="size-3.5" /> Pause
              </>
            ) : (
              <>
                <Play className="size-3.5" /> Resume
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void leave()} disabled={leaving}>
            <LogOut className="size-3.5" /> Leave
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void discard()} disabled={leaving}>
            <Trash2 className="size-3.5" /> Discard
          </Button>
        </div>
      </div>

      {/* Section nav strip */}
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 py-1">
        {SECTIONS.map((s, i) => {
          const over = (elapsed[i] ?? 0) > s.budgetSec;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                "shrink-0 px-2.5 py-1.5 text-[11px] rounded border transition-colors whitespace-nowrap flex items-center gap-1.5",
                i === activeIdx
                  ? "bg-[color:var(--color-brand-electric)] text-white border-transparent"
                  : i < activeIdx
                    ? "bg-[color:var(--color-brand-success)]/15 text-[color:var(--color-brand-success)] border-transparent"
                    : "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)] border-border",
              )}
            >
              {i < activeIdx && <CheckCircle2 className="size-3" />}
              {i + 1}. {s.label}
              <span className={cn("font-mono opacity-70", over && i !== activeIdx && "text-[color:var(--color-brand-danger)] opacity-100")}>
                {fmtClock(elapsed[i] ?? 0)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active section */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">{section.label}</h2>
            <span className={cn("text-lg font-mono tabular-nums", overBudget ? "text-[color:var(--color-brand-danger)]" : "text-foreground")}>
              {fmtClock(elapsedHere)} / {fmtClock(section.budgetSec)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
          <Progress value={pct} className={cn("h-1.5 mt-2", overBudget && "[&>div]:bg-[color:var(--color-brand-danger)]")} />
        </div>

        {section.key === "headlines" && (
          <div className="flex gap-2">
            <Input
              placeholder="One-sentence headline (customer / employee / market)…"
              value={newHeadline}
              onChange={(e) => setNewHeadline(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addHeadline();
                }
              }}
            />
            <Button onClick={() => void addHeadline()} disabled={!newHeadline.trim()}>
              Add
            </Button>
          </div>
        )}

        {section.key === "ids" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Issue (one sentence)…"
                value={newIssue}
                onChange={(e) => setNewIssue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addIssue();
                  }
                }}
              />
              <Button onClick={() => void addIssue()} disabled={!newIssue.trim()}>
                Add Issue
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Identify root cause → discuss until clear → solve permanently. Off-topic? Make it a To-Do.
            </p>
            <div className="rounded-lg border border-border p-3">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Active IDS board</p>
              <IdsSection initialItems={workspace.idsItems} meetingId={meeting.id} />
            </div>
          </div>
        )}

        {section.key === "scorecard" && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Live scorecard — enter or correct the number here; off-track items go to IDS
            </p>
            <Scorecard
              initialKpis={workspace.kpis}
              initialWeekly={workspace.kpiWeekly}
              initialHistory={workspace.kpiHistory}
              people={workspace.people}
              weekStarts={workspace.weekStarts}
            />
          </div>
        )}

        {section.key === "rocks" && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Live rock review — update the actual Rock here; blockers go to IDS
            </p>
            <RocksView
              initialRocks={workspace.rocks}
              milestones={workspace.rockMilestones}
              statusUpdates={workspace.rockStatusUpdates}
              members={workspace.people}
              currentQuarter={workspace.currentQuarter}
            />
          </div>
        )}

        {section.key === "todos" && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Open to-dos — done or not done. Not done twice becomes an Issue.
            </p>
            {openTodos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing open. Clean slate.</p>
            ) : (
              <ul className="divide-y divide-border">
                {openTodos.map((t) => {
                  const owner = workspace.people.find((p) => p.id === t.owner_id);
                  const overdue = t.due_date ? t.due_date < new Date().toISOString().slice(0, 10) : false;
                  return (
                    <li key={t.id} className="py-2 flex items-start gap-3">
                      <Checkbox className="mt-0.5" checked={t.done} onCheckedChange={() => void toggleTodo(t)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{t.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {owner ? personName(owner) : "Unowned"}
                          {t.due_date && (
                            <>
                              {" · "}
                              <span className={cn(overdue && "text-[color:var(--color-brand-danger)]")}>due {t.due_date}</span>
                            </>
                          )}
                          {t.carried_forward_count > 0 && ` · carried ${t.carried_forward_count}×`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {section.key === "conclude" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Round the room — everyone rates the meeting 1–10. Target is 8+.
              </p>
              {attendees.map((p) => {
                const mine = ratings[p.id];
                return (
                  <div key={p.id} className="flex items-center gap-3 flex-wrap">
                    <span className={cn("w-32 text-sm truncate", p.id === currentMemberId && "font-medium")}>{personName(p)}</span>
                    <div className="flex gap-1">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRatings((prev) => ({ ...prev, [p.id]: n }))}
                          className={cn(
                            "size-8 rounded text-xs font-medium border transition-colors",
                            mine === n
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
                  </div>
                );
              })}
              {ratedCount > 0 && ratedCount < attendees.length && (
                <p className="text-[11px] text-muted-foreground">
                  {attendees.length - ratedCount} still to rate. Anyone unrated is recorded as absent.
                </p>
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addTodo();
                }
              }}
            />
            <Button variant="outline" onClick={() => void addTodo()} disabled={!newTodo.trim()}>
              + To-Do
            </Button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-background py-3">
        <Button variant="outline" size="sm" onClick={() => goTo(activeIdx - 1)} disabled={activeIdx === 0}>
          Back
        </Button>
        {!isLast ? (
          <Button onClick={() => goTo(activeIdx + 1)}>
            <SkipForward className="size-3.5" />
            Next: {SECTIONS[activeIdx + 1].label}
          </Button>
        ) : (
          <Button onClick={() => void conclude()} disabled={finishing || ratedCount === 0}>
            <Star className="size-3.5" />
            {finishing ? "Concluding…" : "Conclude meeting"}
          </Button>
        )}
        <Button variant="ghost" size="sm" render={<Link href="/level-10" />}>
          Level 10 page
        </Button>
      </div>
    </div>
  );
}
