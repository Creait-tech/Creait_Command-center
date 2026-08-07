"use client";

/**
 * One indicator, in focus.
 *
 * One at a time rather than a list of thirty: the decision here is a judgement
 * call against four written anchors, not a known-answer data entry, and the
 * anchors only work if they are legible at the moment of choosing. A list makes
 * them small; a focused card lets them stay full size. The pillar rail beside it
 * (see scoring-step.tsx) buys back the orientation a pure one-at-a-time flow
 * loses.
 *
 * Scoring never auto-advances. A mis-keyed digit that jumps the screen becomes
 * an invisible error in a document a client pays $7,500 for, so the commit and
 * the advance stay separate keys. (CSU Northridge's Qualtrics accessibility
 * guidance puts it bluntly — "Do not Auto-Advance Questions!" — because
 * auto-advance removes the window in which a selection can be verified. WCAG
 * 3.2.2 also treats an automatic advance as a change of context that requires
 * prior warning.)
 *
 * Read-aloud copy and facilitator-only copy are separated the way structured
 * clinical interviews separate them (SCID-5, MINI): the line you speak is the
 * largest thing on the card; everything the facilitator reads silently is
 * smaller, muted, and labelled so it can never be mistaken for script.
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SCALE_LABELS, type IndicatorDef } from "@/lib/assessment-instrument";
import type { FacilitationScript } from "@/lib/assessment-facilitation";
import type {
  CcAssessmentScore,
  EvidenceConfidence,
} from "@/lib/supabase/types";

export const EVIDENCE_CYCLE: EvidenceConfidence[] = [
  "unknown",
  "reported",
  "demonstrated",
  "documented",
];

const EVIDENCE_LABEL: Record<EvidenceConfidence, string> = {
  unknown: "—",
  reported: "Reported",
  demonstrated: "Demonstrated",
  documented: "Documented",
};

/** Which written anchors explain a given score. */
const ANCHORS_FOR_SCORE: Record<number, number[]> = {
  0: [0],
  1: [0, 1],
  2: [1],
  3: [1, 2],
  4: [2],
};

export interface IndicatorPatch {
  score?: number | null;
  not_applicable?: boolean;
  evidence_confidence?: EvidenceConfidence;
  notes?: string | null;
}

export function IndicatorCard({
  indicator,
  row,
  script,
  pillarLabel,
  position,
  total,
  onChange,
  onAdvance,
  noteRef,
}: {
  indicator: IndicatorDef;
  row: CcAssessmentScore | undefined;
  script: FacilitationScript | undefined;
  pillarLabel: string;
  position: number;
  total: number;
  onChange: (patch: IndicatorPatch) => void;
  onAdvance: () => void;
  noteRef: React.RefObject<HTMLInputElement | null>;
}) {
  const isNa = row?.not_applicable ?? false;
  const score = isNa ? null : (row?.score ?? null);
  const evidence = row?.evidence_confidence ?? "unknown";
  const resolved = isNa || score !== null;

  const [note, setNote] = useState(row?.notes ?? "");
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [flash, setFlash] = useState<number | "na" | null>(null);
  // Per-indicator local state (note draft, disclosure, commit flash) resets by
  // remount: the parent renders this with key={indicator.key}.

  // The commit flash is the only motion here: it confirms the keystroke landed
  // on the value the facilitator meant, which is the whole reason scoring does
  // not auto-advance.
  useEffect(() => {
    if (flash === null) return;
    const t = setTimeout(() => setFlash(null), 260);
    return () => clearTimeout(t);
  }, [flash]);

  const anchors = [
    { n: 0, label: "Absent", text: indicator.anchor0 },
    { n: 2, label: "Developing", text: indicator.anchor2 },
    { n: 4, label: "Scalable", text: indicator.anchor4 },
  ];
  const litAnchors = score === null ? [] : (ANCHORS_FOR_SCORE[score] ?? []);

  function commitNote() {
    if ((row?.notes ?? "") !== note) onChange({ notes: note });
  }

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[color:var(--color-brand-electric)]">
            {pillarLabel}
            <span className="ml-2 font-normal tabular-nums text-muted-foreground">
              {position} of {total}
            </span>
          </p>
          <h3 className="mt-1.5 text-xl font-semibold leading-tight tracking-tight">
            {indicator.label}
          </h3>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground/70">
          {indicator.key}
        </span>
      </header>

      {script && (
        <section className="rounded-xl bg-[color:var(--color-brand-slate)]/45 px-5 py-4 ring-1 ring-inset ring-[color:var(--color-brand-electric)]/20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-electric)]">
            Say this
          </p>
          <p className="mt-2 max-w-[62ch] text-[17px] font-medium leading-snug text-foreground">
            {script.ask}
          </p>

          {script.listenFor.length > 0 && (
            <>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Listen for
                <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/70">
                  not read aloud
                </span>
              </p>
              <ul className="mt-1.5 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {script.listenFor.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-[13px] leading-snug text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className="mt-[7px] size-1 shrink-0 rounded-full bg-[color:var(--color-brand-mist)]/60"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}

          {script.followUp && (
            <div className="mt-3.5">
              <button
                type="button"
                onClick={() => setShowFollowUp((v) => !v)}
                aria-expanded={showFollowUp}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {showFollowUp ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                They gave a vague answer
              </button>
              {showFollowUp && (
                <p className="mt-1.5 max-w-[62ch] border-t border-border/60 pt-2.5 text-[14px] leading-snug text-foreground/90">
                  {script.followUp}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Score
            <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/70">
              press the number
            </span>
          </p>
          {script?.scoreHint && (
            <p className="max-w-[58ch] text-[12px] leading-snug text-muted-foreground">
              {script.scoreHint}
            </p>
          )}
        </div>

        {/*
          Six equal cells that never wrap: a scale that reflows into two rows
          stops reading as a scale. The word under each numeral appears only
          when the column is wide enough to hold "Established" without
          truncating — below that the numeral carries it, the anchors below
          still name 0, 2 and 4, and every button keeps its full label for
          screen readers and on hover.
        */}
        <div className="@container mt-2.5">
          <div className="grid grid-cols-6 gap-1.5">
            {[0, 1, 2, 3, 4].map((n) => {
              const selected = !isNa && score === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${n} — ${SCALE_LABELS[n]}`}
                  title={`${n} · ${SCALE_LABELS[n]}`}
                  onClick={() => {
                    onChange({ score: n, not_applicable: false });
                    setFlash(n);
                  }}
                  className={cn(
                    "flex min-h-11 flex-col items-center justify-center rounded-md px-1 py-2 transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none",
                    selected
                      ? "bg-[color:var(--color-brand-electric)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                      : "bg-[color:var(--color-brand-slate)]/60 text-muted-foreground hover:bg-[color:var(--color-brand-fog)]/70 hover:text-foreground",
                    flash === n &&
                      "ring-2 ring-[color:var(--color-brand-electric-glow)] ring-offset-2 ring-offset-background"
                  )}
                >
                  <span className="text-lg font-semibold leading-none tabular-nums">
                    {n}
                  </span>
                  <span
                    className={cn(
                      "mt-1 hidden text-[10.5px] leading-none @[30rem]:block",
                      selected ? "text-white/80" : "text-muted-foreground/80"
                    )}
                  >
                    {SCALE_LABELS[n]}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={isNa}
              aria-label="Not applicable"
              title="Not applicable — removed from the denominator, never counted as zero"
              onClick={() => {
                onChange({ score: null, not_applicable: !isNa });
                setFlash("na");
              }}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-md px-1 py-2 transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none",
                isNa
                  ? "bg-[color:var(--color-brand-warning)] text-black"
                  : "bg-[color:var(--color-brand-slate)]/60 text-muted-foreground hover:bg-[color:var(--color-brand-fog)]/70 hover:text-foreground",
                flash === "na" &&
                  "ring-2 ring-[color:var(--color-brand-warning)] ring-offset-2 ring-offset-background"
              )}
            >
              <span className="text-lg font-semibold leading-none">N/A</span>
              <span
                className={cn(
                  "mt-1 hidden text-[10.5px] leading-none @[30rem]:block",
                  isNa ? "text-black/70" : "text-muted-foreground/80"
                )}
              >
                Excluded
              </span>
            </button>
          </div>
        </div>

        <dl className="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-3">
          {anchors.map((a, i) => {
            const lit = litAnchors.includes(i);
            return (
              <div key={a.n}>
                <dt
                  className={cn(
                    "text-[11px] font-semibold tabular-nums transition-colors duration-150 motion-reduce:transition-none",
                    lit ? "text-foreground" : "text-muted-foreground/70"
                  )}
                >
                  {a.n} · {a.label}
                </dt>
                <dd
                  className={cn(
                    "mt-0.5 text-[12.5px] leading-snug transition-colors duration-150 motion-reduce:transition-none",
                    lit ? "text-foreground/90" : "text-muted-foreground/70"
                  )}
                >
                  {a.text}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            Evidence
          </span>
          <div className="flex rounded-md bg-[color:var(--color-brand-slate)]/60 p-0.5">
            {EVIDENCE_CYCLE.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={evidence === value}
                onClick={() => onChange({ evidence_confidence: value })}
                className={cn(
                  "rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 motion-reduce:transition-none",
                  evidence === value
                    ? "bg-[color:var(--color-brand-fog)] text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {EVIDENCE_LABEL[value]}
              </button>
            ))}
          </div>
        </div>

        <Input
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={commitNote}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitNote();
              e.currentTarget.blur();
              onAdvance();
            } else if (e.key === "Escape") {
              e.preventDefault();
              commitNote();
              e.currentTarget.blur();
            }
          }}
          placeholder="Evidence note — quote them if you can (report appendix)"
          className="h-8 flex-1 text-xs"
          aria-label={`Evidence note for ${indicator.label}`}
        />
      </section>

      <p className="sr-only" aria-live="polite">
        {resolved
          ? isNa
            ? `${indicator.label} marked not applicable`
            : `${indicator.label} scored ${score}`
          : `${indicator.label} not yet scored`}
      </p>
    </article>
  );
}
