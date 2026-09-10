import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CalendarCheck, Clock, Star, ExternalLink, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtClock, parseProgress } from "@/lib/meeting-progress";
import { getAgenda, isMeetingType } from "@/lib/meeting-agendas";
import { personName, type Person } from "@/lib/authorship";
import type { Headline, IdsItem, Meeting, MeetingRating, Todo, Win } from "@/lib/supabase/types";

interface Props {
  meeting: Meeting;
  people: Person[];
  ratings: MeetingRating[];
  headlines: Headline[];
  issues: IdsItem[];
  todos: Todo[];
  wins: Win[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function ratingClass(r: number): string {
  if (r >= 8) return "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]";
  if (r >= 5) return "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)]";
  return "bg-[color:var(--color-brand-danger)]/20 text-[color:var(--color-brand-danger)]";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      {children}
    </div>
  );
}

/**
 * The permanent record of a concluded meeting: who was there, how long each
 * section took, how it was rated, and everything captured in the room.
 */
export function MeetingRecord({ meeting, people, ratings, headlines, issues, todos, wins }: Props) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const name = (id: string | null | undefined) => (id ? (byId.get(id) ? personName(byId.get(id)!) : "Unknown") : null);
  const attendees = (meeting.attendee_ids ?? []).map((id) => name(id)).filter(Boolean) as string[];
  const presenter = name(meeting.presenter_id);
  const progress = parseProgress(meeting.agenda_state);
  const agenda = isMeetingType(meeting.meeting_type) ? getAgenda(meeting.meeting_type) : null;
  const sectionLabel = (key: string) => agenda?.sections.find((s) => s.key === key)?.label ?? key.replace(/_/g, " ");
  const avg =
    ratings.length > 0 ? ratings.reduce((a, r) => a + r.rating, 0) / ratings.length : (meeting.rating ?? null);
  const totalSec = progress ? Object.values(progress.sections).reduce((a, s) => a + s.durationSec, 0) : 0;
  const comment = ratings.find((r) => r.comment)?.comment ?? null;

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link href="/meetings" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="size-3" /> Meeting History
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{meeting.title}</h1>
            <span className="rounded-full bg-[color:var(--color-brand-success)]/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-success)]">
              Concluded
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <CalendarCheck className="size-3" /> {fmtDate(meeting.started_at ?? meeting.scheduled_at ?? meeting.created_at)}
            </span>
            {totalSec > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" /> {fmtClock(totalSec)}
              </span>
            )}
            {meeting.recording_url && (
              <a
                href={meeting.recording_url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[color:var(--color-brand-electric)] hover:underline flex items-center gap-1"
              >
                <ExternalLink className="size-3" /> Recording
              </a>
            )}
          </div>
          {(presenter || attendees.length > 0) && (
            <p className="text-xs text-muted-foreground mt-1">
              {presenter && (
                <>
                  Presenter <span className="text-foreground">{presenter}</span> ·{" "}
                </>
              )}
              In the room: <span className="text-foreground">{attendees.join(", ") || "—"}</span>
            </p>
          )}
        </div>
        {avg !== null && (
          <span className={cn("text-sm rounded-full px-3 py-1 font-medium flex items-center gap-1", ratingClass(avg))}>
            <Star className="size-3.5" />
            {avg.toFixed(1)} / 10
          </span>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardContent className="pt-5 space-y-5">
            {ratings.length > 0 && (
              <Section title="Ratings">
                <ul className="space-y-1 text-sm">
                  {ratings.map((r) => (
                    <li key={r.id} className="flex items-center justify-between">
                      <span>{r.rater_name ?? name(r.member_id) ?? "Someone"}</span>
                      <span className={cn("text-xs rounded-full px-2 py-0.5 font-medium", ratingClass(r.rating))}>
                        {r.rating.toFixed(0)}
                      </span>
                    </li>
                  ))}
                </ul>
                {comment && <p className="text-xs text-muted-foreground mt-2 italic">&ldquo;{comment}&rdquo;</p>}
              </Section>
            )}

            {progress && (
              <Section title="Agenda timing">
                <ul className="text-xs space-y-1">
                  {Object.entries(progress.sections).map(([key, v]) => {
                    const over = v.durationSec > v.budgetSec;
                    return (
                      <li key={key} className="flex items-center justify-between">
                        <span>{sectionLabel(key)}</span>
                        <span className={cn("font-mono", over && "text-[color:var(--color-brand-danger)]")}>
                          {fmtClock(v.durationSec)} / {fmtClock(v.budgetSec)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 space-y-5">
            <Section title={`To-Dos (${todos.length})`}>
              {todos.length === 0 ? (
                <p className="text-xs text-muted-foreground">None captured.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {todos.map((t) => (
                    <li key={t.id} className={cn("flex items-center justify-between gap-2", t.done && "opacity-60")}>
                      <span className={cn(t.done && "line-through")}>{t.title}</span>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {name(t.owner_id) ?? "Unowned"}
                        {t.due_date ? ` · ${t.due_date}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={`Issues (${issues.length})`}>
              {issues.length === 0 ? (
                <p className="text-xs text-muted-foreground">None raised.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {issues.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2">
                      <span>{i.title}</span>
                      <span className="text-[11px] text-muted-foreground capitalize whitespace-nowrap">{i.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={`Headlines (${headlines.length})`}>
              {headlines.length === 0 ? (
                <p className="text-xs text-muted-foreground">None captured.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {headlines.map((h) => (
                    <li key={h.id}>
                      {h.text}
                      {h.cascade && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">cascade</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {wins.length > 0 && (
              <Section title={`Wins (${wins.length})`}>
                <ul className="text-sm space-y-1">
                  {wins.map((w) => (
                    <li key={w.id}>{w.title}</li>
                  ))}
                </ul>
              </Section>
            )}
          </CardContent>
        </Card>
      </div>

      {meeting.summary && (
        <Card>
          <CardContent className="pt-5">
            <Section title="Summary">
              <div className="prose prose-sm prose-invert max-w-none">
                <Markdown remarkPlugins={[remarkGfm]}>{meeting.summary}</Markdown>
              </div>
            </Section>
          </CardContent>
        </Card>
      )}

      {meeting.transcript && (
        <Card>
          <CardContent className="pt-5">
            <details>
              <summary className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer">Transcript</summary>
              <pre className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground max-h-[60vh] overflow-y-auto">{meeting.transcript}</pre>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
