/**
 * The editable form of an agenda, plus the pure helpers the editor uses.
 *
 * Deliberately runtime-free and client-safe: the server actions, the server
 * loader and the browser editor all share these shapes, so "what a draft is"
 * is defined once. Every helper returns a new object rather than mutating the
 * draft in place.
 */

import {
  CONCLUDE_KEY,
  slugifyKey,
  standardBudgetSec,
  type AgendaSection,
  type MeetingAgenda,
  type MeetingType,
} from "@/lib/meeting-agendas";

/** An agenda as Settings shows it: the agenda plus who last touched it. */
export interface StoredAgenda {
  agenda: MeetingAgenda;
  /** False when this is the code default because no valid row exists yet. */
  fromDatabase: boolean;
  updatedByName: string | null;
  updatedAt: string | null;
}

/** What the editor holds and what the save action accepts. */
export interface AgendaDraft {
  type: MeetingType;
  label: string;
  cadence: string;
  purpose: string;
  titlePrefix: string;
  sections: AgendaSection[];
}

export function toDraft(agenda: MeetingAgenda): AgendaDraft {
  return {
    type: agenda.type,
    label: agenda.label,
    cadence: agenda.cadence,
    purpose: agenda.purpose,
    titlePrefix: agenda.titlePrefix,
    sections: agenda.sections.map((s) => ({ ...s })),
  };
}

/** True when the draft still matches what is saved — nothing to write. */
export function draftMatches(draft: AgendaDraft, agenda: MeetingAgenda): boolean {
  return JSON.stringify(toDraft(agenda)) === JSON.stringify(draft);
}

export function draftBudgetSec(draft: AgendaDraft): number {
  return draft.sections.reduce((sum, s) => sum + (Number(s.budgetSec) || 0), 0);
}

/** "90 min" / "1 hr 30 min" / "7 hr" — whole minutes, never seconds. */
export function formatBudget(sec: number): string {
  const minutes = Math.round(sec / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export interface BudgetReadout {
  totalSec: number;
  standardSec: number;
  /** Positive when the agenda runs longer than the EOS standard. */
  deltaSec: number;
  tone: "match" | "over" | "under";
  message: string;
}

/**
 * The running total against the length this meeting is meant to be. The
 * standard is the sum of the EOS agenda's own budgets — a Level 10 is 90
 * minutes because its seven standard sections add up to 90 — so there is no
 * separate target to drift out of sync.
 */
export function budgetReadout(draft: AgendaDraft): BudgetReadout {
  const totalSec = draftBudgetSec(draft);
  const standardSec = standardBudgetSec(draft.type);
  const deltaSec = totalSec - standardSec;
  const total = formatBudget(totalSec);
  const standard = formatBudget(standardSec);

  if (deltaSec === 0) {
    return { totalSec, standardSec, deltaSec, tone: "match", message: `${total} — matches the ${standard} EOS standard.` };
  }
  if (deltaSec > 0) {
    return {
      totalSec,
      standardSec,
      deltaSec,
      tone: "over",
      message: `${total} — ${formatBudget(deltaSec)} longer than the ${standard} EOS standard.`,
    };
  }
  return {
    totalSec,
    standardSec,
    deltaSec,
    tone: "under",
    message: `${total} — ${formatBudget(-deltaSec)} shorter than the ${standard} EOS standard.`,
  };
}

/** A key nothing else in the agenda is using. */
export function uniqueKey(base: string, taken: string[]): string {
  const root = slugifyKey(base) || "section";
  if (!taken.includes(root)) return root;
  for (let n = 2; n < 100; n++) {
    const candidate = `${root}_${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${root}_${Date.now()}`;
}

export function replaceSection(
  draft: AgendaDraft,
  index: number,
  patch: Partial<AgendaSection>,
): AgendaDraft {
  return {
    ...draft,
    sections: draft.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)),
  };
}

/** New sections land immediately before the concluding section. */
export function addSection(draft: AgendaDraft): AgendaDraft {
  const taken = draft.sections.map((s) => s.key);
  const section: AgendaSection = {
    key: uniqueKey("section", taken),
    label: "",
    budgetSec: 5 * 60,
    description: "",
  };
  const lastIsConclude = draft.sections[draft.sections.length - 1]?.key === CONCLUDE_KEY;
  const at = lastIsConclude ? draft.sections.length - 1 : draft.sections.length;
  const sections = [...draft.sections];
  sections.splice(at, 0, section);
  return { ...draft, sections };
}

export function removeSection(draft: AgendaDraft, index: number): AgendaDraft {
  return { ...draft, sections: draft.sections.filter((_, i) => i !== index) };
}

export function moveSection(draft: AgendaDraft, index: number, direction: -1 | 1): AgendaDraft {
  const target = index + direction;
  if (target < 0 || target >= draft.sections.length) return draft;
  const sections = [...draft.sections];
  const [moved] = sections.splice(index, 1);
  sections.splice(target, 0, moved);
  return { ...draft, sections };
}
