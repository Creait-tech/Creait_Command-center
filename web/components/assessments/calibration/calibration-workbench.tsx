"use client";

/**
 * Blind scoring of a calibration case.
 *
 * The same card the real scoring screen uses (IndicatorCard, with the whole
 * anchor scale printed), the same rail, the same keys — and beside it the
 * case materials instead of the live session notes. The key is not on this
 * page: it arrives with the result after submission. Answers autosave, so a
 * trainee can stop mid-case and pick it up tomorrow.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  INDICATORS_BY_PILLAR,
  PILLARS,
  type IndicatorDef,
} from "@/lib/assessment-instrument";
import { FACILITATION } from "@/lib/assessment-facilitation";
import {
  computeAnswers,
  missingNotes,
  unresolved,
  type CalibrationAnswer,
  type CalibrationAnswers,
  type CalibrationMaterials,
} from "@/lib/calibration";
import {
  discardCalibration,
  saveCalibrationAnswers,
  submitCalibration,
} from "@/lib/calibration-actions";
import {
  EVIDENCE_CYCLE,
  IndicatorCard,
  type IndicatorPatch,
} from "@/components/assessments/indicator-card";
import { PillarMeter } from "@/components/assessments/progress-ring";
import { CaseMaterials } from "@/components/assessments/calibration/case-materials";
import type { CcAssessmentScore } from "@/lib/supabase/types";

const ALL_INDICATORS: IndicatorDef[] = [
  ...INDICATORS_BY_PILLAR.profit,
  ...INDICATORS_BY_PILLAR.systems,
  ...INDICATORS_BY_PILLAR.leverage,
];

const AUTOSAVE_MS = 900;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** The score-row shape IndicatorCard reads, built from an answer. */
function toRow(key: string, a: CalibrationAnswer | undefined): CcAssessmentScore | undefined {
  if (!a) return undefined;
  return {
    id: key,
    assessment_id: "calibration",
    indicator_key: key,
    pillar: "profit",
    score: a.na ? null : a.score,
    potential_score: null,
    not_applicable: a.na,
    evidence_confidence: a.evidence,
    notes: a.note,
    created_at: "",
    updated_at: "",
  };
}

function stateOf(a: CalibrationAnswer | undefined): "scored" | "na" | "open" {
  if (!a) return "open";
  if (a.na) return "na";
  return a.score !== null ? "scored" : "open";
}

export function CalibrationWorkbench({
  attemptId,
  materials,
  initialAnswers,
}: {
  attemptId: string;
  materials: CalibrationMaterials;
  initialAnswers: CalibrationAnswers;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<CalibrationAnswers>(initialAnswers);
  const [focusKey, setFocusKey] = useState<string>(ALL_INDICATORS[0].key);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [submitting, setSubmitting] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(answers);
  useEffect(() => {
    latest.current = answers;
  }, [answers]);

  // ── Autosave ──────────────────────────────────────────────────────────
  const flush = useCallback(async () => {
    setSaveState("saving");
    const res = await saveCalibrationAnswers(attemptId, latest.current);
    if (!res.ok) {
      setSaveState("error");
      toast.error(res.error, { id: "calibration-save" });
      return false;
    }
    setSaveState("saved");
    return true;
  }, [attemptId]);

  const update = useCallback(
    (fn: (prev: CalibrationAnswers) => CalibrationAnswers) => {
      setAnswers((prev) => fn(prev));
      setSaveState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function patchIndicator(ind: IndicatorDef, patch: IndicatorPatch) {
    update((prev) => {
      const current: CalibrationAnswer = prev.scores[ind.key] ?? {
        score: null,
        na: false,
        evidence: "unknown",
        note: "",
      };
      const next: CalibrationAnswer = { ...current };
      if (patch.not_applicable !== undefined) next.na = patch.not_applicable;
      if (patch.score !== undefined) next.score = patch.score;
      if (next.na) next.score = null;
      if (patch.evidence_confidence !== undefined) next.evidence = patch.evidence_confidence;
      if (patch.notes !== undefined) next.note = patch.notes ?? "";
      return { ...prev, scores: { ...prev.scores, [ind.key]: next } };
    });
  }

  // ── Navigation & keys (mirrors scoring-step.tsx) ──────────────────────
  const focusIndex = Math.max(0, ALL_INDICATORS.findIndex((i) => i.key === focusKey));
  const indicator = ALL_INDICATORS[focusIndex];
  const pillarMeta = PILLARS.find((p) => p.key === indicator.pillar)!;
  const pillarIndicators = INDICATORS_BY_PILLAR[indicator.pillar];
  const positionInPillar = pillarIndicators.findIndex((i) => i.key === indicator.key) + 1;

  const move = useCallback(
    (delta: number) => {
      const next = focusIndex + delta;
      if (next < 0 || next >= ALL_INDICATORS.length) return;
      setFocusKey(ALL_INDICATORS[next].key);
    },
    [focusIndex]
  );

  function onPaneKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    const current = ALL_INDICATORS[focusIndex];
    if (e.key >= "0" && e.key <= "4") {
      e.preventDefault();
      patchIndicator(current, { score: Number(e.key), not_applicable: false });
      return;
    }
    switch (e.key.toLowerCase()) {
      case "n": {
        e.preventDefault();
        patchIndicator(current, {
          score: null,
          not_applicable: !(answers.scores[current.key]?.na ?? false),
        });
        return;
      }
      case "e": {
        e.preventDefault();
        const at = EVIDENCE_CYCLE.indexOf(answers.scores[current.key]?.evidence ?? "unknown");
        patchIndicator(current, {
          evidence_confidence: EVIDENCE_CYCLE[(at + 1) % EVIDENCE_CYCLE.length],
        });
        return;
      }
      case "/":
        e.preventDefault();
        noteRef.current?.focus();
        return;
    }
    if (e.key === "Enter" || e.key === "ArrowRight") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(-1);
    }
  }

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || pane.contains(document.activeElement)) return;
    pane.focus({ preventScroll: true });
  }, [focusKey]);

  // ── Progress ──────────────────────────────────────────────────────────
  const computed = useMemo(() => computeAnswers(answers), [answers]);
  const open = useMemo(() => unresolved(answers), [answers]);
  const noteless = useMemo(() => missingNotes(answers), [answers]);
  const pillarCounts = useMemo(
    () =>
      PILLARS.map((p) => {
        let scored = 0;
        let na = 0;
        for (const ind of INDICATORS_BY_PILLAR[p.key]) {
          const s = stateOf(answers.scores[ind.key]);
          if (s === "scored") scored += 1;
          else if (s === "na") na += 1;
        }
        return { ...p, scored, na };
      }),
    [answers]
  );
  const complete = open.length === 0;

  // ── Submit / discard ──────────────────────────────────────────────────
  async function submit() {
    if (!complete) {
      toast.error(`${open.length} indicator${open.length === 1 ? "" : "s"} still open.`);
      return;
    }
    if (noteless.length > 0) {
      const go = window.confirm(
        `${noteless.length} scored indicator${noteless.length === 1 ? " has" : "s have"} no evidence note (${noteless.join(", ")}). The pass rule is "no score without a note" — submit anyway?`
      );
      if (!go) return;
    }
    if (!answers.primary_constraint.trim()) {
      const go = window.confirm(
        "You haven't named the Primary Business Constraint. It's compared to the key side by side. Submit without it?"
      );
      if (!go) return;
    }
    setSubmitting(true);
    if (timer.current) clearTimeout(timer.current);
    const res = await submitCalibration(attemptId, latest.current);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.data?.result.stats.pass
        ? "Submitted — within the calibration bar."
        : "Submitted — compare against the key below."
    );
    router.refresh();
  }

  async function discard() {
    if (!window.confirm("Throw this attempt away? Your answers so far will be deleted.")) return;
    const res = await discardCalibration(attemptId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.push("/assessments/calibration");
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Progress row */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {pillarCounts.map((p) => {
            const active = p.key === indicator.pillar;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setFocusKey(INDICATORS_BY_PILLAR[p.key][0].key)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg px-3 py-2 text-left transition-colors duration-150 motion-reduce:transition-none",
                  active
                    ? "bg-[color:var(--color-brand-slate)] text-foreground"
                    : "text-muted-foreground hover:bg-[color:var(--color-brand-slate)]/50 hover:text-foreground"
                )}
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.07em]">{p.label}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {p.scored + p.na}/10
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums">
                    {computed.pillars[p.key] ?? "—"}
                  </span>
                </span>
                <PillarMeter className="mt-1.5" scored={p.scored} na={p.na} total={10} />
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-[11px]",
              saveState === "error" ? "text-[color:var(--color-brand-warning)]" : "text-muted-foreground"
            )}
          >
            {saveState === "saved" && "Saved"}
            {saveState === "dirty" && "Unsaved changes"}
            {saveState === "saving" && "Saving…"}
            {saveState === "error" && "Not saved — check your connection"}
          </span>
          <Button size="sm" variant="ghost" onClick={() => void discard()} title="Delete this attempt">
            <Trash2 className="size-3.5" /> Discard
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_minmax(300px,360px)]">
        {/* Rail */}
        <nav
          aria-label={`${pillarMeta.label} indicators`}
          className="-mx-1 flex gap-1 overflow-x-auto lg:mx-0 lg:flex-col lg:overflow-visible"
        >
          {pillarIndicators.map((ind, i) => {
            const a = answers.scores[ind.key];
            const state = stateOf(a);
            const active = ind.key === indicator.key;
            return (
              <button
                key={ind.key}
                type="button"
                onClick={() => setFocusKey(ind.key)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors duration-150 motion-reduce:transition-none lg:shrink",
                  active
                    ? "bg-[color:var(--color-brand-slate)] text-foreground"
                    : "text-muted-foreground hover:bg-[color:var(--color-brand-slate)]/50 hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded text-[11px] font-semibold tabular-nums",
                    state === "scored" && "bg-[color:var(--color-brand-electric)]/20 text-[color:var(--color-brand-electric)]",
                    state === "na" && "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)]",
                    state === "open" && "bg-[color:var(--color-brand-fog)]/50 text-muted-foreground/70"
                  )}
                >
                  {state === "scored" ? a?.score : state === "na" ? "–" : ""}
                </span>
                <span className="truncate lg:max-w-[130px]">
                  <span className="hidden lg:inline">{ind.label}</span>
                  <span className="font-mono lg:hidden">{ind.key}</span>
                </span>
                <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground/50 lg:inline">
                  {i + 1}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Focused indicator */}
        <div
          ref={paneRef}
          tabIndex={-1}
          onKeyDown={onPaneKeyDown}
          className="min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-electric)]/40"
        >
          <CaseMaterials
            materials={materials}
            className="mb-5 rounded-xl bg-[color:var(--color-brand-slate)]/30 px-4 py-3 xl:hidden"
          />

          <IndicatorCard
            key={indicator.key}
            indicator={indicator}
            row={toRow(indicator.key, answers.scores[indicator.key])}
            script={FACILITATION[indicator.key]}
            pillarLabel={pillarMeta.label}
            position={positionInPillar}
            total={pillarIndicators.length}
            onChange={(patch) => patchIndicator(indicator, patch)}
            onAdvance={() => move(1)}
            noteRef={noteRef}
            hideTarget
          />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => move(-1)} disabled={focusIndex === 0}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={() => move(1)}
                disabled={focusIndex === ALL_INDICATORS.length - 1}
              >
                Next <ArrowRight className="size-4" />
              </Button>
            </div>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
              {[
                ["0–4", "score"],
                ["N", "N/A"],
                ["Enter", "next"],
                ["←", "back"],
                ["E", "evidence"],
                ["/", "note"],
              ].map(([key, what]) => (
                <li key={key} className="flex items-center gap-1.5">
                  <kbd className="rounded border border-border bg-[color:var(--color-brand-slate)]/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                    {key}
                  </kbd>
                  {what}
                </li>
              ))}
            </ul>
          </div>

          {/* The judgement calls that aren't a number */}
          <section className="mt-8 flex flex-col gap-4 border-t border-border/60 pt-5">
            <div>
              <label htmlFor="cal-constraint" className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[color:var(--color-brand-electric)]">
                Primary Business Constraint
              </label>
              <p className="mt-1 text-[12px] text-muted-foreground">
                One sentence, the root not the symptom. It has to show up in at least two blocks of the session capture.
              </p>
              <Textarea
                id="cal-constraint"
                value={answers.primary_constraint}
                onChange={(e) => update((prev) => ({ ...prev, primary_constraint: e.target.value }))}
                rows={2}
                className="mt-2 text-[13px]"
                placeholder="The revenue engine is the owner — …"
              />
            </div>
            <div>
              <label htmlFor="cal-momentum" className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[color:var(--color-brand-electric)]">
                Early Momentum Initiative
              </label>
              <p className="mt-1 text-[12px] text-muted-foreground">
                A decision, not a project: measurable inside 30 days, entirely in the owner&apos;s control.
              </p>
              <Textarea
                id="cal-momentum"
                value={answers.momentum_initiative}
                onChange={(e) => update((prev) => ({ ...prev, momentum_initiative: e.target.value }))}
                rows={2}
                className="mt-2 text-[13px]"
              />
            </div>

            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 ring-1 ring-inset",
                complete
                  ? "bg-[color:var(--color-brand-success)]/10 ring-[color:var(--color-brand-success)]/30"
                  : "bg-[color:var(--color-brand-slate)]/40 ring-border/60"
              )}
            >
              <div className="text-[12.5px]">
                {complete ? (
                  <p className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="size-4 text-[color:var(--color-brand-success)]" />
                    All thirty resolved — composite {computed.creaitScore ?? "—"}
                    {computed.band ? ` · ${computed.band}` : ""}.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    {open.length} still open. Submit unlocks when every indicator has a score or an N/A.
                  </p>
                )}
                {noteless.length > 0 && (
                  <p className="mt-0.5 text-[11.5px] text-[color:var(--color-brand-warning)]">
                    No note yet on {noteless.join(", ")} — the key needs the evidence named.
                  </p>
                )}
              </div>
              <Button onClick={() => void submit()} disabled={!complete || submitting}>
                {submitting ? "Comparing…" : "Submit and compare to the key"}
              </Button>
            </div>
          </section>
        </div>

        <CaseMaterials materials={materials} className="hidden xl:flex" />
      </div>
    </div>
  );
}
