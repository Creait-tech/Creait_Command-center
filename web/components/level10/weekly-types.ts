/**
 * `cc_kpi_weekly` — one recorded number per KPI per week — as the scorecard
 * reads it.
 *
 * The row shape and the `cc_kpi_weekly_record()` function both live in
 * `lib/supabase/types.ts`; this module re-exports them so the grid has one
 * import, and adds the defensive parsing PostgREST makes necessary (numeric
 * arrives as a string, jsonb as `unknown`).
 */

import type { CcKpiWeekly, WeeklyCorrection } from "@/lib/supabase/types";

export type { CcKpiWeekly, WeeklyCorrection };

/**
 * Who wrote a week's number.
 *
 * The distinction is load-bearing, not cosmetic. `manual` means a human typed
 * it in a Level 10 — including a retroactive correction of a synced figure —
 * and **nothing may overwrite it**: not the hourly GHL sync, not a re-run of
 * the backfill, not a future weekly-derivation job. That contract is enforced
 * in Postgres by the `cc_kpi_weekly_protect_manual` trigger (phase17), which
 * silently preserves a manual value when an UPDATE tries to turn the row back
 * into a `sync` row. Every write from this app goes through
 * `cc_kpi_weekly_record()`, which always stamps `manual`.
 */
export type WeeklyEntrySource = "manual" | "sync";

/** jsonb arrives as `unknown`; keep the parsing defensive and in one place. */
export function normalizeCorrections(raw: unknown): WeeklyCorrection[] {
  if (!Array.isArray(raw)) return [];
  const out: WeeklyCorrection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const at = typeof entry.at === "string" ? entry.at : null;
    if (!at) continue;
    out.push({
      from: typeof entry.from === "number" ? entry.from : null,
      to: typeof entry.to === "number" ? entry.to : null,
      from_source:
        entry.from_source === "manual" || entry.from_source === "sync"
          ? entry.from_source
          : null,
      by: typeof entry.by === "string" ? entry.by : null,
      by_name: typeof entry.by_name === "string" ? entry.by_name : null,
      at,
    });
  }
  return out;
}

/**
 * Normalise one row read back from PostgREST (numeric arrives as a string).
 *
 * `value` stays nullable, deliberately: `null` is a real state and is NOT
 * zero. It means nobody recorded a number for that week, and coercing it to 0
 * would invent a missed goal.
 */
export function asWeeklyRow(row: unknown): CcKpiWeekly {
  const raw = row as Record<string, unknown>;
  const value = raw.value;
  return {
    id: String(raw.id),
    org_id: String(raw.org_id),
    kpi_id: String(raw.kpi_id),
    week_start: String(raw.week_start),
    value:
      value === null || value === undefined || value === ""
        ? null
        : Number(value),
    source: raw.source === "sync" ? "sync" : "manual",
    entered_by: typeof raw.entered_by === "string" ? raw.entered_by : null,
    entered_by_name:
      typeof raw.entered_by_name === "string" ? raw.entered_by_name : null,
    corrections: normalizeCorrections(raw.corrections),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export function asWeeklyRows(rows: unknown): CcKpiWeekly[] {
  return Array.isArray(rows) ? rows.map(asWeeklyRow) : [];
}

/** Key for the `(kpi, week)` lookup the grid does once per cell. */
export function weeklyKey(kpiId: string, weekStart: string): string {
  return `${kpiId}|${weekStart}`;
}

export function indexWeekly(rows: CcKpiWeekly[]): Map<string, CcKpiWeekly> {
  const map = new Map<string, CcKpiWeekly>();
  for (const row of rows) map.set(weeklyKey(row.kpi_id, row.week_start), row);
  return map;
}
