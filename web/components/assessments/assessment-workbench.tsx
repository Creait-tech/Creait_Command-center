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
import { ArrowLeft, FileText, Lock, Presentation } from "lucide-react";
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
  ASSESSMENT_DOCUMENT_KINDS,
  assessmentReadiness,
  computeScores,
  DOCUMENT_KIND_LABELS,
  formatMoney,
  INDICATORS,
  normalizeOverlapFactor,
  OVERLAY_FLAGS,
  PILLARS,
  portfolioTotals,
  toScoreMap,
  type AssessmentDocumentKind,
  type IndicatorDef,
} from "@/lib/assessment-instrument";
import {
  BLOCK_IDS,
  parseSessionNotes,
  sessionCapturedCount,
  type BlockId,
  type CrossCheckId,
  type CrossCheckRecord,
} from "@/lib/assessment-session";
import { intakeProgress } from "@/lib/assessment-intake";
import {
  appendPlanItem,
  listClientsForLink,
  listOrgMembers,
  recordConversion,
  removePlanItem,
  reorderPlanItems,
  setAssessmentDocuments,
  updateAssessment,
  updateSessionNotes,
  upsertIndicatorScore,
  type ActionResult,
  type AssessmentPatch,
} from "@/lib/assessment-actions";
// The same business date the server actions stamp — see lib/business-date.ts.
import { todayInET } from "@/lib/business-date";
import {
  ClientLinkPanel,
  DocumentRowActions,
  DocumentUploadRow,
} from "@/components/assessments/data-room-controls";
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
import { IntakeStep } from "@/components/assessments/intake-step";
import { OutcomesStep } from "@/components/assessments/outcomes-step";
import { ScoringStep } from "@/components/assessments/scoring-step";
import { OpportunityEditor } from "@/components/assessments/opportunity-editor";
import { PlanBuilder } from "@/components/assessments/plan-builder";
import type { IndicatorPatch } from "@/components/assessments/indicator-card";
import type {
  AssessmentDocument,
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

/**
 * The parent-row fields that may still change on a delivered engagement: the
 * release record, the results-session link, and what the engagement became.
 * Mirrors RELEASE_SAFE_FIELDS in assessment-actions and the
 * cc_assessments_lock_delivered_row trigger (0012, extended in 0016).
 */
const RELEASE_SAFE_PATCH = new Set([
  "status",
  "reviewed_by",
  "reviewed_by_id",
  "meeting_id",
  "converted_to",
  "converted_on",
  "converted_client_id",
]);

type ConversionKind = NonNullable<CcAssessment["converted_to"]>;
const CONVERSION_LABELS: Record<ConversionKind, string> = {
  build: "Build",
  advisory: "Advisory",
};

/** Sentinel item values — a Select item cannot carry an empty string. */
const NO_CLIENT = "__none__";
const NO_FACILITATOR = "__none__";

interface LinkableClient {
  id: string;
  name: string;
  company: string | null;
  status: string;
}

/** "Reid Comfort" or "Reid Comfort · Comfort Roofing" — what the picker shows. */
function clientLabel(client: LinkableClient): string {
  const company = client.company?.trim();
  return company && company !== client.name ? `${client.name} · ${company}` : client.name;
}

/**
 * What a delivered Diagnostic became. Lives OUTSIDE the delivered-lock
 * fieldset on purpose: the conversion is recorded after release by
 * definition, and migration 0016 keeps its three columns out of the lock.
 * The follow-through job's $7,500 credit clock reads `converted_to`, so
 * saving "Build" or "Advisory" here is what stops it.
 */
function ConversionPanel({
  assessment,
  onAssessment,
}: {
  assessment: CcAssessment;
  onAssessment: (next: CcAssessment) => void;
}) {
  const [kind, setKind] = useState<ConversionKind | "none">(
    assessment.converted_to ?? "none"
  );
  const [date, setDate] = useState(assessment.converted_on ?? todayInET());
  const [clientId, setClientId] = useState(assessment.converted_client_id ?? "");
  const [clients, setClients] = useState<LinkableClient[] | null>(null);
  const [saving, setSaving] = useState(false);

  // The picker needs the client list; a delivered engagement is the only
  // place it is shown, so the fetch happens here rather than on every load.
  useEffect(() => {
    let cancelled = false;
    void listClientsForLink().then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        toast.error(res.error, { id: "clients-for-link" });
        setClients([]);
        return;
      }
      setClients(res.data?.clients ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty =
    kind !== (assessment.converted_to ?? "none") ||
    (kind !== "none" &&
      (date !== (assessment.converted_on ?? "") ||
        clientId !== (assessment.converted_client_id ?? "")));

  async function save() {
    setSaving(true);
    const res = await recordConversion(assessment.id, {
      converted_to: kind === "none" ? null : kind,
      converted_on: kind === "none" ? null : date || null,
      converted_client_id: kind === "none" ? null : clientId || null,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data) onAssessment(res.data.assessment);
    toast.success(
      kind === "none" ? "Conversion cleared" : `Recorded as ${CONVERSION_LABELS[kind]}`
    );
  }

  const savedClient = clients?.find((c) => c.id === assessment.converted_client_id);
  const savedSentence = assessment.converted_to
    ? `Became ${assessment.converted_to === "build" ? "a Build" : "an Advisory retainer"}${
        savedClient
          ? ` with ${savedClient.name}`
          : assessment.converted_client_id
            ? " with a linked client"
            : ""
      }${
        assessment.converted_on
          ? ` on ${formatDeliveredDate(assessment.converted_on)}`
          : ""
      } · fee credited`
    : null;

  return (
    <section
      aria-label="What happened next"
      className="relative z-10 flex flex-col gap-3 rounded-xl bg-[color:var(--color-brand-slate)]/40 px-5 py-4 ring-1 ring-inset ring-foreground/10"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-[13px] font-semibold">What happened next</h3>
        <span className="text-[11.5px] text-muted-foreground">
          {savedSentence ??
            "No Build or Advisory recorded yet — the $7,500 credit clock is running."}
        </span>
      </div>
      <p className="max-w-[74ch] text-[12px] leading-relaxed text-muted-foreground">
        The Diagnostic fee is credited toward a Build or an Advisory retainer
        inside 60 days. Record it here the day it is agreed — this is what the
        follow-through job reads, so nothing else needs to know.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Labelled label="Became">
          <Select
            value={kind}
            onValueChange={(v) =>
              typeof v === "string" && setKind(v as ConversionKind | "none")
            }
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="build">Build</SelectItem>
              <SelectItem value="advisory">Advisory</SelectItem>
              <SelectItem value="none">Not yet</SelectItem>
            </SelectContent>
          </Select>
        </Labelled>
        {kind !== "none" && (
          <>
            <Labelled label="Agreed on">
              <Input
                type="date"
                className="h-8 w-40 text-xs"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Labelled>
            <Labelled
              label="Client"
              hint={
                clients === null
                  ? "loading…"
                  : clients.length === 0
                    ? "no clients in this workspace yet"
                    : undefined
              }
            >
              <Select
                value={clientId || NO_CLIENT}
                onValueChange={(v) =>
                  typeof v === "string" && setClientId(v === NO_CLIENT ? "" : v)
                }
                disabled={!clients || clients.length === 0}
              >
                <SelectTrigger className="h-8 w-64 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>No client linked</SelectItem>
                  {(clients ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {clientLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Labelled>
          </>
        )}
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}

/** `delivered_at` is a date column ("2026-09-09"); read it as a local day. */
function formatDeliveredDate(d: string): string {
  const date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function jsonToStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

const DOCUMENT_KINDS: AssessmentDocumentKind[] = [...ASSESSMENT_DOCUMENT_KINDS];

/** The stored data-room list, defensively — it is free-form JSON in Postgres. */
function jsonToDocuments(value: unknown): AssessmentDocument[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const kind = typeof row.kind === "string" ? row.kind : "other";
    if (!name) return [];
    // The storage fields ride along untouched: this list is written back
    // whole on every edit, and dropping them here would orphan the files.
    const storagePath =
      typeof row.storage_path === "string" && row.storage_path ? row.storage_path : null;
    return [
      {
        name,
        kind: (DOCUMENT_KINDS as string[]).includes(kind)
          ? (kind as AssessmentDocument["kind"])
          : "other",
        received_on:
          typeof row.received_on === "string" ? row.received_on : null,
        ...(storagePath
          ? {
              storage_path: storagePath,
              content_type:
                typeof row.content_type === "string" ? row.content_type : null,
              size_bytes:
                typeof row.size_bytes === "number" ? row.size_bytes : null,
            }
          : {}),
      },
    ];
  });
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

/**
 * One pillar in the score bar — the present deck's rail at workbench scale.
 *
 * A thin pillar (too few of its ten indicators examined) keeps its asterisk
 * and its explanatory title exactly as before, and gets an empty dashed rail
 * instead of a bar: the workbench, like the report, never draws a number it
 * will not state. A pillar with nothing scored yet reads as a dash.
 */
function PillarMeter({
  label,
  weight,
  score,
  examined,
  thin,
}: {
  label: string;
  weight: number;
  score: number | null;
  examined: number;
  thin: boolean;
}) {
  const readable = score !== null && !thin;
  const title = thin
    ? `Only ${examined} of 10 ${label} indicators examined — too few to report as a pillar score, and excluded from the composite`
    : score === null
      ? `${label}: no indicators scored yet`
      : `${label}: ${score} of 100, from ${examined} of 10 indicators examined`;
  return (
    <div className="min-w-0" title={title}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] font-semibold text-muted-foreground">
          {label}
          <span className="ml-1 font-normal text-muted-foreground/70">
            ({Math.round(weight * 100)}%) · {examined}/10
          </span>
        </span>
        <span
          className={cn(
            "text-base font-bold leading-none tabular-nums",
            readable ? "text-foreground" : "text-muted-foreground/60"
          )}
        >
          {score ?? "—"}
          {thin && "*"}
        </span>
      </div>
      <div
        className={cn(
          "mt-1.5 h-1.5 overflow-hidden rounded-full",
          readable
            ? "bg-[color:var(--color-brand-slate)]"
            : "border border-dashed border-[color:var(--color-brand-fog)]"
        )}
        role="img"
        aria-label={title}
      >
        {readable && (
          <div
            className="h-full rounded-full bg-[color:var(--color-brand-electric)] motion-safe:transition-[width] motion-safe:duration-500"
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        )}
      </div>
    </div>
  );
}

export function AssessmentWorkbench({
  initialAssessment,
  initialScores,
  initialOpportunities,
  initialStep,
  initialBlock,
  initialIndicator,
  currentUserName,
  currentUserId,
}: {
  initialAssessment: CcAssessment;
  initialScores: CcAssessmentScore[];
  initialOpportunities: CcAssessmentOpportunity[];
  initialStep?: string;
  initialBlock?: string;
  initialIndicator?: string;
  /** The signed-in person — the default reviewer on the release. */
  currentUserName: string;
  /**
   * The signed-in person's Clerk user id — held against `facilitator_id` for
   * the second signature (0016). Empty when Clerk cannot name the session.
   */
  currentUserId: string;
}) {
  const [assessment, setAssessment] = useState(initialAssessment);
  // The org roster for the Facilitator picker. null = not loaded yet;
  // [] = Clerk could not list it, so Setup falls back to a typed name.
  const [members, setMembers] = useState<Array<{ id: string; name: string }> | null>(
    null
  );
  const [membersFailed, setMembersFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void listOrgMembers().then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setMembersFailed(true);
        setMembers([]);
        return;
      }
      setMembers(res.data?.members ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [scores, setScores] = useState(() => toScoreMap(initialScores));
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [planDraft, setPlanDraft] = useState("");
  // The person at the keyboard signs this release, not whoever signed the last
  // one — a stored name is only the fallback when Clerk can't name the session.
  const [reviewer, setReviewer] = useState(
    () => currentUserName || initialAssessment.reviewed_by?.trim() || ""
  );
  const [docDraft, setDocDraft] = useState<{
    name: string;
    kind: AssessmentDocumentKind;
  }>({ name: "", kind: "pnl" });

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
  const documents = useMemo(
    () => jsonToDocuments(assessment.documents),
    [assessment.documents]
  );
  const intakeSections = useMemo(
    () => intakeProgress(assessment.intake),
    [assessment.intake]
  );
  /**
   * The same function the server runs at the delivery transition, so the
   * checklist on this screen and the refusal from the server can never
   * disagree about what "ready" means.
   */
  const readiness = useMemo(
    () =>
      assessmentReadiness({
        scores,
        opportunities,
        assessment: {
          primary_constraint: assessment.primary_constraint,
          constraint_cost: assessment.constraint_cost,
          pnl_on_file: assessment.pnl_on_file,
          reviewed_by: reviewer,
          overlay_flags: assessment.overlay_flags,
          overlap_factor: assessment.overlap_factor,
          owner_belief: assessment.owner_belief,
          plan_items: assessment.plan_items,
        },
      }),
    [
      scores,
      opportunities,
      assessment.primary_constraint,
      assessment.constraint_cost,
      assessment.pnl_on_file,
      assessment.overlay_flags,
      assessment.overlap_factor,
      assessment.owner_belief,
      assessment.plan_items,
      reviewer,
    ]
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

  /**
   * A delivered engagement is locked — the client holds a document built from
   * these fields, and migration 0012 refuses any write that would change it.
   * The controls below are disabled while it is, and every write path checks
   * again here so a running timer or a queued save cannot reach the database
   * and come back as a toast that names a table instead of saying what to do.
   * The release record itself (status, reviewer, meeting link) stays writable,
   * which is how "Reopen for edits" works.
   */
  const locked = assessment.status === "delivered";
  function refuseIfLocked(): boolean {
    if (!locked) return false;
    toast.error(
      "This engagement is delivered and locked. Use “Reopen for edits” before changing anything.",
      { id: "delivered-lock" }
    );
    return true;
  }

  function patchAssessment(patch: AssessmentPatch) {
      if (
        Object.keys(patch).some((k) => !RELEASE_SAFE_PATCH.has(k)) &&
        refuseIfLocked()
      ) {
        return;
      }
      const previous = assessment;
      setAssessment((p) => ({ ...p, ...(patch as Partial<CcAssessment>) }));
      void runSave(
        () => updateAssessment(assessment.id, patch),
        (data) => data && setAssessment(data.assessment),
        () => setAssessment(previous)
      );
  }

  function patchScore(indicator: IndicatorDef, patch: IndicatorPatch) {
      if (refuseIfLocked()) return;
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
      if (refuseIfLocked()) return;
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

  function saveSessionCrossCheck(id: CrossCheckId, record: CrossCheckRecord) {
    setAssessment((p) => {
      const notes = parseSessionNotes(p.session_notes);
      return {
        ...p,
        session_notes: {
          ...(notes as Record<string, unknown>),
          crossChecks: { ...(notes.crossChecks ?? {}), [id]: record },
        } as unknown as CcAssessment["session_notes"],
      };
    });
    queueWrite(() =>
      updateSessionNotes(assessment.id, { crossChecks: { [id]: record } })
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

  /** The data room: whether we hold a P&L, and what else came in. */
  function saveDocuments(next: {
    pnl_on_file?: boolean;
    documents?: AssessmentDocument[];
  }) {
    if (refuseIfLocked()) return;
    const previous = assessment;
    setAssessment((p) => ({
      ...p,
      ...(next.pnl_on_file !== undefined
        ? { pnl_on_file: next.pnl_on_file }
        : {}),
      ...(next.documents !== undefined
        ? { documents: next.documents as unknown as CcAssessment["documents"] }
        : {}),
    }));
    void runSave(
      () => setAssessmentDocuments(assessment.id, next),
      (data) => data && setAssessment(data.assessment),
      () => setAssessment(previous)
    );
  }

  function addDocument() {
    const name = docDraft.name.trim();
    if (!name) return;
    setDocDraft({ name: "", kind: docDraft.kind });
    saveDocuments({
      documents: [...documents, { name, kind: docDraft.kind, received_on: null }],
    });
  }

  function toggleOverlay(key: string) {
    patchAssessment({
      overlay_flags: overlayFlags.includes(key)
        ? overlayFlags.filter((f) => f !== key)
        : [...overlayFlags, key],
    });
  }

  /**
   * The second signature, judged here with the same rule the server applies
   * in deliveryGate so the button and the refusal never disagree. A practice
   * engagement is exempt; a real one needs a recorded facilitator who is not
   * the person at the keyboard.
   */
  const secondSignatureBlock: string | null = assessment.is_practice
    ? null
    : !assessment.facilitator_id
      ? "Record who facilitated this engagement in Setup before releasing it — a real engagement needs a second signature."
      : currentUserId && assessment.facilitator_id === currentUserId
        ? "You facilitated this engagement, so you can't release it. Ask another founder to review and release."
        : null;

  // ── Derived step state ───────────────────────────────────────────────────
  const capturedBlocks = sessionCapturedCount(sessionNotes);
  const constraintFilled = Boolean(assessment.primary_constraint?.trim());

  // Intake progress counts a deliberate "not currently known" as answered —
  // it is an answer, and the instrument never scores it as zero.
  const intakeDone = intakeSections.reduce((sum, s) => sum + s.done, 0);
  const intakeTotal = intakeSections.reduce((sum, s) => sum + s.total, 0);

  const statuses: Record<StepId, StepStatus> = {
    setup: assessment.company?.trim() ? "complete" : "partial",
    intake: assessment.intake_submitted_at
      ? "complete"
      : intakeDone > 0 || assessment.intake_token
        ? "partial"
        : "empty",
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
    intake: intakeDone > 0 ? `${intakeDone}/${intakeTotal}` : undefined,
    session: `${capturedBlocks}/5`,
    scoring: `${resolvedCount}/30`,
    plan: planItems.length > 0 ? `${planItems.length}` : undefined,
  };

  const remaining = INDICATORS.length - resolvedCount;
  const paceSeconds =
    paceSamples.length >= 3 ? median(paceSamples) : DEFAULT_SECONDS_PER_INDICATOR;
  const minutesLeft = Math.max(1, Math.round((remaining * paceSeconds) / 60));

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
            variant="outline"
            render={<Link href={`/assessments/${assessment.id}/present`} />}
            title="Full-screen frames for the results session: score, pillars, the mirror, what it's worth, the 90 days"
          >
            <Presentation className="size-4" /> Present
          </Button>
          <Button
            size="sm"
            render={<Link href={`/assessments/${assessment.id}/report`} />}
          >
            <FileText className="size-4" /> Executive Blueprint
          </Button>
        </div>
      </header>

      {locked && (
        <div
          role="status"
          className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-[color:var(--color-brand-warning)]/10 px-5 py-3 ring-1 ring-inset ring-[color:var(--color-brand-warning)]/40"
        >
          <Lock
            aria-hidden
            className="size-4 shrink-0 text-[color:var(--color-brand-warning)]"
          />
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed">
            <span className="font-semibold">
              Delivered
              {assessment.delivered_at
                ? ` ${formatDeliveredDate(assessment.delivered_at)}`
                : ""}
              {assessment.reviewed_by
                ? `, released by ${assessment.reviewed_by}`
                : ""}
              .
            </span>{" "}
            The client holds this version, so scores, session notes,
            opportunities, the constraint and the plan are locked. Day-30 and
            day-90 reviews stay open under Review.
          </p>
          <Button
            size="sm"
            variant="outline"
            title="Moves the engagement back to Review. The reviewer sign-off is cleared; the delivered snapshot is kept as history."
            onClick={() => patchAssessment({ status: "review" })}
          >
            Reopen for edits
          </Button>
        </div>
      )}

      {/* What the engagement became. Outside the locked fieldset by design —
          the conversion is recorded after release, and stays editable. */}
      {locked && (
        <ConversionPanel assessment={assessment} onAssessment={setAssessment} />
      )}

      {/*
        The score bar is hidden during Session. The guide's whole reveal depends
        on the owner not seeing a verdict until the Results Session, and this
        screen is often shared or visible across a table.
      */}
      {!inSession && (
        <div className="relative z-10 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl bg-[color:var(--color-brand-charcoal)] px-5 py-4 ring-1 ring-inset ring-foreground/10">
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

          {/* Hero number + band, the deck's "Where you are" frame in miniature. */}
          <div
            className="flex items-end gap-3 border-l border-border/60 pl-6"
            title={
              computed.creaitScore === null
                ? "No composite yet — score indicators to state one"
                : `CREAiT Score ${computed.creaitScore} of 100, built on ${computed.scoredCount} of ${INDICATORS.length} indicators`
            }
          >
            <span
              className={cn(
                "text-[44px] font-extrabold leading-none tracking-tight tabular-nums",
                computed.creaitScore === null
                  ? "text-muted-foreground/60"
                  : "text-foreground"
              )}
            >
              {computed.creaitScore ?? "—"}
            </span>
            <div className="pb-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                CREAiT Score
              </p>
              <p
                className={cn(
                  "text-sm font-bold leading-tight",
                  computed.band
                    ? "text-[color:var(--color-brand-electric-glow)]"
                    : "text-muted-foreground"
                )}
              >
                {computed.band ?? "Not yet scored"}
                {computed.provisional && (
                  <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">
                    provisional
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Three pillar rails. Takes the remaining width; wraps under on a narrow window. */}
          <div className="grid min-w-0 flex-1 basis-[340px] grid-cols-3 gap-x-5 gap-y-2">
            {PILLARS.map((p) => (
              <PillarMeter
                key={p.key}
                label={p.label}
                weight={p.weight}
                score={computed.pillars[p.key]}
                examined={computed.pillarScoredCounts[p.key]}
                thin={computed.thinPillars[p.key]}
              />
            ))}
          </div>

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

        {/* Every editing control from Setup through Plan sits inside one
            fieldset: `disabled` on a fieldset disables each descendant input,
            textarea, select and button in one place, so a delivered engagement
            reads as the record it is instead of a form that refuses. */}
        <fieldset
          disabled={locked}
          aria-disabled={locked}
          className="contents"
        >
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

            {/* The second signature (0016): who ran the engagement is recorded
                here so that the release can be held against it. Defaults to
                whoever created the engagement. */}
            <Labelled
              label="Facilitator"
              hint={
                assessment.is_practice
                  ? "who is running this rehearsal"
                  : "who runs the engagement — someone else must release it"
              }
              className="max-w-sm"
            >
              {membersFailed ? (
                <Input
                  defaultValue={assessment.facilitator_name ?? ""}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    // The team list could not be loaded, so the name is
                    // recorded against the stored facilitator id — or you,
                    // when none is stored. Clearing the name clears both.
                    patchAssessment({
                      facilitator_id: name
                        ? assessment.facilitator_id || currentUserId || null
                        : null,
                      facilitator_name: name || null,
                    });
                  }}
                  placeholder="Maurice Grant"
                />
              ) : (
                <Select
                  value={assessment.facilitator_id ?? NO_FACILITATOR}
                  onValueChange={(v) => {
                    if (typeof v !== "string") return;
                    if (v === NO_FACILITATOR) {
                      patchAssessment({ facilitator_id: null, facilitator_name: null });
                      return;
                    }
                    const member = members?.find((m) => m.id === v);
                    if (!member) return;
                    patchAssessment({
                      facilitator_id: member.id,
                      facilitator_name: member.name,
                    });
                  }}
                  disabled={members === null}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_FACILITATOR}>Not recorded</SelectItem>
                    {(members ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                        {m.id === currentUserId ? " (you)" : ""}
                      </SelectItem>
                    ))}
                    {/* A stored facilitator who has since left the org still
                        needs to render, or the select would show blank. */}
                    {assessment.facilitator_id &&
                      !(members ?? []).some((m) => m.id === assessment.facilitator_id) && (
                        <SelectItem value={assessment.facilitator_id}>
                          {assessment.facilitator_name ?? assessment.facilitator_id}
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              )}
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

        {/* ── Intake ───────────────────────────────────────────────────── */}
        {step === "intake" && (
          <IntakeStep assessment={assessment} onAssessment={setAssessment} />
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
            onSaveCrossCheck={saveSessionCrossCheck}
            onPatchAssessment={(patch) =>
              patchAssessment(patch as AssessmentPatch)
            }
            onAssessment={setAssessment}
            onFinish={() => goStep("scoring")}
          />
        )}

        {/* ── Scoring ──────────────────────────────────────────────────── */}
        {step === "scoring" && (
          <ScoringStep
            assessmentId={assessment.id}
            onAssessment={setAssessment}
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
            baseline={{
              annualRevenue: assessment.annual_revenue,
              grossMarginPct: assessment.gross_margin,
              operatingProfit: assessment.operating_profit,
            }}
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
        </fieldset>

        {/* ── Review ───────────────────────────────────────────────────── */}
        {step === "review" && (
          <div className="flex max-w-3xl flex-col gap-5">
            {/* The release gate. Blockers are refusals — the server runs this
                same function and will not accept "delivered" while any stand.
                Warnings are things a reviewer must have a reason for. */}
            <div>
              <h3 className="text-[13px] font-semibold">
                Release gate
                <span className="ml-2 font-normal text-muted-foreground">
                  {readiness.ready
                    ? "clear — this can be delivered"
                    : `${readiness.blockers.length} blocker${readiness.blockers.length === 1 ? "" : "s"}`}
                </span>
              </h3>

              {readiness.blockers.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {readiness.blockers.map((b) => (
                    <li
                      key={b}
                      className="flex gap-2.5 rounded-lg bg-[color:var(--color-brand-danger)]/10 px-3.5 py-2 text-[12.5px] leading-relaxed ring-1 ring-inset ring-[color:var(--color-brand-danger)]/30"
                    >
                      <span
                        aria-hidden
                        className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[color:var(--color-brand-danger)]"
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {readiness.warnings.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {readiness.warnings.map((w) => (
                    <li
                      key={w}
                      className="flex gap-2.5 rounded-lg bg-[color:var(--color-brand-warning)]/10 px-3.5 py-2 text-[12.5px] leading-relaxed text-muted-foreground ring-1 ring-inset ring-[color:var(--color-brand-warning)]/30"
                    >
                      <span
                        aria-hidden
                        className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[color:var(--color-brand-warning)]"
                      />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* The data room. "We have the P&L" is the one fact that decides
                whether the report prints the unaudited-figures disclosure and
                widens Reported-only ranges, so it is a deliberate tick. Both
                it and the reviewer name are part of the delivered document,
                so they lock with it. */}
            <fieldset
              disabled={locked}
              aria-disabled={locked}
              className="contents"
            >
            <div className="border-t border-border/60 pt-4">
              <h3 className="text-[13px] font-semibold">Documents on file</h3>
              <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 text-[13px]">
                <Checkbox
                  checked={assessment.pnl_on_file}
                  onCheckedChange={(c) =>
                    saveDocuments({ pnl_on_file: c === true })
                  }
                  className="mt-0.5"
                />
                <span>
                  P&amp;L on file
                  <span className="ml-1.5 text-muted-foreground">
                    without it the report discloses that Profit findings rest on
                    unaudited owner figures, and Reported-only ranges widen ±25%
                  </span>
                </span>
              </label>

              {documents.length > 0 && (
                <ul className="mt-3 divide-y divide-border/50">
                  {documents.map((doc, i) => (
                    <li
                      key={`${i}-${doc.name}`}
                      className="flex items-center gap-3 py-1.5 text-[12.5px]"
                    >
                      <span className="min-w-0 flex-1 truncate">{doc.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {DOCUMENT_KIND_LABELS[doc.kind]}
                      </span>
                      {doc.received_on && (
                        <span className="shrink-0 tabular-nums text-muted-foreground/70">
                          {doc.received_on}
                        </span>
                      )}
                      <DocumentRowActions
                        assessmentId={assessment.id}
                        doc={doc}
                        disabled={locked}
                        onRemoveLogged={() =>
                          saveDocuments({
                            documents: documents.filter((_, x) => x !== i),
                          })
                        }
                        onAssessment={setAssessment}
                      />
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Input
                  value={docDraft.name}
                  onChange={(e) =>
                    setDocDraft((p) => ({ ...p, name: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDocument();
                    }
                  }}
                  placeholder="e.g. 2025–2026 P&L (24 months)"
                  aria-label="Document name"
                  className="h-8 w-64 text-xs"
                />
                <Select
                  value={docDraft.kind}
                  onValueChange={(v) =>
                    typeof v === "string" &&
                    setDocDraft((p) => ({
                      ...p,
                      kind: v as AssessmentDocumentKind,
                    }))
                  }
                >
                  <SelectTrigger className="h-8 w-44 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {DOCUMENT_KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={addDocument}>
                  Log without a file
                </Button>
                <DocumentUploadRow
                  assessmentId={assessment.id}
                  kind={docDraft.kind}
                  disabled={locked}
                  onAssessment={setAssessment}
                  label={`Upload ${DOCUMENT_KIND_LABELS[docDraft.kind]}`}
                />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
                Upload the file itself where you can — &ldquo;on file&rdquo; then means a
                file, and the report&apos;s evidence claims rest on something a
                reviewer can open. Logging without a file is for documents you
                saw on screen but were not sent.
              </p>
            </div>

            <div className="border-t border-border/60 pt-4">
              <Labelled
                label="Reviewer"
                hint="the name recorded on the release — defaults to you"
                className="max-w-sm"
              >
                <Input
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  onBlur={() =>
                    patchAssessment({ reviewed_by: reviewer.trim() || null })
                  }
                  placeholder="Maurice Grant"
                />
              </Labelled>
              <p className="mt-2 max-w-[74ch] text-[12px] leading-relaxed text-muted-foreground">
                {assessment.is_practice
                  ? "A rehearsal can be released by whoever ran it."
                  : "A real engagement needs a second signature: the person who releases it must be a different founder from the one who facilitated it."}{" "}
                Facilitated by{" "}
                <span className="font-medium text-foreground">
                  {assessment.facilitator_name?.trim() ||
                    (assessment.facilitator_id ? assessment.facilitator_id : "nobody yet")}
                </span>
                {assessment.facilitator_id &&
                assessment.facilitator_id === currentUserId
                  ? " — that's you."
                  : "."}
                {!assessment.facilitator_id && !assessment.is_practice
                  ? " Record the facilitator in Setup before releasing."
                  : ""}
              </p>
              {assessment.reviewed_at && (
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  {`Released by ${assessment.reviewed_by ?? "—"} on ${new Date(
                    assessment.reviewed_at
                  ).toLocaleString("en-US")}.`}
                </p>
              )}
            </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
              <Button
                render={<Link href={`/assessments/${assessment.id}/report`} />}
              >
                <FileText className="size-4" /> Open the Executive Blueprint
              </Button>
              <Button
                variant="outline"
                render={<Link href={`/assessments/${assessment.id}/present`} />}
              >
                <Presentation className="size-4" /> Present on screen
              </Button>
              {assessment.status !== "delivered" && (
                <Button
                  variant="outline"
                  disabled={!readiness.ready || secondSignatureBlock !== null}
                  title={
                    secondSignatureBlock ??
                    (readiness.ready
                      ? "Records the reviewer and snapshots exactly what was released"
                      : readiness.blockers[0])
                  }
                  onClick={() =>
                    patchAssessment({
                      status: "delivered",
                      reviewed_by: reviewer.trim() || null,
                    })
                  }
                >
                  Mark delivered
                </Button>
              )}
            </div>

            {/* Follow-through appears only once the client has the document —
                before that there is nothing to review against, and it would
                read as part of the release gate rather than after it. */}
            {assessment.status === "delivered" && (
              <>
                <ClientLinkPanel
                  assessment={assessment}
                  onAssessment={setAssessment}
                />
                <OutcomesStep
                  assessment={assessment}
                  planItems={planItems}
                  currentUserName={currentUserName}
                  onAssessment={setAssessment}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
