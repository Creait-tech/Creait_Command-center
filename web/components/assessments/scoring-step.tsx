"use client";

/**
 * Scoring mode — the sitting AFTER the intensive.
 *
 * The Facilitator Guide is explicit: "After: same day, while fresh — score all
 * 30 indicators in the calculator, log evidence levels…". So this screen assumes
 * the client has gone home. It shows the running score (which would be a verdict
 * in the room) and keeps the block notes captured during the session in view, so
 * scoring from notes never means switching windows.
 *
 * Two views, because the research cuts both ways. One-at-a-time wins when the
 * answer needs deliberation — NN/g's wizard guidance, and Baymard's finding that
 * a single decision per screen reduces the sense of effort. It loses for
 * known-answer entry, where a list is simply faster, and NN/g's own exclusion is
 * repeat users who need to compare and jump around. A first-time facilitator
 * wants Guided; the same person in week three wants All thirty. The toggle keeps
 * position, so neither is a dead end.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, LayoutList, NotebookPen, Rows3, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  discardScoreProposals,
  proposeScores,
  recordProposalOutcome,
} from "@/lib/assessment-score-proposals";
import type { CcAssessment } from "@/lib/supabase/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  INDICATORS_BY_PILLAR,
  PILLARS,
  SCALE_LABELS,
  type ComputedScores,
  type IndicatorDef,
  type ScoreMap,
} from "@/lib/assessment-instrument";
import {
  BLOCK_BY_ID,
  BLOCK_FOR_PILLAR,
  blockNote,
  type ScoreProposal,
  type SessionNotes,
} from "@/lib/assessment-session";
import { FACILITATION } from "@/lib/assessment-facilitation";
import {
  EVIDENCE_CYCLE,
  IndicatorCard,
  type IndicatorPatch,
} from "@/components/assessments/indicator-card";
import { PillarMeter } from "@/components/assessments/progress-ring";
import type { AssessmentPillar, CcAssessmentScore } from "@/lib/supabase/types";

const ALL_INDICATORS: IndicatorDef[] = [
  ...INDICATORS_BY_PILLAR.profit,
  ...INDICATORS_BY_PILLAR.systems,
  ...INDICATORS_BY_PILLAR.leverage,
];

const EVIDENCE_MARK: Record<string, string> = {
  unknown: "—",
  reported: "R",
  demonstrated: "D",
  documented: "Doc",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function stateOf(row: CcAssessmentScore | undefined): "scored" | "na" | "open" {
  if (!row) return "open";
  if (row.not_applicable) return "na";
  return row.score !== null ? "scored" : "open";
}

// ---------------------------------------------------------------------------
function BlockNotesPanel({
  pillar,
  notes,
  className,
}: {
  pillar: AssessmentPillar;
  notes: SessionNotes;
  className?: string;
}) {
  const blockId = BLOCK_FOR_PILLAR[pillar];
  const block = BLOCK_BY_ID[blockId];
  const text = blockNote(notes, blockId).trim();

  return (
    <aside className={cn("min-w-0", className)}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <NotebookPen className="size-3" />
        Session notes · {block.label}
      </p>
      {text ? (
        <p className="mt-2 max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/85">
          {text}
        </p>
      ) : (
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          Nothing was captured in this block. Score from your own notes or the
          transcript, and leave anything you genuinely didn&apos;t examine
          unscored — the report says so rather than faking it.
        </p>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
/**
 * Section boundaries, not one thirty-item bar. Conrad et al. (2010) found a
 * single slow-moving progress indicator on a long instrument increases
 * abandonment; several fast ones don't. Ten indicators is a finishable unit, and
 * this is the moment it finishes.
 */
function PillarCompletePanel({
  label,
  score,
  nextLabel,
  onNext,
}: {
  label: string;
  score: number | null;
  nextLabel: string | null;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg bg-[color:var(--color-brand-slate)]/60 px-4 py-2.5 duration-300 ease-out animate-in fade-in motion-reduce:animate-none">
      <p className="text-[13px]">
        <span className="font-semibold">{label} complete</span>
        <span className="text-muted-foreground">
          {" "}
          — all ten examined, pillar score{" "}
        </span>
        <span className="font-semibold tabular-nums">{score ?? "—"}</span>
      </p>
      {nextLabel && (
        <Button size="sm" variant="secondary" onClick={onNext}>
          Next: {nextLabel} <ArrowRight className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function CompletionPanel({
  computed,
  onContinue,
}: {
  computed: ComputedScores;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-xl bg-[color:var(--color-brand-success)]/10 px-5 py-4 ring-1 ring-inset ring-[color:var(--color-brand-success)]/30 duration-500 ease-out animate-in fade-in slide-in-from-bottom-2 motion-reduce:animate-none">
      <div className="min-w-0">
        <p className="text-sm font-semibold">All thirty indicators resolved.</p>
        <p className="mt-1 max-w-[62ch] text-[12.5px] leading-relaxed text-muted-foreground">
          CREAiT Score{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {computed.creaitScore}
          </span>
          {computed.band ? ` · ${computed.band}` : ""}. The instrument is
          complete — the number is defensible now. Next: price what you found.
        </p>
      </div>
      <Button size="sm" onClick={onContinue}>
        Price the opportunities <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
/** All thirty at once — for a facilitator who already knows the instrument. */
function ListView({
  scores,
  onScoreChange,
  onOpenGuided,
}: {
  scores: ScoreMap;
  onScoreChange: (indicator: IndicatorDef, patch: IndicatorPatch) => void;
  onOpenGuided: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {PILLARS.map((pillar) => (
        <section key={pillar.key}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[color:var(--color-brand-electric)]">
            {pillar.label}
            <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
              {pillar.question}
            </span>
          </h3>
          <ul className="mt-2 divide-y divide-border/50">
            {INDICATORS_BY_PILLAR[pillar.key].map((ind) => {
              const row = scores[ind.key];
              const isNa = row?.not_applicable ?? false;
              const score = isNa ? null : (row?.score ?? null);
              return (
                <li
                  key={ind.key}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2"
                >
                  <button
                    type="button"
                    onClick={() => onOpenGuided(ind.key)}
                    className="min-w-0 flex-1 text-left text-[13px] transition-colors hover:text-[color:var(--color-brand-electric)]"
                    title="Open in guided view"
                  >
                    <span className="mr-2 font-mono text-[11px] text-muted-foreground/70">
                      {ind.key}
                    </span>
                    {ind.label}
                  </button>

                  <div className="flex items-center gap-0.5">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={!isNa && score === n}
                        aria-label={`${ind.label}: ${n} ${SCALE_LABELS[n]}`}
                        title={SCALE_LABELS[n]}
                        onClick={() =>
                          onScoreChange(ind, { score: n, not_applicable: false })
                        }
                        className={cn(
                          "size-7 rounded text-[12px] font-semibold tabular-nums transition-colors duration-150 motion-reduce:transition-none",
                          !isNa && score === n
                            ? "bg-[color:var(--color-brand-electric)] text-white"
                            : "bg-[color:var(--color-brand-slate)]/70 text-muted-foreground hover:bg-[color:var(--color-brand-fog)] hover:text-foreground"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-pressed={isNa}
                      aria-label={`${ind.label}: not applicable`}
                      title="Not applicable — removed from the denominator"
                      onClick={() =>
                        onScoreChange(ind, {
                          score: null,
                          not_applicable: !isNa,
                        })
                      }
                      className={cn(
                        "ml-1 h-7 rounded px-2 text-[11px] font-semibold transition-colors duration-150 motion-reduce:transition-none",
                        isNa
                          ? "bg-[color:var(--color-brand-warning)] text-black"
                          : "bg-[color:var(--color-brand-slate)]/70 text-muted-foreground hover:bg-[color:var(--color-brand-fog)] hover:text-foreground"
                      )}
                    >
                      N/A
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const at = EVIDENCE_CYCLE.indexOf(
                        row?.evidence_confidence ?? "unknown"
                      );
                      onScoreChange(ind, {
                        evidence_confidence:
                          EVIDENCE_CYCLE[(at + 1) % EVIDENCE_CYCLE.length],
                      });
                    }}
                    aria-label={`Evidence confidence for ${ind.label}`}
                    className="w-11 shrink-0 rounded bg-[color:var(--color-brand-slate)]/50 px-1 py-1 text-center text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {EVIDENCE_MARK[row?.evidence_confidence ?? "unknown"]}
                  </button>

                  <Input
                    defaultValue={row?.notes ?? ""}
                    onBlur={(e) => {
                      if ((row?.notes ?? "") !== e.target.value) {
                        onScoreChange(ind, { notes: e.target.value });
                      }
                    }}
                    placeholder="Note"
                    aria-label={`Evidence note for ${ind.label}`}
                    className="h-7 w-full text-xs sm:w-56"
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * The model's proposal for the focused indicator, beside the card.
 *
 * Shown as a proposal, never applied by itself: the score, the evidence level,
 * the quote it rests on and one sentence of reasoning, with one Accept button
 * that writes the score row through the same onScoreChange the keys use. When
 * the notes support nothing, the panel shows the question to ask instead.
 * Once the facilitator has scored the indicator, the panel turns into the
 * comparison — "proposed 2, you scored 3" — which is the calibration record.
 */
function ProposalPanel({
  indicator,
  row,
  proposal,
  onAccept,
}: {
  indicator: IndicatorDef;
  row: CcAssessmentScore | undefined;
  proposal: ScoreProposal | undefined;
  onAccept: () => void;
}) {
  if (!proposal) return null;
  const applied = row && (row.not_applicable || row.score !== null);
  const appliedScore = row?.not_applicable ? "N/A" : row?.score ?? null;
  const agrees = applied && !row?.not_applicable && row?.score === proposal.score;

  return (
    <aside
      className={cn(
        "mb-4 rounded-xl px-4 py-3 ring-1 ring-inset",
        proposal.score === null
          ? "bg-[color:var(--color-brand-warning)]/8 ring-[color:var(--color-brand-warning)]/30"
          : "bg-[color:var(--color-brand-violet)]/10 ring-[color:var(--color-brand-violet)]/30"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Sparkles className="size-3 text-[color:var(--color-brand-violet)]" />
            Proposed from the notes
            {applied && (
              <span className="ml-1 font-normal normal-case tracking-normal">
                · you scored {appliedScore}
                {agrees ? " — agrees" : proposal.score === null ? "" : " — differs"}
              </span>
            )}
          </p>
          {proposal.score !== null ? (
            <p className="mt-1.5 text-[15px] font-semibold">
              {proposal.score} {SCALE_LABELS[proposal.score]}
              <span className="ml-2 text-[12px] font-medium text-muted-foreground">
                {proposal.evidence === "demonstrated" ? "Demonstrated" : "Reported"}
              </span>
            </p>
          ) : (
            <p className="mt-1.5 text-[13.5px] font-medium text-[color:var(--color-brand-warning)]">
              Nothing in the notes supports a score
            </p>
          )}
          {proposal.quote && (
            <p className="mt-1 border-l-2 border-[color:var(--color-brand-violet)]/50 pl-2 text-[12.5px] italic leading-snug text-muted-foreground">
              “{proposal.quote}”
            </p>
          )}
          {proposal.reason && (
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
              {proposal.reason}
            </p>
          )}
          {proposal.gap && (
            <p className="mt-1.5 text-[12.5px] leading-snug text-[color:var(--color-brand-aqua)]">
              Ask: {proposal.gap}
            </p>
          )}
        </div>
        {proposal.score !== null && !agrees && (
          <Button size="sm" onClick={onAccept}>
            Accept {proposal.score} · {proposal.evidence === "demonstrated" ? "Demonstrated" : "Reported"}
          </Button>
        )}
      </div>
      <p className="sr-only">
        A proposal for {indicator.label}; the score is not applied until accepted.
      </p>
    </aside>
  );
}

// ---------------------------------------------------------------------------
export function ScoringStep({
  assessmentId,
  scores,
  computed,
  sessionNotes,
  focusKey,
  onFocusChange,
  onScoreChange,
  onAssessment,
  onContinue,
}: {
  assessmentId: string;
  scores: ScoreMap;
  computed: ComputedScores;
  sessionNotes: SessionNotes;
  focusKey: string;
  onFocusChange: (key: string) => void;
  onScoreChange: (indicator: IndicatorDef, patch: IndicatorPatch) => void;
  /** Replaces the engagement row after a server action returns it (proposals live in session_notes). */
  onAssessment?: (a: CcAssessment) => void;
  onContinue: () => void;
}) {
  const [view, setView] = useState<"guided" | "list">("guided");
  const [proposing, setProposing] = useState(false);
  const proposals = sessionNotes.scoreProposals ?? null;
  const proposalStats = useMemo(() => {
    if (!proposals) return null;
    const items = Object.values(proposals.items);
    const scored = items.filter((p) => p && p.score !== null).length;
    const applied = items.filter((p) => p && p.applied_at).length;
    const agreed = items.filter(
      (p) => p && p.applied_at && p.applied_score !== undefined && p.applied_score === p.score
    ).length;
    return { total: items.length, scored, gaps: items.length - scored, applied, agreed };
  }, [proposals]);

  async function runPropose() {
    setProposing(true);
    const res = await proposeScores(assessmentId);
    setProposing(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data) onAssessment?.(res.data.assessment);
    toast.success("Proposals ready — nothing is scored until you accept it.");
  }

  async function runDiscard() {
    const res = await discardScoreProposals(assessmentId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data) onAssessment?.(res.data.assessment);
  }

  function acceptProposal(ind: IndicatorDef) {
    const p = proposals?.items[ind.key];
    if (!p || p.score === null) return;
    const row = scores[ind.key];
    onScoreChange(ind, {
      score: p.score,
      not_applicable: false,
      evidence_confidence: p.evidence ?? "reported",
      // The rubric wants the note to name the quote; keep a note the
      // facilitator already wrote, otherwise the quote becomes the note.
      notes: row?.notes?.trim() ? row.notes : p.quote ? `“${p.quote}”` : null,
    });
    void recordProposalOutcome(assessmentId, ind.key, p.score).then((res) => {
      if (res.ok && res.data) onAssessment?.(res.data.assessment);
    });
  }
  const [showKeys, setShowKeys] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  const focusIndex = Math.max(
    0,
    ALL_INDICATORS.findIndex((i) => i.key === focusKey)
  );
  const indicator = ALL_INDICATORS[focusIndex];
  const pillar = indicator.pillar;
  const pillarMeta = PILLARS.find((p) => p.key === pillar)!;
  const pillarIndicators = INDICATORS_BY_PILLAR[pillar];
  const positionInPillar =
    pillarIndicators.findIndex((i) => i.key === indicator.key) + 1;

  const resolvedCount = computed.resolvedCount;
  const complete = resolvedCount >= ALL_INDICATORS.length;

  const move = useCallback(
    (delta: number) => {
      const next = focusIndex + delta;
      if (next < 0 || next >= ALL_INDICATORS.length) return;
      onFocusChange(ALL_INDICATORS[next].key);
    },
    [focusIndex, onFocusChange]
  );

  /**
   * Shortcuts are scoped to this pane, not to the window.
   *
   * WCAG 2.1.4 Character Key Shortcuts (Level A) forbids single-character
   * shortcuts that are always live, because they fire under speech input and
   * steal keys from users who navigate by typing. Option 3 of that criterion —
   * "active only when the component has focus" — is what this does: the pane
   * takes focus when you arrive and after every move, so in practice the keys
   * are always there for the facilitator, and never there for anyone typing
   * somewhere else on the page.
   */
  function onPaneKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;

    const current = ALL_INDICATORS[focusIndex];
    if (e.key >= "0" && e.key <= "4") {
      e.preventDefault();
      onScoreChange(current, { score: Number(e.key), not_applicable: false });
      return;
    }
    switch (e.key.toLowerCase()) {
      case "n": {
        e.preventDefault();
        const row = scores[current.key];
        onScoreChange(current, {
          score: null,
          not_applicable: !(row?.not_applicable ?? false),
        });
        return;
      }
      case "e": {
        e.preventDefault();
        const row = scores[current.key];
        const at = EVIDENCE_CYCLE.indexOf(row?.evidence_confidence ?? "unknown");
        onScoreChange(current, {
          evidence_confidence: EVIDENCE_CYCLE[(at + 1) % EVIDENCE_CYCLE.length],
        });
        return;
      }
      case "/": {
        e.preventDefault();
        noteRef.current?.focus();
        return;
      }
      case "?": {
        e.preventDefault();
        setShowKeys((v) => !v);
        return;
      }
    }
    if (e.key === "Enter" || e.key === "ArrowRight") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(-1);
    }
  }

  // Take focus on arrival and after every move so the keys are live without the
  // facilitator having to think about where focus is.
  useEffect(() => {
    if (view !== "guided") return;
    const pane = paneRef.current;
    if (!pane) return;
    if (pane.contains(document.activeElement)) return;
    pane.focus({ preventScroll: true });
  }, [focusKey, view]);

  const pillarCounts = useMemo(
    () =>
      PILLARS.map((p) => {
        let scored = 0;
        let na = 0;
        for (const ind of INDICATORS_BY_PILLAR[p.key]) {
          const s = stateOf(scores[ind.key]);
          if (s === "scored") scored += 1;
          else if (s === "na") na += 1;
        }
        return { ...p, scored, na };
      }),
    [scores]
  );

  const thisPillar = pillarCounts.find((p) => p.key === pillar)!;
  const pillarDone = thisPillar.scored + thisPillar.na === 10;
  const pillarOrder = PILLARS.findIndex((p) => p.key === pillar);
  const nextPillar = PILLARS[pillarOrder + 1] ?? null;

  return (
    <div className="flex flex-col gap-5">
      {complete && (
        <CompletionPanel computed={computed} onContinue={onContinue} />
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* Pillar switch — the primary progress signal */}
        <div className="flex flex-wrap gap-1.5">
          {pillarCounts.map((p) => {
            const active = p.key === pillar && view === "guided";
            const thin = computed.thinPillars[p.key];
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setView("guided");
                  onFocusChange(INDICATORS_BY_PILLAR[p.key][0].key);
                }}
                aria-pressed={active}
                className={cn(
                  "rounded-lg px-3 py-2 text-left transition-colors duration-150 motion-reduce:transition-none",
                  active
                    ? "bg-[color:var(--color-brand-slate)] text-foreground"
                    : "text-muted-foreground hover:bg-[color:var(--color-brand-slate)]/50 hover:text-foreground"
                )}
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.07em]">
                    {p.label}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {p.scored + p.na}/10
                  </span>
                  <span
                    className={cn(
                      "text-[13px] font-semibold tabular-nums",
                      thin && "text-muted-foreground/60"
                    )}
                    title={
                      thin
                        ? `Only ${p.scored} of 10 ${p.label} indicators examined — too few to report as a pillar score, and excluded from the composite`
                        : undefined
                    }
                  >
                    {computed.pillars[p.key] ?? "—"}
                    {thin && "*"}
                  </span>
                </span>
                <PillarMeter
                  className="mt-1.5"
                  scored={p.scored}
                  na={p.na}
                  total={10}
                />
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void runPropose()}
              disabled={proposing}
              title="Reads the session notes and the intake against every anchor and proposes a score with the quote it rests on. Nothing is scored until you accept it."
            >
              <Sparkles className="size-3.5" />
              {proposing
                ? "Reading the notes…"
                : proposals
                  ? "Propose again"
                  : "Propose scores from the notes"}
            </Button>
            {proposalStats && (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {proposalStats.scored} proposed · {proposalStats.gaps} to ask
                {proposalStats.applied > 0
                  ? ` · ${proposalStats.agreed}/${proposalStats.applied} agreed`
                  : ""}
              </span>
            )}
            {proposals && (
              <Button size="xs" variant="ghost" onClick={() => void runDiscard()}>
                Clear
              </Button>
            )}
          </div>
        <div className="flex rounded-md bg-[color:var(--color-brand-slate)]/60 p-0.5">
          {(
            [
              ["guided", "Guided", Rows3],
              ["list", "All thirty", LayoutList],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150 motion-reduce:transition-none",
                view === id
                  ? "bg-[color:var(--color-brand-fog)] text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {view === "list" ? (
        <ListView
          scores={scores}
          onScoreChange={onScoreChange}
          onOpenGuided={(key) => {
            onFocusChange(key);
            setView("guided");
          }}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_280px]">
          {/* Rail — orientation inside the pillar */}
          <nav
            aria-label={`${pillarMeta.label} indicators`}
            className="-mx-1 flex gap-1 overflow-x-auto lg:mx-0 lg:flex-col lg:overflow-visible"
          >
            {pillarIndicators.map((ind, i) => {
              const state = stateOf(scores[ind.key]);
              const active = ind.key === indicator.key;
              const row = scores[ind.key];
              return (
                <button
                  key={ind.key}
                  type="button"
                  onClick={() => onFocusChange(ind.key)}
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
                      state === "scored" &&
                        "bg-[color:var(--color-brand-electric)]/20 text-[color:var(--color-brand-electric)]",
                      state === "na" &&
                        "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)]",
                      state === "open" &&
                        "bg-[color:var(--color-brand-fog)]/50 text-muted-foreground/70"
                    )}
                  >
                    {state === "scored" ? row?.score : state === "na" ? "–" : ""}
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
            {pillarDone && (
              <PillarCompletePanel
                label={pillarMeta.label}
                score={computed.pillars[pillar]}
                nextLabel={nextPillar?.label ?? null}
                onNext={() => {
                  if (nextPillar) {
                    onFocusChange(INDICATORS_BY_PILLAR[nextPillar.key][0].key);
                  }
                }}
              />
            )}

            <BlockNotesPanel
              pillar={pillar}
              notes={sessionNotes}
              className={cn(
                "rounded-xl bg-[color:var(--color-brand-slate)]/30 px-4 py-3 xl:hidden",
                pillarDone ? "mt-4 mb-5" : "mb-5"
              )}
            />

            <div className={cn(pillarDone && "mt-4 xl:mt-4")}>
              <ProposalPanel
                key={`proposal-${indicator.key}`}
                indicator={indicator}
                row={scores[indicator.key]}
                proposal={proposals?.items[indicator.key]}
                onAccept={() => acceptProposal(indicator)}
              />
              <IndicatorCard
                key={indicator.key}
                indicator={indicator}
                row={scores[indicator.key]}
                script={FACILITATION[indicator.key]}
                pillarLabel={pillarMeta.label}
                position={positionInPillar}
                total={pillarIndicators.length}
                onChange={(patch) => onScoreChange(indicator, patch)}
                onAdvance={() => move(1)}
                noteRef={noteRef}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => move(-1)}
                  disabled={focusIndex === 0}
                >
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

              {/* Hints stay visible: shortcuts nobody sees are shortcuts
                  nobody uses (Lane et al. 2005). */}
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

            <p className={cn("mt-2 text-[11px] text-muted-foreground", !showKeys && "sr-only")}>
              Shortcuts work while this panel has focus — click anywhere in it if
              they stop responding.
            </p>
          </div>

          <BlockNotesPanel
            pillar={pillar}
            notes={sessionNotes}
            className="hidden xl:block"
          />
        </div>
      )}
    </div>
  );
}
