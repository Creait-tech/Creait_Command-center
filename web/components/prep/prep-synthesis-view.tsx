"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Plus, Check, Play, AlertTriangle, Handshake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { acceptProposedIssue, acceptProposedRock, startMeetingFromPrep, synthesizePrep } from "@/lib/prep-actions";
import type { PrepSynthesis } from "@/lib/prep-synthesis";
import type { PrepSessionRow } from "@/lib/prep-types";
import { getAgenda, isMeetingType } from "@/lib/meeting-agendas";
import { personName, type Person } from "@/lib/authorship";

interface Props {
  session: PrepSessionRow;
  synthesis: PrepSynthesis | null;
  people: Person[];
  /** Everyone has submitted — synthesizing earlier reads a half-written room. */
  everyoneIn: boolean;
  quarter: string;
}

function quarterEnd(quarter: string): string {
  const [yearStr, qStr] = quarter.split("-Q");
  const year = parseInt(yearStr, 10);
  const q = parseInt(qStr, 10);
  const monthEnd = q * 3;
  const lastDay = new Date(year, monthEnd, 0).getDate();
  return `${year}-${String(monthEnd).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/**
 * The synthesis: what the team agrees on, what they don't, and the rocks and
 * issues their answers imply.
 *
 * Everything here is a draft. Accepting a rock or an issue writes a real row
 * through the same action a human uses; until someone clicks, nothing exists.
 */
export function PrepSynthesisView({ session, synthesis, people, everyoneIn, quarter }: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const agenda = isMeetingType(session.meeting_type) ? getAgenda(session.meeting_type) : null;
  const sectionLabel = (key: string) => agenda?.sections.find((s) => s.key === key)?.label ?? key.replace(/_/g, " ");

  async function run() {
    setRunning(true);
    const result = await synthesizePrep(session.id);
    setRunning(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Synthesis written by ${result.data.model}`);
    router.refresh();
  }

  async function acceptRock(key: string, r: PrepSynthesis["proposed_rocks"][number]) {
    const owner = r.suggested_owner
      ? people.find((p) => personName(p).toLowerCase() === r.suggested_owner!.trim().toLowerCase())
      : undefined;
    const result = await acceptProposedRock({
      sessionId: session.id,
      title: r.title,
      doneLooksLike: r.done_looks_like,
      ownerId: owner?.id ?? null,
      rockType: r.rock_type,
      quarter,
      dueDate: quarterEnd(quarter),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setAccepted((p) => new Set(p).add(key));
    toast.success(`Rock added for ${quarter}`);
  }

  async function acceptIssue(key: string, i: PrepSynthesis["proposed_issues"][number]) {
    const result = await acceptProposedIssue({ sessionId: session.id, title: i.title, why: i.why });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setAccepted((p) => new Set(p).add(key));
    toast.success("Issue added to the IDS list");
  }

  async function openMeeting() {
    setStarting(true);
    const result = await startMeetingFromPrep({
      sessionId: session.id,
      attendeeIds: session.participant_ids,
      presenterId: session.participant_ids[0] ?? null,
    });
    setStarting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.push(`/level-10/meeting/${result.data.id}`);
  }

  if (!synthesis) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-3">
          <Sparkles className="size-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium">No synthesis yet</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            When everyone has answered, the Command Center reads every answer and writes back what the team agrees on,
            where it doesn&apos;t, and the rocks and issues those answers imply.
          </p>
          {!everyoneIn && (
            <p className="text-xs text-[color:var(--color-brand-warning)]">
              Not everyone has submitted yet. You can run it anyway, but it will only read what has been written.
            </p>
          )}
          <Button onClick={() => void run()} disabled={running}>
            <Sparkles className="size-4" />
            {running ? "Reading everyone's answers…" : "Synthesize"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm max-w-2xl">{synthesis.overview}</p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => void run()} disabled={running}>
            <Sparkles className="size-3.5" />
            {running ? "Re-reading…" : "Re-run"}
          </Button>
          {!session.meeting_id && (
            <Button size="sm" onClick={() => void openMeeting()} disabled={starting}>
              <Play className="size-3.5" />
              {starting ? "Opening…" : "Start the meeting"}
            </Button>
          )}
        </div>
      </div>

      {synthesis.decisions_needed.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Decisions this meeting must make</p>
            <ul className="space-y-1 text-sm list-disc pl-5">
              {synthesis.decisions_needed.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {synthesis.sections.map((s) => (
        <Card key={s.section_key}>
          <CardContent className="pt-5 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{sectionLabel(s.section_key)}</p>
              {s.headline && <p className="text-sm mt-1">{s.headline}</p>}
            </div>

            {s.agreements.length > 0 && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--color-brand-success)] mb-1.5 flex items-center gap-1">
                  <Handshake className="size-3" /> Already agreed — don&apos;t spend time here
                </p>
                <ul className="space-y-1 text-sm">
                  {s.agreements.map((a, i) => (
                    <li key={i}>
                      {a.point}
                      {a.who.length > 0 && <span className="text-[11px] text-muted-foreground"> — {a.who.join(", ")}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {s.tensions.length > 0 && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--color-brand-warning)] mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="size-3" /> Spend the time here
                </p>
                <ul className="space-y-2">
                  {s.tensions.map((t, i) => (
                    <li key={i} className="text-sm">
                      <p className="font-medium">{t.question}</p>
                      <ul className="mt-1 space-y-0.5">
                        {t.positions.map((p, j) => (
                          <li key={j} className="text-xs border-l-2 border-border pl-2">
                            <span className="font-medium">{p.who.join(", ") || "Someone"}: </span>
                            <span className="text-muted-foreground">{p.view}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {synthesis.proposed_rocks.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              Rocks the answers imply — accept the ones the room agrees on
            </p>
            <ul className="space-y-2">
              {synthesis.proposed_rocks.map((r, i) => {
                const key = `rock-${i}`;
                const done = accepted.has(key);
                return (
                  <li key={key} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{r.title}</p>
                      {r.done_looks_like && (
                        <p className="text-xs text-muted-foreground mt-0.5">Done looks like: {r.done_looks_like}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-medium uppercase tracking-wider",
                            r.rock_type === "company"
                              ? "bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)]"
                              : "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)]",
                          )}
                        >
                          {r.rock_type}
                        </span>
                        {r.suggested_owner && <span>owner: {r.suggested_owner}</span>}
                        {r.proposed_by.length > 0 && <span>proposed by {r.proposed_by.join(", ")}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={done ? "ghost" : "outline"}
                      className="shrink-0"
                      disabled={done}
                      onClick={() => void acceptRock(key, r)}
                    >
                      {done ? (
                        <>
                          <Check className="size-3.5" /> Added
                        </>
                      ) : (
                        <>
                          <Plus className="size-3.5" /> Accept
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {synthesis.proposed_issues.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Issues to put on the IDS list</p>
            <ul className="space-y-2">
              {synthesis.proposed_issues.map((issue, i) => {
                const key = `issue-${i}`;
                const done = accepted.has(key);
                return (
                  <li key={key} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm">{issue.title}</p>
                      {issue.why && <p className="text-xs text-muted-foreground mt-0.5">{issue.why}</p>}
                    </div>
                    <Button
                      size="sm"
                      variant={done ? "ghost" : "outline"}
                      className="shrink-0"
                      disabled={done}
                      onClick={() => void acceptIssue(key, issue)}
                    >
                      {done ? (
                        <>
                          <Check className="size-3.5" /> Added
                        </>
                      ) : (
                        <>
                          <Plus className="size-3.5" /> Accept
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground">
        Written by {synthesis.model} on{" "}
        {new Date(synthesis.generated_at).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
        . A draft — nothing here is real until someone accepts it.
      </p>
    </div>
  );
}
