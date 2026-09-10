/**
 * The shape of `meetings.agenda_state`.
 *
 * While a meeting runs, the room persists where it is (which section, whether
 * the clock is running and since when, seconds spent per section) so that a
 * refresh, a second laptop on the projector, or a dropped connection resumes
 * the meeting instead of restarting it. After the meeting concludes the same
 * object is the final per-section timing record.
 *
 * Version 1 (rows from before the lifecycle migration) was a flat map of
 * section key to `{ durationSec, budgetSec }`. `parseProgress` accepts both so
 * Meeting History keeps reading old rows.
 */

export interface SectionTiming {
  durationSec: number;
  budgetSec: number;
}

export interface MeetingProgress {
  v: 2;
  /** Index into the agenda's sections. */
  activeIdx: number;
  /** Whether the clock was running when this was saved. */
  running: boolean;
  /** ISO time the clock was last started; the seconds since then belong to
   *  the active section and are not yet in `sections`. */
  runningSince: string | null;
  sections: Record<string, SectionTiming>;
}

function isTiming(v: unknown): v is SectionTiming {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as SectionTiming).durationSec === "number" &&
    typeof (v as SectionTiming).budgetSec === "number"
  );
}

/** Read whatever is in `agenda_state`. Returns null for an empty or foreign shape. */
export function parseProgress(raw: unknown): MeetingProgress | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (obj.v === 2 && obj.sections && typeof obj.sections === "object") {
    const sections: Record<string, SectionTiming> = {};
    for (const [k, v] of Object.entries(obj.sections as Record<string, unknown>)) {
      if (isTiming(v)) sections[k] = { durationSec: v.durationSec, budgetSec: v.budgetSec };
    }
    return {
      v: 2,
      activeIdx: typeof obj.activeIdx === "number" ? obj.activeIdx : 0,
      running: obj.running === true,
      runningSince: typeof obj.runningSince === "string" ? obj.runningSince : null,
      sections,
    };
  }

  // Version 1: a flat map of section key → timing.
  const sections: Record<string, SectionTiming> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (isTiming(v)) sections[k] = { durationSec: v.durationSec, budgetSec: v.budgetSec };
  }
  if (Object.keys(sections).length === 0) return null;
  return { v: 2, activeIdx: 0, running: false, runningSince: null, sections };
}

/**
 * Seconds that have accrued since the clock was started but are not yet
 * folded into `sections` — the gap a resuming room has to add back.
 */
export function unsavedRunningSec(p: MeetingProgress, now = Date.now()): number {
  if (!p.running || !p.runningSince) return 0;
  const since = Date.parse(p.runningSince);
  if (!Number.isFinite(since)) return 0;
  return Math.max(0, Math.floor((now - since) / 1000));
}

/** Total seconds spent across every section, including any unsaved running time. */
export function totalDurationSec(raw: unknown, now = Date.now()): number {
  const p = parseProgress(raw);
  if (!p) return 0;
  const saved = Object.values(p.sections).reduce((a, s) => a + s.durationSec, 0);
  return saved + unsavedRunningSec(p, now);
}

export function fmtClock(sec: number): string {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
