/**
 * Money formatting shared by the present deck (a client component) and the
 * client results page (a server component). It lives in its own module with
 * no "use client" directive on purpose: a function exported from a client
 * module becomes a client reference on the server, and calling it there
 * throws at render time.
 */

/** Compact money for exhibits: $147K, $2.4M, $850. */
export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `$${(Math.round((n / 1_000_000) * 10) / 10).toLocaleString("en-US")}M`;
  }
  if (abs >= 1_000) return `$${Math.round(n / 1_000).toLocaleString("en-US")}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function moneyExact(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
