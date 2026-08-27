"use client";

import { useMemo } from "react";
import { MoreVertical, Pencil, RefreshCw, Trash2, AlertTriangle } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { personName, type Person } from "@/lib/authorship";
import { cn } from "@/lib/utils";
import {
  describeGoal,
  formatGoal,
  formatGridValue,
  formatKpiValue,
  goalMet,
  kpiWriteMode,
  writeModeCopy,
  TOTAL_SUPPRESSED_HINT,
  type KpiRow,
} from "./kpi-meta";
import { rowStats, type RowStatus } from "./scorecard-math";
import { ScorecardCell } from "./scorecard-cell";
import {
  CAPPED_WEEK_EXPLAINER,
  formatWeekRange,
  formatWeekRangeLong,
  isCappedWeek,
} from "./weeks";
import type { CcKpiWeekly } from "./weekly-types";

/**
 * Column geometry.
 *
 * The identity block — status bar, owner, KPI, goal, average, total — is
 * frozen so a horizontally scrolled grid still says *which* number you are
 * looking at and *what it had to beat*. Widths are deliberately tight: at
 * 460px frozen, a 1440px laptop still shows six or seven week columns, which is
 * the difference between a scorecard you can read in a meeting and one you have
 * to scroll to understand. Kept as numbers rather than Tailwind classes because
 * each column's `left` offset is the running sum of the ones before it.
 */
const W = {
  status: 4,
  owner: 34,
  title: 184,
  goal: 78,
  average: 80,
  total: 80,
  week: 88,
} as const;

const LEFT = {
  status: 0,
  owner: W.status,
  title: W.status + W.owner,
  goal: W.status + W.owner + W.title,
  average: W.status + W.owner + W.title + W.goal,
  total: W.status + W.owner + W.title + W.goal + W.average,
} as const;

const STATUS_COLOR: Record<RowStatus, string> = {
  hit: "var(--color-brand-success)",
  miss: "var(--color-brand-danger)",
  unscored: "var(--color-brand-warning)",
  "no-goal": "var(--color-brand-fog)",
};

const STATUS_LABEL: Record<RowStatus, string> = {
  hit: "On track — the most recent scored week met its goal",
  miss: "Off track — the most recent scored week missed its goal",
  unscored: "Not scored yet — no trustworthy number in the weeks shown",
  "no-goal": "No goal set, so nothing to score against",
};

/** Sticky cells need their own opaque background or the grid scrolls through them. */
const FROZEN =
  "sticky z-10 bg-[color:var(--color-brand-charcoal)] group-hover/row:bg-[color:var(--color-brand-slate)] transition-colors";
const FROZEN_HEAD =
  "sticky z-20 bg-[color:var(--color-brand-slate)] transition-colors";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface OwnerChipProps {
  person: Person | undefined;
}

function OwnerChip({ person }: OwnerChipProps) {
  if (!person) {
    return (
      <span
        title="No owner. Every number on an EOS scorecard should have one — set it in Edit KPI."
        className="flex size-6 items-center justify-center rounded-full border border-dashed border-[color:var(--color-brand-fog)] text-[10px] text-[color:var(--color-brand-mist)]/60"
      >
        –
      </span>
    );
  }
  const name = personName(person);
  return (
    <span
      title={`Owner: ${name}`}
      className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-[color:var(--color-brand-fog)] text-[10px] font-semibold text-foreground"
    >
      {person.avatar_url ? (
        /* Avatars come from arbitrary external hosts, so next/image would need
           each one allow-listed in next.config; a 24px chip isn't worth it. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatar_url} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

interface WeeklyGridProps {
  kpis: KpiRow[];
  /** Newest first. */
  weekStarts: string[];
  entries: Map<string, CcKpiWeekly>;
  peopleById: Map<string, Person>;
  onSaveCell: (
    kpiId: string,
    weekStart: string,
    value: number | null,
  ) => Promise<boolean>;
  onEditKpi: (kpi: KpiRow) => void;
  onDeleteKpi: (kpi: KpiRow) => void;
}

export function WeeklyGrid({
  kpis,
  weekStarts,
  entries,
  peopleById,
  onSaveCell,
  onEditKpi,
  onDeleteKpi,
}: WeeklyGridProps) {
  const currentWeek = weekStarts[0];
  const stats = useMemo(
    () => new Map(kpis.map((kpi) => [kpi.id, rowStats(kpi, weekStarts, entries)])),
    [kpis, weekStarts, entries],
  );

  const hasCappedWeeks = weekStarts.some(isCappedWeek);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-charcoal)]">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              Weekly scorecard. Each row is one KPI; each column is one week,
              most recent first. A blank cell means no number was recorded.
            </caption>
            <thead>
              <tr>
                <th
                  aria-hidden="true"
                  className={cn(FROZEN_HEAD, "border-b border-[color:var(--color-brand-fog)] p-0")}
                  style={{ left: LEFT.status, width: W.status, minWidth: W.status }}
                />
                <th
                  scope="col"
                  className={cn(
                    FROZEN_HEAD,
                    "border-b border-[color:var(--color-brand-fog)] py-2 pl-2 text-left text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-mist)]",
                  )}
                  style={{ left: LEFT.owner, width: W.owner, minWidth: W.owner }}
                >
                  <span className="sr-only">Owner</span>
                </th>
                <th
                  scope="col"
                  className={cn(
                    FROZEN_HEAD,
                    "border-b border-[color:var(--color-brand-fog)] px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-mist)]",
                  )}
                  style={{ left: LEFT.title, width: W.title, minWidth: W.title }}
                >
                  Measurable
                </th>
                <th
                  scope="col"
                  className={cn(
                    FROZEN_HEAD,
                    "border-b border-[color:var(--color-brand-fog)] px-2 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-mist)]",
                  )}
                  style={{ left: LEFT.goal, width: W.goal, minWidth: W.goal }}
                >
                  Goal
                </th>
                <th
                  scope="col"
                  title="Mean of the weeks shown that carry a trustworthy number. Blank weeks are skipped, not counted as zero."
                  className={cn(
                    FROZEN_HEAD,
                    "border-b border-[color:var(--color-brand-fog)] px-2 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-mist)]",
                  )}
                  style={{ left: LEFT.average, width: W.average, minWidth: W.average }}
                >
                  Avg
                </th>
                <th
                  scope="col"
                  title={TOTAL_SUPPRESSED_HINT}
                  className={cn(
                    FROZEN_HEAD,
                    "border-b border-r border-[color:var(--color-brand-fog)] px-2 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-mist)] shadow-[8px_0_10px_-10px_rgba(0,0,0,0.9)]",
                  )}
                  style={{ left: LEFT.total, width: W.total, minWidth: W.total }}
                >
                  Total
                </th>
                {weekStarts.map((week) => {
                  const capped = isCappedWeek(week);
                  const isCurrent = week === currentWeek;
                  return (
                    <th
                      key={week}
                      scope="col"
                      title={
                        capped
                          ? `${formatWeekRangeLong(week)}\n\n${CAPPED_WEEK_EXPLAINER}`
                          : formatWeekRangeLong(week)
                      }
                      className="border-b border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-slate)] px-1.5 py-2 text-right align-bottom"
                      style={{ width: W.week, minWidth: W.week }}
                    >
                      <span
                        className={cn(
                          "block text-[11px] font-medium whitespace-nowrap",
                          isCurrent
                            ? "text-[color:var(--color-brand-electric)]"
                            : "text-foreground/70",
                        )}
                      >
                        {formatWeekRange(week)}
                      </span>
                      <span className="block h-3 text-[9px] uppercase tracking-wider">
                        {isCurrent ? (
                          <span className="text-[color:var(--color-brand-electric)]">
                            This week
                          </span>
                        ) : capped ? (
                          <span className="text-[color:var(--color-brand-warning)]">
                            capped
                          </span>
                        ) : null}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {kpis.map((kpi) => {
                const s = stats.get(kpi.id)!;
                const owner = kpi.owner_id
                  ? peopleById.get(kpi.owner_id)
                  : undefined;
                const mode = kpiWriteMode(kpi);
                const copy = writeModeCopy(mode, kpi.source);
                // The average is scored against the *weekly* goal, which is a
                // fair comparison for ">=" and "<=". An "=" goal is not: an
                // average landing exactly on a fixed quota is vanishingly
                // unlikely, so colouring it red would just be noise.
                const averageMet =
                  kpi.goal_operator === "="
                    ? null
                    : goalMet(s.average, kpi.target, kpi.goal_operator);

                return (
                  <tr key={kpi.id} className="group/row">
                    <td
                      className="sticky z-10 border-b border-[color:var(--color-brand-fog)] p-0"
                      style={{
                        left: LEFT.status,
                        width: W.status,
                        minWidth: W.status,
                        backgroundColor: STATUS_COLOR[s.status],
                      }}
                      title={STATUS_LABEL[s.status]}
                    >
                      <span className="sr-only">{STATUS_LABEL[s.status]}</span>
                    </td>

                    <td
                      className={cn(
                        FROZEN,
                        "border-b border-[color:var(--color-brand-fog)] py-1.5 pl-2",
                      )}
                      style={{ left: LEFT.owner, width: W.owner, minWidth: W.owner }}
                    >
                      <OwnerChip person={owner} />
                    </td>

                    <td
                      className={cn(
                        FROZEN,
                        "border-b border-[color:var(--color-brand-fog)] px-2 py-1.5",
                      )}
                      style={{ left: LEFT.title, width: W.title, minWidth: W.title }}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className="truncate font-medium text-foreground"
                          title={
                            kpi.description
                              ? `${kpi.name}\n\n${kpi.description}`
                              : kpi.name
                          }
                        >
                          {kpi.name}
                        </span>
                        {copy.tone !== "neutral" && (
                          <span
                            title={copy.detail}
                            className={cn(
                              "shrink-0 cursor-help",
                              copy.tone === "warn"
                                ? "text-[color:var(--color-brand-warning)]"
                                : "text-[color:var(--color-brand-electric)]",
                            )}
                          >
                            {copy.tone === "warn" ? (
                              <AlertTriangle className="size-3" />
                            ) : (
                              <RefreshCw className="size-3" />
                            )}
                            <span className="sr-only">{copy.badge}</span>
                          </span>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={`Actions for ${kpi.name}`}
                            className="ml-auto shrink-0 rounded p-0.5 text-[color:var(--color-brand-mist)] opacity-70 transition-colors hover:bg-[color:var(--color-brand-fog)] hover:text-foreground hover:opacity-100"
                          >
                            <MoreVertical className="size-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEditKpi(kpi)}>
                              <Pencil className="size-3.5" /> Edit KPI
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => onDeleteKpi(kpi)}
                            >
                              <Trash2 className="size-3.5" /> Delete KPI
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>

                    <td
                      className={cn(
                        FROZEN,
                        "border-b border-[color:var(--color-brand-fog)] px-2 py-1.5 text-right font-data tabular-nums text-[13px]",
                        kpi.target == null
                          ? "text-[color:var(--color-brand-mist)]/50"
                          : "text-[color:var(--color-brand-mist)]",
                      )}
                      style={{ left: LEFT.goal, width: W.goal, minWidth: W.goal }}
                      title={describeGoal(kpi)}
                    >
                      {formatGoal(kpi)}
                    </td>

                    <td
                      className={cn(
                        FROZEN,
                        "border-b border-[color:var(--color-brand-fog)] px-2 py-1.5 text-right font-data tabular-nums text-[13px]",
                        s.average == null
                          ? "text-[color:var(--color-brand-mist)]/40"
                          : averageMet === true
                            ? "text-[color:var(--color-brand-success)]"
                            : averageMet === false
                              ? "text-[color:var(--color-brand-danger)]"
                              : "text-foreground",
                      )}
                      style={{
                        left: LEFT.average,
                        width: W.average,
                        minWidth: W.average,
                      }}
                      title={
                        s.average == null
                          ? "No trustworthy weeks in view to average."
                          : [
                              `Average of ${s.usableWeeks} of the ${weekStarts.length} weeks shown: ${formatKpiValue(s.average, kpi.unit)}`,
                              s.excludedWeeks > 0
                                ? `${s.excludedWeeks} recorded ${s.excludedWeeks === 1 ? "week is" : "weeks are"} left out — ${CAPPED_WEEK_EXPLAINER}`
                                : "",
                            ]
                              .filter(Boolean)
                              .join("\n\n")
                      }
                    >
                      {s.average == null ? "–" : formatGridValue(s.average, kpi.unit)}
                      {s.excludedWeeks > 0 && s.average != null && (
                        <span
                          aria-hidden="true"
                          className="align-super text-[9px] text-[color:var(--color-brand-warning)]"
                        >
                          *
                        </span>
                      )}
                    </td>

                    <td
                      className={cn(
                        FROZEN,
                        "border-b border-r border-[color:var(--color-brand-fog)] px-2 py-1.5 text-right font-data tabular-nums text-[13px] shadow-[8px_0_10px_-10px_rgba(0,0,0,0.9)]",
                        s.total == null
                          ? "text-[color:var(--color-brand-mist)]/40"
                          : "text-foreground",
                      )}
                      style={{ left: LEFT.total, width: W.total, minWidth: W.total }}
                      title={
                        s.aggregation === "none"
                          ? TOTAL_SUPPRESSED_HINT
                          : s.total == null
                            ? "No trustworthy weeks in view to add up."
                            : `Sum of ${s.usableWeeks} of the ${weekStarts.length} weeks shown: ${formatKpiValue(s.total, kpi.unit)}`
                      }
                    >
                      {s.total == null ? "–" : formatGridValue(s.total, kpi.unit)}
                    </td>

                    {s.readings.map((reading) => (
                      <td
                        key={reading.weekStart}
                        className="border-b border-[color:var(--color-brand-fog)] px-1 py-1.5 transition-colors group-hover/row:bg-[color:var(--color-brand-slate)]/60"
                        style={{ width: W.week, minWidth: W.week }}
                      >
                        <ScorecardCell
                          kpi={kpi}
                          reading={reading}
                          onSave={(week, value) => onSaveCell(kpi.id, week, value)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <GridLegend hasCappedWeeks={hasCappedWeeks} />
    </div>
  );
}

function GridLegend({ hasCappedWeeks }: { hasCappedWeeks: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[color:var(--color-brand-mist)]">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-sm bg-[color:var(--color-brand-success)]" />
        Goal met
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-sm bg-[color:var(--color-brand-danger)]" />
        Goal missed
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-sm bg-[color:var(--color-brand-warning)]" />
        Nothing to score
      </span>
      <span className="flex items-center gap-1.5">
        <span className="font-data text-[color:var(--color-brand-mist)]/40">–</span>
        No number recorded (not zero)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="relative inline-block size-3 rounded-sm border border-[color:var(--color-brand-fog)]">
          <span className="absolute right-0 top-0 size-0 border-t-[6px] border-l-[6px] border-t-[color:var(--color-brand-mist)] border-l-transparent" />
        </span>
        Corrected — hover for what it used to say
      </span>
      {hasCappedWeeks && (
        <span
          className="flex items-center gap-1.5 text-[color:var(--color-brand-warning)]"
          title={CAPPED_WEEK_EXPLAINER}
        >
          <AlertTriangle className="size-3" />
          Weeks marked &ldquo;capped&rdquo; predate the 2026-08-07 row-cap fix — shown,
          but not scored or averaged
        </span>
      )}
    </div>
  );
}
