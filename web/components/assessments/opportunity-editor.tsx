"use client";

/**
 * Priced findings, and the overlap-adjusted portfolio underneath them.
 *
 * The totals row is a sum row under a list, and reads like one: a hairline rule
 * and tabular figures, no card, no accent bar. The overlap factor sits in the
 * same row as the number it modifies, because the guide's hard rule is that the
 * raw sum is never what gets sold.
 */

import { useState } from "react";
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
  blueprint: "",
  replaces: "",
  hours_recovered_weekly: "",
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
    owner_estimate_annual:
      o.owner_estimate_annual !== null ? String(o.owner_estimate_annual) : "",
    confidence: o.confidence,
    blueprint: o.blueprint ?? "",
    replaces: o.replaces ?? "",
    hours_recovered_weekly:
      o.hours_recovered_weekly !== null ? String(o.hours_recovered_weekly) : "",
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
      owner_estimate_annual: form.owner_estimate_annual,
      confidence: form.confidence,
      rank: editing?.rank ?? nextRank,
      include_in_report: editing?.include_in_report ?? true,
      blueprint: form.blueprint,
      replaces: form.replaces,
      hours_recovered_weekly: form.hours_recovered_weekly,
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
                  value={form.hours_recovered_weekly}
                  onChange={(e) =>
                    set("hours_recovered_weekly", e.target.value)
                  }
                  className="tabular-nums"
                />
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

// ---------------------------------------------------------------------------
export function OpportunityEditor({
  assessmentId,
  opportunities,
  overlapFactor,
  onOpportunitiesChange,
  onOverlapChange,
}: {
  assessmentId: string;
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
