/**
 * Week arithmetic for the EOS weekly scorecard.
 *
 * `cc_kpi_weekly.week_start` is a **date** holding the Monday of an
 * America/New_York week. Everything here therefore works on `YYYY-MM-DD`
 * strings and does its stepping in UTC, never on a local `Date`:
 *
 *  - A local `Date` on a machine set to, say, Europe/London would put an
 *    Atlanta Sunday evening in the following week and silently write the
 *    number into the wrong column.
 *  - The grid renders on the server and hydrates in the browser. If the two
 *    disagreed about which Monday "this week" is, React would re-render the
 *    whole column set on hydration. Deriving the calendar date once, in a
 *    fixed timezone, and stepping it as a string keeps both sides identical.
 *
 * Free of React and of any server-only import so the page, the grid and the
 * server action can all use it.
 */

/** Weeks are Monday-start, in the company's operating timezone. */
export const SCORECARD_TIMEZONE = "America/New_York";

/** Week columns on the Weekly grid. 13 = one quarter, as Ninety.io shows. */
export const WEEK_COLUMN_COUNT = 13;

/** Trailing windows on the T4W & T13W view. */
export const TRAILING_WINDOWS = [4, 13] as const;
export type TrailingWindow = (typeof TRAILING_WINDOWS)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const DATE_IN_TZ = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCORECARD_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

const MONTH_DAY_YEAR = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value) && !Number.isNaN(utcDate(value).getTime());
}

/** Today's calendar date in the scorecard timezone, as `YYYY-MM-DD`. */
export function todayInScorecardTz(now: Date = new Date()): string {
  return DATE_IN_TZ.format(now);
}

/** Shift a `YYYY-MM-DD` date by whole days. */
export function addDays(isoDate: string, days: number): string {
  const d = utcDate(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return isoOf(d);
}

/** The Monday on or before `isoDate`. */
export function mondayOf(isoDate: string): string {
  const d = utcDate(isoDate);
  // getUTCDay(): 0 = Sunday. Shift so Monday = 0.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return isoOf(d);
}

/** The `week_start` of the week we are currently in. */
export function currentWeekStart(now?: Date): string {
  return mondayOf(todayInScorecardTz(now));
}

/** `count` consecutive week starts ending at `from`, newest first. */
export function recentWeekStarts(count: number, from: string): string[] {
  const weeks: string[] = [];
  for (let i = 0; i < count; i += 1) weeks.push(addDays(from, -7 * i));
  return weeks;
}

/**
 * Column heading, e.g. `Aug 24 – 30`, or `Aug 31 – Sep 6` across a month
 * boundary.
 *
 * Repeating the month inside a single week ("Aug 24 – Aug 30") costs four
 * characters in an 88px column, which is the difference between the header
 * fitting and the column stretching until one fewer week is on screen.
 */
export function formatWeekRange(weekStart: string): string {
  const start = utcDate(weekStart);
  const end = utcDate(addDays(weekStart, 6));
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const endLabel = sameMonth
    ? String(end.getUTCDate())
    : MONTH_DAY.format(end);
  return `${MONTH_DAY.format(start)} – ${endLabel}`;
}

/** Long form for tooltips, e.g. `Aug 24 – Aug 30, 2026`. */
export function formatWeekRangeLong(weekStart: string): string {
  return `${MONTH_DAY.format(utcDate(weekStart))} – ${MONTH_DAY_YEAR.format(
    utcDate(addDays(weekStart, 6)),
  )}`;
}

// -----------------------------------------------------------------------------
// The capped-100 era
// -----------------------------------------------------------------------------

/**
 * Before this date the GHL MCP tools returned at most 100 rows and the
 * scoreboard recorded `items.length` as if it were a population, so several
 * KPIs sat at a flat 100 for weeks on end. That plateau is the ceiling of the
 * old tooling, not a measurement — and MRR in the same period picked up
 * pipeline figures in the millions for the same reason.
 *
 * The historical values are left exactly as recorded (rewriting them would
 * destroy the evidence). Instead, the affected weeks are marked in the grid and
 * excluded from Average / Total, so nobody reads the plateau as real
 * performance. Correcting those cells by hand is the expected use of
 * inline entry — a corrected cell becomes `source = 'manual'` and is scored
 * normally again.
 *
 * See CLAUDE.md, "GHL MCP tools now paginate (fixed 2026-08-06)".
 */
export const GHL_ROW_CAP_FIX_DATE = "2026-08-07";

/**
 * True for a week whose recorded number came from the capped tooling.
 *
 * The test is on the week's **last** day, not its first, because each stored
 * week holds that week's *closing* reading (the backfill took the last
 * `cc_kpi_history` row in each week, and the sync keeps the current week at its
 * latest value). A week that closed after the fix was therefore measured with
 * the fixed tooling even if it opened before it — marking it unreliable would
 * throw away a good number, which on a four-week-deep scorecard is 25% of the
 * evidence.
 */
export function isCappedWeek(weekStart: string): boolean {
  return addDays(weekStart, 6) < GHL_ROW_CAP_FIX_DATE;
}

export const CAPPED_WEEK_SHORT = "Unreliable — recorded under the old 100-row cap";

export const CAPPED_WEEK_EXPLAINER =
  "Weeks that closed before 2026-08-07 were read through GoHighLevel tools that returned at most 100 rows, so a flat 100 (or a multi-million MRR) is the ceiling of the old tooling, not a measurement. Those weeks are shown exactly as recorded, but left unscored and out of Average and Total. Type over a cell to correct it — a corrected week counts again.";
