/**
 * The owner's results page — the present deck laid out as one scrolling
 * document, plus the plan, the check-ins and the released PDF.
 *
 * Server component: nothing here is interactive beyond links, so there is
 * no client bundle to ship to the owner. The exhibits are the same SVGs the
 * facilitator showed on screen, so what they remember from the room is what
 * they open at home.
 */

import { Download } from "lucide-react";

import {
  PillarBarsDark,
  PlanTimeline,
  RangeBars,
  ScoreLadder,
} from "@/components/assessments/present/present-deck";
import { money, moneyExact } from "@/components/assessments/present/format";
import type { ClientResults as ClientResultsData } from "@/lib/client-results-server";
import type { AssessmentOutcomeReview } from "@/lib/supabase/types";

const STATUS_LABEL: Record<
  AssessmentOutcomeReview["items"][number]["status"],
  string
> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  dropped: "Set aside",
};

function Section({
  kicker,
  title,
  children,
  note,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section className="mx-auto w-full max-w-[1080px] px-6 py-14 md:px-10">
      <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-brand-electric-glow)]">
        {kicker}
      </p>
      <h2 className="mt-2 text-[clamp(26px,3.4vw,40px)] font-bold leading-[1.08] tracking-tight text-white [text-wrap:balance]">
        {title}
      </h2>
      <div className="mt-8">{children}</div>
      {note && (
        <p className="mt-6 max-w-[78ch] text-[14.5px] leading-relaxed text-[color:var(--color-brand-mist)]">
          {note}
        </p>
      )}
    </section>
  );
}

function Review({ label, review }: { label: string; review: AssessmentOutcomeReview }) {
  return (
    <div className="rounded-2xl bg-[color:var(--color-brand-slate)]/60 p-6 ring-1 ring-inset ring-white/10">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-brand-aqua)]">
        {label}
        {review.reviewed_on ? ` · ${review.reviewed_on}` : ""}
      </p>
      {review.summary && (
        <p className="mt-3 text-[16px] leading-relaxed text-white">{review.summary}</p>
      )}
      {review.items.length > 0 && (
        <ul className="mt-4 divide-y divide-white/10">
          {review.items.map((item, i) => (
            <li key={`${i}-${item.plan_item}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5 text-[14.5px]">
              <span className="min-w-0 flex-1 text-white">{item.plan_item}</span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-brand-mist)]">
                {STATUS_LABEL[item.status]}
              </span>
              {(item.baseline || item.actual) && (
                <span className="w-full text-[13px] text-[color:var(--color-brand-mist)]">
                  {item.kpi ? `${item.kpi}: ` : ""}
                  {item.baseline ?? "—"} → {item.actual ?? "—"}
                  {item.note ? ` · ${item.note}` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ClientResults({ data: d }: { data: ClientResultsData }) {
  const hasReviews = Boolean(d.outcomes.day30 || d.outcomes.day90);

  return (
    <main
      className="min-h-dvh bg-[color:var(--color-brand-ink)] text-white"
      style={{ colorScheme: "dark" }}
    >
      {d.isPractice && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
        >
          <span className="rotate-[-24deg] select-none text-[12rem] font-black tracking-widest text-[color:var(--color-brand-violet)]/10">
            PRACTICE
          </span>
        </div>
      )}

      <header className="relative z-10 mx-auto w-full max-w-[1080px] px-6 pt-16 pb-6 md:px-10">
        <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-brand-electric-glow)]">
          CREAiT Growth &amp; AI Diagnostic
        </p>
        <h1 className="mt-4 text-[clamp(38px,6vw,72px)] font-bold leading-[0.98] tracking-tight [text-wrap:balance]">
          {d.company}
        </h1>
        <p className="mt-5 text-[clamp(16px,1.8vw,22px)] text-[color:var(--color-brand-mist)]">
          Results for {d.client} · delivered {d.date}
          {d.reviewer ? ` · reviewed by ${d.reviewer}` : ""}
        </p>
        {d.blueprintUrl && (
          <a
            href={d.blueprintUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[color:var(--color-brand-electric)] px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[color:var(--color-brand-electric-glow)]"
          >
            <Download className="size-4" /> Download your Executive Blueprint (PDF)
          </a>
        )}
        {d.isDraft && (
          <p className="mt-6 inline-block rounded-full bg-[color:var(--color-brand-warning)]/15 px-3 py-1 text-[13px] font-semibold text-[color:var(--color-brand-warning)]">
            Draft — {d.resolved} of 30 indicators resolved
          </p>
        )}
      </header>

      <div className="relative z-10 divide-y divide-white/10">
        <Section
          kicker="Where you are"
          title={d.score === null ? "The score is not stated yet" : `${d.band} — ${d.score} of 100`}
          note={`Scored from ${d.resolved} of 30 indicators. The bands run Reactive, Stabilizing, Building, Scaling, Self-Running. The score is where the evidence puts the business today, not a grade.`}
        >
          <div className="flex flex-wrap items-end gap-10">
            <div>
              <span
                className="block text-[clamp(80px,11vw,140px)] font-extrabold leading-none tracking-tight"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {d.score ?? "—"}
              </span>
              <span className="mt-1 block text-[14px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-brand-mist)]">
                CREAiT Score
              </span>
            </div>
            <div className="min-w-0 flex-1 basis-[480px]">
              <ScoreLadder score={d.score} />
            </div>
          </div>
        </Section>

        <Section
          kicker="Three pillars"
          title="Profit, Systems and Leverage — each one on its own"
          note="A pillar with fewer than four of its ten indicators examined is shown as insufficient data and carries no weight in the score."
        >
          <PillarBarsDark pillars={d.pillars} />
        </Section>

        <Section kicker="The mirror" title="What you told us, and what the evidence says">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-[color:var(--color-brand-slate)]/70 p-7 ring-1 ring-inset ring-white/10">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-brand-mist)]">
                You said the bottleneck was
              </p>
              <p className="mt-4 text-[clamp(19px,2vw,26px)] font-medium leading-snug">
                {d.ownerBelief ? `“${d.ownerBelief}”` : "— not captured —"}
              </p>
            </div>
            <div className="rounded-2xl bg-[color:var(--color-brand-electric)]/12 p-7 ring-1 ring-inset ring-[color:var(--color-brand-electric)]/40">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-brand-electric-glow)]">
                The evidence points at
              </p>
              <p className="mt-4 text-[clamp(19px,2vw,26px)] font-medium leading-snug">
                {d.constraint ?? "— not named —"}
              </p>
              {d.constraintCost && (
                <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--color-brand-mist)]">
                  What it costs a year: {d.constraintCost}
                </p>
              )}
              {d.constraintSymptoms && (
                <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--color-brand-mist)]">
                  What it explains: {d.constraintSymptoms}
                </p>
              )}
            </div>
          </div>
          {d.constraintFix && (
            <p className="mt-6 max-w-[78ch] text-[16px] leading-relaxed">
              <span className="font-semibold text-[color:var(--color-brand-aqua)]">First intervention: </span>
              {d.constraintFix}
            </p>
          )}
          {d.momentum && (
            <p className="mt-2 max-w-[78ch] text-[16px] leading-relaxed">
              <span className="font-semibold text-[color:var(--color-brand-aqua)]">Inside 30 days: </span>
              {d.momentum}
            </p>
          )}
        </Section>

        <Section
          kicker="What the findings are worth"
          title={d.portfolioExpected > 0 ? `${moneyExact(d.portfolioExpected)} a year, expected` : "No priced finding"}
          note={
            d.opportunities.length > 1
              ? `Ranges, not points: each bar runs low to high and the marker is the expected case. The total is overlap-adjusted at ${Math.round(d.overlapFactor * 100)}% because findings share the same customers and hours — the raw sum is never the number. Range on the total: ${money(d.portfolioLow)} to ${money(d.portfolioHigh)}. The arithmetic behind every figure is in Appendix B of your Blueprint.`
              : undefined
          }
        >
          {d.opportunities.length > 0 ? (
            <RangeBars rows={d.opportunities.slice(0, 6)} />
          ) : (
            <p className="text-[17px] text-[color:var(--color-brand-mist)]">
              No priced findings were released with this document.
            </p>
          )}
        </Section>

        <Section
          kicker="The next ninety days"
          title={d.plan.length > 0 ? "Three things, in order" : "The plan is in your Blueprint"}
          note={d.plan.length > 3 ? `${d.plan.length - 3} more after these. First things first.` : undefined}
        >
          {d.plan.length > 0 ? <PlanTimeline items={d.plan} /> : null}
        </Section>

        {hasReviews && (
          <Section kicker="Follow-through" title="How the plan is going">
            <div className="grid gap-6 md:grid-cols-2">
              {d.outcomes.day30 && <Review label="Day 30" review={d.outcomes.day30} />}
              {d.outcomes.day90 && <Review label="Day 90" review={d.outcomes.day90} />}
            </div>
          </Section>
        )}
      </div>

      <footer className="relative z-10 mx-auto w-full max-w-[1080px] px-6 py-12 text-[13px] leading-relaxed text-[color:var(--color-brand-mist)] md:px-10">
        Your full $7,500 is applied as credit toward CREAiT Builds or Advisory
        when you start within 60 days of your results session. This page is a
        private link issued by your advisor; it can be closed or replaced at any
        time.
      </footer>
    </main>
  );
}
