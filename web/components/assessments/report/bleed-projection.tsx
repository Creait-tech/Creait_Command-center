import { formatMoney } from "@/lib/assessment-instrument";
import { compactMoney, niceMax, T, VB_W } from "./tokens";

/**
 * The cost of doing nothing — the same money as the opportunity chart, seen
 * from the other side.
 *
 * FORM — a single series over time, so a line with an area wash. Straight-line
 * accumulation: the monthly gap repeated, NOT compounded. Compounding would
 * bend the curve upward and manufacture a number the evidence does not
 * support, so the line is deliberately straight and the caption says so.
 *
 * COLOR — one hue, no legend. The stroke is dashed and the fill is hatched
 * because this is the only exhibit in the report that is a PROJECTION rather
 * than a reading; both cues survive grayscale.
 */
export function BleedProjection({
  annualExpected,
  operatingProfit,
}: {
  annualExpected: number;
  operatingProfit: number | null;
}) {
  if (!Number.isFinite(annualExpected) || annualExpected <= 0) return null;

  const monthly = annualExpected / 12;
  const H = 208;
  const PAD_L = 58;
  const TOP = 30;
  const BOTTOM = 158;
  const plotW = VB_W - PAD_L;
  const domain = niceMax(annualExpected);

  const x = (m: number) => PAD_L + (m / 12) * plotW;
  const y = (v: number) => BOTTOM - (v / domain) * (BOTTOM - TOP);

  const pts = Array.from({ length: 13 }, (_, m) => ({ m, v: monthly * m }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.m)} ${y(p.v)}`).join(" ");
  const areaPath = `${linePath} L ${x(12)} ${BOTTOM} L ${x(0)} ${BOTTOM} Z`;
  const yTicks = [0, domain / 2, domain];
  const marks = [6, 12];
  const share =
    operatingProfit && operatingProfit > 0
      ? Math.round((annualExpected / operatingProfit) * 100)
      : null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${VB_W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={`Projection: cumulative foregone operating profit if nothing changes. ${compactMoney(
          monthly
        )} per month, reaching ${compactMoney(monthly * 6)} at six months and ${compactMoney(
          annualExpected
        )} at twelve months. Straight-line, not compounded.`}
      >
        <defs>
          <pattern
            id="rp-proj"
            width={6}
            height={6}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={6} height={6} fill="#eaf6fd" />
            <line x1={0} y1={0} x2={0} y2={6} stroke="#bfe2f6" strokeWidth={2} />
          </pattern>
          <clipPath id="rp-reveal">
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

        {yTicks.map((t, i) => (
          <g key={`y${i}`}>
            <line x1={PAD_L} y1={y(t)} x2={VB_W} y2={y(t)} stroke="#eef2f6" strokeWidth={1} />
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

        <g clipPath="url(#rp-reveal)">
          <path d={areaPath} fill="url(#rp-proj)" />
          <path
            d={linePath}
            fill="none"
            stroke={T.blue}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="7 5"
          />
        </g>

        {marks.map((m, i) => (
          <g
            key={m}
            className="rp-fade"
            style={{ ["--d" as string]: `${700 + i * 180}ms` }}
          >
            <circle
              cx={x(m)}
              cy={y(monthly * m)}
              r={5}
              fill={T.blue}
              stroke={T.surface}
              strokeWidth={2}
            >
              <title>{`Month ${m}: ${compactMoney(monthly * m)} cumulative`}</title>
            </circle>
            <text
              x={m === 12 ? VB_W : x(m)}
              y={y(monthly * m) - 12}
              textAnchor={m === 12 ? "end" : "middle"}
              fontSize={13}
              fontWeight={800}
              fill={T.ink}
            >
              {compactMoney(monthly * m)}
            </text>
          </g>
        ))}

        <line x1={PAD_L} y1={BOTTOM} x2={VB_W} y2={BOTTOM} stroke={T.line} strokeWidth={1} />
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
          PROJECTION — cumulative operating profit foregone if nothing changes
        </text>
        <text x={PAD_L} y={BOTTOM + 46} fontSize={9} fill={T.muted}>
          Straight-line. The monthly gap is repeated, never compounded.
        </text>
      </svg>

      {/* Exact figures, not rounded ones — the arithmetic is the argument. */}
      <p style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.75, marginTop: 14 }}>
        <b>The arithmetic, in full:</b>{" "}
        {`${formatMoney(annualExpected)} expected annual impact ÷ 12 = ${formatMoney(
          monthly
        )} per month. × 6 months = ${formatMoney(
          monthly * 6
        )}. × 12 months = ${formatMoney(annualExpected)}.`}
      </p>
      {share !== null && (
        <p style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.75, marginTop: 6 }}>
          {`For scale: ${formatMoney(
            annualExpected
          )} is ${share}% of the ${formatMoney(
            operatingProfit
          )} operating profit this business reported for the baseline year.`}
        </p>
      )}
    </div>
  );
}
