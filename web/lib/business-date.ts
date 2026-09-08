/**
 * The office's business date.
 *
 * `new Date().toISOString().slice(0, 10)` is UTC, so anything stamped after
 * 7pm in Atlanta was being filed under tomorrow — including the date on the
 * cover of a client's report. Every business date in this application is a
 * calendar date in America/New_York, whatever clock the server or the phone
 * happens to be running on.
 *
 * Pure module — no server-only imports — so client components, server actions
 * and background jobs can all share one definition of "today".
 */

export const BUSINESS_TIMEZONE = "America/New_York";

const ET_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today in America/New_York, as YYYY-MM-DD. */
export function todayInET(at: Date = new Date()): string {
  return ET_DATE.format(at);
}
