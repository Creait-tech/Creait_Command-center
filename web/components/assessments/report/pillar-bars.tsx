import type { AssessmentPillar } from "@/lib/supabase/types";
import { PILLARS } from "@/lib/assessment-instrument";
import { T, VB_W } from "./tokens";

/**
 * Three pillars, one measure each.
 *
 * FORM — bars, not a radar. The dataviz heuristic routes "compare magnitude,
 * low → high" to bars; a three-axis radar would be a triangle whose AREA scales
 * as the square of the values (it overstates gaps), it cannot show the unequal
 * pillar weights, it is unreadable in grayscale without fills, and — decisive
 * here — it has no honest way to draw "we did not examine enough of this
 * pillar to state a number": every vertex must sit somewhere. A bar can simply
 * not be drawn, and a hatched rail says "no reading" in any medium.
 *
 * COLOR — one measure across three named (nominal) categories, so every bar
 * takes the SAME hue. Colouring them by value would burn the identity channel
 * re-encoding what bar length already shows.
 */
export function PillarBars({
  pillars,
  counts,
  thin,
  potentials,
}: {
  pillars: Record<AssessmentPillar, number | null>;
  counts: Record<AssessmentPillar, number>;
  /** Comes from computeScores so the chart and the tables cannot disagree. */
  thin: Record<AssessmentPillar, boolean>;
  /**
   * Advisor-set targets with the 90-day plan executed. When present, each
   * readable pillar gets a second, HOLLOW bar under the solid one — outlined
   * vs filled, so the pair survives grayscale. The caller gates this on
   * enough indicators carrying a target; omit to render exactly as before.
   */
  potentials?: Record<AssessmentPillar, number | null>;
}) {
  const paired = potentials !== undefined;
  const ROW = paired ? 66 : 50;
  const H = PILLARS.length * ROW;
  const TRACK = VB_W - 46;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={PILLARS.map((p) => {
        const n = counts[p.key];
        const v = pillars[p.key];
        const state =
          v === null
            ? "not examined"
            : thin[p.key]
              ? `insufficient data, ${n} of 10 indicators`
              : `${v} of 100 from ${n} of 10 indicators`;
        const target =
          paired && v !== null && !thin[p.key] && potentials?.[p.key] !== null
            ? `, advisor-set target ${potentials?.[p.key]} of 100`
            : "";
        return `${p.label}: ${state}${target}`;
      }).join(". ")}
    >
      <defs>
        <pattern
          id="rp-nodata"
          width={7}
          height={7}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={7} height={7} fill="#f2f5f8" />
          <line x1={0} y1={0} x2={0} y2={7} stroke="#c8d2dd" strokeWidth={2} />
        </pattern>
      </defs>

      {PILLARS.map((p, i) => {
        const y = i * ROW;
        const n = counts[p.key];
        const value = pillars[p.key];
        const isThin = thin[p.key];
        const readable = value !== null && !isThin;
        const w = readable ? (value / 100) * TRACK : 0;
        const label =
          value === null
            ? "not examined"
            : isThin
              ? `insufficient data · ${n} of 10`
              : null;

        return (
          <g key={p.key}>
            <text x={0} y={y + 11} fontSize={12} fontWeight={800} fill={T.ink}>
              {p.label}
              <tspan dx={10} fontSize={10.5} fontWeight={500} fill={T.muted}>
                {`${Math.round(p.weight * 100)}% of the composite`}
              </tspan>
            </text>
            {label && (
              <text
                x={VB_W}
                y={y + 11}
                textAnchor="end"
                fontSize={11}
                fontWeight={700}
                fill={T.muted}
              >
                {label}
              </text>
            )}

            <rect x={0} y={y + 19} width={TRACK} height={10} rx={2} fill={T.track} />
            {!readable && (
              <rect
                x={0}
                y={y + 19}
                width={TRACK}
                height={10}
                rx={2}
                fill="url(#rp-nodata)"
              >
                <title>{`${p.label}: ${label}`}</title>
              </rect>
            )}
            {readable && (
              <>
                {/* Square at the baseline, 4px rounded at the data end. */}
                <g
                  className="rp-grow-x"
                  style={{ ["--d" as string]: `${140 + i * 90}ms` }}
                >
                  <path d={barPath(w, y + 19, 10, 4)} fill={T.blue}>
                    <title>{`${p.label}: ${value} of 100, from ${n} of 10 indicators examined`}</title>
                  </path>
                </g>
                <text
                  className="rp-fade"
                  style={{ ["--d" as string]: `${560 + i * 90}ms` }}
                  x={w + 9}
                  y={y + 28.5}
                  fontSize={13}
                  fontWeight={800}
                  fill={T.ink}
                >
                  {value}
                  {paired && (
                    <tspan dx={4} fontSize={8.5} fontWeight={600} fill={T.muted}>
                      today
                    </tspan>
                  )}
                </text>
              </>
            )}

            {/* Target bar — hollow, under the solid one. Only drawn when the
                current bar is readable, so a target can never stand in for a
                pillar the report refuses to state. */}
            {paired && readable && potentials?.[p.key] !== null && (
              (() => {
                const pv = potentials![p.key] as number;
                const pw = (Math.min(100, Math.max(0, pv)) / 100) * TRACK;
                return (
                  <>
                    <rect
                      x={0}
                      y={y + 33}
                      width={TRACK}
                      height={10}
                      rx={2}
                      fill={T.track}
                    />
                    <g
                      className="rp-grow-x"
                      style={{ ["--d" as string]: `${340 + i * 90}ms` }}
                    >
                      <rect
                        x={0.75}
                        y={y + 33.75}
                        width={Math.max(2, pw - 1.5)}
                        height={8.5}
                        rx={3}
                        fill={T.surface}
                        stroke={T.blue}
                        strokeWidth={1.5}
                      >
                        <title>{`${p.label}: advisor-set target ${pv} of 100 with the 90-day plan executed — not a projection`}</title>
                      </rect>
                    </g>
                    <text
                      className="rp-fade"
                      style={{ ["--d" as string]: `${740 + i * 90}ms` }}
                      x={pw + 9}
                      y={y + 42.5}
                      fontSize={12}
                      fontWeight={700}
                      fill={T.ink}
                    >
                      {pv}
                      <tspan dx={4} fontSize={8.5} fontWeight={600} fill={T.muted}>
                        target
                      </tspan>
                    </text>
                  </>
                );
              })()
            )}

            <text x={0} y={y + (paired ? 59 : 43)} fontSize={10} fill={T.muted}>
              {`${n} of 10 indicators examined${
                n > 0 && n < 10 ? ` · ${10 - n} not examined` : ""
              }  ·  ${p.question}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * A bar with a square baseline end and a rounded data end. Rendered as a path
 * so the two ends can differ; `rx` on a <rect> would round all four corners.
 * The rendered width is driven by CSS (`--w`) so the entrance can grow it, but
 * the path itself already carries the final geometry as the fallback.
 */
function barPath(w: number, y: number, h: number, r: number): string {
  const radius = Math.min(r, Math.max(0, w));
  if (w <= 0) return "";
  return [
    `M 0 ${y}`,
    `H ${Math.max(0, w - radius)}`,
    `A ${radius} ${radius} 0 0 1 ${w} ${y + radius}`,
    `V ${y + h - radius}`,
    `A ${radius} ${radius} 0 0 1 ${Math.max(0, w - radius)} ${y + h}`,
    `H 0`,
    "Z",
  ].join(" ");
}
