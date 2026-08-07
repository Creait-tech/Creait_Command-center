import type { CcAssessmentOpportunity } from "@/lib/supabase/types";
import { compactMoney, niceMax, T, VB_W } from "./tokens";

/**
 * What each opportunity is worth — as a RANGE, never a point.
 *
 * FORM — a range bar (the bull/base/bear bar of an equity one-pager, the
 * tornado bar of capital budgeting). The estimate genuinely is an interval, so
 * the mark is an interval: drawing a single bar to "expected" would claim a
 * precision the method does not have. Rows are sorted by expected impact, so
 * rank is carried by vertical ORDER — which survives a grayscale print with no
 * colour at all.
 *
 * COLOR — one series, so one hue and no legend box (the title names it). The
 * band is a light step of the blue ramp; the expected marker is the full-
 * strength step, so the point estimate is the darkest thing in the row.
 */
export function MoneyMap({
  opportunities,
}: {
  opportunities: CcAssessmentOpportunity[];
}) {
  const rows = opportunities
    .filter((o) => o.annual_expected !== null || o.annual_high !== null)
    .slice()
    .sort((a, b) => (b.annual_expected ?? 0) - (a.annual_expected ?? 0));

  if (rows.length === 0) return null;

  const ROW = 50;
  const AXIS = 34;
  const H = rows.length * ROW + AXIS;
  const domainMax = niceMax(
    Math.max(...rows.map((o) => o.annual_high ?? o.annual_expected ?? 0))
  );
  const x = (v: number) => (Math.max(0, v) / domainMax) * VB_W;
  const ticks = [0, domainMax / 2, domainMax];

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={`Annual operating-profit impact by initiative, shown as low-to-high ranges. ${rows
        .map(
          (o) =>
            `${o.title}: ${compactMoney(o.annual_low)} to ${compactMoney(
              o.annual_high
            )}, expected ${compactMoney(o.annual_expected)}`
        )
        .join(". ")}`}
    >
      {/* Recessive hairline grid — solid, one step off the surface. */}
      {ticks.map((t, i) => (
        <line
          key={`g${i}`}
          x1={x(t)}
          y1={14}
          x2={x(t)}
          y2={rows.length * ROW + 2}
          stroke="#eef2f6"
          strokeWidth={1}
        />
      ))}

      {rows.map((o, i) => {
        const y = i * ROW;
        const lo = o.annual_low ?? o.annual_expected ?? 0;
        const hi = o.annual_high ?? o.annual_expected ?? 0;
        const ex = o.annual_expected;
        const bx = x(lo);
        const bw = Math.max(6, x(hi) - x(lo));
        const ex_x = ex === null ? null : x(ex);
        // Keep the value label inside the plot instead of letting it clip.
        const labelX =
          ex_x === null ? 0 : Math.min(VB_W - 34, Math.max(34, ex_x));

        return (
          <g key={o.id}>
            <text x={0} y={y + 12} fontSize={12.5} fontWeight={800} fill={T.ink}>
              {`${i + 1}. ${o.title}`}
            </text>
            <text x={VB_W - 2} y={y + 12} textAnchor="end" fontSize={10} fill={T.muted}>
              {`${compactMoney(lo)} – ${compactMoney(hi)} / yr`}
            </text>

            <g
              className="rp-grow-x"
              style={{ ["--d" as string]: `${120 + i * 110}ms` }}
            >
              <rect x={bx} y={y + 22} width={bw} height={12} rx={6} fill={T.washStrong}>
                <title>
                  {`${o.title} — low ${compactMoney(lo)}, expected ${compactMoney(
                    ex
                  )}, high ${compactMoney(hi)} per year`}
                </title>
              </rect>
            </g>

            {ex_x !== null && (
              <g
                className="rp-fade"
                style={{ ["--d" as string]: `${420 + i * 110}ms` }}
              >
                {/* 2px surface ring keeps the marker legible on the band. */}
                <rect
                  x={ex_x - 4}
                  y={y + 17}
                  width={8}
                  height={22}
                  rx={4}
                  fill={T.surface}
                />
                <rect
                  x={ex_x - 2}
                  y={y + 19}
                  width={4}
                  height={18}
                  rx={2}
                  fill={T.blue}
                />
                <text
                  x={labelX}
                  y={y + 47}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={800}
                  fill={T.ink}
                >
                  {compactMoney(ex)}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Axis */}
      <line
        x1={0}
        y1={rows.length * ROW + 2}
        x2={VB_W}
        y2={rows.length * ROW + 2}
        stroke={T.line}
        strokeWidth={1}
      />
      {ticks.map((t, i) => (
        <text
          key={`t${i}`}
          x={i === 0 ? 0 : i === ticks.length - 1 ? VB_W - 2 : x(t)}
          y={rows.length * ROW + 15}
          textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
          fontSize={9}
          fill={T.muted}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {compactMoney(t)}
        </text>
      ))}
      <text
        x={0}
        y={rows.length * ROW + 28}
        fontSize={9}
        fill={T.muted}
      >
        Annual operating-profit impact · bar spans low to high · the mark is the expected case
      </text>
    </svg>
  );
}
