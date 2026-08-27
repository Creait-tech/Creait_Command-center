"use client";

import { useMemo } from "react";

import { personName, type Person } from "@/lib/authorship";
import { cn } from "@/lib/utils";
import {
  describeGoal,
  formatGoal,
  formatGridValue,
  formatKpiValue,
  type KpiRow,
} from "./kpi-meta";
import { trailing, type TrailingResult } from "./scorecard-math";
import { CAPPED_WEEK_EXPLAINER, TRAILING_WINDOWS } from "./weeks";
import type { CcKpiWeekly } from "./weekly-types";

/**
 * Trailing 4 and trailing 13 weeks — Ninety.io's second tab, derived from the
 * same rows the Weekly grid renders, with two things spelled out rather than
 * implied:
 *
 *  - **Which aggregate.** A per-week flow is totalled; a running level is
 *    averaged. Every cell says which one it did, because "T13W = 16,335" means
 *    two completely different things depending on the answer.
 *  - **How much of the window was real.** With eleven weeks on record — five of
 *    them from the capped-100 era — a "trailing 13" that quietly averaged four
 *    weeks would look like a quarter of evidence. The coverage is printed on
 *    the cell, and a window with nothing usable in it stays blank.
 */

interface TrailingCellProps {
  kpi: KpiRow;
  result: TrailingResult;
}

function TrailingCell({ kpi, result }: TrailingCellProps) {
  if (result.value == null) {
    return (
      <div
        className="text-right"
        title={
          result.excluded > 0
            ? `Nothing to aggregate: the ${result.window} weeks in this window hold ${result.excluded} recorded ${result.excluded === 1 ? "week" : "weeks"}, all from before the row-cap fix.\n\n${CAPPED_WEEK_EXPLAINER}`
            : `No numbers recorded in the last ${result.window} weeks.`
        }
      >
        <span className="font-data tabular-nums text-[color:var(--color-brand-mist)]/40">
          –
        </span>
        <span className="block text-[10px] text-[color:var(--color-brand-mist)]/60">
          no data
        </span>
      </div>
    );
  }

  const complete = result.used === result.window;
  const modeLabel = result.mode === "sum" ? "total" : "avg";

  return (
    <div
      className="text-right"
      title={[
        `${result.mode === "sum" ? "Total" : "Average"} of the last ${result.window} weeks: ${formatKpiValue(result.value, kpi.unit)}`,
        `Built from ${result.used} of ${result.window} weeks.`,
        result.excluded > 0
          ? `${result.excluded} recorded ${result.excluded === 1 ? "week was" : "weeks were"} left out.\n\n${CAPPED_WEEK_EXPLAINER}`
          : "",
        result.comparable
          ? `Compared against the weekly goal (${describeGoal(kpi)}).`
          : "A multi-week total isn't comparable with a weekly goal, so it isn't scored.",
      ]
        .filter(Boolean)
        .join("\n\n")}
    >
      <span
        className={cn(
          "font-data tabular-nums text-[13px] font-semibold",
          result.met === true
            ? "text-[color:var(--color-brand-success)]"
            : result.met === false
              ? "text-[color:var(--color-brand-danger)]"
              : "text-foreground",
        )}
      >
        {formatGridValue(result.value, kpi.unit)}
      </span>
      <span
        className={cn(
          "block text-[10px]",
          complete
            ? "text-[color:var(--color-brand-mist)]/70"
            : "text-[color:var(--color-brand-warning)]",
        )}
      >
        {modeLabel} · {result.used}/{result.window} wks
      </span>
    </div>
  );
}

interface TrailingViewProps {
  kpis: KpiRow[];
  weekStarts: string[];
  entries: Map<string, CcKpiWeekly>;
  peopleById: Map<string, Person>;
}

export function TrailingView({
  kpis,
  weekStarts,
  entries,
  peopleById,
}: TrailingViewProps) {
  const rows = useMemo(
    () =>
      kpis.map((kpi) => ({
        kpi,
        windows: TRAILING_WINDOWS.map((w) =>
          trailing(kpi, weekStarts, entries, w),
        ),
      })),
    [kpis, weekStarts, entries],
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        The same weeks, rolled up. Per-week counts are totalled; running levels
        (MRR, open pipeline) are averaged — each cell says which, and how many
        weeks it actually had to work with.
      </p>

      <div className="overflow-hidden rounded-xl border border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-charcoal)]">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-[color:var(--color-brand-slate)]">
              <th
                scope="col"
                className="border-b border-[color:var(--color-brand-fog)] px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-mist)]"
              >
                Measurable
              </th>
              <th
                scope="col"
                className="border-b border-[color:var(--color-brand-fog)] px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-mist)]"
              >
                Owner
              </th>
              <th
                scope="col"
                className="border-b border-[color:var(--color-brand-fog)] px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-mist)]"
              >
                Weekly goal
              </th>
              <th
                scope="col"
                className="border-b border-[color:var(--color-brand-fog)] px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-mist)]"
              >
                T4W
              </th>
              <th
                scope="col"
                className="border-b border-[color:var(--color-brand-fog)] px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-mist)]"
              >
                T13W
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ kpi, windows }) => {
              const owner = kpi.owner_id ? peopleById.get(kpi.owner_id) : undefined;
              return (
                <tr key={kpi.id} className="hover:bg-[color:var(--color-brand-slate)]/50">
                  <td
                    className="border-b border-[color:var(--color-brand-fog)] px-3 py-2 font-medium"
                    title={kpi.description ?? undefined}
                  >
                    {kpi.name}
                  </td>
                  <td className="border-b border-[color:var(--color-brand-fog)] px-3 py-2 text-[color:var(--color-brand-mist)]">
                    {owner ? personName(owner) : "—"}
                  </td>
                  <td
                    className="border-b border-[color:var(--color-brand-fog)] px-3 py-2 text-right font-data tabular-nums text-[color:var(--color-brand-mist)]"
                    title={describeGoal(kpi)}
                  >
                    {formatGoal(kpi)}
                  </td>
                  {windows.map((result) => (
                    <td
                      key={result.window}
                      className="border-b border-[color:var(--color-brand-fog)] px-3 py-2"
                    >
                      <TrailingCell kpi={kpi} result={result} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
