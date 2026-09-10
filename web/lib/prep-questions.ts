/**
 * Default question sets for prep sessions — the solo homework before a long
 * meeting. Keys match the agenda section keys in `meeting-agendas.ts` so the
 * synthesis of each question lands in the right section of the room.
 *
 * `kind: "list"` answers are several short items (proposed rocks, issues);
 * `kind: "text"` answers are a paragraph.
 */

import type { MeetingType } from "@/lib/meeting-agendas";

export interface PrepQuestionTemplate {
  section_key: string;
  prompt: string;
  help?: string;
  kind: "text" | "list";
}

/** The meeting types that get a prep session by default. Any type can have one. */
export const PREP_MEETING_TYPES: MeetingType[] = ["quarterly", "annual", "focus_day"];

const QUARTERLY: PrepQuestionTemplate[] = [
  { section_key: "segue", prompt: "Best thing that happened last quarter — one personal, one business.", kind: "text" },
  { section_key: "prior_quarter", prompt: "Your rocks last quarter: which did you finish, which did you miss, and what actually got in the way?", help: "Be specific. A missed rock with an honest reason is worth more than a vague done.", kind: "text" },
  { section_key: "prior_quarter", prompt: "Which scorecard number worried you most this quarter, and why?", kind: "text" },
  { section_key: "vto", prompt: "Is the core focus still right? Anything in the 1-year plan or 3-year picture you would change?", help: "If nothing, say so and why you're confident.", kind: "text" },
  { section_key: "rocks", prompt: "Your proposed company rocks for next quarter — one line each, with what done looks like.", help: "Three to seven. The team will merge everyone's list in the room.", kind: "list" },
  { section_key: "rocks", prompt: "Your own individual rock(s) for next quarter.", kind: "list" },
  { section_key: "ids", prompt: "The issues we keep avoiding — the ones that belong on the quarterly IDS list.", kind: "list" },
  { section_key: "ids", prompt: "Right people, right seats: anything you're seeing that the team needs to talk about?", kind: "text" },
  { section_key: "conclude", prompt: "What would make this quarterly a 10 for you?", kind: "text" },
];

const ANNUAL: PrepQuestionTemplate[] = [
  { section_key: "segue", prompt: "Your proudest moment of the year, and the hardest one.", kind: "text" },
  { section_key: "prior_year", prompt: "What did we say we'd do this year, and what actually happened? Revenue, clients, rocks.", kind: "text" },
  { section_key: "team_health", prompt: "Right people, right seats. For each seat: does the person get it, want it, and have the capacity to do it?", help: "Including your own seat.", kind: "text" },
  { section_key: "vto", prompt: "Core values: which ones do we actually live, and which are on the wall only?", kind: "text" },
  { section_key: "vto", prompt: "The 10-year target — still the right mountain? Say it in one sentence.", kind: "text" },
  { section_key: "vto", prompt: "Next year's plan: revenue, profit, and the three to five measurables that matter.", kind: "list" },
  { section_key: "vto", prompt: "What should we stop doing next year?", kind: "list" },
  { section_key: "rocks", prompt: "Your proposed Q1 rocks — one line each, with what done looks like.", kind: "list" },
  { section_key: "ids", prompt: "The structural issues that have been on the list all year.", kind: "list" },
  { section_key: "conclude", prompt: "What would make these two days a 10 for you?", kind: "text" },
];

const FOCUS_DAY: PrepQuestionTemplate[] = [
  { section_key: "expectations", prompt: "What do you want from running the company on EOS? What would be different a year from now?", kind: "text" },
  { section_key: "ceiling", prompt: "Where are we hitting the ceiling? Which of the five abilities — simplify, delegate, predict, systemize, structure — is weakest for us?", kind: "text" },
  { section_key: "accountability", prompt: "Draw the seats: the three to seven major functions of the company, one owner each.", help: "A function, then a name. Sales & Marketing — John. Operations — Ashaela.", kind: "list" },
  { section_key: "accountability", prompt: "For each seat you named: does the owner get it, want it, and have the capacity? Where are you unsure?", kind: "text" },
  { section_key: "rocks", prompt: "The three to seven most important things the company must get done in the next 90 days.", kind: "list" },
  { section_key: "pulse", prompt: "Meeting pulse: what day and time should the weekly Level 10 be, and who must be in it?", kind: "text" },
  { section_key: "scorecard", prompt: "The five to fifteen numbers you would want to see every week to know the company is healthy.", help: "A number, then a weekly goal. Calls booked — 10.", kind: "list" },
  { section_key: "conclude", prompt: "What would make this Focus Day a 10 for you?", kind: "text" },
];

const GENERIC: PrepQuestionTemplate[] = [
  { section_key: "segue", prompt: "What's on your mind going into this meeting?", kind: "text" },
  { section_key: "ids", prompt: "The issues you want solved in this meeting.", kind: "list" },
  { section_key: "conclude", prompt: "What would make this meeting a 10 for you?", kind: "text" },
];

export function defaultPrepQuestions(type: MeetingType): PrepQuestionTemplate[] {
  switch (type) {
    case "quarterly":
      return QUARTERLY;
    case "annual":
      return ANNUAL;
    case "focus_day":
      return FOCUS_DAY;
    default:
      return GENERIC;
  }
}
