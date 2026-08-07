/**
 * Visual tokens for the Executive Blueprint charts.
 *
 * Derived from the report's existing palette (blue #0284c7 / ink #111827 /
 * muted #5b6675 / line #e4e9f0 / tint #f4fafd). Every value here that carries
 * data has been run through the dataviz validator against a #ffffff surface —
 * see BAND_RAMP below. Nothing in this file is eyeballed.
 */

export const T = {
  blue: "#0284c7",
  ink: "#111827",
  muted: "#5b6675",
  line: "#e4e9f0",
  tint: "#f4fafd",
  /** Chart track / unfilled rail — chrome, never data. */
  track: "#e8edf3",
  /** A rail that *does* carry meaning (a phase, a gap) — must stay visible. */
  railInk: "#c3cfdc",
  /** Lighter step of the blue ramp: range bands, area washes. */
  wash: "#d3ecf9",
  washStrong: "#a8d9f2",
  warn: "#b03a2e",
  warnTint: "#fff6f4",
  warnLine: "#f3c6bf",
  surface: "#ffffff",
} as const;

/**
 * Ordinal ramp for the five maturity bands — ONE hue, monotone lightness,
 * light→dark as maturity rises. Validated with the dataviz script:
 *
 *   node scripts/validate_palette.js \
 *     "#45bdf7,#17a5e6,#0284c7,#076391,#0b4568" \
 *     --ordinal --mode light --surface "#ffffff"
 *   → ALL CHECKS PASS (monotone L · adjacent ΔL ≥ 0.06 · light end 2.13:1
 *     vs surface · single hue, 8° spread)
 *
 * Because it is one hue stepped by lightness, it survives a grayscale print:
 * the progression is readable without any color at all. Slot 3 is the report's
 * own brand blue, so the ramp is literally built around the existing token.
 */
export const BAND_RAMP = [
  "#45bdf7", // Reactive     0–20
  "#17a5e6", // Stabilizing 21–40
  "#0284c7", // Building    41–60
  "#076391", // Scaling     61–80
  "#0b4568", // Self-Running 81–100
] as const;

/** Ink colour for text laid *inside* a band segment — picked by luminance. */
export const BAND_TEXT_ON = ["#0b3c56", "#ffffff", "#ffffff", "#ffffff", "#ffffff"] as const;

/** Compact money for chart labels: $147K, $2.4M, $850. Never invents digits. */
export function compactMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const v = n / 1_000_000;
    return `$${(Math.round(v * 10) / 10).toLocaleString("en-US")}M`;
  }
  if (abs >= 1_000) {
    // Keep one decimal below $100K so a chart label never disagrees with the
    // exact figure printed beside it ($73.5K, not $74K, for $73,500).
    const v = n / 1_000;
    const rounded = abs >= 100_000 ? Math.round(v) : Math.round(v * 10) / 10;
    return `$${rounded.toLocaleString("en-US")}K`;
  }
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** A "nice" axis maximum at or above `v`, kept tight so the plot isn't mostly air. */
export function niceMax(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const ladder = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const step = ladder.find((s) => norm <= s + 1e-9) ?? 10;
  return step * mag;
}

/** Chart geometry — matches the report's ~680px printable content width. */
export const VB_W = 680;

/**
 * Entrance animation is opt-in per element via this class plus a `--d` delay.
 * The CSS default is always the FINAL state; the keyframes only supply a
 * `from`, so print, reduced-motion, and any browser that drops the animation
 * all land on the finished chart rather than an empty one.
 */
export function delay(i: number, base = 90): React.CSSProperties {
  return { ["--d" as string]: `${i * base}ms` };
}
