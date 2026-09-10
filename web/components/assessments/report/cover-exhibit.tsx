import type { AssessmentPillar } from "@/lib/supabase/types";
import { BANDS, PILLARS } from "@/lib/assessment-instrument";
import { BAND_FILL_DARK, D, VB_W } from "./tokens";

/**
 * The cover's two exhibits, in the present deck's treatment.
 *
 * These are the deck's ScoreLadder and PillarBarsDark redrawn at page scale.
 * The deck draws in a 1000-unit viewBox for a full screen; squeezed into a
 * cover column that geometry scales its type to six or seven points, which
 * does not survive a printer. So the shapes, palette and proportions are the
 * deck's, the coordinate system is the report's (VB_W, ~680px of printable
 * width), and every font size here is a real point size on paper.
 *
 * Server-rendered, no animation, no client bundle: the cover prints exactly
 * as it renders. Colour is carried by fills, which print because
 * `.report-root` sets `print-color-adjust: exact`.
 */

/** Five band steps with the reading marked on them. */
export function CoverScoreLadder({ score }: { score: number | null }) {
  const W = 440;
  const H = 80;
  const seg = W / BANDS.length;
  const activeIdx =
    score === null ? -1 : Math.max(0, BANDS.findIndex((b) => score <= b.max));
  const rawX = score === null ? 0 : (Math.min(100, Math.max(0, score)) / 100) * W;
  const x = Math.min(W - 6, Math.max(6, rawX));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={
        score === null
          ? "The five maturity bands, no score yet"
          : `CREAiT Score ${score} of 100, in the ${BANDS[activeIdx].label} band. The scale runs Reactive, Stabilizing, Building, Scaling, Self-Running.`
      }
    >
      {BANDS.map((band, i) => {
        const active = i === activeIdx;
        const lo = i === 0 ? 0 : BANDS[i - 1].max + 1;
        return (
          <g key={band.label}>
            <rect
              x={i * seg + 1.5}
              y={active ? 26 : 32}
              width={seg - 3}
              height={active ? 22 : 14}
              rx={3}
              fill={BAND_FILL_DARK[i]}
              opacity={activeIdx === -1 || active ? 1 : 0.45}
            >
              <title>{`${band.label}: ${lo}–${band.max}`}</title>
            </rect>
            <text
              x={i * seg + seg / 2}
              y={63}
              textAnchor="middle"
              fontSize={active ? 11.5 : 10.5}
              fontWeight={active ? 800 : 500}
              fill={active ? D.ink : D.muted}
            >
              {band.label}
            </text>
            <text
              x={i * seg + seg / 2}
              y={76}
              textAnchor="middle"
              fontSize={8.5}
              fill={D.muted}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {`${lo}–${band.max}`}
            </text>
          </g>
        );
      })}
      {score !== null && (
        <g>
          <line x1={x} x2={x} y1={13} y2={52} stroke={D.ink} strokeWidth={2} />
          <circle cx={x} cy={9} r={5.5} fill={D.ink} />
          <circle cx={x} cy={9} r={2.5} fill={D.electric} />
        </g>
      )}
    </svg>
  );
}

/** Three pillars, one rail each; a pillar the report will not state gets no bar. */
export function CoverPillarBars({
  pillars,
  counts,
  thin,
}: {
  pillars: Record<AssessmentPillar, number | null>;
  counts: Record<AssessmentPillar, number>;
  /** Comes from computeScores so the cover and the dashboard cannot disagree. */
  thin: Record<AssessmentPillar, boolean>;
}) {
  const ROW = 46;
  const LABEL = 212;
  const TRACK = VB_W - LABEL - 62;
  const H = PILLARS.length * ROW - 6;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={PILLARS.map((p) => {
        const n = counts[p.key];
        const v = pillars[p.key];
        return v === null
          ? `${p.label}: not examined`
          : thin[p.key]
            ? `${p.label}: insufficient data, ${n} of 10 indicators examined`
            : `${p.label}: ${v} of 100 from ${n} of 10 indicators examined`;
      }).join(". ")}
    >
      {PILLARS.map((p, i) => {
        const y = i * ROW;
        const n = counts[p.key];
        const value = pillars[p.key];
        const readable = value !== null && !thin[p.key];
        const w = readable ? (Math.min(100, value) / 100) * TRACK : 0;
        const state =
          value === null
            ? "not examined"
            : `insufficient data · ${n} of 10 examined`;
        return (
          <g key={p.key}>
            <text x={0} y={y + 17} fontSize={13.5} fontWeight={700} fill={D.ink}>
              {p.label}
            </text>
            <text x={0} y={y + 32} fontSize={9.5} fill={D.muted}>
              {`${Math.round(p.weight * 100)}% of the score · ${n} of 10 examined`}
            </text>
            <rect x={LABEL} y={y + 9} width={TRACK} height={16} rx={4} fill={D.rail} />
            {readable ? (
              <rect x={LABEL} y={y + 9} width={w} height={16} rx={4} fill={D.electric}>
                <title>{`${p.label}: ${value} of 100, from ${n} of 10 indicators examined`}</title>
              </rect>
            ) : (
              <text
                x={LABEL + 10}
                y={y + 20.5}
                fontSize={9.5}
                fontStyle="italic"
                fill={D.muted}
              >
                {state}
              </text>
            )}
            <text
              x={VB_W}
              y={y + 23}
              textAnchor="end"
              fontSize={24}
              fontWeight={800}
              fill={readable ? D.ink : D.muted}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {readable ? value : "—"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
