"use client";

/**
 * The Growth & AI Diagnostic workbench.
 *
 * Structure follows the Facilitator Guide's own delivery, not a form's
 * convenience: Setup before the intensive · Session live in the room · Scoring
 * the same evening from those notes · Opportunities, Constraint and Plan through
 * the analysis window · Review before the results session. Each is a step, and
 * every step is reachable at any time — the client will not answer in order.
 *
 * The step lives in the URL (?step=…&block=…&k=…) so a refresh, a crashed tab or
 * a second monitor resumes exactly where the facilitator was. It is written with
 * history.replaceState rather than the router: a router navigation would refetch
 * the server component and turn every keystroke-advance into a page load.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  computeScores,
  formatMoney,
  INDICATORS,
  MIN_PILLAR_SAMPLE,
  MIN_REPORT_RESOLVED,
  normalizeOverlapFactor,
  OVERLAY_FLAGS,
  PILLARS,
  portfolioTotals,
  toScoreMap,
  type IndicatorDef,
} from "@/lib/assessment-instrument";
import {
  BLOCK_IDS,
  parseSessionNotes,
  sessionCapturedCount,
  type BlockId,
} from "@/lib/assessment-session";
import {
  appendPlanItem,
  removePlanItem,
  reorderPlanItems,
  updateAssessment,
  updateSessionNotes,
  upsertIndicatorScore,
  type ActionResult,
  type AssessmentPatch,
} from "@/lib/assessment-actions";
import {
  PracticeBadge,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/components/assessments/assessments-view";
import {
  isStepId,
  SessionStepper,
  STEPS,
  StepIntro,
  type StepId,
  type StepStatus,
} from "@/components/assessments/session-stepper";
import { ProgressRing } from "@/components/assessments/progress-ring";
import { SaveState, type SaveStatus } from "@/components/assessments/save-state";
import { SessionStep } from "@/components/assessments/session-step";
import { ScoringStep } from "@/components/assessments/scoring-step";
import { OpportunityEditor } from "@/components/assessments/opportunity-editor";
import { PlanBuilder } from "@/components/assessments/plan-builder";
import type { IndicatorPatch } from "@/components/assessments/indicator-card";
import type {
  AssessmentStatus,
  CcAssessment,
  CcAssessmentOpportunity,
  CcAssessmentScore,
} from "@/lib/supabase/types";

const STATUS_OPTIONS: AssessmentStatus[] = [
  "practice",
  "intake",
  "scoring",
  "review",
  "delivered",
];

/** Fallback pace before this session has produced enough samples of its own. */
const DEFAULT_SECONDS_PER_INDICATOR = 45;

function jsonToStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function median(values: number[]): number {
  if (values.length === 0) return DEFAULT_SECONDS_PER_INDICATOR;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function Labelled({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-medium text-muted-foreground">
        {label}
        {hint && (
          <span className="ml-1.5 font-normal text-muted-foreground/70">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

export function AssessmentWorkbench({
  initialAssessment,
  initialScores,
  initialOpportunities,
  initialStep,
  initialBlock,
  initialIndicator,
}: {
  initialAssessment: CcAssessment;
  initialScores: CcAssessmentScore[];
  initialOpportunities: CcAssessmentOpportunity[];
  initialStep?: string;
  initialBlock?: string;
  initialIndicator?: string;
}) {
  const [assessment, setAssessment] = useState(initialAssessment);
  const [scores, setScores] = useState(() => toScoreMap(initialScores));
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [planDraft, setPlanDraft] = useState("");

  const [step, setStep] = useState<StepId>(() =>
    isStepId(initialStep) ? initialStep : "setup"
  );
  const [block, setBlock] = useState<BlockId>(() =>
    (BLOCK_IDS as string[]).includes(initialBlock ?? "")
      ? (initialBlock as BlockId)
      : "b1"
  );
  const [indicatorKey, setIndicatorKey] = useState<string>(() =>
    INDICATORS.some((i) => i.key === initialIndicator)
      ? initialIndicator!
      : INDICATORS[0].key
  );

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const inflight = useRef(0);
  const lastFailed = useRef<(() => void) | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  // Pace samples for the time-remaining estimate — measured from this session,
  // not guessed, so it converges on how fast this facilitator actually works.
  const [paceSamples, setPaceSamples] = useState<number[]>([]);
  const lastResolveAt = useRef<number | null>(null);

  const computed = useMemo(() => computeScores(scores), [scores]);
  const resolvedCount = computed.resolvedCount;

  // Pace is measured, not guessed: each time the resolved count ticks up we
  // record the gap. Long gaps are dropped — a coffee break is not a scoring
  // pace — so the estimate reflects working speed rather than wall clock.
  useEffect(() => {
    if (resolvedCount === 0) {
      lastResolveAt.current = null;
      return;
    }
    const now = Date.now();
    const previous = lastResolveAt.current;
    lastResolveAt.current = now;
    if (previous === null) return;
    const delta = (now - previous) / 1000;
    if (delta > 1 && delta < 300) setPaceSamples((prev) => [...prev, delta]);
  }, [resolvedCount]);
  const reportReady = resolvedCount >= MIN_REPORT_RESOLVED;
  const sessionNotes = useMemo(
    () => parseSessionNotes(assessment.session_notes),
    [assessment.session_notes]
  );
  const overlayFlags = useMemo(
    () => jsonToStrings(assessment.overlay_flags),
    [assessment.overlay_flags]
  );
  const planItems = useMemo(
    () => jsonToStrings(assessment.plan_items),
    [assessment.plan_items]
  );
  const portfolio = useMemo(
    () => portfolioTotals(opportunities, assessment.overlap_factor),
    [opportunities, assessment.overlap_factor]
  );

  // ── URL ──────────────────────────────────────────────────────────────────
  function syncUrl(next: { step?: StepId; block?: BlockId; k?: string }) {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      const s = next.step ?? step;
      url.searchParams.set("step", s);
      if (s === "session") {
        url.searchParams.set("block", next.block ?? block);
        url.searchParams.delete("k");
      } else if (s === "scoring") {
        url.searchParams.set("k", next.k ?? indicatorKey);
        url.searchParams.delete("block");
      } else {
        url.searchParams.delete("block");
        url.searchParams.delete("k");
      }
    window.history.replaceState(null, "", url);
  }

  function goStep(id: StepId) {
    setStep(id);
    syncUrl({ step: id });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // ── Saving ───────────────────────────────────────────────────────────────
  /**
   * Every write reports into one save indicator. Optimistic UI stays: the
   * facilitator never waits on the network to score the next indicator, but the
   * screen now says whether the work is actually on the server, which it never
   * did before.
   */
  async function runSave<T>(
    run: () => Promise<ActionResult<T>>,
    onOk?: (data: T | undefined) => void,
    onFail?: () => void
  ) {
      inflight.current += 1;
      setSaveStatus("saving");
      try {
        const res = await run();
        if (!res.ok) {
          lastFailed.current = () => void runSave(run, onOk, onFail);
          onFail?.();
          setSaveStatus("error");
          toast.error(res.error);
          return;
        }
        onOk?.(res.data);
        inflight.current = Math.max(0, inflight.current - 1);
        if (inflight.current === 0) setSaveStatus("saved");
        return;
      } catch {
        lastFailed.current = () => void runSave(run, onOk, onFail);
        onFail?.();
        setSaveStatus("error");
        toast.error("Couldn't reach the server — your work is still on screen.");
        return;
      } finally {
        if (inflight.current > 0) inflight.current -= 1;
      }
  }

  function patchAssessment(patch: AssessmentPatch) {
      const previous = assessment;
      setAssessment((p) => ({ ...p, ...(patch as Partial<CcAssessment>) }));
      void runSave(
        () => updateAssessment(assessment.id, patch),
        (data) => data && setAssessment(data.assessment),
        () => setAssessment(previous)
      );
  }

  function patchScore(indicator: IndicatorDef, patch: IndicatorPatch) {
      const previous = scores;
      const existing = scores[indicator.key];

      const next: CcAssessmentScore = {
        id: existing?.id ?? `optimistic-${indicator.key}`,
        assessment_id: assessment.id,
        indicator_key: indicator.key,
        pillar: indicator.pillar,
        score:
          patch.not_applicable === true
            ? null
            : patch.score !== undefined
              ? patch.score
              : (existing?.score ?? null),
        potential_score:
          patch.not_applicable === true
            ? null
            : patch.potential_score !== undefined
              ? patch.potential_score
              : (existing?.potential_score ?? null),
        not_applicable:
          patch.not_applicable ?? existing?.not_applicable ?? false,
        evidence_confidence:
          patch.evidence_confidence ?? existing?.evidence_confidence ?? "unknown",
        notes: patch.notes !== undefined ? patch.notes : (existing?.notes ?? null),
        created_at: existing?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setScores((p) => ({ ...p, [indicator.key]: next }));
      void runSave(
        () =>
          upsertIndicatorScore({
            assessment_id: assessment.id,
            indicator_key: indicator.key,
            score: next.score,
            potential_score: next.potential_score,
            not_applicable: next.not_applicable,
            evidence_confidence: next.evidence_confidence,
            notes: next.notes,
          }),
        undefined,
        () => setScores(previous)
      );
  }

  /** Plan and session writes are serialised so rapid entry can't interleave. */
  function queueWrite(
    run: () => Promise<ActionResult<{ assessment: CcAssessment }>>
  ) {
      writeQueue.current = writeQueue.current
        .then(() =>
          runSave(run, (data) => data && setAssessment(data.assessment))
        )
      .then(() => undefined)
      .catch(() => undefined);
  }

  function saveSessionNote(id: BlockId, text: string) {
      setAssessment((p) => {
        const notes = parseSessionNotes(p.session_notes);
        return {
          ...p,
          session_notes: {
            ...(notes as Record<string, unknown>),
            blocks: { ...(notes.blocks ?? {}), [id]: text },
          } as CcAssessment["session_notes"],
        };
      });
    queueWrite(() =>
      updateSessionNotes(assessment.id, { blockId: id, notes: text })
    );
  }

  function saveSessionElapsed(id: BlockId, seconds: number) {
    queueWrite(() =>
      updateSessionNotes(assessment.id, { blockId: id, elapsedSeconds: seconds })
    );
  }

  function saveSessionMetric(key: string, value: string) {
    queueWrite(() =>
      updateSessionNotes(assessment.id, { metrics: { [key]: value } })
    );
  }

  function addPlanItem() {
    const item = planDraft.trim();
    if (!item) return;
    setPlanDraft("");
    setAssessment((p) => ({
      ...p,
      plan_items: [...jsonToStrings(p.plan_items), item],
    }));
    queueWrite(() => appendPlanItem(assessment.id, item));
  }

  function removePlanItemAt(item: string, index: number) {
    setAssessment((p) => ({
      ...p,
      plan_items: jsonToStrings(p.plan_items).filter((_, i) => i !== index),
    }));
    queueWrite(() => removePlanItem(assessment.id, item, index));
  }

  function movePlanItem(item: string, index: number, direction: "up" | "down") {
    const to = direction === "up" ? index - 1 : index + 1;
    setAssessment((p) => {
      const items = jsonToStrings(p.plan_items);
      if (to < 0 || to >= items.length) return p;
      const next = [...items];
      next[index] = items[to];
      next[to] = items[index];
      return { ...p, plan_items: next };
    });
    queueWrite(() => reorderPlanItems(assessment.id, item, index, direction));
  }

  function toggleOverlay(key: string) {
    patchAssessment({
      overlay_flags: overlayFlags.includes(key)
        ? overlayFlags.filter((f) => f !== key)
        : [...overlayFlags, key],
    });
  }

  // ── Derived step state ───────────────────────────────────────────────────
  const capturedBlocks = sessionCapturedCount(sessionNotes);
  const constraintFilled = Boolean(assessment.primary_constraint?.trim());

  const statuses: Record<StepId, StepStatus> = {
    setup: assessment.company?.trim() ? "complete" : "partial",
    session:
      capturedBlocks === 0
        ? "empty"
        : capturedBlocks === BLOCK_IDS.length
          ? "complete"
          : "partial",
    scoring:
      resolvedCount === 0
        ? "empty"
        : resolvedCount >= INDICATORS.length
          ? "complete"
          : "partial",
    opportunities: opportunities.length === 0 ? "empty" : "complete",
    constraint: constraintFilled ? "complete" : "empty",
    plan:
      planItems.length === 0
        ? "empty"
        : planItems.length >= 3
          ? "complete"
          : "partial",
    review: assessment.status === "delivered" ? "complete" : "empty",
  };

  const counts: Partial<Record<StepId, string>> = {
    session: `${capturedBlocks}/5`,
    scoring: `${resolvedCount}/30`,
    plan: planItems.length > 0 ? `${planItems.length}` : undefined,
  };

  const remaining = INDICATORS.length - resolvedCount;
  const paceSeconds =
    paceSamples.length >= 3 ? median(paceSamples) : DEFAULT_SECONDS_PER_INDICATOR;
  const minutesLeft = Math.max(1, Math.round((remaining * paceSeconds) / 60));

  const thinPillars = PILLARS.filter((p) => computed.thinPillars[p.key]);

  const inSession = step === "session";
  const meta = STEPS[step];

  return (
    <div className="relative flex flex-col gap-5 p-6">
      {assessment.is_practice && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
        >
          <span className="rotate-[-24deg] select-none text-[9rem] font-black tracking-widest text-[color:var(--color-brand-violet)]/10">
            PRACTICE
          </span>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <Link
            href="/assessments"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Assessments
          </Link>
          <div className="mt-1 flex items-center gap-2.5">
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {assessment.company?.trim() || assessment.client_name}
            </h1>
            {assessment.is_practice && <PracticeBadge />}
          </div>
          <p className="text-sm text-muted-foreground">
            {assessment.company?.trim() ? assessment.client_name : "No company set"}
            {assessment.industry ? ` · ${assessment.industry}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SaveState
            status={saveStatus}
            onRetry={() => lastFailed.current?.()}
          />
          <Select
            value={assessment.status}
            onValueChange={(v) =>
              typeof v === "string" &&
              patchAssessment({ status: v as AssessmentStatus })
            }
          >
            <SelectTrigger
              className={cn("h-9 w-36", STATUS_STYLES[assessment.status])}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            render={<Link href={`/assessments/${assessment.id}/report`} />}
          >
            <FileText className="size-4" /> Executive Blueprint
          </Button>
        </div>
      </header>

      {/*
        The score bar is hidden during Session. The guide's whole reveal depends
        on the owner not seeing a verdict until the Results Session, and this
        screen is often shared or visible across a table.
      */}
      {!inSession && (
        <div className="relative z-10 flex flex-wrap items-center gap-x-7 gap-y-3 rounded-xl bg-[color:var(--color-brand-charcoal)] px-5 py-3.5 ring-1 ring-inset ring-foreground/10">
          <div className="flex items-center gap-3">
            <ProgressRing
              value={resolvedCount}
              total={INDICATORS.length}
              label={`${resolvedCount} of ${INDICATORS.length} indicators resolved`}
            />
            <div>
              <p className="text-[11px] text-muted-foreground">
                of 30 resolved
                {computed.naCount > 0 ? ` · ${computed.naCount} N/A` : ""}
              </p>
              {remaining > 0 && resolvedCount > 0 && (
                <p className="text-[11px] tabular-nums text-muted-foreground/80">
                  ~{minutesLeft} min left at your pace
                </p>
              )}
            </div>
          </div>

          <div className="border-l border-border/60 pl-6">
            <span className="text-3xl font-extrabold tabular-nums text-[color:var(--color-brand-electric)]">
              {computed.creaitScore ?? "—"}
            </span>
            <span className="block text-[11px] font-semibold text-muted-foreground">
              CREAiT Score{computed.band ? ` · ${computed.band}` : ""}
              {computed.provisional ? " · provisional" : ""}
            </span>
          </div>

          {PILLARS.map((p) => {
            const n = computed.pillarScoredCounts[p.key];
            const thin = computed.thinPillars[p.key];
            return (
              <div key={p.key}>
                <span
                  className={cn(
                    "block text-base font-bold tabular-nums",
                    thin && "text-muted-foreground/60"
                  )}
                  title={
                    thin
                      ? `Only ${n} of 10 ${p.label} indicators examined — too few to report as a pillar score`
                      : undefined
                  }
                >
                  {computed.pillars[p.key] ?? "—"}
                  {thin && "*"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {p.label} ({Math.round(p.weight * 100)}%) · {n}/10
                </span>
              </div>
            );
          })}

          <div className="ml-auto text-right">
            <span className="block text-base font-bold tabular-nums text-[color:var(--color-brand-success)]">
              {formatMoney(portfolio.adjExpected)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Expected annual opportunity
            </span>
          </div>
        </div>
      )}

      <div className="relative z-10">
        <SessionStepper
          current={step}
          statuses={statuses}
          counts={counts}
          onSelect={goStep}
        />
      </div>

      <div className="relative z-10 flex flex-col gap-5">
        <StepIntro
          step={meta}
          trailing={
            inSession ? (
              <SaveState status={saveStatus} onRetry={() => lastFailed.current?.()} />
            ) : undefined
          }
        />

        {/* ── Setup ────────────────────────────────────────────────────── */}
        {step === "setup" && (
          <div className="flex max-w-3xl flex-col gap-4">
            <Labelled
              label="Company"
              hint="the business being assessed — this is the report cover line"
            >
              <Input
                defaultValue={assessment.company ?? ""}
                onBlur={(e) => patchAssessment({ company: e.target.value })}
                placeholder="Summit Exterior Services"
              />
            </Labelled>
            <Labelled
              label="Primary contact"
              hint="the person you'll be sitting with"
            >
              <Input
                defaultValue={assessment.client_name}
                onBlur={(e) => {
                  if (e.target.value.trim()) {
                    patchAssessment({ client_name: e.target.value });
                  }
                }}
                placeholder="Dana Brooks"
              />
            </Labelled>
            <Labelled label="Industry">
              <Input
                defaultValue={assessment.industry ?? ""}
                onBlur={(e) => patchAssessment({ industry: e.target.value })}
                placeholder="Property services"
              />
            </Labelled>

            <div className="border-t border-border/60 pt-3">
              <p className="text-[11px] font-medium text-muted-foreground">
                The report will be headed
              </p>
              <p className="mt-1 text-sm font-semibold">
                {assessment.company?.trim()
                  ? `${assessment.company.trim()} · ${assessment.client_name}`
                  : assessment.client_name}
              </p>
            </div>

            {assessment.is_practice && (
              <p className="border-t border-border/60 pt-3 text-[13px] leading-relaxed text-muted-foreground">
                This is a rehearsal engagement. It is excluded from every count,
                the report carries a PRACTICE watermark, and nothing here reaches
                a client. Run one end to end before a paying engagement — it is
                the cheapest way to find out which questions you can&apos;t yet
                ask out loud.
              </p>
            )}
          </div>
        )}

        {/* ── Session ──────────────────────────────────────────────────── */}
        {step === "session" && (
          <SessionStep
            key={block}
            assessment={assessment}
            notes={sessionNotes}
            activeBlock={block}
            onBlockChange={(id) => {
              setBlock(id);
              syncUrl({ step: "session", block: id });
            }}
            onSaveNote={saveSessionNote}
            onSaveElapsed={saveSessionElapsed}
            onSaveMetric={saveSessionMetric}
            onPatchAssessment={(patch) =>
              patchAssessment(patch as AssessmentPatch)
            }
            onFinish={() => goStep("scoring")}
          />
        )}

        {/* ── Scoring ──────────────────────────────────────────────────── */}
        {step === "scoring" && (
          <ScoringStep
            scores={scores}
            computed={computed}
            sessionNotes={sessionNotes}
            focusKey={indicatorKey}
            onFocusChange={(k) => {
              setIndicatorKey(k);
              syncUrl({ step: "scoring", k });
            }}
            onScoreChange={patchScore}
            onContinue={() => goStep("opportunities")}
          />
        )}

        {/* ── Opportunities ────────────────────────────────────────────── */}
        {step === "opportunities" && (
          <OpportunityEditor
            assessmentId={assessment.id}
            opportunities={opportunities}
            overlapFactor={assessment.overlap_factor}
            onOpportunitiesChange={setOpportunities}
            onOverlapChange={(entered) => {
              const normalized = normalizeOverlapFactor(entered);
              if (entered !== "" && Number(entered) !== normalized) {
                toast.error(
                  `Overlap factor must be between 0 and 1 — kept ${normalized}`
                );
              }
              patchAssessment({ overlap_factor: normalized });
            }}
          />
        )}

        {/* ── Constraint ───────────────────────────────────────────────── */}
        {step === "constraint" && (
          <div className="flex flex-col gap-6">
            {assessment.owner_belief?.trim() && (
              <div className="max-w-3xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  They said the bottleneck was
                </p>
                <p className="mt-1.5 text-[15px] leading-snug">
                  &ldquo;{assessment.owner_belief}&rdquo;
                </p>
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  Test your root cause against this. Either it confirms them or
                  it makes theirs a symptom — both land, neither judges.
                </p>
              </div>
            )}

            <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
              <Labelled label="Root constraint" hint="one sentence">
                <Textarea
                  defaultValue={assessment.primary_constraint ?? ""}
                  onBlur={(e) =>
                    patchAssessment({ primary_constraint: e.target.value })
                  }
                  className="min-h-20"
                />
              </Labelled>
              <Labelled label="Symptoms it explains">
                <Textarea
                  defaultValue={assessment.constraint_symptoms ?? ""}
                  onBlur={(e) =>
                    patchAssessment({ constraint_symptoms: e.target.value })
                  }
                  className="min-h-20"
                />
              </Labelled>
              <Labelled label="Annual cost" hint="state the basis">
                <Textarea
                  defaultValue={assessment.constraint_cost ?? ""}
                  onBlur={(e) =>
                    patchAssessment({ constraint_cost: e.target.value })
                  }
                  className="min-h-20"
                />
              </Labelled>
              <Labelled label="First intervention & measurement">
                <Textarea
                  defaultValue={assessment.constraint_fix ?? ""}
                  onBlur={(e) =>
                    patchAssessment({ constraint_fix: e.target.value })
                  }
                  className="min-h-20"
                />
              </Labelled>
              <Labelled
                label="Early Momentum Initiative"
                hint="measurable inside 30 days"
                className="sm:col-span-2"
              >
                <Textarea
                  defaultValue={assessment.momentum_initiative ?? ""}
                  onBlur={(e) =>
                    patchAssessment({ momentum_initiative: e.target.value })
                  }
                  className="min-h-16"
                />
              </Labelled>
            </div>

            <div className="border-t border-border/60 pt-4">
              <h3 className="text-[13px] font-semibold">
                Critical Constraint Overlay
              </h3>
              <p className="mt-1 max-w-[74ch] text-[12px] leading-relaxed text-muted-foreground">
                Flagged regardless of scores — a warning can never be averaged
                away. Any active flag forces &ldquo;Prepare First&rdquo; on
                growth work that depends on the weak foundation.
              </p>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {OVERLAY_FLAGS.map((flag) => {
                  const active = overlayFlags.includes(flag.key);
                  return (
                    <label
                      key={flag.key}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-[13px] transition-colors duration-150 motion-reduce:transition-none",
                        active
                          ? "bg-[color:var(--color-brand-danger)]/10 ring-1 ring-inset ring-[color:var(--color-brand-danger)]/40"
                          : "bg-[color:var(--color-brand-slate)]/40 hover:bg-[color:var(--color-brand-slate)]/70"
                      )}
                    >
                      <Checkbox
                        checked={active}
                        onCheckedChange={() => toggleOverlay(flag.key)}
                        className="mt-0.5"
                      />
                      <span>{flag.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Plan ─────────────────────────────────────────────────────── */}
        {step === "plan" && (
          <div className="max-w-3xl">
            <PlanBuilder
              items={planItems}
              draft={planDraft}
              onDraftChange={setPlanDraft}
              onAdd={addPlanItem}
              onRemove={removePlanItemAt}
              onMove={movePlanItem}
            />
          </div>
        )}

        {/* ── Review ───────────────────────────────────────────────────── */}
        {step === "review" && (
          <div className="flex max-w-3xl flex-col gap-5">
            {!reportReady && (
              <div className="rounded-xl bg-[color:var(--color-brand-warning)]/10 px-5 py-3.5 ring-1 ring-inset ring-[color:var(--color-brand-warning)]/40">
                <p className="text-sm font-semibold">
                  Not ready to deliver — {resolvedCount} of 30 indicators
                  resolved
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Below {MIN_REPORT_RESOLVED} the report reads as an unfinished
                  checklist, and pillar scores drawn from a handful of indicators
                  mislead. Score every indicator or mark it N/A with a reason
                  before this goes to a client.
                </p>
              </div>
            )}

            <div>
              <h3 className="text-[13px] font-semibold">Before you deliver</h3>
              <ul className="mt-2 divide-y divide-border/50">
                {[
                  {
                    ok: resolvedCount >= INDICATORS.length,
                    label: `All 30 indicators resolved (${resolvedCount}/30)`,
                    fix: () => goStep("scoring"),
                  },
                  {
                    ok: thinPillars.length === 0,
                    label:
                      thinPillars.length === 0
                        ? "Every pillar has enough data to report"
                        : `${thinPillars.map((p) => p.label).join(", ")} scored from fewer than ${MIN_PILLAR_SAMPLE} indicators`,
                    fix: () => goStep("scoring"),
                  },
                  {
                    ok: Boolean(assessment.owner_belief?.trim()),
                    label: "Their bottleneck belief captured verbatim",
                    fix: () => goStep("session"),
                  },
                  {
                    ok: opportunities.some((o) => o.include_in_report),
                    label: "At least one priced opportunity in the report",
                    fix: () => goStep("opportunities"),
                  },
                  {
                    ok: constraintFilled,
                    label: "Primary Business Constraint named",
                    fix: () => goStep("constraint"),
                  },
                  {
                    ok: planItems.length >= 3,
                    label: `90-day plan has at least three priorities (${planItems.length})`,
                    fix: () => goStep("plan"),
                  },
                ].map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center gap-3 py-2 text-[13px]"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        row.ok
                          ? "bg-[color:var(--color-brand-success)]"
                          : "bg-[color:var(--color-brand-warning)]"
                      )}
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1",
                        !row.ok && "text-muted-foreground"
                      )}
                    >
                      {row.label}
                    </span>
                    {!row.ok && (
                      <Button size="xs" variant="ghost" onClick={row.fix}>
                        Fix
                      </Button>
                    )}
                    <span className="sr-only">
                      {row.ok ? "complete" : "incomplete"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
              <Button
                render={<Link href={`/assessments/${assessment.id}/report`} />}
              >
                <FileText className="size-4" /> Open the Executive Blueprint
              </Button>
              {assessment.status !== "delivered" && (
                <Button
                  variant="outline"
                  onClick={() => patchAssessment({ status: "delivered" })}
                >
                  Mark delivered
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
