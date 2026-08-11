/**
 * AI Tuesday — shared facts and date arithmetic.
 *
 * The class is a fixed weekly appointment (Tuesdays, 6:00–7:30 PM Eastern, on
 * Zoom), so "which session is this?" is arithmetic, not a lookup. Every date
 * here is computed in America/New_York regardless of where the server or the
 * founder's phone happens to be: a Tuesday-evening class marked at 9 PM ET is
 * already Wednesday in UTC, and naive local math would file it under the wrong
 * week.
 *
 * Pure module — no server-only imports — so the public page, the dashboard,
 * server actions and Inngest can all share one definition of "this week".
 */

export const CLASS_TIMEZONE = "America/New_York";

/** Tuesday. `Date.getDay()` numbering: Sunday = 0. */
const CLASS_WEEKDAY = 2;

export const CLASS_FACTS = {
  name: "AI Tuesday — CREAiT Live",
  day: "Tuesdays",
  startTime: "6:00 PM Eastern",
  durationMinutes: 90,
  platform: "Zoom",
  price: "Free",
  /**
   * The recurring Zoom room — ONE link, every week, everywhere. The GHL
   * reminder texts (W12/W13/W15) carry this same URL; if the meeting is ever
   * recreated in Zoom, update it here AND in those workflows or half the
   * audience lands in a dead room.
   */
  zoomJoinUrl:
    "https://us02web.zoom.us/j/81299345082?pwd=nxxeiE2l5zVq8SqxXa5R8Ya5JbZD2p.1",
  /** 15-minute fit call for the Growth & AI Diagnostic. */
  fitCallUrl:
    "https://api.leadconnectorhq.com/widget/booking/UvQUpWdVrhv82iDmMOi4",
} as const;

const ET_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLASS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** The calendar date and weekday in Eastern time, whatever the host clock is. */
function easternParts(at: Date): { iso: string; weekday: number } {
  const parts = ET_PARTS.formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const iso = `${get("year")}-${get("month")}-${get("day")}`;
  return { iso, weekday: WEEKDAY_INDEX[get("weekday")] ?? 0 };
}

/** Shift an ISO date (YYYY-MM-DD) by whole days without touching timezones. */
export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(base).toISOString().slice(0, 10);
}

/**
 * The Tuesday this week belongs to: today when today is Tuesday, otherwise the
 * most recent Tuesday behind us. Wednesday through Monday all still point at
 * the class that just happened, which is exactly the window in which anyone
 * marks attendance.
 */
export function currentClassDate(now: Date = new Date()): string {
  const { iso, weekday } = easternParts(now);
  const back = (weekday - CLASS_WEEKDAY + 7) % 7;
  return shiftIsoDate(iso, -back);
}

/** The next Tuesday a visitor registering right now would attend. */
export function nextClassDate(now: Date = new Date()): string {
  const { iso, weekday } = easternParts(now);
  const forward = (CLASS_WEEKDAY - weekday + 7) % 7;
  return shiftIsoDate(iso, forward);
}

/** The last `count` class dates, most recent first, including the current one. */
export function recentClassDates(count: number, now: Date = new Date()): string[] {
  const current = currentClassDate(now);
  return Array.from({ length: count }, (_, i) => shiftIsoDate(current, -7 * i));
}

/** "Tuesday, August 11" — the founders read dates, not ISO strings. */
export function formatClassDate(
  iso: string,
  opts: { weekday?: boolean; year?: boolean } = {},
): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: opts.weekday === false ? undefined : "long",
    month: "long",
    day: "numeric",
    year: opts.year ? "numeric" : undefined,
  });
}

/** "Aug 11" — for axis labels and dense tables. */
export function formatClassDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

export type WeekStats = {
  sessionDate: string;
  /** People on the list when that class ran. */
  registered: number;
  attended: number;
  noShow: number;
  /** Registered minus everyone a human actually decided about. */
  unmarked: number;
  /** attended / registered, or null when nobody was registered yet. */
  showRate: number | null;
};

/**
 * Weekly numbers from the raw rows.
 *
 * Two deliberate choices, both about not flattering ourselves:
 *
 *  - The denominator is everyone registered as of that class, not everyone who
 *    was marked. Marking half the list and reporting 100% would be a lie the
 *    scoreboard tells every week.
 *  - `unmarked` is reported alongside, so a rate resting on a half-finished
 *    check-off is visible on the page rather than silently deflated.
 */
export function computeWeekStats(
  sessionDates: string[],
  registrations: { created_at: string }[],
  attendance: { sessionDate: string; attended: boolean }[],
): WeekStats[] {
  return sessionDates.map((sessionDate) => {
    // Registered "as of" the class: anyone who signed up before the class ended.
    const cutoff = Date.parse(`${shiftIsoDate(sessionDate, 1)}T00:00:00Z`);
    const registered = registrations.filter(
      (r) => Date.parse(r.created_at) < cutoff,
    ).length;

    const marks = attendance.filter((a) => a.sessionDate === sessionDate);
    const attended = marks.filter((a) => a.attended).length;
    const noShow = marks.filter((a) => !a.attended).length;

    return {
      sessionDate,
      registered,
      attended,
      noShow,
      unmarked: Math.max(0, registered - attended - noShow),
      showRate: registered > 0 ? attended / registered : null,
    };
  });
}
