"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { formatGridValue, formatKpiValue, type KpiRow } from "./kpi-meta";
import type { WeekReading } from "./scorecard-math";
import { CAPPED_WEEK_SHORT, formatWeekRangeLong } from "./weeks";
import type { WeeklyCorrection } from "./weekly-types";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function describeCorrection(
  correction: WeeklyCorrection,
  unit: string | null,
): string {
  const from =
    correction.from == null ? "blank" : formatKpiValue(correction.from, unit);
  const to = correction.to == null ? "blank" : formatKpiValue(correction.to, unit);
  const who = correction.by_name ?? "someone";
  const when = formatWhen(correction.at);
  return `${from} → ${to} by ${who}${when ? ` on ${when}` : ""}`;
}

/**
 * Everything a reader might need to trust the number, in one native tooltip.
 *
 * Native `title` rather than a hover card on purpose: it is what the rest of
 * this scoreboard already uses, it survives a horizontally scrolled grid, and
 * it carries multi-line text without adding a popup to every one of ~80 cells.
 */
function cellTooltip(kpi: KpiRow, reading: WeekReading): string {
  const lines: string[] = [
    `${kpi.name} · ${formatWeekRangeLong(reading.weekStart)}`,
  ];

  if (reading.value == null) {
    lines.push("No number recorded — this week is unknown, not zero.");
  } else {
    lines.push(formatKpiValue(reading.value, kpi.unit));
  }

  const entry = reading.entry;
  if (entry) {
    if (entry.source === "manual") {
      lines.push(
        entry.entered_by_name
          ? `Entered by ${entry.entered_by_name}${
              entry.updated_at ? ` · ${formatWhen(entry.updated_at)}` : ""
            }`
          : "Entered by hand",
      );
    } else {
      lines.push("From the GoHighLevel sync");
    }
  }

  if (reading.unreliable) {
    lines.push(`⚠ ${CAPPED_WEEK_SHORT} — not scored, not counted in Average or Total.`);
  } else if (reading.met === true) {
    lines.push("Goal met");
  } else if (reading.met === false) {
    lines.push("Goal missed");
  }

  const corrections = entry?.corrections ?? [];
  if (corrections.length > 0) {
    lines.push("");
    lines.push(
      corrections.length === 1 ? "Corrected once:" : `Corrected ${corrections.length} times:`,
    );
    for (const correction of corrections.slice(-3)) {
      lines.push(`• ${describeCorrection(correction, kpi.unit)}`);
    }
    if (corrections.length > 3) {
      lines.push(`• …and ${corrections.length - 3} earlier`);
    }
  }

  lines.push("");
  lines.push("Click to enter or correct this week's number.");
  return lines.join("\n");
}

interface ScorecardCellProps {
  kpi: KpiRow;
  reading: WeekReading;
  /** Resolves `true` when the value is stored, `false` when the write failed. */
  onSave: (weekStart: string, value: number | null) => Promise<boolean>;
}

export function ScorecardCell({ kpi, reading, onSave }: ScorecardCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Escape has to beat the blur handler, which would otherwise commit the very
  // edit the user just abandoned.
  const cancelled = useRef(false);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const corrections = reading.entry?.corrections ?? [];
  const corrected = corrections.length > 0;

  function startEdit() {
    if (saving) return;
    cancelled.current = false;
    setDraft(reading.value == null ? "" : String(reading.value));
    setEditing(true);
  }

  async function commit() {
    if (cancelled.current) return;
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);

    if (next !== null && !Number.isFinite(next)) {
      // Leave the cell open so the bad input is visible and fixable.
      inputRef.current?.focus();
      return;
    }
    if (next === reading.value) {
      setEditing(false);
      return;
    }

    setSaving(true);
    const ok = await onSave(reading.weekStart, next);
    setSaving(false);
    setEditing(false);
    if (!ok) setDraft(reading.value == null ? "" : String(reading.value));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelled.current = true;
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        step="any"
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => void commit()}
        aria-label={`${kpi.name}, week of ${formatWeekRangeLong(reading.weekStart)}`}
        placeholder="blank"
        className="h-8 w-full rounded-md border border-[color:var(--color-brand-electric)] bg-[color:var(--color-brand-ink)] px-1.5 text-right text-[13px] font-data tabular-nums text-foreground outline-none disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    );
  }

  const blank = reading.value == null;

  return (
    <button
      type="button"
      onClick={startEdit}
      title={cellTooltip(kpi, reading)}
      aria-label={[
        kpi.name,
        formatWeekRangeLong(reading.weekStart),
        blank ? "no number recorded" : formatKpiValue(reading.value!, kpi.unit),
        reading.unreliable ? "unreliable, pre-row-cap-fix" : "",
        reading.met === true ? "goal met" : reading.met === false ? "goal missed" : "",
        corrected ? "corrected" : "",
      ]
        .filter(Boolean)
        .join(", ")}
      className={cn(
        "relative flex h-8 w-full items-center justify-end rounded-md px-1.5 text-[13px] font-data tabular-nums transition-colors",
        "hover:bg-[color:var(--color-brand-fog)]/50 focus-visible:bg-[color:var(--color-brand-fog)]/50",
        saving && "opacity-50",
        blank
          ? "text-[color:var(--color-brand-mist)]/40"
          : reading.unreliable
            ? "text-[color:var(--color-brand-mist)] decoration-dotted underline underline-offset-4 decoration-[color:var(--color-brand-warning)]"
            : reading.met === true
              ? "text-[color:var(--color-brand-success)] font-semibold"
              : reading.met === false
                ? "text-[color:var(--color-brand-danger)] font-semibold"
                : "text-foreground",
      )}
    >
      {blank ? "–" : formatGridValue(reading.value!, kpi.unit)}
      {corrected && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 size-0 border-t-[7px] border-l-[7px] border-t-[color:var(--color-brand-mist)] border-l-transparent"
        />
      )}
    </button>
  );
}
