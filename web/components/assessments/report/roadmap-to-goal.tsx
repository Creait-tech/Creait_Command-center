import type { CcAssessmentOpportunity } from "@/lib/supabase/types";
import { formatMoney } from "@/lib/assessment-instrument";
import { compactMoney, niceMax, T, VB_W } from "./tokens";

/**
 * Two paths, one chart — the closing argument of the money section.
 *
 * FORM — two cumulative series over the same twelve months, so two lines on
 * ONE axis, both in dollars. "If nothing changes" is the bleed math the reader
 * has already seen (the monthly gap repeated — straight, never compounded).
 * "If the plan is executed" is the same overlap-adjusted expected recovery,
 * phased in by each initiative's months-to-benefit: an initiative contributes
 * nothing until its start month and its full run-rate after. Because every
 * initiative starts at or after month zero, the recovery line can never cross
 * above the foregone line — the chart is honest by construction.
 *
 * COLOR — the foregone path is dashed and muted; the executed path is solid
 * and blue. Dash + weight survive grayscale; both lines are labeled directly
 * at their endpoints, so there is no color-only legend. NO compounding, NO
 * invented growth rates: both lines are straight-line arithmetic shown in
 * full underneath.
 */

export interface RoadmapRow {
  id: string;
  title: string;
  /** Raw annual expected. */
  expected: number;
  /** × overlap factor. */
  adjExpected: number;
  /** adjExpected ÷ 12. */
  monthly: number;
  /** Month the initiative starts contributing (months_to_benefit, clamped). */
  startMonth: number;
  /** monthly × (12 − startMonth): what lands inside the first year. */
  yearOne: number;
}

/** Rows the chart can honestly draw — unpriced initiatives are omitted. */
export function roadmapRows(
  opportunities: CcAssessmentOpportunity[],
  overlapFactor: number
): RoadmapRow[] {
  return opportunities
    .filter(
      (o) =>
        o.include_in_report &&
        o.annual_expected !== null &&
        Number(o.annual_expected) > 0
    )
    .map((o) => {
      const expected = Number(o.annual_expected);
      const adjExpected = expected * overlapFactor;
      const monthly = adjExpected / 12;
      const startMonth = Math.min(
        12,
        Math.max(0, Number(o.months_to_benefit ?? 0) || 0)
      );
      return {
        id: o.id,
        title: o.title,
        expected,
        adjExpected,
        monthly,
        startMonth,
        yearOne: monthly * (12 - startMonth),
      };
    })
    .sort((a, b) => b.adjExpected - a.adjExpected);
}

export function RoadmapToGoal({
  rows,
  annualExpected,
  overlapApplied,
  overlapFactor,
}: {
  rows: RoadmapRow[];
  /** The overlap-adjusted expected portfolio — the foregone line's month 12. */
  annualExpected: number;
  overlapApplied: boolean;
  overlapFactor: number;
}) {
  if (rows.length === 0 || !Number.isFinite(annualExpected) || annualExpected <= 0) {
    return null;
  }

  const monthlyGap = annualExpected / 12;
  const recoveredAt = (m: number) =>
    rows.reduce((acc, r) => acc + Math.max(0, m - r.startMonth) * r.monthly, 0);
  const yearOneTotal = recoveredAt(12);

  const H = 236;
  const PAD_L = 58;
  const TOP = 30;
  const BOTTOM = 168;
  // Room on the right for the two endpoint labels.
  const PAD_R = 150;
  const plotW = VB_W - PAD_L - PAD_R;
  const domain = niceMax(annualExpected);

  const x = (m: number) => PAD_L + (m / 12) * plotW;
  const y = (v: number) => BOTTOM - (v / domain) * (BOTTOM - TOP);

  const foregonePath = `M ${x(0)} ${y(0)} L ${x(12)} ${y(annualExpected)}`;
  // The recovery line is piecewise-linear with a breakpoint at each start
  // month — evaluate it exactly there rather than sampling.
  const breakpoints = Array.from(
    new Set([0, 12, ...rows.map((r) => r.startMonth)])
  ).sort((a, b) => a - b);
  const recoveredPath = breakpoints
    .map((m, i) => `${i === 0 ? "M" : "L"} ${x(m)} ${y(recoveredAt(m))}`)
    .join(" ");

  const yTicks = [0, domain / 2, domain];
  const foreY = y(annualExpected);
  const recY = y(yearOneTotal);
  // Keep the two endpoint labels from colliding when the lines converge.
  const labelsClose = Math.abs(recY - foreY) < 30;
  const recLabelY = labelsClose ? foreY + 30 : recY;

  return (
    <div>
      <svg
        viewBox={`0 0 ${VB_W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={`Projection comparing two paths over twelve months. If nothing changes: ${compactMoney(
          annualExpected
        )} of operating profit foregone. If the plan is executed: ${compactMoney(
          yearOneTotal
        )} recovered in year one, with each initiative contributing from its own start month. Straight-line arithmetic, not compounded.`}
      >
        {yTicks.map((t, i) => (
          <g key={`y${i}`}>
            <line
              x1={PAD_L}
              y1={y(t)}
              x2={PAD_L + plotW}
              y2={y(t)}
              stroke="#eef2f6"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize={9}
              fill={T.muted}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {compactMoney(t)}
            </text>
          </g>
        ))}

        <g clipPath="url(#rp-goal-reveal)">
          <defs>
            <clipPath id="rp-goal-reveal">
              <rect
                className="rp-grow-x"
                style={{ ["--d" as string]: "120ms" }}
                x={PAD_L}
                y={0}
                width={plotW + 2}
                height={H}
              />
            </clipPath>
          </defs>
          <path
            d={foregonePath}
            fill="none"
            stroke={T.muted}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeDasharray="7 5"
          />
          <path
            d={recoveredPath}
            fill="none"
            stroke={T.blue}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Endpoints + direct labels — no color-only legend. */}
        <g className="rp-fade" style={{ ["--d" as string]: "760ms" }}>
          <circle
            cx={x(12)}
            cy={foreY}
            r={4.5}
            fill={T.surface}
            stroke={T.muted}
            strokeWidth={2}
          />
          <text x={x(12) + 10} y={foreY - 5} fontSize={10} fontWeight={800} fill={T.ink}>
            {compactMoney(annualExpected)} foregone
          </text>
          <text x={x(12) + 10} y={foreY + 7} fontSize={9} fill={T.muted}>
            if nothing changes (dashed)
          </text>
        </g>
        <g className="rp-fade" style={{ ["--d" as string]: "920ms" }}>
          <circle
            cx={x(12)}
            cy={recY}
            r={4.5}
            fill={T.blue}
            stroke={T.surface}
            strokeWidth={2}
          />
          <text x={x(12) + 10} y={recLabelY - 5} fontSize={10} fontWeight={800} fill={T.blue}>
            {compactMoney(yearOneTotal)} recovered
          </text>
          <text x={x(12) + 10} y={recLabelY + 7} fontSize={9} fill={T.muted}>
            if the plan is executed (solid)
          </text>
        </g>

        <line
          x1={PAD_L}
          y1={BOTTOM}
          x2={PAD_L + plotW}
          y2={BOTTOM}
          stroke={T.line}
          strokeWidth={1}
        />
        {[0, 3, 6, 9, 12].map((m) => (
          <text
            key={`x${m}`}
            x={x(m)}
            y={BOTTOM + 15}
            textAnchor={m === 0 ? "start" : m === 12 ? "end" : "middle"}
            fontSize={9}
            fill={T.muted}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {m === 0 ? "today" : `month ${m}`}
          </text>
        ))}
        <text x={PAD_L} y={BOTTOM + 34} fontSize={9.5} fontWeight={700} fill={T.muted}>
          PROJECTION, NOT A PROMISE — assumes the plan is executed and the
          measured gaps stay the same size
        </text>
        <text x={PAD_L} y={BOTTOM + 46} fontSize={9} fill={T.muted}>
          Straight-line on both paths. Nothing here compounds, and no growth
          rate is assumed.
        </text>
      </svg>

      {/* The arithmetic, initiative by initiative — the chart is checkable. */}
      <div style={{ marginTop: 14, fontSize: 12.5, color: T.ink, lineHeight: 1.75 }}>
        <p>
          <b>The recovery line, line by line:</b>
        </p>
        <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ marginBottom: 4 }}>
              {r.title}: {formatMoney(r.expected)} expected
              {overlapApplied
                ? ` × ${overlapFactor} overlap = ${formatMoney(r.adjExpected)}`
                : ""}{" "}
              ÷ 12 = {formatMoney(r.monthly)}/mo, starting month{" "}
              {formatMonth(r.startMonth)} → {formatMonth(12 - r.startMonth)}{" "}
              months in year one = <b>{formatMoney(r.yearOne)}</b>
            </li>
          ))}
        </ul>
        <p style={{ marginTop: 8 }}>
          Year-one recovery if the plan is executed:{" "}
          <b style={{ color: T.blue }}>{formatMoney(yearOneTotal)}</b>. Left
          unaddressed, the same twelve months forgo{" "}
          <b>{formatMoney(annualExpected)}</b> ({formatMoney(monthlyGap)}/mo ×
          12). The two paths cost the same calendar — they differ only in what
          you have at the end of it.
        </p>
      </div>
    </div>
  );
}

function formatMonth(m: number): string {
  return (Math.round(m * 10) / 10).toString();
}
