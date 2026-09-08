/**
 * One reader for the numbers people actually type.
 *
 * Owners fill the intake in their own words and facilitators type into the
 * session workbench while someone is still talking, so the same shapes turn up
 * in both places: "$12,500", "about 40", "1.2m", "35%", "60-65%". Two copies of
 * this parser drifted apart once — one of them multiplied "40 monthly" by a
 * million — so there is now exactly one, and both modules import it.
 *
 * The rule that matters: a k/m/b multiplier only counts when it ENDS the token.
 * A letter after it means the letter started a word, not a magnitude.
 *
 * Pure module — no React, no I/O. Safe to import from client and server.
 *
 * // examples:
 * //   "3 managers" → 3            (not 3,000,000 — "m" begins a word)
 * //   "1.2m"       → 1,200,000
 * //   "$45k"       → 45,000
 * //   "40 min"     → 40           (not 40,000,000)
 * //   "60-65%"     → 60           (a range reads as its low end)
 * //   "about ten"  → null         (no number at all)
 */

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  b: 1_000_000_000,
};

/**
 * The first number in the text, with $ / commas understood, a k / m / b
 * multiplier applied only where it ends the token, and a range read as its low
 * end. Returns null — never zero — when there is no number to read.
 */
export function parseLooseNumber(
  raw: string | null | undefined
): number | null {
  if (typeof raw !== "string") return null;
  // The lookahead lives INSIDE the optional group so it constrains the suffix
  // only: "40 min" backs off to a bare 40 rather than failing to match at all.
  const match = raw
    .replace(/[$,]/g, "")
    .match(/(-?\d+(?:\.\d+)?)\s*(?:([kmb])(?![a-z]))?/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const suffix = match[2]?.toLowerCase();
  return suffix ? value * (MULTIPLIERS[suffix] ?? 1) : value;
}
