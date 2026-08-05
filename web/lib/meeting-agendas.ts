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
>;

const min = (n: number) => n * 60;

export const MEETING_AGENDAS: Record<MeetingType, MeetingAgenda> = {
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
];

export function getAgenda(type: MeetingType): MeetingAgenda {
  return MEETING_AGENDAS[type] ?? MEETING_AGENDAS.level_10;
}

/** Total budget in seconds — used for the "Total: 12:30 / 90:00" readout. */
export function agendaBudgetSec(agenda: MeetingAgenda): number {
  return agenda.sections.reduce((sum, s) => sum + s.budgetSec, 0);
}
