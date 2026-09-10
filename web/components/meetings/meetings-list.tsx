"use client";

import { useState, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { CalendarCheck, Star, Clock, ExternalLink, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { totalDurationSec } from "@/lib/meeting-progress";
import type { Meeting, MeetingRating, Win, IdsItem, Todo } from "@/lib/supabase/types";

interface Props {
  initialMeetings: Meeting[];
  ratings: MeetingRating[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtDurationFromAgenda(agenda: unknown): string | null {
  const total = totalDurationSec(agenda);
  if (total === 0) return null;
  const m = Math.floor(total / 60);
  return `${m} min`;
}

function ratingClass(r: number | null): string {
  if (r === null) return "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)]";
  if (r >= 8) return "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]";
  if (r >= 5) return "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)]";
  return "bg-[color:var(--color-brand-danger)]/20 text-[color:var(--color-brand-danger)]";
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  readai: "Read.ai",
  zoom: "Zoom",
  other: "Other",
};

export function MeetingsList({ initialMeetings, ratings }: Props) {
  const [selected, setSelected] = useState<Meeting | null>(null);

  const ratingsByMeeting = useMemo(() => {
    const map = new Map<string, MeetingRating[]>();
    for (const r of ratings) {
      const list = map.get(r.meeting_id) ?? [];
      list.push(r);
      map.set(r.meeting_id, list);
    }
    return map;
  }, [ratings]);

  if (initialMeetings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-3">
          <CalendarCheck className="size-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium">No meetings logged yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Run your first Level 10 from the Level 10 page. Every concluded meeting lands here with its ratings, timings and what was captured.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="pt-4">
          <ul className="divide-y divide-border">
            {initialMeetings.map((m) => {
              const rs = ratingsByMeeting.get(m.id) ?? [];
              const avgRating = rs.length > 0 ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : m.rating ?? null;
              const duration = fmtDurationFromAgenda(m.agenda_state);
              const live = m.status === "in_progress";
              return (
                <li key={m.id} className="py-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(m)}
                    className="flex-1 min-w-0 text-left flex items-center gap-3 hover:bg-[color:var(--color-brand-slate)]/40 -mx-2 px-2 py-2 rounded-md transition-colors"
                  >
                    <div className="size-9 rounded-full bg-[color:var(--color-brand-slate)] flex items-center justify-center shrink-0">
                      <CalendarCheck className="size-4 text-[color:var(--color-brand-electric)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                        {live && (
                          <span className="rounded-full bg-[color:var(--color-brand-electric)]/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-electric)]">
                            In progress
                          </span>
                        )}
                        <span>{fmtDate(m.started_at ?? m.scheduled_at ?? m.created_at)}</span>
                        <span>{SOURCE_LABEL[m.source ?? "manual"]}</span>
                        {duration && <span className="flex items-center gap-1"><Clock className="size-3" /> {duration}</span>}
                      </div>
                    </div>
                    {avgRating !== null && (
                      <span className={cn("text-xs rounded-full px-2 py-0.5 font-medium flex items-center gap-1", ratingClass(avgRating))}>
                        <Star className="size-3" />
                        {avgRating.toFixed(1)}
                      </span>
                    )}
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                  </button>
                  <Link
                    href={`/level-10/meeting/${m.id}`}
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-[color:var(--color-brand-electric)]"
                  >
                    <FileText className="size-3" />
                    {live ? "Resume" : "Open"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <MeetingDetailModal
        meeting={selected}
        ratings={selected ? ratingsByMeeting.get(selected.id) ?? [] : []}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function MeetingDetailModal({
  meeting,
  ratings,
  onClose,
}: {
  meeting: Meeting | null;
  ratings: MeetingRating[];
  onClose: () => void;
}) {
  const [wins, setWins] = useState<Win[]>([]);
  const [issues, setIssues] = useState<IdsItem[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);

  useMemo(() => {
    if (!meeting) {
      setWins([]); setIssues([]); setTodos([]);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    void Promise.all([
      supabase.from("wins").select("*").eq("meeting_id", meeting.id).order("created_at"),
      supabase.from("ids_items").select("*").eq("meeting_id", meeting.id).order("priority", { ascending: false }),
      supabase.from("cc_todos").select("*").eq("meeting_id", meeting.id).order("created_at"),
    ]).then(([w, i, t]) => {
      setWins((w.data as Win[] | null) ?? []);
      setIssues((i.data as IdsItem[] | null) ?? []);
      setTodos((t.data as Todo[] | null) ?? []);
      setLoading(false);
    });
  }, [meeting]);

  if (!meeting) return null;

  const agendaState = meeting.agenda_state as Record<string, { durationSec: number; budgetSec: number }> | null;

  return (
    <Dialog open={meeting !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{meeting.title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 -mr-4 pr-4">
          <div className="space-y-5 pt-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>{fmtDate(meeting.scheduled_at ?? meeting.created_at)}</span>
              <span>· {SOURCE_LABEL[meeting.source ?? "manual"]}</span>
              {meeting.recording_url && (
                <a href={meeting.recording_url} target="_blank" rel="noreferrer noopener" className="text-[color:var(--color-brand-electric)] hover:underline flex items-center gap-1">
                  <ExternalLink className="size-3" /> Recording
                </a>
              )}
            </div>

            {ratings.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Meeting ratings</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {ratings.map((r) => (
                    <span key={r.id} className={cn("text-xs rounded-full px-2 py-0.5 font-medium flex items-center gap-1", ratingClass(r.rating))}>
                      <Star className="size-3" />
                      {r.rating.toFixed(1)}
                      {r.rater_name && <span className="text-[10px] opacity-70">· {r.rater_name}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {agendaState && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Agenda timing</p>
                <ul className="text-xs space-y-1">
                  {Object.entries(agendaState).map(([key, v]) => {
                    const mins = Math.floor((v.durationSec ?? 0) / 60);
                    const secs = (v.durationSec ?? 0) % 60;
                    const budgetMins = Math.floor((v.budgetSec ?? 0) / 60);
                    const over = (v.durationSec ?? 0) > (v.budgetSec ?? 0);
                    return (
                      <li key={key} className="flex items-center justify-between">
                        <span className="capitalize">{key.replace(/_/g, " ")}</span>
                        <span className={cn("font-mono", over && "text-[color:var(--color-brand-danger)]")}>
                          {mins}:{String(secs).padStart(2, "0")} / {budgetMins}:00
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {meeting.summary && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Summary</p>
                <div className="prose prose-sm prose-invert max-w-none text-xs">
                  <Markdown remarkPlugins={[remarkGfm]}>{meeting.summary}</Markdown>
                </div>
              </div>
            )}

            {loading ? (
              <p className="text-xs text-muted-foreground">Loading extracted items…</p>
            ) : (
              <>
                {wins.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[color:var(--color-brand-success)] mb-2">Wins · {wins.length}</p>
                    <ul className="text-xs space-y-1">
                      {wins.map((w) => <li key={w.id} className="text-[color:var(--color-brand-mist)]">✓ {w.title}</li>)}
                    </ul>
                  </div>
                )}
                {issues.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[color:var(--color-brand-warning)] mb-2">IDS items · {issues.length}</p>
                    <ul className="text-xs space-y-1">
                      {issues.map((i) => <li key={i.id} className="text-[color:var(--color-brand-mist)]">• P{i.priority} {i.title}</li>)}
                    </ul>
                  </div>
                )}
                {todos.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-[color:var(--color-brand-electric)] mb-2">To-Dos · {todos.length}</p>
                    <ul className="text-xs space-y-1">
                      {todos.map((t) => (
                        <li key={t.id} className={cn("flex items-center gap-2", t.done && "line-through opacity-60")}>
                          <span>{t.done ? "✓" : "○"}</span>
                          <span className="text-[color:var(--color-brand-mist)]">{t.title}</span>
                          {t.due_date && <span className="ml-auto text-[10px] text-muted-foreground">Due {new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {meeting.transcript && (
              <details>
                <summary className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground">
                  Transcript ({meeting.transcript.length.toLocaleString()} chars)
                </summary>
                <pre className="text-xs whitespace-pre-wrap mt-2 p-3 bg-[color:var(--color-brand-slate)]/40 rounded text-[color:var(--color-brand-mist)] max-h-64 overflow-y-auto">
                  {meeting.transcript}
                </pre>
              </details>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
