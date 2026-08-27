/**
 * Turning stored weeks into the numbers a scorecard row shows.
 *
 * Two rules run through everything here:
 *
 *  1. **A blank week is unknown, not zero.** A missing row, or a row whose
 *     `value` is null, contributes nothing to an average, nothing to a total,
 *     and never colours red. Treating absent data as a 0 invents a miss.
 *
 *  2. **The capped-100 era is not evidence.** Weeks that began before the GHL
 *     row-cap fix recorded a ceiling rather than a measurement, so a synced
 *     value in one of those weeks is shown but not counted. The moment a human
 *     types over that cell it becomes `source = 'manual'` and counts again —
 *     correcting the plateau is the intended workflow, not a workaround.
 */

import {
  goalMet,
  kpiAggregation,
  type KpiAggregation,
  type KpiRow,
} from "./kpi-meta";
import { isCappedWeek } from "./weeks";
import { weeklyKey, type CcKpiWeekly } from "./weekly-types";

export interface WeekReading {
  weekStart: string;
  entry: CcKpiWeekly | undefined;
  /** `null` when nobody recorded a number for this week. */
  value: number | null;
  /**
   * A synced value from before the row-cap fix: shown as recorded, but left
   * unscored and out of the aggregates. A human correction clears this.
   */
  unreliable: boolean;
  /** Whether this reading counts toward Average / Total. */
  usable: boolean;
  /** `true` hit, `false` missed, `null` nothing to score. */
  met: boolean | null;
}

export type RowStatus = "hit" | "miss" | "unscored" | "no-goal";

export interface RowStats {
  readings: WeekReading[];
  /** Average across the usable weeks in view. */
  average: number | null;
  /** Sum across the usable weeks, or `null` when this KPI can't be summed. */
  total: number | null;
  aggregation: KpiAggregation;
  /** How many of the weeks in view carried a usable number. */
  usableWeeks: number;
  /** Recorded weeks skipped because they predate the row-cap fix. */
  excludedWeeks: number;
  /** The most recent week that had something to score, if any. */
  latest: WeekReading | null;
  status: RowStatus;
}

export function readWeek(
  kpi: KpiRow,
  weekStart: string,
  entries: Map<string, CcKpiWeekly>,
): WeekReading {
  const entry = entries.get(weeklyKey(kpi.id, weekStart));
  const value = entry?.value ?? null;
  const unreliable =
    isCappedWeek(weekStart) && value !== null && entry?.source !== "manual";
  const usable = value !== null && !unreliable;
  return {
    weekStart,
    entry,
    value,
    unreliable,
    usable,
    met: usable ? goalMet(value, kpi.target, kpi.goal_operator) : null,
  };
}

/**
 * @param weekStarts newest first, as the grid renders them.
 */
export function rowStats(
  kpi: KpiRow,
  weekStarts: string[],
  entries: Map<string, CcKpiWeekly>,
): RowStats {
  const readings = weekStarts.map((week) => readWeek(kpi, week, entries));
  const usable = readings.filter((r) => r.usable);
  const excludedWeeks = readings.filter((r) => r.unreliable).length;

  const sum = usable.reduce((acc, r) => acc + (r.value ?? 0), 0);
  const average = usable.length > 0 ? sum / usable.length : null;
  const aggregation = kpiAggregation(kpi);
  const total = aggregation === "sum" && usable.length > 0 ? sum : null;

  const latest = usable[0] ?? null;
  const status: RowStatus =
    kpi.target == null
      ? "no-goal"
      : latest == null
        ? "unscored"
        : latest.met
          ? "hit"
          : "miss";

  return {
    readings,
    average,
    total,
    aggregation,
    usableWeeks: usable.length,
    excludedWeeks,
    latest,
    status,
  };
}

// -----------------------------------------------------------------------------
// Trailing windows (T4W / T13W)
// -----------------------------------------------------------------------------

export interface TrailingResult {
  /** `sum` for per-week flows, `average` for running levels. */
  mode: "sum" | "average";
  value: number | null;
  /** Usable weeks found inside the window. */
  used: number;
  /** Length of the window (4 or 13). */
  window: number;
  /** Recorded weeks inside the window skipped as capped-era. */
  excluded: number;
  /** Whether that aggregate can be compared with the weekly goal. */
  comparable: boolean;
  met: boolean | null;
}

/**
 * Aggregate the most recent `window` weeks.
 *
 * The mode follows the same additivity rule as the Total column: a per-week
 * flow is summed, a running level is averaged. Only the average is scored
 * against the goal — `kpis.target` is a *weekly* target, so comparing a
 * 13-week sum against it would mark every healthy row red.
 */
export function trailing(
  kpi: KpiRow,
  weekStarts: string[],
  entries: Map<string, CcKpiWeekly>,
  window: number,
): TrailingResult {
  const slice = weekStarts.slice(0, window);
  const readings = slice.map((week) => readWeek(kpi, week, entries));
  const usable = readings.filter((r) => r.usable);
  const excluded = readings.filter((r) => r.unreliable).length;
  const mode = kpiAggregation(kpi) === "sum" ? "sum" : "average";

  if (usable.length === 0) {
    return {
      mode,
      value: null,
      used: 0,
      window,
      excluded,
      comparable: false,
      met: null,
    };
  }

  const sum = usable.reduce((acc, r) => acc + (r.value ?? 0), 0);
  const value = mode === "sum" ? sum : sum / usable.length;
  const comparable = mode === "average";

  return {
    mode,
    value,
    used: usable.length,
    window,
    excluded,
    comparable,
    met: comparable ? goalMet(value, kpi.target, kpi.goal_operator) : null,
  };
}
