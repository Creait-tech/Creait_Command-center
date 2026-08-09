import { BANDS } from "@/lib/assessment-instrument";
import { BAND_RAMP, T, VB_W } from "./tokens";

/**
 * The anchor exhibit: one number against the scale it lives on.
 *
 * FORM — the dataviz heuristic sends "a single ratio against a limit" to a
 * meter, and "the one number a dashboard leads with" to a hero figure. Not a
 * dial, not a donut: a donut-with-a-number-inside encodes the value as an arc
 * the reader must estimate, and it cannot show WHERE the value sits among five
 * named bands. This is the reference-range rail a lab report uses — the scale
 * is drawn, the bands are named, and the reading is marked on it.
 *
 * COLOR — ordinal (position in a sequence), so one hue stepped by lightness.
 * See BAND_RAMP in tokens.ts for the validator run. Grayscale-safe: the five
 * bands are told apart by lightness, and the marker is ink.
 */
export function ScoreBandRail({
  score,
  potential,
}: {
  score: number | null;
  /**
   * Advisor-set target with the 90-day plan executed — rendered as a HOLLOW
   * marker (outlined, surface-filled) vs the solid current one, so the two
   * survive grayscale. The caller gates this on enough indicators carrying a
   * target; pass null/undefined to render exactly as before.
   */
  potential?: number | null;
}) {
  const H = 65;
  const seg = VB_W / BANDS.length; // 136
  const activeIdx =
    score === null ? -1 : Math.max(0, BANDS.findIndex((b) => score <= b.max));
  const rawX = score === null ? 0 : (Math.min(100, Math.max(0, score)) / 100) * VB_W;
  const markX = Math.min(VB_W - 6, Math.max(6, rawX));
  const showPotential =
    potential !== null && potential !== undefined && score !== null;
  const potX = showPotential
    ? Math.min(
        VB_W - 6,
        Math.max(6, (Math.min(100, Math.max(0, potential)) / 100) * VB_W)
      )
    : 0;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={
        score === null
          ? "Maturity band scale, no score yet"
          : `CREAiT Score ${score} of 100, in the ${BANDS[activeIdx].label} band.${
              showPotential
                ? ` Advisor-set target with the 90-day plan executed: ${potential} of 100, shown as a hollow marker.`
                : ""
            } The scale runs Reactive, Stabilizing, Building, Scaling, Self-Running.`
      }
    >
      {BANDS.map((band, i) => {
        const x = i * seg;
        const isActive = i === activeIdx;
        return (
          <g key={band.label}>
            {/* 2px surface gaps do the separating — never a stroke. */}
            <rect
              className="rp-seg"
              style={{ ["--d" as string]: `${i * 70}ms` }}
              x={x + 1}
              y={10}
              width={seg - 2}
              height={21}
              rx={2}
              fill={BAND_RAMP[i]}
            >
              <title>
                {`${band.label}: ${i === 0 ? 0 : BANDS[i - 1].max + 1}–${band.max}`}
              </title>
            </rect>
            <text
              x={x + seg / 2}
              y={44}
              textAnchor="middle"
              fontSize={10}
              fontWeight={isActive ? 800 : 500}
              fill={isActive ? T.ink : T.muted}
            >
              {band.label}
            </text>
          </g>
        );
      })}

      {/* Boundary scale — 0 / 20 / 40 / 60 / 80 / 100 */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const x = i * seg;
        const cx = Math.min(VB_W - 9, Math.max(9, x));
        return (
          <g key={`t${i}`}>
            <line x1={x} y1={32} x2={x} y2={35} stroke={T.line} strokeWidth={1} />
            <text
              x={cx}
              y={59}
              textAnchor="middle"
              fontSize={8.5}
              fill={T.muted}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {i * 20}
            </text>
          </g>
        );
      })}

      {/* Target first, so the solid "today" marker always wins an overlap. */}
      {showPotential && (
        <g transform={`translate(${potX} 0)`}>
          <g className="rp-fade" style={{ ["--d" as string]: "700ms" }}>
            <line
              x1={0}
              y1={10}
              x2={0}
              y2={31}
              stroke={T.surface}
              strokeWidth={5}
              strokeLinecap="butt"
            />
            <line
              x1={0}
              y1={10}
              x2={0}
              y2={31}
              stroke={T.ink}
              strokeWidth={1.5}
              strokeDasharray="2.5 2.5"
              strokeLinecap="butt"
            />
            <path
              d="M -6 0.75 L 6 0.75 L 0 8.5 Z"
              fill={T.surface}
              stroke={T.ink}
              strokeWidth={1.5}
              strokeLinejoin="round"
            >
              <title>{`Target with the 90-day plan executed: ${potential} of 100 — set by your advisor, not a projection`}</title>
            </path>
          </g>
        </g>
      )}

      {score !== null && (
        /* Outer group = final position (SVG attribute). Inner group carries the
           CSS entrance, so the resting state is always correct. */
        <g transform={`translate(${markX} 0)`}>
          <g
            className="rp-needle"
            style={{ ["--from" as string]: `${-markX}px` }}
          >
            <path d="M -6 0 L 6 0 L 0 9 Z" fill={T.ink} />
            <line
              x1={0}
              y1={10}
              x2={0}
              y2={31}
              stroke={T.surface}
              strokeWidth={5}
              strokeLinecap="butt"
            />
            <line
              x1={0}
              y1={10}
              x2={0}
              y2={31}
              stroke={T.ink}
              strokeWidth={2}
              strokeLinecap="butt"
            />
          </g>
        </g>
      )}
    </svg>
  );
}
