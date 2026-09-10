import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Lock, Unlock } from "lucide-react";
import { loadPrepSession } from "@/lib/prep-actions";
import { prepSynthesisOf, REVEAL_LABELS } from "@/lib/prep-types";
import { PrepAnswerForm } from "@/components/prep/prep-answer-form";
import { PrepSynthesisView } from "@/components/prep/prep-synthesis-view";
import { MEETING_AGENDAS, isMeetingType } from "@/lib/meeting-agendas";
import { currentQuarter } from "@/lib/meeting-workspace";
import { personName } from "@/lib/authorship";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PrepSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await loadPrepSession(id);
  if (!view) notFound();

  const { session, questions, participants, people, answers, viewerMemberId, revealed } = view;
  const byId = new Map(people.map((p) => [p.id, p]));
  const label = isMeetingType(session.meeting_type) ? MEETING_AGENDAS[session.meeting_type].label : session.meeting_type;
  const submitted = participants.some((p) => p.member_id === viewerMemberId && p.submitted_at !== null);
  const everyoneIn = participants.length > 0 && participants.every((p) => p.submitted_at !== null);
  const synthesis = prepSynthesisOf(session);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Link href="/prep" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="size-3" /> Meeting Prep
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{session.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              <span>{label}</span>
              <span className="flex items-center gap-1">
                {revealed ? <Unlock className="size-3" /> : <Lock className="size-3" />}
                {REVEAL_LABELS[session.reveal]}
              </span>
              {session.due_at && (
                <span>due {new Date(session.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              )}
              {session.meeting_id && (
                <Link href={`/level-10/meeting/${session.meeting_id}`} className="text-[color:var(--color-brand-electric)] hover:underline">
                  Open the meeting
                </Link>
              )}
            </div>
          </div>
          <ul className="flex items-center gap-3 flex-wrap">
            {participants.map((p) => {
              const who = byId.get(p.member_id);
              const done = p.submitted_at !== null;
              return (
                <li
                  key={p.member_id}
                  className={cn("flex items-center gap-1.5 text-xs", done ? "text-[color:var(--color-brand-success)]" : "text-muted-foreground")}
                >
                  {done ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                  {who ? personName(who) : "Someone"}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-brand-mist)]">
            The questions
          </h2>
          <PrepAnswerForm
            session={session}
            questions={questions}
            answers={answers}
            people={people}
            viewerMemberId={viewerMemberId}
            revealed={revealed}
            submitted={submitted}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-brand-mist)]">
            What the room has to decide
          </h2>
          <PrepSynthesisView
            session={session}
            synthesis={synthesis}
            people={people}
            everyoneIn={everyoneIn}
            quarter={currentQuarter()}
          />
        </section>
      </div>
    </div>
  );
}
