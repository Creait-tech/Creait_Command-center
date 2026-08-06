"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  formatPayback,
  INDICATORS_BY_PILLAR,
  MIN_PILLAR_SAMPLE,
  MIN_REPORT_RESOLVED,
  normalizeOverlapFactor,
  OVERLAY_FLAGS,
  paybackMonths,
  PILLARS,
  portfolioTotals,
  rangeOrderIssue,
  SCALE_LABELS,
  toScoreMap,
  type IndicatorDef,
} from "@/lib/assessment-instrument";
import {
  appendPlanItem,
  deleteOpportunity,
  removePlanItem,
  saveOpportunity,
  setOpportunityIncluded,
  updateAssessment,
  upsertIndicatorScore,
  type ActionResult,
  type AssessmentPatch,
} from "@/lib/assessment-actions";
import {
  PracticeBadge,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/components/assessments/assessments-view";
import type {
  AssessmentStatus,
  CcAssessment,
  CcAssessmentOpportunity,
  CcAssessmentScore,
  EvidenceConfidence,
  OpportunityConfidence,
} from "@/lib/supabase/types";

const STATUS_OPTIONS: AssessmentStatus[] = [
  "practice",
  "intake",
  "scoring",
  "review",
  "delivered",
];

const EVIDENCE_OPTIONS: Array<{ value: EvidenceConfidence; label: string }> = [
  { value: "unknown", label: "—" },
  { value: "reported", label: "R · Reported" },
  { value: "demonstrated", label: "D · Demonstrated" },
  { value: "documented", label: "Doc · Documented" },
];

const CONFIDENCE_OPTIONS: Array<{ value: OpportunityConfidence; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function jsonToStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

// ---------------------------------------------------------------------------
// Indicator row — anchors visible, 0–4 + N/A, evidence, note
// ---------------------------------------------------------------------------
function IndicatorRow({
  indicator,
  row,
  onChange,
}: {
  indicator: IndicatorDef;
  row: CcAssessmentScore | undefined;
  onChange: (patch: {
    score?: number | null;
    not_applicable?: boolean;
    evidence_confidence?: EvidenceConfidence;
    notes?: string | null;
  }) => void;
}) {
  const [note, setNote] = useState(row?.notes ?? "");
  const score = row?.not_applicable ? null : row?.score ?? null;
  const isNa = row?.not_applicable ?? false;
  const evidence = row?.evidence_confidence ?? "unknown";

  return (
    <div className="rounded-lg border border-[color:var(--color-brand-fog)]/50 bg-[color:var(--color-brand-slate)]/20 p-3 space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold">
          <span className="text-muted-foreground font-mono text-xs mr-1.5">
            {indicator.key}
          </span>
          {indicator.label}
        </p>
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              title={SCALE_LABELS[n]}
              onClick={() => onChange({ score: n, not_applicable: false })}
              className={cn(
                "size-7 rounded-md text-xs font-semibold tabular-nums transition-colors",
                !isNa && score === n
                  ? "bg-[color:var(--color-brand-electric)] text-white"
                  : "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)] hover:bg-[color:var(--color-brand-fog)]/70"
              )}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            title="Not applicable — removed from the denominator"
            onClick={() => onChange({ score: null, not_applicable: !isNa })}
            className={cn(
              "h-7 rounded-md px-2 text-xs font-semibold transition-colors",
              isNa
                ? "bg-[color:var(--color-brand-warning)]/80 text-black"
                : "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)] hover:bg-[color:var(--color-brand-fog)]/70"
            )}
          >
            N/A
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] leading-snug text-muted-foreground">
        <p>
          <span className="font-semibold text-[color:var(--color-brand-danger)]">
            0 · Absent —
          </span>{" "}
          {indicator.anchor0}
        </p>
        <p>
          <span className="font-semibold text-[color:var(--color-brand-warning)]">
            2 · Developing —
          </span>{" "}
          {indicator.anchor2}
        </p>
        <p>
          <span className="font-semibold text-[color:var(--color-brand-success)]">
            4 · Scalable —
          </span>{" "}
          {indicator.anchor4}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="sm:w-48 shrink-0">
          <Select
            value={evidence}
            onValueChange={(v) =>
              typeof v === "string" &&
              onChange({ evidence_confidence: v as EvidenceConfidence })
            }
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder="Evidence">
                {(value: unknown) =>
                  EVIDENCE_OPTIONS.find((o) => o.value === value)?.label ??
                  "Evidence"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EVIDENCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if ((row?.notes ?? "") !== note) onChange({ notes: note });
          }}
          placeholder="Evidence note (shown in the report appendix)"
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Opportunity dialog (add / edit)
// ---------------------------------------------------------------------------
interface OppForm {
  title: string;
  finding: string;
  annual_low: string;
  annual_expected: string;
  annual_high: string;
  fix_cost: string;
  months_to_benefit: string;
  confidence: OpportunityConfidence;
}

const EMPTY_OPP: OppForm = {
  title: "",
  finding: "",
  annual_low: "",
  annual_expected: "",
  annual_high: "",
  fix_cost: "",
  months_to_benefit: "",
  confidence: "medium",
};

function toOppForm(o: CcAssessmentOpportunity): OppForm {
  return {
    title: o.title,
    finding: o.finding ?? "",
    annual_low: o.annual_low !== null ? String(o.annual_low) : "",
    annual_expected: o.annual_expected !== null ? String(o.annual_expected) : "",
    annual_high: o.annual_high !== null ? String(o.annual_high) : "",
    fix_cost: o.fix_cost !== null ? String(o.fix_cost) : "",
    months_to_benefit:
      o.months_to_benefit !== null ? String(o.months_to_benefit) : "",
    confidence: o.confidence,
  };
}

function OpportunityDialog({
  assessmentId,
  editing,
  nextRank,
  open,
  onOpenChange,
  onSaved,
}: {
  assessmentId: string;
  editing: CcAssessmentOpportunity | null;
  nextRank: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (o: CcAssessmentOpportunity) => void;
}) {
  const [form, setForm] = useState<OppForm>(
    editing ? toOppForm(editing) : EMPTY_OPP
  );
  const [submitting, setSubmitting] = useState(false);
  const [lastEditingId, setLastEditingId] = useState<string | null>(
    editing?.id ?? null
  );

  // Re-sync the form when a different row is opened.
  if ((editing?.id ?? null) !== lastEditingId) {
    setLastEditingId(editing?.id ?? null);
    setForm(editing ? toOppForm(editing) : EMPTY_OPP);
  }

  const previewPayback = paybackMonths(
    form.fix_cost.trim() ? Number(form.fix_cost) : null,
    form.annual_expected.trim() ? Number(form.annual_expected) : null
  );

  function set<K extends keyof OppForm>(k: K, v: OppForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title required");
      return;
    }
    setSubmitting(true);
    const res = await saveOpportunity({
      id: editing?.id,
      assessment_id: assessmentId,
      title: form.title,
      finding: form.finding,
      annual_low: form.annual_low,
      annual_expected: form.annual_expected,
      annual_high: form.annual_high,
      fix_cost: form.fix_cost,
      months_to_benefit: form.months_to_benefit,
      confidence: form.confidence,
      rank: editing?.rank ?? nextRank,
      include_in_report: editing?.include_in_report ?? true,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onSaved(res.data!.opportunity);
    onOpenChange(false);
    if (!editing) setForm(EMPTY_OPP);
    toast.success(editing ? "Opportunity updated" : "Opportunity added");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit opportunity" : "Add opportunity"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Initiative *
            </label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Speed-to-quote + follow-up engine"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Finding &amp; basis (the math you can defend)
            </label>
            <Textarea
              value={form.finding}
              onChange={(e) => set("finding", e.target.value)}
              className="min-h-16"
              placeholder="What the evidence shows, and the basis for the numbers below…"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Annual low $
              </label>
              <Input
                type="number"
                value={form.annual_low}
                onChange={(e) => set("annual_low", e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Expected $
              </label>
              <Input
                type="number"
                value={form.annual_expected}
                onChange={(e) => set("annual_expected", e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Annual high $
              </label>
              <Input
                type="number"
                value={form.annual_high}
                onChange={(e) => set("annual_high", e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Fix cost $
              </label>
              <Input
                type="number"
                value={form.fix_cost}
                onChange={(e) => set("fix_cost", e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Months to benefit
              </label>
              <Input
                type="number"
                value={form.months_to_benefit}
                onChange={(e) => set("months_to_benefit", e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Confidence
              </label>
              <Select
                value={form.confidence}
                onValueChange={(v) =>
                  typeof v === "string" &&
                  set("confidence", v as OpportunityConfidence)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONFIDENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Payback (fix cost ÷ expected monthly recovery):{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {formatPayback(previewPayback)}
            </span>
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !form.title.trim()}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Workbench
// ---------------------------------------------------------------------------
export function AssessmentWorkbench({
  initialAssessment,
  initialScores,
  initialOpportunities,
}: {
  initialAssessment: CcAssessment;
  initialScores: CcAssessmentScore[];
  initialOpportunities: CcAssessmentOpportunity[];
}) {
  const [assessment, setAssessment] = useState(initialAssessment);
  const [scores, setScores] = useState(() => toScoreMap(initialScores));
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [oppDialogOpen, setOppDialogOpen] = useState(false);
  const [editingOppId, setEditingOppId] = useState<string | null>(null);
  const [planDraft, setPlanDraft] = useState("");
  const planQueue = useRef<Promise<void>>(Promise.resolve());
  /**
   * Plan writes in flight. While this is non-zero a full assessment row coming
   * back from an unrelated field save is stale with respect to plan_items, so
   * the local list is kept rather than snapping back and losing the item the
   * advisor just typed.
   */
  const pendingPlanWrites = useRef(0);
  /**
   * One write chain per indicator. Clicking 0 then 4 quickly fires two
   * upserts; without serialization the network can deliver them out of order
   * and the row ends up holding 0 while the workbench shows 4 — a silent
   * disagreement between the screen and the printed report.
   */
  const scoreQueues = useRef(new Map<string, Promise<void>>());

  const computed = useMemo(() => computeScores(scores), [scores]);
  const resolvedCount = computed.resolvedCount;
  const reportReady = resolvedCount >= MIN_REPORT_RESOLVED;
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
  const editingOpp =
    opportunities.find((o) => o.id === editingOppId) ?? null;

  /**
   * Optimistic assessment-field save.
   *
   * Rollback restores only the keys this patch touched. Restoring the whole
   * previous row would wipe out edits the advisor made to other fields while
   * this request was in flight.
   */
  async function patchAssessment(patch: AssessmentPatch) {
    const keys = Object.keys(patch) as Array<keyof CcAssessment>;
    const previousValues = Object.fromEntries(
      keys.map((k) => [k, assessment[k]])
    ) as Partial<CcAssessment>;

    setAssessment((p) => ({ ...p, ...(patch as Partial<CcAssessment>) }));
    const res = await updateAssessment(assessment.id, patch);
    if (!res.ok) {
      setAssessment((p) => ({ ...p, ...previousValues }));
      toast.error(res.error);
      return;
    }
    // The server row is authoritative for everything except a plan list that
    // has writes still in flight — that copy is stale by construction.
    const row = res.data!.assessment;
    setAssessment((p) =>
      pendingPlanWrites.current > 0 ? { ...row, plan_items: p.plan_items } : row
    );
  }

  /**
   * Optimistic indicator save, serialized per indicator so the last click
   * always wins in the database too. Rollback restores only this indicator.
   */
  function patchScore(
    indicator: IndicatorDef,
    patch: {
      score?: number | null;
      not_applicable?: boolean;
      evidence_confidence?: EvidenceConfidence;
      notes?: string | null;
    }
  ) {
    const previous = scores[indicator.key];
    const next: CcAssessmentScore = {
      id: previous?.id ?? `optimistic-${indicator.key}`,
      assessment_id: assessment.id,
      indicator_key: indicator.key,
      pillar: indicator.pillar,
      score:
        patch.not_applicable === true
          ? null
          : patch.score !== undefined
            ? patch.score
            : previous?.score ?? null,
      not_applicable: patch.not_applicable ?? previous?.not_applicable ?? false,
      evidence_confidence:
        patch.evidence_confidence ?? previous?.evidence_confidence ?? "unknown",
      notes: patch.notes !== undefined ? patch.notes : previous?.notes ?? null,
      created_at: previous?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Merge functionally so a save on another indicator can't be clobbered.
    setScores((p) => ({ ...p, [indicator.key]: next }));

    const prior = scoreQueues.current.get(indicator.key) ?? Promise.resolve();
    const chained = prior
      .then(async () => {
        const res = await upsertIndicatorScore({
          assessment_id: assessment.id,
          indicator_key: indicator.key,
          score: next.score,
          not_applicable: next.not_applicable,
          evidence_confidence: next.evidence_confidence,
          notes: next.notes,
        });
        if (!res.ok) {
          setScores((p) => {
            const revert = { ...p };
            if (previous) revert[indicator.key] = previous;
            else delete revert[indicator.key];
            return revert;
          });
          toast.error(res.error);
        }
      })
      .catch(() => {
        toast.error(`Could not save ${indicator.key}`);
      })
      .finally(() => {
        if (scoreQueues.current.get(indicator.key) === chained) {
          scoreQueues.current.delete(indicator.key);
        }
      });
    scoreQueues.current.set(indicator.key, chained);
  }

  /**
   * Only the include flag is written. Re-sending the whole row from client
   * state let a stale browser copy overwrite figures saved elsewhere.
   */
  async function toggleOppIncluded(
    opp: CcAssessmentOpportunity,
    include: boolean
  ) {
    setOpportunities((p) =>
      p.map((x) => (x.id === opp.id ? { ...x, include_in_report: include } : x))
    );
    const res = await setOpportunityIncluded(opp.id, assessment.id, include);
    if (!res.ok) {
      setOpportunities((p) =>
        p.map((x) =>
          x.id === opp.id ? { ...x, include_in_report: !include } : x
        )
      );
      toast.error(res.error);
      return;
    }
    setOpportunities((p) =>
      p.map((x) => (x.id === opp.id ? res.data!.opportunity : x))
    );
  }

  async function handleDeleteOpp(opp: CcAssessmentOpportunity) {
    if (!window.confirm(`Delete "${opp.title}"?`)) return;
    const res = await deleteOpportunity(opp.id, assessment.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setOpportunities((p) => p.filter((o) => o.id !== opp.id));
    toast.success("Opportunity deleted");
  }

  function toggleOverlay(key: string) {
    const next = overlayFlags.includes(key)
      ? overlayFlags.filter((f) => f !== key)
      : [...overlayFlags, key];
    void patchAssessment({ overlay_flags: next });
  }

  /**
   * Plan writes are queued so rapid entry can't interleave: each mutation
   * waits for the previous one, and the server mutates the stored array under
   * a row lock rather than trusting a client snapshot.
   *
   * The returned row is only adopted once the queue has drained. Adopting it
   * mid-queue would replay an intermediate list and make items the advisor has
   * already typed vanish and reappear.
   */
  function queuePlanWrite(
    run: () => Promise<ActionResult<{ assessment: CcAssessment }>>,
    rollback: (items: string[]) => string[]
  ) {
    pendingPlanWrites.current += 1;
    const revert = () =>
      setAssessment((p) => ({
        ...p,
        plan_items: rollback(jsonToStrings(p.plan_items)),
      }));
    planQueue.current = planQueue.current
      .then(async () => {
        const res = await run();
        if (!res.ok) {
          revert();
          toast.error(res.error);
          return;
        }
        if (pendingPlanWrites.current <= 1) {
          setAssessment(res.data!.assessment);
        }
      })
      .catch(() => {
        revert();
        toast.error("Could not save the plan item");
      })
      .finally(() => {
        pendingPlanWrites.current = Math.max(0, pendingPlanWrites.current - 1);
      });
  }

  function addPlanItem() {
    const item = planDraft.trim();
    if (!item) return;
    setPlanDraft("");
    setAssessment((p) => ({
      ...p,
      plan_items: [...jsonToStrings(p.plan_items), item],
    }));
    queuePlanWrite(
      () => appendPlanItem(assessment.id, item),
      // Failed append: drop the last copy of the item we optimistically added.
      (items) => {
        const at = items.lastIndexOf(item);
        return at === -1 ? items : items.filter((_, i) => i !== at);
      }
    );
  }

  function removePlanItemAt(item: string, index: number) {
    setAssessment((p) => ({
      ...p,
      plan_items: jsonToStrings(p.plan_items).filter((_, i) => i !== index),
    }));
    queuePlanWrite(
      () => removePlanItem(assessment.id, item, index),
      // Failed removal: put it back where it was.
      (items) => {
        const restored = [...items];
        restored.splice(Math.min(Math.max(index, 0), restored.length), 0, item);
        return restored;
      }
    );
  }

  return (
    <div className="relative flex flex-col gap-5 p-6">
      {assessment.is_practice && (
        <>
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
          >
            <span className="rotate-[-24deg] text-[9rem] font-black tracking-widest text-[color:var(--color-brand-violet)]/10 select-none">
              PRACTICE
            </span>
          </div>
          <div className="relative z-10 rounded-lg border border-[color:var(--color-brand-violet)]/40 bg-[color:var(--color-brand-violet)]/10 px-4 py-2.5 text-sm text-[color:var(--color-brand-violet)] flex items-center gap-2">
            <PracticeBadge />
            Rehearsal engagement — excluded from counts. The report carries a
            PRACTICE watermark.
          </div>
        </>
      )}

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/assessments"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3" /> Assessments
          </Link>
          <div className="flex items-center gap-2.5 mt-1">
            <h1 className="text-2xl font-bold truncate">
              {assessment.client_name}
            </h1>
            {assessment.is_practice && <PracticeBadge />}
          </div>
          {assessment.company && (
            <p className="text-sm text-muted-foreground">
              {assessment.company}
              {assessment.industry ? ` · ${assessment.industry}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={assessment.status}
            onValueChange={(v) =>
              typeof v === "string" &&
              void patchAssessment({ status: v as AssessmentStatus })
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
      </div>

      {!reportReady && (
        <div className="relative z-10 rounded-xl border border-[color:var(--color-brand-warning,#c98a2b)]/50 bg-[color:var(--color-brand-warning,#c98a2b)]/10 px-5 py-3.5">
          <p className="text-sm font-semibold">
            Not ready to deliver — {resolvedCount} of 30 indicators resolved
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Below {MIN_REPORT_RESOLVED} the report reads as an unfinished
            checklist, and pillar scores drawn from a handful of indicators
            mislead. Score every indicator or mark it N/A with a reason before
            this goes to a client.
          </p>
        </div>
      )}

      {/* Sticky running score bar */}
      <div
        className={cn(
          "sticky top-2 z-20 rounded-xl border px-5 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-2 shadow-lg backdrop-blur",
          assessment.is_practice
            ? "border-[color:var(--color-brand-violet)]/60 bg-[color:var(--color-brand-violet)]/15"
            : "border-[color:var(--color-brand-fog)]/60 bg-[color:var(--color-brand-charcoal)]/95"
        )}
      >
        {assessment.is_practice && (
          // The banner at the top of the page scrolls away; this bar does not.
          <span className="rounded-md bg-[color:var(--color-brand-violet)] px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white">
            Practice
          </span>
        )}
        <div>
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
            <div
              key={p.key}
              className="rounded-lg bg-[color:var(--color-brand-slate)]/60 px-3 py-1.5 text-center"
              title={
                thin
                  ? `Only ${n} of 10 ${p.label} indicators examined — too few to report as a pillar score`
                  : undefined
              }
            >
              <span
                className={cn(
                  "block text-base font-bold tabular-nums",
                  thin && "text-muted-foreground/60"
                )}
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
        <div className="rounded-lg bg-[color:var(--color-brand-slate)]/60 px-3 py-1.5 text-center">
          <span className="block text-base font-bold tabular-nums text-[color:var(--color-brand-success)]">
            {formatMoney(portfolio.adjExpected)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Expected annual opportunity
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {computed.scoredCount}/30 scored
          {computed.naCount > 0 ? ` · ${computed.naCount} N/A` : ""}
        </span>
        {overlayFlags.length > 0 && (
          <span className="rounded-lg border border-[color:var(--color-brand-danger)]/40 bg-[color:var(--color-brand-danger)]/10 px-3 py-1.5 text-xs font-semibold text-[color:var(--color-brand-danger)]">
            ⚠ {overlayFlags.length} critical constraint
            {overlayFlags.length > 1 ? "s" : ""} active
          </span>
        )}
      </div>

      {/* Baseline */}
      <Card className="relative z-10">
        <CardHeader>
          <CardTitle className="text-base">Client &amp; baseline</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Annual revenue $
            </label>
            <Input
              type="number"
              defaultValue={assessment.annual_revenue ?? ""}
              onBlur={(e) =>
                void patchAssessment({ annual_revenue: e.target.value })
              }
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Gross margin %
            </label>
            <Input
              type="number"
              defaultValue={assessment.gross_margin ?? ""}
              onBlur={(e) =>
                void patchAssessment({ gross_margin: e.target.value })
              }
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Operating profit $
            </label>
            <Input
              type="number"
              defaultValue={assessment.operating_profit ?? ""}
              onBlur={(e) =>
                void patchAssessment({ operating_profit: e.target.value })
              }
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <label className="text-xs font-medium text-muted-foreground">
              Owner&apos;s primary objective
            </label>
            <Input
              defaultValue={assessment.owner_objective ?? ""}
              onBlur={(e) =>
                void patchAssessment({ owner_objective: e.target.value })
              }
            />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <label className="text-xs font-medium text-muted-foreground">
              Owner&apos;s stated bottleneck (intake Q8, verbatim — the
              &ldquo;you said / evidence says&rdquo; moment)
            </label>
            <Input
              defaultValue={assessment.owner_belief ?? ""}
              onBlur={(e) =>
                void patchAssessment({ owner_belief: e.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Indicator scoring */}
      <Card className="relative z-10">
        <CardHeader>
          <CardTitle className="text-base">
            Indicator scoring — 0–4 or N/A
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Scale: 0 Absent · 1 Informal · 2 Developing · 3 Established · 4
            Scalable. N/A is removed from the denominator, never counted as
            zero. Evidence confidence never changes the score — it widens
            ranges in the report.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {PILLARS.map((pillar) => (
            <div key={pillar.key} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold text-[color:var(--color-brand-electric)]">
                  {pillar.label}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({Math.round(pillar.weight * 100)}%) — {pillar.question}
                  </span>
                </h3>
                <span className="text-sm font-bold tabular-nums">
                  {computed.pillars[pillar.key] ?? "—"}
                </span>
              </div>
              <div className="space-y-2">
                {INDICATORS_BY_PILLAR[pillar.key].map((ind) => (
                  <IndicatorRow
                    key={ind.key}
                    indicator={ind}
                    row={scores[ind.key]}
                    onChange={(patch) => void patchScore(ind, patch)}
                  />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Opportunities */}
      <Card className="relative z-10">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">
              Profit opportunities — detail the 2–3 strongest
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingOppId(null);
                setOppDialogOpen(true);
              }}
            >
              <Plus className="size-4" /> Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Annual operating-profit impact, low / expected / high. The
            portfolio total is overlap-adjusted — never sell the raw sum.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No opportunities yet.
            </p>
          ) : (
            opportunities.map((opp) => {
              const payback = paybackMonths(opp.fix_cost, opp.annual_expected);
              const rangeIssue = rangeOrderIssue(opp);
              return (
                <div
                  key={opp.id}
                  className={cn(
                    "rounded-lg border border-[color:var(--color-brand-fog)]/50 bg-[color:var(--color-brand-slate)]/20 p-3 space-y-2",
                    !opp.include_in_report && "opacity-50"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{opp.title}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-[color:var(--color-brand-fog)]/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-brand-mist)]">
                        {opp.confidence} confidence
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingOppId(opp.id);
                          setOppDialogOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[color:var(--color-brand-danger)] hover:text-[color:var(--color-brand-danger)]"
                        onClick={() => void handleDeleteOpp(opp)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  {opp.finding && (
                    <p className="text-xs text-muted-foreground">
                      {opp.finding}
                    </p>
                  )}
                  {rangeIssue && (
                    <p className="text-xs font-semibold text-[color:var(--color-brand-warning)]">
                      ⚠ {rangeIssue} — the printed range will read as nonsense.
                      Fix before delivering.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs tabular-nums">
                    <span>
                      <span className="text-muted-foreground">Low</span>{" "}
                      <b>{formatMoney(opp.annual_low)}</b>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Expected</span>{" "}
                      <b className="text-[color:var(--color-brand-success)]">
                        {formatMoney(opp.annual_expected)}
                      </b>
                    </span>
                    <span>
                      <span className="text-muted-foreground">High</span>{" "}
                      <b>{formatMoney(opp.annual_high)}</b>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Fix cost</span>{" "}
                      <b>{formatMoney(opp.fix_cost)}</b>
                    </span>
                    <span>
                      <span className="text-muted-foreground">Payback</span>{" "}
                      <b>{formatPayback(payback)}</b>
                    </span>
                    {opp.months_to_benefit !== null && (
                      <span>
                        <span className="text-muted-foreground">
                          To benefit
                        </span>{" "}
                        <b>{opp.months_to_benefit} mo</b>
                      </span>
                    )}
                    <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                      <Checkbox
                        checked={opp.include_in_report}
                        onCheckedChange={(c) =>
                          void toggleOppIncluded(opp, c === true)
                        }
                      />
                      <span className="text-muted-foreground">In report</span>
                    </label>
                  </div>
                </div>
              );
            })
          )}

          <div className="flex flex-wrap items-center gap-4 rounded-lg border-t-2 border-[color:var(--color-brand-fog)]/60 pt-3 text-sm">
            <span className="font-semibold">
              {portfolio.overlapApplied
                ? `Portfolio (×${portfolio.overlapFactor} overlap):`
                : "Portfolio (single initiative — no overlap to adjust):"}
            </span>
            <span className="tabular-nums">
              low <b>{formatMoney(portfolio.adjLow)}</b>
            </span>
            <span className="tabular-nums">
              expected{" "}
              <b className="text-[color:var(--color-brand-success)]">
                {formatMoney(portfolio.adjExpected)}
              </b>
            </span>
            <span className="tabular-nums">
              high <b>{formatMoney(portfolio.adjHigh)}</b>
            </span>
            <label className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
              Overlap factor
              <Input
                // Keyed on the persisted value so a rejected entry (0, blank,
                // >1) snaps back to what was actually stored instead of
                // leaving the field showing a number the portfolio never used.
                key={`overlap-${portfolio.configuredFactor}`}
                type="number"
                step="0.05"
                min="0.1"
                max="1"
                defaultValue={portfolio.configuredFactor}
                onBlur={(e) => {
                  const entered = e.target.value.trim();
                  const normalized = normalizeOverlapFactor(entered);
                  if (entered !== "" && Number(entered) !== normalized) {
                    toast.error(
                      `Overlap factor must be between 0 and 1 — kept ${normalized}`
                    );
                  }
                  void patchAssessment({ overlap_factor: normalized });
                }}
                className="w-20 h-8 tabular-nums"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Critical Constraint Overlay */}
      <Card className="relative z-10">
        <CardHeader>
          <CardTitle className="text-base">
            Critical Constraint Overlay
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Flagged regardless of scores — a warning can never be averaged
            away. Any active warning forces &ldquo;Prepare First&rdquo; on
            growth initiatives that depend on the weak foundation.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OVERLAY_FLAGS.map((flag) => {
            const active = overlayFlags.includes(flag.key);
            return (
              <label
                key={flag.key}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer text-sm transition-colors",
                  active
                    ? "border-[color:var(--color-brand-danger)]/50 bg-[color:var(--color-brand-danger)]/10"
                    : "border-[color:var(--color-brand-fog)]/50 bg-[color:var(--color-brand-slate)]/20 hover:bg-[color:var(--color-brand-slate)]/40"
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
        </CardContent>
      </Card>

      {/* Primary Business Constraint */}
      <Card className="relative z-10">
        <CardHeader>
          <CardTitle className="text-base">
            Primary Business Constraint
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Symptoms → Root → Annual Cost → First Intervention → Measurement.
            Compare against the owner&apos;s own Q8 belief at the reveal.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Root constraint (one sentence)
            </label>
            <Textarea
              defaultValue={assessment.primary_constraint ?? ""}
              onBlur={(e) =>
                void patchAssessment({ primary_constraint: e.target.value })
              }
              className="min-h-20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Symptoms it explains
            </label>
            <Textarea
              defaultValue={assessment.constraint_symptoms ?? ""}
              onBlur={(e) =>
                void patchAssessment({ constraint_symptoms: e.target.value })
              }
              className="min-h-20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Annual cost (state the basis)
            </label>
            <Textarea
              defaultValue={assessment.constraint_cost ?? ""}
              onBlur={(e) =>
                void patchAssessment({ constraint_cost: e.target.value })
              }
              className="min-h-20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              First intervention &amp; measurement
            </label>
            <Textarea
              defaultValue={assessment.constraint_fix ?? ""}
              onBlur={(e) =>
                void patchAssessment({ constraint_fix: e.target.value })
              }
              className="min-h-20"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              Early Momentum Initiative (measurable win inside 30 days)
            </label>
            <Textarea
              defaultValue={assessment.momentum_initiative ?? ""}
              onBlur={(e) =>
                void patchAssessment({ momentum_initiative: e.target.value })
              }
              className="min-h-16"
            />
          </div>
        </CardContent>
      </Card>

      {/* 90-day plan */}
      <Card className="relative z-10">
        <CardHeader>
          <CardTitle className="text-base">90-day plan</CardTitle>
          <p className="text-xs text-muted-foreground">
            The plan must be worth $7,500 standing alone — fully usable without
            CREAiT.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {planItems.length === 0 && (
            <p className="text-sm text-muted-foreground">No plan items yet.</p>
          )}
          {planItems.map((item, i) => (
            <div
              key={`${i}-${item}`}
              className="flex items-start justify-between gap-2 rounded-lg border border-[color:var(--color-brand-fog)]/50 bg-[color:var(--color-brand-slate)]/20 px-3 py-2"
            >
              <p className="text-sm">
                <span className="text-muted-foreground font-mono text-xs mr-2">
                  {i + 1}.
                </span>
                {item}
              </p>
              <button
                type="button"
                aria-label={`Remove plan item ${i + 1}`}
                onClick={() => removePlanItemAt(item, i)}
                className="text-muted-foreground hover:text-[color:var(--color-brand-danger)] transition-colors shrink-0 mt-0.5"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Input
              value={planDraft}
              onChange={(e) => setPlanDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPlanItem();
                }
              }}
              placeholder="Add a 90-day priority…"
            />
            <Button
              variant="outline"
              onClick={addPlanItem}
              disabled={!planDraft.trim()}
            >
              <Plus className="size-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <OpportunityDialog
        assessmentId={assessment.id}
        editing={editingOpp}
        nextRank={opportunities.length + 1}
        open={oppDialogOpen}
        onOpenChange={(o) => {
          setOppDialogOpen(o);
          if (!o) setEditingOppId(null);
        }}
        onSaved={(saved) =>
          setOpportunities((p) => {
            const exists = p.some((x) => x.id === saved.id);
            return exists
              ? p.map((x) => (x.id === saved.id ? saved : x))
              : [...p, saved];
          })
        }
      />
    </div>
  );
}
