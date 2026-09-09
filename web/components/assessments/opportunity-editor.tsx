"use client";

/**
 * Priced findings, and the overlap-adjusted portfolio underneath them.
 *
 * The totals row is a sum row under a list, and reads like one: a hairline rule
 * and tabular figures, no card, no accent bar. The overlap factor sits in the
 * same row as the number it modifies, because the guide's hard rule is that the
 * raw sum is never what gets sold.
 */

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  concentrationWarning,
  formatMoney,
  formatPayback,
  paybackMonths,
  portfolioTotals,
} from "@/lib/assessment-instrument";
import { deleteOpportunity, saveOpportunity } from "@/lib/assessment-actions";
import {
  CALCULATORS,
  CALCULATOR_LIST,
  compute,
  defaultInputs,
  describeCalc,
  EMPTY_BASELINE,
  missingBaseline,
  parseCalc,
  toCalcRecord,
} from "@/lib/opportunity-calculators";
import type {
  CalcBaseline,
  CalcField,
  CalcKind,
  CalcOutputs,
  ComputeResult,
  RawCalcInputs,
} from "@/lib/opportunity-calculators";
import type {
  CcAssessmentOpportunity,
  OpportunityConfidence,
} from "@/lib/supabase/types";

const CONFIDENCE_OPTIONS: Array<{
  value: OpportunityConfidence;
  label: string;
}> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

interface OppForm {
  title: string;
  finding: string;
  annual_low: string;
  annual_expected: string;
  annual_high: string;
  fix_cost: string;
  months_to_benefit: string;
  owner_estimate_annual: string;
  confidence: OpportunityConfidence;
  basis_reported_only: boolean;
  blueprint: string;
  replaces: string;
  hours_recovered_weekly: string;
}

const EMPTY_OPP: OppForm = {
  title: "",
  finding: "",
  annual_low: "",
  annual_expected: "",
  annual_high: "",
  fix_cost: "",
  months_to_benefit: "",
  owner_estimate_annual: "",
  confidence: "medium",
  basis_reported_only: false,
  blueprint: "",
  replaces: "",
  hours_recovered_weekly: "",
};

/**
 * "How was this range produced?" — hand-entered, or one of the calculators.
 * Stored as the `calc` record so the report can print the arithmetic instead
 * of asking the client to trust three numbers someone typed.
 */
type RangeSource = "manual" | CalcKind;

/** Calculator inputs as the boxes hold them: strings while being typed. */
type CalcDraft = Record<string, string | boolean>;

function draftFrom(inputs: RawCalcInputs): CalcDraft {
  const out: CalcDraft = {};
  for (const [k, v] of Object.entries(inputs)) {
    out[k] = typeof v === "boolean" ? v : String(v);
  }
  return out;
}

/** Empty boxes are left OUT, so the calculator refuses by name instead of modelling on zero. */
function draftToInputs(draft: CalcDraft): RawCalcInputs {
  const out: RawCalcInputs = {};
  for (const [k, v] of Object.entries(draft)) {
    if (typeof v === "boolean") {
      out[k] = v;
      continue;
    }
    if (v.trim() === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

const UNIT_SUFFIX: Record<CalcField["unit"], string> = {
  usd: "$",
  pct: "%",
  points: "pts",
  hours: "h/wk",
  count: "",
  none: "",
};

/** Consecutive scenario fields (low/expected/high) share one three-up row. */
function groupFields(fields: CalcField[]): CalcField[][] {
  const rows: CalcField[][] = [];
  for (const f of fields) {
    const last = rows[rows.length - 1];
    if (f.scenario && last && last[0]?.scenario && last.length < 3) {
      last.push(f);
    } else {
      rows.push([f]);
    }
  }
  return rows;
}

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
    owner_estimate_annual:
      o.owner_estimate_annual !== null ? String(o.owner_estimate_annual) : "",
    confidence: o.confidence,
    basis_reported_only: o.basis_reported_only ?? false,
    blueprint: o.blueprint ?? "",
    replaces: o.replaces ?? "",
    hours_recovered_weekly:
      o.hours_recovered_weekly !== null ? String(o.hours_recovered_weekly) : "",
  };
}

function OpportunityDialog({
  assessmentId,
  baseline,
  editing,
  nextRank,
  open,
  onOpenChange,
  onSaved,
}: {
  assessmentId: string;
  baseline: CalcBaseline;
  editing: CcAssessmentOpportunity | null;
  nextRank: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (o: CcAssessmentOpportunity) => void;
}) {
  const storedCalc = useMemo(
    () => (editing ? parseCalc(editing.calc) : null),
    [editing]
  );
  const [form, setForm] = useState<OppForm>(
    editing ? toOppForm(editing) : EMPTY_OPP
  );
  const [source, setSource] = useState<RangeSource>(storedCalc?.kind ?? "manual");
  const [draft, setDraft] = useState<CalcDraft>(
    storedCalc ? draftFrom(storedCalc.inputs) : {}
  );
  /** Set when a hand edit dropped a calculator record, so the dialog can say so. */
  const [calcDropped, setCalcDropped] = useState(false);
  /**
   * Whether a calculator input has actually been touched since the dialog
   * opened. Until it has, the stored record stands — opening a finding to fix
   * a typo in its title must not silently republish a different range.
   */
  const [calcEdited, setCalcEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastEditingId, setLastEditingId] = useState<string | null>(
    editing?.id ?? null
  );

  if ((editing?.id ?? null) !== lastEditingId) {
    setLastEditingId(editing?.id ?? null);
    setForm(editing ? toOppForm(editing) : EMPTY_OPP);
    const next = editing ? parseCalc(editing.calc) : null;
    setSource(next?.kind ?? "manual");
    setDraft(next ? draftFrom(next.inputs) : {});
    setCalcDropped(false);
    setCalcEdited(false);
  }

  const calcKind = source === "manual" ? null : source;
  const inputs = useMemo(() => draftToInputs(draft), [draft]);
  const computed = useMemo(
    () => (calcKind ? compute(calcKind, inputs, baseline) : null),
    [calcKind, inputs, baseline]
  );
  /**
   * The saved arithmetic, replayed rather than re-run. A recomputation on open
   * would quietly move the range whenever the assessment's baseline (or this
   * module) had changed since the finding was priced — the advisor would never
   * be told, and the report would print a number nobody chose.
   */
  const unchangedCalc =
    !calcEdited && storedCalc && storedCalc.kind === calcKind ? storedCalc : null;
  const result: ComputeResult | null = unchangedCalc
    ? {
        ok: true,
        low: unchangedCalc.outputs.low,
        expected: unchangedCalc.outputs.expected,
        high: unchangedCalc.outputs.high,
        chain: unchangedCalc.chain,
        inputs: unchangedCalc.inputs,
        ...(unchangedCalc.outputs.capacityHoursWeekly !== undefined
          ? { capacityHoursWeekly: unchangedCalc.outputs.capacityHoursWeekly }
          : {}),
      }
    : computed;
  const outputs: CalcOutputs | null =
    result && result.ok ? { ...result } : null;

  /**
   * With a calculator running, the three figures ARE its outputs — the boxes
   * show what the arithmetic says, not what someone typed last week.
   */
  const shown = {
    annual_low: outputs ? String(outputs.low) : form.annual_low,
    annual_expected: outputs ? String(outputs.expected) : form.annual_expected,
    annual_high: outputs ? String(outputs.high) : form.annual_high,
    hours_recovered_weekly:
      outputs?.capacityHoursWeekly !== undefined
        ? String(outputs.capacityHoursWeekly)
        : form.hours_recovered_weekly,
  };

  const previewPayback = paybackMonths(
    form.fix_cost.trim() ? Number(form.fix_cost) : null,
    shown.annual_expected.trim() ? Number(shown.annual_expected) : null
  );

  function set<K extends keyof OppForm>(k: K, v: OppForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function chooseSource(next: RangeSource) {
    setCalcDropped(false);
    setSource(next);
    if (next === "manual") return;
    // Back to the calculator this finding was saved with: its own inputs come
    // back, and with nothing edited its stored range stands. Any other
    // calculator starts from defaults, which is itself a change.
    if (storedCalc?.kind === next) {
      setDraft((prev) =>
        calcEdited && Object.keys(prev).length > 0
          ? prev
          : draftFrom(storedCalc.inputs)
      );
      return;
    }
    setDraft(draftFrom(defaultInputs(next, baseline)));
    setCalcEdited(true);
  }

  /**
   * Typing over a computed figure ends the derivation. The numbers on screen
   * are frozen into the form first, so the hand-entered range starts from what
   * the calculator last said rather than snapping back to a stale value.
   */
  function editRangeByHand(
    field: "annual_low" | "annual_expected" | "annual_high",
    value: string
  ) {
    if (calcKind) {
      setForm((p) => ({
        ...p,
        annual_low: shown.annual_low,
        annual_expected: shown.annual_expected,
        annual_high: shown.annual_high,
        hours_recovered_weekly: shown.hours_recovered_weekly,
        [field]: value,
      }));
      setSource("manual");
      setCalcDropped(true);
      toast.message(
        "Range is hand-entered now — the calculator record was cleared."
      );
      return;
    }
    set(field, value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title required");
      return;
    }
    if (calcKind && !outputs) {
      toast.error(
        result && !result.ok ? result.error : "The calculator has no result yet"
      );
      return;
    }
    setSubmitting(true);
    const res = await saveOpportunity({
      id: editing?.id,
      assessment_id: assessmentId,
      title: form.title,
      finding: form.finding,
      annual_low: shown.annual_low,
      annual_expected: shown.annual_expected,
      annual_high: shown.annual_high,
      fix_cost: form.fix_cost,
      months_to_benefit: form.months_to_benefit,
      owner_estimate_annual: form.owner_estimate_annual,
      confidence: form.confidence,
      basis_reported_only: form.basis_reported_only,
      rank: editing?.rank ?? nextRank,
      include_in_report: editing?.include_in_report ?? true,
      blueprint: form.blueprint,
      replaces: form.replaces,
      hours_recovered_weekly: shown.hours_recovered_weekly,
      // null, not undefined: a hand-entered range must actively clear any
      // calculator record still on the row. An untouched calculator keeps the
      // record it already had, timestamp included — nothing was recalculated.
      calc:
        calcKind && outputs
          ? (unchangedCalc ?? toCalcRecord(calcKind, outputs))
          : null,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onSaved(res.data!.opportunity);
    onOpenChange(false);
    if (!editing) {
      setForm(EMPTY_OPP);
      setSource("manual");
      setDraft({});
      setCalcDropped(false);
    }
    toast.success(editing ? "Opportunity updated" : "Opportunity added");
  }

  // A click outside this dialog used to close it and drop everything typed —
  // on a laptop the calculator inputs run below the fold, so reaching for the
  // scrollbar was enough to lose the form. Outside clicks no longer dismiss;
  // Cancel, Save, the × and Escape are the ways out. The fields scroll inside
  // the dialog and the footer stays put, so Save is always on screen.
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      disablePointerDismissal
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit opportunity" : "Add opportunity"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-col gap-3 pt-1"
        >
        <div className="flex min-h-0 max-h-[calc(100dvh-11rem)] flex-col gap-3 overflow-y-auto overscroll-contain pr-1">
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
          {/* The report states these as "profit impact" and adds the expected
              figure straight onto operating profit to compute the margin
              shift. An advisor who enters recovered *revenue* here would
              overstate that headline by the whole cost of delivery — on a
              10%-margin business, by roughly 10x. The label has to carry the
              definition; the arithmetic downstream cannot infer it. */}
          <p className="text-[11px] text-muted-foreground">
            Enter <strong>annual profit impact</strong>, not recovered revenue —
            what reaches operating profit after the cost of delivering it. The
            report adds the expected figure directly to operating profit.
          </p>

          {/* How the range was produced. A calculator writes the three figures
              and stores its arithmetic, so Appendix B can print the derivation
              instead of asking the client to trust three typed numbers. */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              How was this range produced?
            </label>
            <Select
              value={source}
              onValueChange={(v) =>
                typeof v === "string" && chooseSource(v as RangeSource)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">
                  Hand-entered — I typed the range
                </SelectItem>
                {CALCULATOR_LIST.map((c) => (
                  <SelectItem key={c.kind} value={c.kind}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {calcDropped && (
              <p className="text-[11px] text-[color:var(--color-brand-danger)]">
                You edited a figure by hand, so the range is no longer derived —
                the calculator record has been cleared and the report will say
                the range was entered by the advisor.
              </p>
            )}
          </div>

          {calcKind && (
            <CalculatorPanel
              kind={calcKind}
              baseline={baseline}
              draft={draft}
              onDraftChange={(key, value) => {
                setCalcEdited(true);
                setDraft((p) => ({ ...p, [key]: value }));
              }}
              result={result}
            />
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Annual low $
              </label>
              <Input
                type="number"
                value={shown.annual_low}
                onChange={(e) => editRangeByHand("annual_low", e.target.value)}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Expected profit $
              </label>
              <Input
                type="number"
                value={shown.annual_expected}
                onChange={(e) =>
                  editRangeByHand("annual_expected", e.target.value)
                }
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Annual high $
              </label>
              <Input
                type="number"
                value={shown.annual_high}
                onChange={(e) => editRangeByHand("annual_high", e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>
          {calcKind && (
            <p className="text-[11px] text-muted-foreground">
              These three come from the calculator above. Type over any of them
              and the range becomes hand-entered.
            </p>
          )}
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
          {/* The evidence rule, as a tick. There is no indicator→opportunity
              mapping in the schema, so whether a finding rests only on what the
              owner told us is the advisor's statement — and it widens the
              printed range by ±25% wherever this opportunity appears. */}
          <label className="flex cursor-pointer items-start gap-2.5 text-xs">
            <Checkbox
              checked={form.basis_reported_only}
              onCheckedChange={(c) => set("basis_reported_only", c === true)}
              className="mt-0.5"
            />
            <span>
              Based only on Reported evidence
              <span className="ml-1.5 text-muted-foreground">
                every indicator behind this finding is Reported — the report
                widens the range ±25% and says it is based on their estimates
              </span>
            </span>
          </label>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Owner&apos;s own estimate (annual $){" "}
              <span className="font-normal text-muted-foreground/70">
                optional
              </span>
            </label>
            <Input
              type="number"
              value={form.owner_estimate_annual}
              onChange={(e) => set("owner_estimate_annual", e.target.value)}
              className="tabular-nums"
            />
            <p className="text-[11px] text-muted-foreground/70">
              what THEY think it&apos;s worth — we model conservatively. The
              report cites it only when it sits above our expected case.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Payback (fix cost ÷ expected monthly recovery):{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatPayback(previewPayback)}
            </span>
          </p>

          {/* AI Workflow Blueprint — optional. This is what turns a priced
              finding into "the build that captures this" in the report. */}
          <div className="space-y-3 border-t border-border/60 pt-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Blueprint — what gets built{" "}
                <span className="font-normal text-muted-foreground/70">
                  optional · the automation / AI / tech solution, named plainly
                </span>
              </label>
              <Textarea
                value={form.blueprint}
                onChange={(e) => set("blueprint", e.target.value)}
                className="min-h-16"
                placeholder="e.g. Missed-call text-back + AI voice agent on the main line; CRM logs every call"
              />
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  What it replaces{" "}
                  <span className="font-normal text-muted-foreground/70">
                    the manual work it eliminates
                  </span>
                </label>
                <Input
                  value={form.replaces}
                  onChange={(e) => set("replaces", e.target.value)}
                  placeholder="e.g. Hand-typed quotes and memory-based follow-up"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Hours/week back
                </label>
                <Input
                  type="number"
                  min="0"
                  value={shown.hours_recovered_weekly}
                  readOnly={outputs?.capacityHoursWeekly !== undefined}
                  onChange={(e) =>
                    set("hours_recovered_weekly", e.target.value)
                  }
                  className="tabular-nums"
                />
                {outputs?.capacityHoursWeekly !== undefined && (
                  <p className="text-[11px] text-muted-foreground/70">
                    from the calculator
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
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

/**
 * One calculator's inputs, its live result and the printed arithmetic.
 *
 * The chain is shown here and stored verbatim — the advisor reads the same
 * lines in the dialog that the client reads in Appendix B, so a number that
 * looks wrong on the page looked wrong here first.
 */
function CalculatorPanel({
  kind,
  baseline,
  draft,
  onDraftChange,
  result,
}: {
  kind: CalcKind;
  baseline: CalcBaseline;
  draft: CalcDraft;
  onDraftChange: (key: string, value: string | boolean) => void;
  result: ReturnType<typeof compute> | null;
}) {
  const meta = CALCULATORS[kind];
  const gaps = missingBaseline(kind, baseline);

  return (
    <div className="space-y-3 rounded-lg bg-[color:var(--color-brand-slate)]/35 p-3">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {meta.description}
      </p>
      {gaps.length > 0 && (
        <p className="text-[11px] leading-relaxed text-[color:var(--color-brand-danger)]">
          This assessment has no{" "}
          {gaps
            .map((g) =>
              g === "grossMarginPct"
                ? "gross margin"
                : g === "annualRevenue"
                  ? "annual revenue"
                  : "operating profit"
            )
            .join(" or ")}{" "}
          recorded — nothing is prefilled, so type the figure below or capture it
          in the session step.
        </p>
      )}

      {groupFields(meta.fields).map((row, i) => (
        <div
          key={i}
          className={cn(
            "grid gap-3",
            row.length === 3 ? "grid-cols-3" : "grid-cols-1"
          )}
        >
          {row.map((f) =>
            f.boolean ? (
              <label
                key={f.key}
                className="flex cursor-pointer items-start gap-2.5 text-xs"
              >
                <Checkbox
                  checked={draft[f.key] === true}
                  onCheckedChange={(c) => onDraftChange(f.key, c === true)}
                  className="mt-0.5"
                />
                <span>
                  {f.label}
                  {f.help && (
                    <span className="ml-1.5 text-muted-foreground">
                      {f.help}
                    </span>
                  )}
                </span>
              </label>
            ) : (
              <div key={f.key} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {f.label}
                  {UNIT_SUFFIX[f.unit] && (
                    <span className="ml-1 font-normal text-muted-foreground/70">
                      {UNIT_SUFFIX[f.unit]}
                    </span>
                  )}
                </label>
                <Input
                  type="number"
                  value={
                    typeof draft[f.key] === "string"
                      ? (draft[f.key] as string)
                      : ""
                  }
                  onChange={(e) => onDraftChange(f.key, e.target.value)}
                  className="tabular-nums"
                />
                {f.help && row.length < 3 && (
                  <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                    {f.help}
                  </p>
                )}
              </div>
            )
          )}
          {row.length === 3 && row.find((f) => f.help)?.help && (
            <p className="col-span-3 -mt-1 text-[11px] leading-relaxed text-muted-foreground/70">
              {row.find((f) => f.help)?.help}
            </p>
          )}
        </div>
      ))}

      {result && !result.ok && (
        <p className="text-[11px] leading-relaxed text-[color:var(--color-brand-danger)]">
          {result.error}
        </p>
      )}
      {result?.ok && (
        <div className="space-y-1.5 border-t border-border/60 pt-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            The arithmetic, as the report will print it
          </p>
          <ol className="space-y-0.5 text-[11px] leading-relaxed tabular-nums">
            {result.chain.map((line, i) => (
              <li key={i} className="text-muted-foreground">
                {line}
              </li>
            ))}
          </ol>
          <p className="pt-1 text-xs tabular-nums">
            <span className="text-muted-foreground">Operating profit</span>{" "}
            <b>{formatMoney(result.low)}</b>{" "}
            <span className="text-muted-foreground">low ·</span>{" "}
            <b className="text-[color:var(--color-brand-success)]">
              {formatMoney(result.expected)}
            </b>{" "}
            <span className="text-muted-foreground">expected ·</span>{" "}
            <b>{formatMoney(result.high)}</b>{" "}
            <span className="text-muted-foreground">high</span>
            {result.capacityHoursWeekly !== undefined && (
              <span className="text-muted-foreground">
                {" "}
                · {result.capacityHoursWeekly} h/week capacity
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function OpportunityEditor({
  assessmentId,
  baseline = EMPTY_BASELINE,
  opportunities,
  overlapFactor,
  onOpportunitiesChange,
  onOverlapChange,
}: {
  assessmentId: string;
  /** The assessment's engine figures — calculators prefill and refuse from these. */
  baseline?: CalcBaseline;
  opportunities: CcAssessmentOpportunity[];
  overlapFactor: number;
  onOpportunitiesChange: (
    next: (prev: CcAssessmentOpportunity[]) => CcAssessmentOpportunity[]
  ) => void;
  onOverlapChange: (value: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = opportunities.find((o) => o.id === editingId) ?? null;
  const portfolio = portfolioTotals(opportunities, overlapFactor);
  // Advisor-only: the report never says this. See concentrationWarning().
  const concentration = concentrationWarning(opportunities);

  async function handleDelete(opp: CcAssessmentOpportunity) {
    if (!window.confirm(`Delete "${opp.title}"?`)) return;
    const res = await deleteOpportunity(opp.id, assessmentId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onOpportunitiesChange((p) => p.filter((o) => o.id !== opp.id));
    toast.success("Opportunity deleted");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditingId(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" /> Add opportunity
        </Button>
      </div>

      {opportunities.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing priced yet. Two or three defensible findings beat ten guesses —
          the report shows your basis for every number.
        </p>
      ) : (
        <ul className="divide-y divide-border/50">
          {opportunities.map((opp) => {
            const payback = paybackMonths(opp.fix_cost, opp.annual_expected);
            const calc = parseCalc(opp.calc);
            return (
              <li
                key={opp.id}
                className={cn(
                  "py-3",
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
                        setEditingId(opp.id);
                        setDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${opp.title}`}
                      className="text-[color:var(--color-brand-danger)] hover:text-[color:var(--color-brand-danger)]"
                      onClick={() => void handleDelete(opp)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {opp.finding && (
                  <p className="mt-1 max-w-[80ch] text-xs leading-relaxed text-muted-foreground">
                    {opp.finding}
                  </p>
                )}
                {/* Whether the range is derived is a property of the finding,
                    so it reads on the row, not only inside the dialog. */}
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  {calc
                    ? describeCalc(calc)
                    : "Hand-entered range — no calculator record."}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs tabular-nums">
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
                      <span className="text-muted-foreground">To benefit</span>{" "}
                      <b>{opp.months_to_benefit} mo</b>
                    </span>
                  )}
                  <label className="ml-auto flex cursor-pointer items-center gap-1.5">
                    <Checkbox
                      checked={opp.include_in_report}
                      onCheckedChange={(c) => {
                        const include = c === true;
                        onOpportunitiesChange((p) =>
                          p.map((x) =>
                            x.id === opp.id
                              ? { ...x, include_in_report: include }
                              : x
                          )
                        );
                        void saveOpportunity({
                          id: opp.id,
                          assessment_id: assessmentId,
                          title: opp.title,
                          finding: opp.finding,
                          annual_low: opp.annual_low,
                          annual_expected: opp.annual_expected,
                          annual_high: opp.annual_high,
                          fix_cost: opp.fix_cost,
                          months_to_benefit: opp.months_to_benefit,
                          confidence: opp.confidence,
                          rank: opp.rank,
                          include_in_report: include,
                          blueprint: opp.blueprint,
                          replaces: opp.replaces,
                          hours_recovered_weekly: opp.hours_recovered_weekly,
                        });
                      }}
                    />
                    <span className="text-muted-foreground">In report</span>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Sum row — a total under a list, not a card. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[color:var(--color-brand-fog)] pt-3 text-sm">
        <span className="font-semibold">
          Portfolio
          <span className="ml-1.5 font-normal text-muted-foreground">
            ×{portfolio.overlapFactor} overlap
          </span>
        </span>
        <span className="tabular-nums text-muted-foreground">
          low <b className="text-foreground">{formatMoney(portfolio.adjLow)}</b>
        </span>
        <span className="tabular-nums text-muted-foreground">
          expected{" "}
          <b className="text-[color:var(--color-brand-success)]">
            {formatMoney(portfolio.adjExpected)}
          </b>
        </span>
        <span className="tabular-nums text-muted-foreground">
          high <b className="text-foreground">{formatMoney(portfolio.adjHigh)}</b>
        </span>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Overlap factor
          <Input
            type="number"
            step="0.05"
            min="0.1"
            max="1"
            defaultValue={portfolio.configuredFactor}
            onBlur={(e) => onOverlapChange(e.target.value)}
            className="h-8 w-20 tabular-nums"
          />
        </label>
      </div>

      {concentration && (
        <p className="max-w-[80ch] rounded-lg bg-[color:var(--color-brand-slate)]/45 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground ring-1 ring-inset ring-[color:var(--color-brand-electric)]/20">
          &ldquo;{concentration.title}&rdquo; carries{" "}
          <b className="tabular-nums text-foreground">
            {concentration.sharePct}%
          </b>{" "}
          of the projected recovery. If the client disputes that one number,
          most of the projection goes with it — consider lowering it and
          broadening.
        </p>
      )}

      <OpportunityDialog
        assessmentId={assessmentId}
        baseline={baseline}
        editing={editing}
        nextRank={opportunities.length + 1}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingId(null);
        }}
        onSaved={(saved) =>
          onOpportunitiesChange((p) => {
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
