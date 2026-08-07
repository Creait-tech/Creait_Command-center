"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { cn } from "@/lib/utils";
import type { Kpi, KpiSource } from "@/lib/supabase/types";
import {
  CUSTOM_UNIT,
  NO_UNIT,
  SOURCE_OPTIONS,
  UNIT_OPTIONS,
  formatKpiValue,
  kpiWriteMode,
  writeModeCopy,
} from "./kpi-meta";

interface KpiFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` opens the dialog in create mode. */
  kpi: Kpi | null;
  /** `max(sort_order) + 1` across the current scoreboard. Create mode only. */
  nextSortOrder: number;
  /**
   * Changes once per opened session. Used as the form's React key so a fresh
   * open always starts from the stored row — no effect syncing props into
   * state, and no reset while the dialog is playing its close animation.
   */
  sessionKey: number;
  /** Called with the saved row so the caller can update optimistically. */
  onSaved: (kpi: Kpi, mode: "create" | "edit") => void;
}

interface FormState {
  name: string;
  description: string;
  target: string;
  /** A `UNIT_OPTIONS` value, or `CUSTOM_UNIT` while typing a free-text unit. */
  unitChoice: string;
  customUnit: string;
  source: KpiSource;
  sortOrder: string;
}

function unitChoiceFor(unit: string | null): string {
  if (unit == null) return NO_UNIT;
  return UNIT_OPTIONS.some((o) => o.value === unit) ? unit : CUSTOM_UNIT;
}

function initialForm(kpi: Kpi | null, nextSortOrder: number): FormState {
  if (!kpi) {
    return {
      name: "",
      description: "",
      target: "",
      unitChoice: NO_UNIT,
      customUnit: "",
      source: "manual",
      sortOrder: String(nextSortOrder),
    };
  }
  const unitChoice = unitChoiceFor(kpi.unit);
  return {
    name: kpi.name,
    description: kpi.description ?? "",
    target: kpi.target == null ? "" : String(kpi.target),
    unitChoice,
    customUnit: unitChoice === CUSTOM_UNIT ? (kpi.unit ?? "") : "",
    source: kpi.source,
    sortOrder: String(kpi.sort_order),
  };
}

/** Collapse the picker + custom field back into what goes in `kpis.unit`. */
function resolveUnit(form: FormState): string | null {
  if (form.unitChoice === NO_UNIT) return null;
  if (form.unitChoice === CUSTOM_UNIT) return form.customUnit.trim() || null;
  return form.unitChoice;
}

interface KpiFormProps {
  kpi: Kpi | null;
  nextSortOrder: number;
  onOpenChange: (open: boolean) => void;
  onSaved: (kpi: Kpi, mode: "create" | "edit") => void;
}

/**
 * The form body. Mounted fresh per editing session (keyed by `sessionKey`),
 * so its initial state *is* the reset — there is nothing to synchronise.
 */
function KpiForm({ kpi, nextSortOrder, onOpenChange, onSaved }: KpiFormProps) {
  const orgId = useActiveOrgId();
  const isEdit = kpi != null;
  const [form, setForm] = useState<FormState>(() =>
    initialForm(kpi, nextSortOrder)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const unit = resolveUnit(form);
  const trimmedName = form.name.trim();

  // Preview off the target if there is one, else the live value, else a
  // stand-in — the point is to show the unit's formatting, not the number.
  const previewBasis =
    form.target.trim() !== "" && !Number.isNaN(Number(form.target))
      ? Number(form.target)
      : (kpi?.value ?? 1485);

  // What will actually own this number once saved — computed from the pending
  // form, not the stored row, so the warning tracks what you're typing.
  const pendingMode = kpiWriteMode({ name: trimmedName, source: form.source });
  const pendingCopy = writeModeCopy(pendingMode, form.source);
  const sourceHint = SOURCE_OPTIONS.find((o) => o.value === form.source)?.hint;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    let target: number | null = null;
    if (form.target.trim() !== "") {
      const parsed = Number(form.target);
      if (Number.isNaN(parsed)) {
        setError("Target must be a number, or left blank for no target.");
        return;
      }
      target = parsed;
    }

    let sortOrder = isEdit ? (kpi?.sort_order ?? 0) : nextSortOrder;
    if (!isEdit && form.sortOrder.trim() !== "") {
      const parsed = Number(form.sortOrder);
      if (!Number.isInteger(parsed)) {
        setError("Position must be a whole number.");
        return;
      }
      sortOrder = parsed;
    }

    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    if (isEdit && kpi) {
      // Deliberately does not touch `value` or `last_synced_at` — those belong
      // to the click-to-edit flow on the card and to the sync job.
      const { data, error: dbError } = await supabase
        .from("kpis")
        .update({
          name: trimmedName,
          description: form.description.trim() || null,
          target,
          unit,
          source: form.source,
        })
        .eq("id", kpi.id)
        .eq("org_id", orgId)
        .select("*")
        .single();

      setSubmitting(false);
      if (dbError) {
        setError(dbError.message);
        return;
      }
      onSaved(data as Kpi, "edit");
      onOpenChange(false);
      toast.success(`"${trimmedName}" updated`);
      return;
    }

    // RLS matches `org_id` against the Clerk JWT claim, so the insert has to
    // carry it explicitly — the column has no database default.
    const { data, error: dbError } = await supabase
      .from("kpis")
      .insert({
        org_id: orgId,
        name: trimmedName,
        description: form.description.trim() || null,
        value: 0,
        target,
        unit,
        source: form.source,
        sort_order: sortOrder,
      })
      .select("*")
      .single();

    setSubmitting(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    onSaved(data as Kpi, "create");
    onOpenChange(false);
    toast.success(`"${trimmedName}" added to the scoreboard`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <div className="space-y-1">
        <label
          className="text-xs font-medium text-muted-foreground"
          htmlFor="kpi-name"
        >
          Name <span className="text-[color:var(--color-brand-danger)]">*</span>
        </label>
        <Input
          id="kpi-name"
          placeholder="e.g. Diagnostics Sold"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          autoFocus
        />
      </div>

      <div className="space-y-1">
        <label
          className="text-xs font-medium text-muted-foreground"
          htmlFor="kpi-description"
        >
          Description
        </label>
        <Textarea
          id="kpi-description"
          placeholder="What this measures, and any caveat the team should know."
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          className="min-h-16"
        />
        <p className="text-[11px] text-[color:var(--color-brand-mist)]">
          Shown behind the info icon on the card.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="kpi-target"
          >
            Target
          </label>
          <Input
            id="kpi-target"
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="No target"
            value={form.target}
            onChange={(e) => update("target", e.target.value)}
            className="font-data tabular-nums"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Unit
          </label>
          <Select
            value={form.unitChoice}
            onValueChange={(v) =>
              typeof v === "string" && update("unitChoice", v)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value ?? NO_UNIT}
                  value={opt.value ?? NO_UNIT}
                >
                  {opt.label}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_UNIT}>Custom…</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.unitChoice === CUSTOM_UNIT && (
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="kpi-custom-unit"
          >
            Custom unit
          </label>
          <Input
            id="kpi-custom-unit"
            placeholder="e.g. calls, hrs, leads"
            value={form.customUnit}
            onChange={(e) => update("customUnit", e.target.value)}
          />
          <p className="text-[11px] text-[color:var(--color-brand-mist)]">
            Appended after the number. Leave blank for no unit.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-slate)]/40 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-brand-mist)]">
          Renders as
        </p>
        <p className="text-lg font-bold font-data tabular-nums leading-tight">
          {formatKpiValue(previewBasis, unit)}
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Source
        </label>
        <Select
          value={form.source}
          onValueChange={(v) =>
            typeof v === "string" && update("source", v as KpiSource)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sourceHint && (
          <p className="text-[11px] text-[color:var(--color-brand-mist)]">
            {sourceHint}
          </p>
        )}
      </div>

      {/* Who will actually write the number once this is saved. Driven by the
          pending name + source, because the GHL sync matches on name. */}
      {trimmedName !== "" && (
        <div
          className={cn(
            "flex gap-2 rounded-lg border px-3 py-2 text-[11px] leading-relaxed",
            pendingCopy.tone === "warn"
              ? "border-[color:var(--color-brand-warning)]/40 bg-[color:var(--color-brand-warning)]/10 text-[color:var(--color-brand-warning)]"
              : pendingCopy.tone === "auto"
                ? "border-[color:var(--color-brand-electric)]/40 bg-[color:var(--color-brand-electric)]/10 text-[color:var(--color-brand-electric)]"
                : "border-[color:var(--color-brand-fog)] text-[color:var(--color-brand-mist)]"
          )}
        >
          {pendingCopy.tone === "warn" ? (
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
          ) : (
            <RefreshCw className="size-3.5 shrink-0 mt-0.5" />
          )}
          <span>{pendingCopy.detail}</span>
        </div>
      )}

      {!isEdit && (
        <div className="space-y-1">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="kpi-sort-order"
          >
            Position
          </label>
          <Input
            id="kpi-sort-order"
            type="number"
            step="1"
            value={form.sortOrder}
            onChange={(e) => update("sortOrder", e.target.value)}
            className="font-data tabular-nums"
          />
          <p className="text-[11px] text-[color:var(--color-brand-mist)]">
            Lower numbers sit earlier on the board. Defaults to the end.
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-[color:var(--color-brand-danger)]">{error}</p>
      )}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !trimmedName}>
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Add KPI"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function KpiFormDialog({
  open,
  onOpenChange,
  kpi,
  nextSortOrder,
  sessionKey,
  onSaved,
}: KpiFormDialogProps) {
  const isEdit = kpi != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit KPI" : "Add KPI"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Change what this KPI measures and how it renders. The current value is edited on the card itself."
              : "New KPIs start at 0. Enter this week's number on the card once it's on the board."}
          </DialogDescription>
        </DialogHeader>
        <KpiForm
          key={sessionKey}
          kpi={kpi}
          nextSortOrder={nextSortOrder}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
