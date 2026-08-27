import type { Kpi, KpiGoalOperator, KpiSource } from "@/lib/supabase/types";

// =============================================================================
// Shared KPI presentation rules.
//
// Lives apart from `scoreboard.tsx` so the scoreboard and the create/edit
// dialog agree on how a value renders and on who owns a given number. Kept
// free of React and of any server-only import so both can use it.
// =============================================================================

/**
 * `kpis.unit` is free text in the database, but only three values change how a
 * number renders. Anything else is appended as a suffix; null renders bare.
 * The unit picker offers exactly this set so an operator can't pick a unit the
 * card doesn't know how to draw.
 */
export function formatKpiValue(value: number, unit: string | null): string {
  if (unit === "USD" || unit === "$") {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  if (unit === "%") {
    return `${value.toLocaleString("en-US")}%`;
  }
  if (unit) {
    return `${value.toLocaleString("en-US")} ${unit}`;
  }
  return value.toLocaleString("en-US");
}

export function formatTarget(target: number | null, unit: string | null): string {
  if (target == null) return "";
  return formatKpiValue(target, unit);
}

/**
 * Grid-sized rendering of the same number.
 *
 * A scorecard cell is ~88px wide and set in a monospace face, so
 * "$20,115,685" or "1,485 count" either wraps or stretches the column until a
 * week falls off the screen. Currency and percent keep their marker because it
 * changes what the number means; a free-text unit ("count") is dropped, since
 * the row heading already says what is being counted. Nothing is lost: every
 * cell, goal, average and total carries the full-precision figure in its
 * tooltip.
 *
 * The 10,000 threshold is set by the widest thing that has to fit — a goal
 * cell, which also carries an operator glyph. "≥ $67,000" does not fit;
 * "≥ $67K" does.
 */
export function formatGridValue(value: number, unit: string | null): string {
  const currency = unit === "USD" || unit === "$";
  const abs = Math.abs(value);
  const body =
    abs >= 10_000
      ? value.toLocaleString("en-US", {
          notation: "compact",
          maximumFractionDigits: 1,
        })
      : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (currency) return `$${body}`;
  if (unit === "%") return `${body}%`;
  return body;
}

// =============================================================================
// Goal direction
// =============================================================================

/**
 * `kpis.goal_operator` (migration `phase16_weekly_scorecard`, CHECK-constrained
 * to these three, default `>=`).
 *
 * The column exists because "higher is better" is not universal. Cost per lead,
 * churn and response time are hit by going *down*; scoring them the same way as
 * MRR paints every good week red. Nothing in this module may assume a
 * direction — always route through `goalMet`.
 */
export type GoalOperator = KpiGoalOperator;

/**
 * A KPI as the scorecard reads it.
 *
 * A plain alias: `lib/supabase/types.ts` now declares `goal_operator` and
 * `owner_id`, so no widening is needed. The name is kept because every call
 * site reads better as "a KPI row" and because it gives one place to widen
 * again if a future column lands ahead of the generated types.
 */
export type KpiRow = Kpi;

export function normalizeGoalOperator(value: unknown): GoalOperator {
  return value === "<=" || value === "=" ? value : ">=";
}

/**
 * Read a `select("*")` row.
 *
 * `Table<Kpi>` types the row as `Kpi & { [k: string]: unknown }`, so this both
 * narrows it and repairs a missing or unrecognised operator — a KPI created
 * before `goal_operator` existed, or by a path that didn't set it, must not
 * land here as `undefined` and score every week as unmet.
 */
export function asKpiRow(row: unknown): KpiRow {
  const raw = row as Record<string, unknown>;
  return {
    ...(raw as unknown as Kpi),
    goal_operator: normalizeGoalOperator(raw.goal_operator),
    owner_id: typeof raw.owner_id === "string" ? raw.owner_id : null,
  };
}

export function asKpiRows(rows: unknown): KpiRow[] {
  return Array.isArray(rows) ? rows.map(asKpiRow) : [];
}

export interface GoalOperatorOption {
  value: GoalOperator;
  /** Shown in the picker. */
  label: string;
  /** The glyph the grid renders next to the target. */
  glyph: string;
  hint: string;
}

export const GOAL_OPERATOR_OPTIONS: GoalOperatorOption[] = [
  {
    value: ">=",
    label: "At or above target",
    glyph: "≥",
    hint: "Green when the week's number reaches the target. Revenue, calls booked, demos.",
  },
  {
    value: "<=",
    label: "At or below target",
    glyph: "≤",
    hint: "Green when the week's number stays under the target. Cost, churn, response time.",
  },
  {
    value: "=",
    label: "Exactly on target",
    glyph: "=",
    hint: "Green only on an exact match. Rare — use it for a fixed quota.",
  },
];

export function goalOperatorGlyph(operator: GoalOperator): string {
  return (
    GOAL_OPERATOR_OPTIONS.find((o) => o.value === operator)?.glyph ?? operator
  );
}

/** Compact goal for the Goal column, e.g. `≥ $67K`. */
export function formatGoal(kpi: Pick<KpiRow, "target" | "unit" | "goal_operator">): string {
  if (kpi.target == null) return "—";
  return `${goalOperatorGlyph(kpi.goal_operator)} ${formatGridValue(kpi.target, kpi.unit)}`;
}

/** Full-precision goal for tooltips, e.g. `at or above $67,000`. */
export function describeGoal(
  kpi: Pick<KpiRow, "target" | "unit" | "goal_operator">,
): string {
  if (kpi.target == null) return "No goal set";
  const option = GOAL_OPERATOR_OPTIONS.find((o) => o.value === kpi.goal_operator);
  const phrase = option ? option.label.toLowerCase() : `${kpi.goal_operator}`;
  return `${phrase} ${formatKpiValue(kpi.target, kpi.unit)}`;
}

/**
 * Did this number hit the goal?
 *
 * `null` means "unscored" and is deliberately distinct from `false`:
 * a KPI with no target, or a week with no entry, has not missed anything.
 * Callers must render `null` as neutral, never as red.
 */
export function goalMet(
  value: number | null,
  target: number | null,
  operator: GoalOperator,
): boolean | null {
  if (value == null || target == null) return null;
  switch (operator) {
    case ">=":
      return value >= target;
    case "<=":
      return value <= target;
    case "=":
      return value === target;
  }
}

// =============================================================================
// Whether weeks can be added up
// =============================================================================

/**
 * Can a KPI's weekly values be summed into a Total?
 *
 * Only for a metric that measures a *flow through a week*. Summing a running
 * level — MRR, open pipeline, headcount, active deals — produces a number with
 * no meaning: "$16,335 of MRR across 11 weeks" is not a fact about the
 * business, and putting it in a column labelled Total invites someone to quote
 * it. A percentage never sums either.
 *
 * There is no column that records this, so it is inferred, conservatively:
 *  - a percent is never additive;
 *  - a KPI whose **name declares its window** ("Conversations 7d", "Calls
 *    Booked 7d", "Demos per week") is a per-week flow, so it sums;
 *  - everything else is treated as a level and the Total is suppressed rather
 *    than guessed.
 *
 * The rule is stated in the UI on every suppressed cell, so the escape hatch —
 * name the KPI with its window — is discoverable rather than magic.
 */
export type KpiAggregation = "sum" | "none";

const WINDOW_MARKER =
  /(^|[\s(])\d+\s?d($|[\s)])|\bper\s+week\b|\bweekly\b|\bthis\s+week\b|\/\s?wk\b|\bwk\b/i;

export function kpiAggregation(kpi: Pick<Kpi, "name" | "unit">): KpiAggregation {
  if (kpi.unit === "%") return "none";
  return WINDOW_MARKER.test(kpi.name) ? "sum" : "none";
}

export const TOTAL_SUPPRESSED_HINT =
  "No total: this KPI reads as a running level (like MRR or open pipeline), and adding a level up across weeks isn't a real number. Totals show for per-week counts — name a KPI with its window (e.g. \"Calls Booked 7d\") to get one.";

export interface UnitOption {
  /** Stored in `kpis.unit`. `null` means "no unit — render a bare number". */
  value: string | null;
  label: string;
  /** Live example so the picker shows the formatting, not just the name. */
  preview: string;
}

/**
 * Every unit `formatKpiValue` treats specially, plus the two shapes already in
 * the seeded data ("count", none). `$` is accepted by the formatter as a
 * synonym for USD but isn't offered — one canonical spelling avoids two
 * currency KPIs that look identical but sort/compare as different units.
 */
export const UNIT_OPTIONS: UnitOption[] = [
  { value: null, label: "None — plain number", preview: "1,485" },
  { value: "USD", label: "Currency (USD)", preview: "$1,485" },
  { value: "%", label: "Percent", preview: "12%" },
  { value: "count", label: "Count", preview: "1,485 count" },
];

/** Sentinel used only inside the unit picker; never written to the database. */
export const CUSTOM_UNIT = "__custom__";
/** Sentinel for the null unit — Base UI Select needs a string value. */
export const NO_UNIT = "__none__";

export interface SourceOption {
  value: KpiSource;
  label: string;
  hint: string;
}

export const SOURCE_OPTIONS: SourceOption[] = [
  {
    value: "manual",
    label: "Manual",
    hint: "You type this number in the Level 10. Nothing overwrites it.",
  },
  {
    value: "ghl",
    label: "GoHighLevel",
    hint: "Pulled from GHL by the hourly sync — a typed value gets replaced.",
  },
  {
    value: "stripe",
    label: "Stripe",
    hint: "Reserved. No Stripe sync runs yet, so this stays a typed number.",
  },
  {
    value: "google",
    label: "Google",
    hint: "Reserved. No Google sync runs yet, so this stays a typed number.",
  },
  {
    value: "other",
    label: "Other",
    hint: "Fed by a process outside this app. Nothing here overwrites it.",
  },
];

/**
 * The KPI names the hourly GHL sync writes.
 *
 * Load-bearing subtlety: `ghlSync` in `lib/inngest-functions.ts` finds rows
 * with `.eq('name', name)` — it matches on **name, not on `source`**. So this
 * list, not the `source` column, is what actually decides whether a number
 * gets overwritten. A `source = 'ghl'` KPI whose name isn't here never syncs;
 * a `source = 'manual'` KPI named "MRR" is overwritten anyway.
 *
 * Duplicated rather than imported because that module pulls in the Inngest
 * server client and can't be loaded in a browser bundle. Keep it in step with
 * the `updates` array there — same arrangement as `meetings.meeting_type` and
 * `lib/meeting-agendas.ts`. Matching is exact and case-sensitive, as in the
 * query.
 */
export const GHL_SYNCED_KPI_NAMES = [
  "MRR",
  "Active Deals",
  "Conversations 7d",
  "New Contacts 7d",
  "Open Pipeline Value",
] as const;

export function isGhlSyncedName(name: string): boolean {
  return (GHL_SYNCED_KPI_NAMES as readonly string[]).includes(name.trim());
}

/**
 * Who actually writes this KPI's value.
 *
 * - `manual`   — you own it; nothing overwrites it.
 * - `synced`   — the hourly GHL sync writes it. Typing here is temporary.
 * - `declared` — the row claims an automated source, but no job writes this
 *                name. The value is whatever was last typed, and the "last
 *                synced" stamp will never advance.
 * - `shadowed` — the row says manual, but the GHL sync writes this name. The
 *                most dangerous case: it looks hand-owned and isn't.
 */
export type KpiWriteMode = "manual" | "synced" | "declared" | "shadowed";

export function kpiWriteMode(kpi: Pick<Kpi, "name" | "source">): KpiWriteMode {
  const syncedName = isGhlSyncedName(kpi.name);
  if (kpi.source === "manual") return syncedName ? "shadowed" : "manual";
  if (kpi.source === "ghl") return syncedName ? "synced" : "declared";
  return "declared";
}

export interface WriteModeCopy {
  /** Short label for the card badge. */
  badge: string;
  /** Sentence shown on hover and inside the edit form. */
  detail: string;
  /** Warning shown when the operator is about to type a value by hand. */
  editWarning: string | null;
  /** Whether the badge should read as an alert rather than plain metadata. */
  tone: "neutral" | "auto" | "warn";
}

export function writeModeCopy(
  mode: KpiWriteMode,
  source: KpiSource
): WriteModeCopy {
  switch (mode) {
    case "manual":
      return {
        badge: "Manual",
        detail:
          "You own this number. Nothing overwrites it — it stays as typed until someone changes it.",
        editWarning: null,
        tone: "neutral",
      };
    case "synced":
      return {
        badge: "Auto · GHL",
        detail:
          "The hourly GoHighLevel sync writes this number. Editing it by hand is temporary.",
        editWarning:
          "This KPI is written by the hourly GoHighLevel sync — your number will be replaced on the next run. To keep a typed value, edit the KPI and set its source to Manual (and rename it, since the sync matches on name).",
        tone: "auto",
      };
    case "declared":
      return {
        badge: `${sourceLabel(source)} · not syncing`,
        detail: `This KPI is marked "${sourceLabel(
          source
        )}", but no background job writes a KPI with this name. The value is whatever was last typed, and the sync stamp will never advance.`,
        editWarning:
          "No sync feeds this KPI despite its source, so your value will stick — but the card will keep reporting a stale sync stamp. Set the source to Manual to make that honest.",
        tone: "warn",
      };
    case "shadowed":
      return {
        badge: "Manual · overwritten",
        detail:
          "This KPI is marked Manual, but the hourly GoHighLevel sync matches KPIs by name and writes this one. It is not hand-owned.",
        editWarning:
          "Despite the Manual source, the hourly GoHighLevel sync matches on name and writes this KPI — your number will be replaced. Rename it if you want to own the value.",
        tone: "warn",
      };
  }
}

export function sourceLabel(source: KpiSource): string {
  return SOURCE_OPTIONS.find((o) => o.value === source)?.label ?? source;
}
