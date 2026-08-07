import type { CcAssessmentOpportunity } from "@/lib/supabase/types";
import { paybackMonths } from "@/lib/assessment-instrument";
import { T, VB_W } from "./tokens";

export interface PaybackRow {
  id: string;
  title: string;
  /** Months of build before any return arrives. */
  buildMonths: number;
  /** Month the fix cost has been fully recovered. */
  paidBackAt: number;
  payback: number;
}

/** Rows the timeline can honestly draw — everything else is simply omitted. */
export function paybackRows(opps: CcAssessmentOpportunity[]): PaybackRow[] {
  return opps
    .map((o) => {
      const payback = paybackMonths(o.fix_cost, o.annual_expected);
      if (payback === null) return null;
      const buildMonths = Number(o.months_to_benefit ?? 0) || 0;
      return {
        id: o.id,
        title: o.title,
        buildMonths,
        payback,
        paidBackAt: buildMonths + payback,
      };
    })
    .filter((r): r is PaybackRow => r !== null)
    .sort((a, b) => a.paidBackAt - b.paidBackAt);
}

/**
 * When each fix stops costing and starts returning.
 *
 * FORM — a lollipop timeline, not a Gantt. A Gantt implies scheduled work with
 * dependencies and durations we have not planned; what we actually know is two
 * instants per initiative (return begins; cost recovered) and the interval
 * between them. Two instants and an interval is exactly a lollipop.
 *
 * COLOR — a single hue. The two phases are told apart by MARK GEOMETRY (a 4px
 * hollow rail vs an 8px solid bar vs a ringed dot), not by a second colour:
 * the validator put blue against a de-emphasis gray at normal-vision ΔE 13.3,
 * below the 15 floor, so hue would have been the weak channel here. Height
 * survives grayscale, CVD, and a fax machine.
 */
export function PaybackTimeline({ rows }: { rows: PaybackRow[] }) {
  if (rows.length === 0) return null;

  const LEGEND = 20;
  const ROW = 48;
  const AXIS = 28;
  const H = LEGEND + rows.length * ROW + AXIS;

  const maxMonth = Math.max(...rows.map((r) => r.paidBackAt));
  const axisMax = Math.max(6, Math.ceil(maxMonth / 3) * 3);
  const PAD_R = 108; // room for the "paid back" label
  const plotW = VB_W - PAD_R;
  const x = (m: number) => (Math.min(m, axisMax) / axisMax) * plotW;
  const monthTicks = Array.from({ length: axisMax + 1 }, (_, i) => i).filter(
    (m) => axisMax <= 8 || m % 2 === 0
  );

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={`Payback timeline. ${rows
        .map(
          (r) =>
            `${r.title}: returns begin month ${fmtMonth(
              r.buildMonths
            )}, fix cost recovered by month ${fmtMonth(r.paidBackAt)}`
        )
        .join(". ")}`}
    >
      {/* Legend — required whenever more than one thing is encoded. */}
      <g>
        <rect x={0} y={5} width={22} height={4} rx={2} fill={T.track} />
        <text x={28} y={11} fontSize={9.5} fill={T.muted}>
          Building — no return yet
        </text>
        <rect x={172} y={3} width={22} height={8} rx={2} fill={T.blue} />
        <text x={200} y={11} fontSize={9.5} fill={T.muted}>
          Returning, recovering the fix cost
        </text>
        <circle cx={396} cy={7} r={5} fill={T.blue} stroke={T.surface} strokeWidth={2} />
        <text x={406} y={11} fontSize={9.5} fill={T.muted}>
          Fix cost fully paid back
        </text>
      </g>

      {monthTicks.map((m) => (
        <line
          key={`g${m}`}
          x1={x(m)}
          y1={LEGEND + 4}
          x2={x(m)}
          y2={LEGEND + rows.length * ROW}
          stroke="#eef2f6"
          strokeWidth={1}
        />
      ))}

      {rows.map((r, i) => {
        const y = LEGEND + i * ROW;
        const bx = x(r.buildMonths);
        const px = x(r.paidBackAt);
        return (
          <g key={r.id}>
            <text x={0} y={y + 14} fontSize={11.5} fontWeight={700} fill={T.ink}>
              {r.title}
            </text>

            <g
              className="rp-grow-x"
              style={{ ["--d" as string]: `${140 + i * 120}ms` }}
            >
              {r.buildMonths > 0 && (
                <rect x={0} y={y + 24} width={bx} height={4} rx={2} fill={T.track}>
                  <title>{`Building for ${fmtMonth(r.buildMonths)} month(s) before any return`}</title>
                </rect>
              )}
              <rect
                x={bx}
                y={y + 22}
                width={Math.max(3, px - bx)}
                height={8}
                rx={2}
                fill={T.blue}
              >
                <title>{`Returning from month ${fmtMonth(
                  r.buildMonths
                )}; fix cost recovered by month ${fmtMonth(r.paidBackAt)}`}</title>
              </rect>
            </g>

            <g className="rp-fade" style={{ ["--d" as string]: `${520 + i * 120}ms` }}>
              <circle cx={px} cy={y + 26} r={5.5} fill={T.blue} stroke={T.surface} strokeWidth={2} />
              <text x={px + 12} y={y + 30} fontSize={10.5} fontWeight={700} fill={T.ink}>
                {`paid back · month ${fmtMonth(r.paidBackAt)}`}
              </text>
            </g>
          </g>
        );
      })}

      <line
        x1={0}
        y1={LEGEND + rows.length * ROW}
        x2={plotW}
        y2={LEGEND + rows.length * ROW}
        stroke={T.line}
        strokeWidth={1}
      />
      {monthTicks.map((m) => (
        <text
          key={`t${m}`}
          x={x(m)}
          y={LEGEND + rows.length * ROW + 14}
          textAnchor={m === 0 ? "start" : "middle"}
          fontSize={9}
          fill={T.muted}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {m}
        </text>
      ))}
      <text
        x={0}
        y={LEGEND + rows.length * ROW + 26}
        fontSize={9}
        fill={T.muted}
      >
        Months from the day you start · payback = cost to fix ÷ expected monthly recovery
      </text>
    </svg>
  );
}

function fmtMonth(m: number): string {
  return (Math.round(m * 10) / 10).toString();
}
