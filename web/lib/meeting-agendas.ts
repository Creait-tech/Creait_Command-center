/**
 * EOS meeting system — agenda templates.
 *
 * EOS is a meeting *system*, not one meeting. The weekly Level 10 carries the
 * rhythm; quarterly, annual and the supporting sessions keep the company aligned.
 * Each type runs its own agenda with its own time budget.
 *
 * Section keys are load-bearing. The meeting room renders capture UI for:
 *   "headlines" → headline input   "ids" → issue input   "conclude" → rating
 * Every agenda must end with a "conclude" section or the meeting can't be saved.
 *
 * ── Where an agenda actually comes from ──────────────────────────────────────
 * The constants below are the EOS standard and the permanent fallback. An org
 * may customise any of them in Settings → Meeting agendas; those edits live in
 * `cc_meeting_agendas` (one row per org per type) and are layered on top at
 * runtime by `applyAgendaOverrides()`.
 *
 * The consumer interface is deliberately unchanged: `MEETING_AGENDAS[type]` and
 * `getAgenda(type)` are still a synchronous lookup returning the same shape, so
 * the meeting room (`components/level10/**`) needed no edits. `MEETING_AGENDAS`
 * is a Proxy over the defaults that consults the override map on read, which is
 * what keeps the type picker and the meeting room showing the same agenda.
 *
 * Overrides are applied in the browser only. Module scope on the server is
 * shared between concurrent requests, so writing one org's agendas there could
 * serve them to another org; SSR therefore always renders the EOS defaults.
 * Nothing agenda-derived reaches the initial HTML (the picker's menu and the
 * meeting dialog both render on interaction), so there is no hydration seam.
 */

import type { MeetingType as DbMeetingType } from "@/lib/supabase/types";

export interface AgendaSection {
  key: string;
  label: string;
  budgetSec: number;
  description: string;
}

export interface MeetingAgenda {
  type: MeetingType;
  label: string;
  cadence: string;
  purpose: string;
  titlePrefix: string;
  sections: AgendaSection[];
}

/**
 * The EOS subset of the meeting types the database accepts. Derived from the DB
 * union with Extract, so adding an agenda for a value the CHECK constraint
 * rejects is a compile error rather than a runtime insert failure.
 */
export type MeetingType = Extract<
  DbMeetingType,
  | "level_10"
  | "quarterly"
  | "annual"
  | "quarterly_conversation"
  | "same_page"
  | "huddle"
  | "financial"
  | "state_of_company"
  | "focus_day"
>;

const min = (n: number) => n * 60;

/**
 * The EOS standard agendas, in code. These are the fallback when an org has no
 * saved row, and the source of truth for "Reset to the EOS default".
 */
export const DEFAULT_MEETING_AGENDAS: Record<MeetingType, MeetingAgenda> = {
  level_10: {
    type: "level_10",
    label: "Level 10 Meeting",
    cadence: "Weekly · 90 min",
    purpose: "Leadership execution meeting: scorecard, Rocks, issues, accountability.",
    titlePrefix: "L10",
    sections: [
      { key: "segue", label: "Segue", budgetSec: min(5), description: "Each person: 1 personal + 1 business good news. Stay connected." },
      { key: "scorecard", label: "Scorecard", budgetSec: min(5), description: "Each KPI: on-track or off-track. NO discussion. Off-track → Issue." },
      { key: "rocks", label: "Rock Review", budgetSec: min(5), description: "Each Rock owner: on-track or off-track. NO discussion. Off-track → Issue." },
      { key: "headlines", label: "Customer/Employee Headlines", budgetSec: min(5), description: "One-sentence updates. If it needs discussion → Issue." },
      { key: "todos", label: "To-Do Review", budgetSec: min(5), description: "Done / not done. Carry over or drop to Issues." },
      { key: "ids", label: "IDS — Identify, Discuss, Solve", budgetSec: min(60), description: "Top 3 issues. Identify root cause → discuss → solve forever." },
      { key: "conclude", label: "Conclude", budgetSec: min(5), description: "Recap To-Dos. Everyone rates the meeting 1–10. Target ≥ 8." },
    ],
  },

  quarterly: {
    type: "quarterly",
    label: "Quarterly Planning",
    cadence: "Every 90 days · full day",
    purpose: "Recalibrate priorities, review the prior quarter, set new Rocks, solve major issues.",
    titlePrefix: "Quarterly",
    sections: [
      { key: "segue", label: "Segue", budgetSec: min(30), description: "Best personal and business news from the last 90 days. Reconnect before you work." },
      { key: "prior_quarter", label: "Prior Quarter Review", budgetSec: min(60), description: "Rock completion rate and the scorecard trend. Target 80%+ Rocks done. Be honest about misses." },
      { key: "vto", label: "V/TO Review", budgetSec: min(60), description: "Is the vision still right? Core values, focus, 10-year target, marketing strategy, 3-year picture." },
      { key: "rocks", label: "Establish Next Quarter's Rocks", budgetSec: min(120), description: "3–7 company Rocks. Each one specific, measurable, and owned by exactly one person." },
      { key: "ids", label: "IDS — Quarterly Issues", budgetSec: min(120), description: "Everything blocking the next 90 days. Solve it here or it follows you into the quarter." },
      { key: "conclude", label: "Conclude", budgetSec: min(30), description: "Recap Rocks and To-Dos, agree the cascading message, rate the day 1–10." },
    ],
  },

  annual: {
    type: "annual",
    label: "Annual Planning",
    cadence: "Yearly · two days",
    purpose: "Reset the long-term vision, refine the V/TO, set the year's direction.",
    titlePrefix: "Annual",
    sections: [
      { key: "segue", label: "Segue", budgetSec: min(45), description: "Wins from the year. Everyone speaks. This sets the tone for two days." },
      { key: "prior_year", label: "Prior Year Review", budgetSec: min(90), description: "Revenue, profit, measurables, Rock completion. What actually happened versus what you said would happen." },
      { key: "team_health", label: "Team Health", budgetSec: min(90), description: "Right people, right seats. GWC on every seat. The conversation nobody wants and everybody needs." },
      { key: "vto", label: "V/TO — Full Rebuild", budgetSec: min(180), description: "Core values, core focus, 10-year target, marketing strategy, 3-year picture, 1-year plan." },
      { key: "rocks", label: "Q1 Rocks", budgetSec: min(120), description: "Translate the 1-year plan into 3–7 Rocks for the first quarter." },
      { key: "ids", label: "IDS — Annual Issues", budgetSec: min(120), description: "The structural issues. The ones that have been on the list all year." },
      { key: "conclude", label: "Conclude", budgetSec: min(45), description: "Cascading message, commitments, rate the session 1–10." },
    ],
  },

  quarterly_conversation: {
    type: "quarterly_conversation",
    label: "Quarterly Conversation",
    cadence: "Every 90 days · 1-on-1 · 60 min",
    purpose: "Leader and direct report: performance, fit, and support.",
    titlePrefix: "1-on-1",
    sections: [
      { key: "opener", label: "Opener", budgetSec: min(5), description: "Not a performance review. A conversation. Set that expectation first." },
      { key: "working", label: "What's Working", budgetSec: min(15), description: "They go first. Listen more than you talk." },
      { key: "not_working", label: "What's Not Working", budgetSec: min(15), description: "Both directions. You ask for feedback too." },
      { key: "gwc", label: "GWC Check", budgetSec: min(10), description: "Do they Get it, Want it, and have the Capacity to do it? All three, honestly." },
      { key: "next_90", label: "Next 90 Days", budgetSec: min(10), description: "Their Rocks, their role, what support they need from you." },
      { key: "conclude", label: "Conclude", budgetSec: min(5), description: "Agree the commitments. Rate the conversation 1–10." },
    ],
  },

  same_page: {
    type: "same_page",
    label: "Same Page Meeting",
    cadence: "As needed · 60 min",
    purpose: "Resolve misalignment between two key people before it spreads.",
    titlePrefix: "Same Page",
    sections: [
      { key: "purpose", label: "Name the Gap", budgetSec: min(5), description: "State plainly what you're here to get aligned on. No preamble." },
      { key: "perspective_a", label: "First Perspective", budgetSec: min(15), description: "One person, uninterrupted. The other only asks clarifying questions." },
      { key: "perspective_b", label: "Second Perspective", budgetSec: min(15), description: "Swap. Same rules." },
      { key: "ids", label: "IDS — Where We Diverge", budgetSec: min(20), description: "Identify the real disagreement, discuss it, solve it. It is almost never the thing you came in arguing about." },
      { key: "conclude", label: "Commitments", budgetSec: min(5), description: "What each of you will do differently. Rate the conversation 1–10." },
    ],
  },

  huddle: {
    type: "huddle",
    label: "Team Huddle",
    cadence: "Daily or as needed · 15 min",
    purpose: "Fast check-in. Remove blockers, share what matters, get back to work.",
    titlePrefix: "Huddle",
    sections: [
      { key: "headlines", label: "Headlines", budgetSec: min(5), description: "One sentence each. Anything the team needs to know today." },
      { key: "ids", label: "Blockers", budgetSec: min(7), description: "What's in your way right now? Small blockers solve here; big ones become Issues." },
      { key: "conclude", label: "Priorities", budgetSec: min(3), description: "Each person names their one priority for today. Rate 1–10." },
    ],
  },

  financial: {
    type: "financial",
    label: "Financial Review",
    cadence: "Monthly · 60 min",
    purpose: "Monthly look at financial performance against the plan.",
    titlePrefix: "Financial",
    sections: [
      { key: "scorecard", label: "Scorecard", budgetSec: min(10), description: "Every financial measurable: on-track or off-track. No discussion yet." },
      { key: "pnl", label: "P&L Review", budgetSec: min(15), description: "Revenue, cost, margin against plan. Where did the money actually go?" },
      { key: "cash", label: "Cash Position", budgetSec: min(10), description: "Cash on hand, runway, receivables, and the tax reserve. Profit is opinion; cash is fact." },
      { key: "ids", label: "IDS — Variances", budgetSec: min(20), description: "Every material variance becomes an issue. Solve the cause, not the number." },
      { key: "conclude", label: "Actions", budgetSec: min(5), description: "To-Dos with owners and dates. Rate the meeting 1–10." },
    ],
  },

  state_of_company: {
    type: "state_of_company",
    label: "State of the Company",
    cadence: "Monthly or quarterly · 60 min",
    purpose: "Company-wide communication. Reinforce vision, priorities and progress.",
    titlePrefix: "State of the Company",
    sections: [
      { key: "been", label: "Where We've Been", budgetSec: min(10), description: "The story so far. Short. People need context before numbers." },
      { key: "are", label: "Where We Are", budgetSec: min(15), description: "Honest current state — the scorecard, the Rocks, the wins and the misses." },
      { key: "going", label: "Where We're Going", budgetSec: min(15), description: "The vision, restated. People need to hear it more often than feels necessary." },
      { key: "headlines", label: "Headlines", budgetSec: min(10), description: "Customer and employee news worth the whole room hearing." },
      { key: "conclude", label: "Q&A and Close", budgetSec: min(10), description: "Open floor. Then rate the session 1–10." },
    ],
  },

  focus_day: {
    type: "focus_day",
    label: "Focus Day",
    cadence: "Once · full day",
    purpose: "Install the EOS foundation: accountability chart, rocks, meeting pulse, scorecard.",
    titlePrefix: "Focus Day",
    sections: [
      { key: "expectations", label: "Expectations", budgetSec: min(30), description: "What each person wants from running the company this way. Name it so you can check it at the end." },
      { key: "ceiling", label: "Hitting the Ceiling", budgetSec: min(45), description: "The five abilities: simplify, delegate, predict, systemize, structure. Where are we stuck?" },
      { key: "accountability", label: "Accountability Chart", budgetSec: min(120), description: "Structure first, people second. Three to seven major functions, one owner each. GWC every seat." },
      { key: "rocks", label: "Rocks", budgetSec: min(90), description: "The three to seven most important things for the next 90 days. One owner each." },
      { key: "pulse", label: "Meeting Pulse", budgetSec: min(30), description: "Weekly Level 10 — same day, same time, same agenda. Quarterlies on the calendar." },
      { key: "scorecard", label: "Scorecard", budgetSec: min(60), description: "Five to fifteen weekly numbers with a goal each. The absolute pulse of the business." },
      { key: "conclude", label: "Conclude", budgetSec: min(30), description: "Recap the rocks and the pulse. Did the day meet the expectations? Rate it 1–10." },
    ],
  },
};

export const MEETING_TYPE_ORDER: MeetingType[] = [
  "level_10",
  "huddle",
  "financial",
  "quarterly",
  "quarterly_conversation",
  "same_page",
  "state_of_company",
  "annual",
  "focus_day",
];

// ─────────────────────────────────────────────────────────────────────────────
// Load-bearing section keys
// ─────────────────────────────────────────────────────────────────────────────

/** The final section of every agenda. Without it a meeting can't be rated. */
export const CONCLUDE_KEY = "conclude";

/**
 * Keys the meeting room switches on to render capture UI. Renaming one of these
 * doesn't rename a feature — it removes it, silently. The editor locks them and
 * says why; this map is the copy it shows.
 */
export const CAPTURE_SECTION_KEYS: Record<string, string> = {
  headlines: "Shows the headline box — what's typed here becomes a Headline.",
  ids: "Shows the issue box — what's typed here becomes an Issue on the IDS list.",
  conclude: "Shows the 1–10 rating and the Finish button that saves the meeting.",
};

export function isCaptureKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(CAPTURE_SECTION_KEYS, key);
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime overrides (browser only — see the module header)
// ─────────────────────────────────────────────────────────────────────────────

const overrides = new Map<MeetingType, MeetingAgenda>();

/** Narrows an arbitrary string to one of the eight editable EOS types. */
export function isMeetingType(value: string): value is MeetingType {
  return Object.prototype.hasOwnProperty.call(DEFAULT_MEETING_AGENDAS, value);
}

/**
 * Layer an org's saved agendas over the defaults for the rest of this page's
 * life. No-op on the server: module scope there is shared across requests, and
 * one org's agendas must never be able to leak into another org's render.
 *
 * Called during hydration by `components/meeting-agendas/agenda-hydrator.tsx`
 * (before any consumer renders) and again by the editor after a successful save
 * so the meeting room picks up the change without a reload.
 */
export function applyAgendaOverrides(agendas: MeetingAgenda[]): void {
  if (typeof window === "undefined") return;
  for (const agenda of agendas) {
    if (isMeetingType(agenda.type)) overrides.set(agenda.type, agenda);
  }
}

/** Drop one override so the code default is authoritative again. */
export function clearAgendaOverride(type: MeetingType): void {
  overrides.delete(type);
}

/**
 * The agendas in force. Same shape and same lookup as before this file was
 * database-backed — the Proxy is what lets an org's saved agenda answer
 * `MEETING_AGENDAS[type]` without every call site learning about the database.
 */
export const MEETING_AGENDAS: Record<MeetingType, MeetingAgenda> = new Proxy(
  DEFAULT_MEETING_AGENDAS,
  {
    get(target, prop, receiver) {
      if (typeof prop === "string" && isMeetingType(prop)) {
        return overrides.get(prop) ?? target[prop];
      }
      return Reflect.get(target, prop, receiver);
    },
  },
);

export function getAgenda(type: MeetingType): MeetingAgenda {
  return MEETING_AGENDAS[type] ?? MEETING_AGENDAS.level_10;
}

/** The untouched EOS standard for a type, whatever the org has saved. */
export function defaultAgenda(type: MeetingType): MeetingAgenda {
  return DEFAULT_MEETING_AGENDAS[type] ?? DEFAULT_MEETING_AGENDAS.level_10;
}

/** Total budget in seconds — used for the "Total: 12:30 / 90:00" readout. */
export function agendaBudgetSec(agenda: MeetingAgenda): number {
  return agenda.sections.reduce((sum, s) => sum + s.budgetSec, 0);
}

/**
 * How long this meeting is *meant* to take. The EOS standard length is exactly
 * the sum of the standard agenda's budgets (a Level 10 is 90 minutes because
 * 5+5+5+5+5+60+5 = 90), so there is no second number to keep in sync.
 */
export function standardBudgetSec(type: MeetingType): number {
  return agendaBudgetSec(defaultAgenda(type));
}

/** True when the agenda differs in any visible way from the EOS standard. */
export function isCustomised(agenda: MeetingAgenda): boolean {
  const std = defaultAgenda(agenda.type);
  if (
    agenda.label !== std.label ||
    agenda.cadence !== std.cadence ||
    agenda.purpose !== std.purpose ||
    agenda.titlePrefix !== std.titlePrefix ||
    agenda.sections.length !== std.sections.length
  ) {
    return true;
  }
  return agenda.sections.some((s, i) => {
    const d = std.sections[i];
    return (
      s.key !== d.key ||
      s.label !== d.label ||
      s.budgetSec !== d.budgetSec ||
      s.description !== d.description
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation — one implementation, shared by the editor and the loader
// ─────────────────────────────────────────────────────────────────────────────

export const AGENDA_LIMITS = {
  maxSections: 30,
  minBudgetSec: 60,
  maxBudgetSec: 8 * 60 * 60,
  maxLabel: 80,
  maxKey: 40,
  maxDescription: 400,
  maxCadence: 80,
  maxPurpose: 240,
  maxTitlePrefix: 40,
} as const;

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

/** A section key derived from a label: "Rock Review" → "rock_review". */
export function slugifyKey(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, AGENDA_LIMITS.maxKey);
  return KEY_PATTERN.test(slug) ? slug : `section_${slug}`.slice(0, AGENDA_LIMITS.maxKey);
}

export type AgendaValidation =
  | { ok: true; agenda: MeetingAgenda }
  | { ok: false; errors: string[] };

/**
 * Check a draft agenda and return the cleaned, storable version.
 *
 * The two rules that carry weight — a `conclude` section, last — are checked
 * here rather than only in the UI, because the same function guards the write
 * and the read. A row that fails is treated as absent and the EOS default is
 * served instead, so a bad agenda can never reach the meeting room.
 */
export function validateAgenda(input: {
  type: MeetingType;
  label: string;
  cadence: string;
  purpose: string;
  titlePrefix: string;
  sections: AgendaSection[];
}): AgendaValidation {
  const errors: string[] = [];

  if (!isMeetingType(input.type)) {
    return { ok: false, errors: [`"${input.type}" is not a meeting type this system knows.`] };
  }

  const label = input.label.trim();
  const cadence = input.cadence.trim();
  const purpose = input.purpose.trim();
  const titlePrefix = input.titlePrefix.trim();

  if (!label) errors.push("The meeting needs a name.");
  if (label.length > AGENDA_LIMITS.maxLabel) errors.push(`The name is longer than ${AGENDA_LIMITS.maxLabel} characters.`);
  if (!titlePrefix) errors.push("The title prefix is what every saved meeting is named with — it can't be blank.");
  if (titlePrefix.length > AGENDA_LIMITS.maxTitlePrefix) errors.push(`The title prefix is longer than ${AGENDA_LIMITS.maxTitlePrefix} characters.`);
  if (cadence.length > AGENDA_LIMITS.maxCadence) errors.push(`The cadence is longer than ${AGENDA_LIMITS.maxCadence} characters.`);
  if (purpose.length > AGENDA_LIMITS.maxPurpose) errors.push(`The purpose is longer than ${AGENDA_LIMITS.maxPurpose} characters.`);

  const sections: AgendaSection[] = [];
  const seen = new Set<string>();

  if (input.sections.length === 0) {
    errors.push("An agenda needs at least one section.");
  }
  if (input.sections.length > AGENDA_LIMITS.maxSections) {
    errors.push(`An agenda can hold at most ${AGENDA_LIMITS.maxSections} sections.`);
  }

  input.sections.forEach((raw, i) => {
    const position = `Section ${i + 1}`;
    const key = (raw.key ?? "").trim();
    const sectionLabel = (raw.label ?? "").trim();
    const description = (raw.description ?? "").trim();
    const budgetSec = Math.round(Number(raw.budgetSec));

    if (!KEY_PATTERN.test(key) || key.length > AGENDA_LIMITS.maxKey) {
      errors.push(`${position}: the key "${key}" must be lower-case letters, numbers and underscores, starting with a letter.`);
    } else if (seen.has(key)) {
      errors.push(`${position}: two sections share the key "${key}". Keys have to be unique.`);
    }
    seen.add(key);

    if (!sectionLabel) errors.push(`${position} needs a name.`);
    if (sectionLabel.length > AGENDA_LIMITS.maxLabel) errors.push(`${position}: the name is longer than ${AGENDA_LIMITS.maxLabel} characters.`);
    if (description.length > AGENDA_LIMITS.maxDescription) errors.push(`${position}: the description is longer than ${AGENDA_LIMITS.maxDescription} characters.`);

    if (!Number.isFinite(budgetSec) || budgetSec < AGENDA_LIMITS.minBudgetSec) {
      errors.push(`${position}: give it at least one minute.`);
    } else if (budgetSec > AGENDA_LIMITS.maxBudgetSec) {
      errors.push(`${position}: ${AGENDA_LIMITS.maxBudgetSec / 3600} hours is the longest a single section can be.`);
    }

    sections.push({ key, label: sectionLabel, budgetSec, description });
  });

  const concludeCount = sections.filter((s) => s.key === CONCLUDE_KEY).length;
  const last = sections[sections.length - 1];

  if (concludeCount === 0) {
    errors.push(
      'This agenda has no "conclude" section. That section is where the meeting room shows the 1–10 rating and the Finish button — without it the meeting can be started but never rated or saved.',
    );
  } else if (concludeCount > 1) {
    errors.push('Only one section can use the key "conclude" — it is the section that ends and saves the meeting.');
  } else if (last && last.key !== CONCLUDE_KEY) {
    errors.push(
      'The "conclude" section has to be last. Anything after it can never be reached, because concluding is what saves and closes the meeting.',
    );
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    agenda: { type: input.type, label, cadence, purpose, titlePrefix, sections },
  };
}

/**
 * Turn a `cc_meeting_agendas` row into an agenda, or null if it can't be
 * trusted. Callers fall back to the code default — a malformed row must never
 * take the meeting room down with it.
 */
export function parseAgendaRow(row: {
  type: string;
  label?: string | null;
  cadence?: string | null;
  purpose?: string | null;
  title_prefix?: string | null;
  sections?: unknown;
}): MeetingAgenda | null {
  if (!isMeetingType(row.type)) return null;
  if (!Array.isArray(row.sections)) return null;

  const sections: AgendaSection[] = [];
  for (const entry of row.sections) {
    if (typeof entry !== "object" || entry === null) return null;
    const s = entry as Record<string, unknown>;
    if (typeof s.key !== "string" || typeof s.label !== "string") return null;
    sections.push({
      key: s.key,
      label: s.label,
      budgetSec: typeof s.budgetSec === "number" ? s.budgetSec : Number(s.budgetSec),
      description: typeof s.description === "string" ? s.description : "",
    });
  }

  const result = validateAgenda({
    type: row.type,
    label: row.label ?? "",
    cadence: row.cadence ?? "",
    purpose: row.purpose ?? "",
    titlePrefix: row.title_prefix ?? "",
    sections,
  });

  return result.ok ? result.agenda : null;
}
