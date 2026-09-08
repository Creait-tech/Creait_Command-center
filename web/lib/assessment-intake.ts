/**
 * The Owner Pre-Assessment Intake — question set, storage shape and the two
 * things the coordinator does with it (pre-fill the baseline, see which
 * indicators the intake actually gave evidence for).
 *
 * Source of truth: "CREAIT Growth & AI Diagnostic — Master Intake
 * Questionnaire v1" (resources/CREAIT-Master-Intake-Questionnaire.md). The
 * numbering here IS that document's numbering: q1–q55 plus conditional module
 * E (e1–e6). Four questions the rigor review found missing are appended with
 * fresh ids rather than renumbering, because a question id is what an answer
 * is keyed on in the database and renumbering would silently re-file every
 * stored answer:
 *
 *   q56  loaded labor rate by role — the Leverage audit computes
 *        hours/yr × loaded rate, and the rate was never asked for.
 *   q57  owner burnout / continuity — OVERLAY_FLAGS carries owner_burnout and
 *        nothing in the intake could raise it.
 *   q58  team training on the tools    ┐ L9 (team readiness) had no intake
 *   q59  team appetite for the change  ┘ evidence at all.
 *
 * The design rules of the instrument hold here, and two of them are load-
 * bearing in code:
 *
 *   1. "Not currently known" is a real answer on every question that allows
 *      it, is stored as the literal string "unknown", and is NEVER coerced to
 *      zero. A zeroed unknown becomes a finding the owner never made.
 *   2. Estimates are welcome. Scalar answers are stored as the owner typed
 *      them ("about 1.2M", "60-65%") and parsed on the way OUT, so nothing an
 *      owner writes is ever rejected or silently rounded on the way in.
 */

import type { IndicatorKey } from "@/lib/assessment-instrument";

/**
 * The literal stored for "Not currently known". A string, deliberately: it
 * survives a JSON round trip, it is visibly different from an empty answer,
 * and no arithmetic anywhere can mistake it for a number.
 */
export const UNKNOWN = "unknown";

// ─────────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────────

export type IntakeSectionId = "s1" | "s2" | "s3" | "s4" | "s5" | "s6" | "e";

export interface IntakeSection {
  id: IntakeSectionId;
  title: string;
  /** One line to the owner about what this section is for. */
  blurb: string;
  /**
   * Module E only applies when the owner's objective (q3) includes a sale,
   * a succession or an exit. Shown, but never counted against progress, when
   * it does not apply.
   */
  conditional?: boolean;
}

export const INTAKE_SECTIONS: IntakeSection[] = [
  {
    id: "s1",
    title: "You and the business you want",
    blurb:
      "Where you are heading, and what your own week looks like today. Answer these in your own words — they set the frame for everything after.",
  },
  {
    id: "s2",
    title: "Business profile & money",
    blurb:
      "The shape of the business and its numbers. Estimates and ranges are fine; this is used to size opportunities, and it is not a valuation.",
  },
  {
    id: "s3",
    title: "The growth engine",
    blurb:
      "How work comes in, how it converts, and what it is worth. Where the profit levers usually sit.",
  },
  {
    id: "s4",
    title: "Operations & systems",
    blurb:
      "How the work actually gets done, who owns it, and what breaks most often.",
  },
  {
    id: "s5",
    title: "Technology, AI & automation",
    blurb:
      "What you run on, what already runs itself, and what is still done by hand.",
  },
  {
    id: "s6",
    title: "Owner independence & risk",
    blurb:
      "What still needs you personally, and what would hurt most if it disappeared.",
  },
  {
    id: "e",
    title: "Ownership transition",
    blurb:
      "Only if a sale, a succession or an exit is one of your objectives. Skip it if it is not.",
    conditional: true,
  },
];

export const INTAKE_SECTIONS_BY_ID: Record<IntakeSectionId, IntakeSection> =
  Object.fromEntries(INTAKE_SECTIONS.map((s) => [s.id, s])) as Record<
    IntakeSectionId,
    IntakeSection
  >;

// ─────────────────────────────────────────────────────────────────────────────
// Questions
// ─────────────────────────────────────────────────────────────────────────────

export type IntakeQuestionId =
  | "q1" | "q2" | "q3" | "q4" | "q5" | "q6" | "q7" | "q8" | "q9" | "q10"
  | "q11" | "q12" | "q13" | "q14" | "q15" | "q16" | "q17" | "q18" | "q19" | "q20"
  | "q21" | "q22" | "q23" | "q24" | "q25" | "q26" | "q27" | "q28" | "q29" | "q30"
  | "q31" | "q32" | "q33" | "q34" | "q35" | "q36" | "q37" | "q38" | "q39" | "q40"
  | "q41" | "q42" | "q43" | "q44" | "q45" | "q46" | "q47" | "q48" | "q49" | "q50"
  | "q51" | "q52" | "q53" | "q54" | "q55" | "q56" | "q57" | "q58" | "q59"
  | "e1" | "e2" | "e3" | "e4" | "e5" | "e6";

export type IntakeQuestionType =
  | "short"
  | "long"
  | "number"
  | "currency"
  | "percent"
  | "single"
  | "multi"
  | "table"
  /** Nothing is uploaded here — the owner lists what they can send. */
  | "upload_note";

export interface IntakeColumn {
  key: string;
  label: string;
  type: "short" | "number" | "currency" | "percent" | "single";
  /** Required for a `single` column. */
  options?: string[];
  width?: "narrow" | "wide";
}

export interface IntakeQuestion {
  id: IntakeQuestionId;
  section: IntakeSectionId;
  prompt: string;
  help?: string;
  type: IntakeQuestionType;
  /** `single` and `multi` only. */
  options?: string[];
  /** `table` only. */
  columns?: IntakeColumn[];
  /**
   * `table` only: fixed row labels. With rows the owner fills a grid whose
   * left column is written for them; without them the owner adds their own
   * rows up to `maxRows`.
   */
  rows?: string[];
  maxRows?: number;
  /** Whether "Not currently known" is offered — see UNKNOWN. */
  allowUnknown: boolean;
  /** Which of the thirty indicators this answer is evidence for. */
  feedsIndicators: IndicatorKey[];
  required: boolean;
  /** Mirror instrument — asked exactly as written, so the owner hears it. */
  mirror?: boolean;
  /** OVERLAY_FLAGS keys this answer can raise for the advisor to confirm. */
  feedsOverlay?: string[];
}

/** The reserved column key holding the row label of a fixed-row table. */
export const TABLE_ROW_KEY = "row";

const OBJECTIVES = [
  "More profit & cash flow",
  "Reliable revenue growth",
  "Stronger sales/marketing engine",
  "Better operations & delivery capacity",
  "Reduce owner dependence",
  "Use AI/automation effectively",
  "Prepare to scale",
  "Succession/leadership transition",
  "Future sale or partial exit",
  "Resilience/risk reduction",
  "Other",
];

/** The objectives that fire conditional module E. */
export const TRANSITION_OBJECTIVES = [
  "Succession/leadership transition",
  "Future sale or partial exit",
];

const ALWAYS_SOMETIMES = ["Always", "Usually", "Sometimes", "Rarely"];

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  // ── Section 1 — You and the business you want (Mirror opening) ────────────
  {
    id: "q1",
    section: "s1",
    prompt: "Contact & company",
    help: "So the report is headed correctly and we can reach you.",
    type: "table",
    rows: [
      "Your name",
      "Email",
      "Phone",
      "Company name",
      "Website",
      "Location",
      "Industry",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: false,
    feedsIndicators: [],
    required: true,
  },
  {
    id: "q2",
    section: "s1",
    prompt: "Describe your company in plain language.",
    help: "What do you sell, who do you serve, how is the work delivered?",
    type: "long",
    allowUnknown: false,
    feedsIndicators: [],
    required: true,
  },
  {
    id: "q3",
    section: "s1",
    prompt: "Primary objective for the next 1–3 years",
    help: "One primary, up to two secondary.",
    type: "table",
    rows: ["Primary", "Secondary", "Secondary"],
    columns: [
      { key: "objective", label: "Objective", type: "single", options: OBJECTIVES, width: "wide" },
    ],
    allowUnknown: false,
    feedsIndicators: [],
    required: true,
  },
  {
    id: "q4",
    section: "s1",
    prompt:
      "What three measurable outcomes would make the next 12 months a success?",
    type: "table",
    rows: ["1", "2", "3"],
    columns: [
      { key: "outcome", label: "Outcome", type: "short", width: "wide" },
      { key: "target", label: "Target", type: "short" },
    ],
    allowUnknown: true,
    feedsIndicators: [],
    required: false,
  },
  {
    id: "q5",
    section: "s1",
    prompt: "Describe the business you want to own three years from now.",
    help: "Size, profit, team, systems — and your role in it.",
    type: "long",
    allowUnknown: false,
    feedsIndicators: [],
    required: false,
  },
  {
    id: "q6",
    section: "s1",
    prompt: "Your current role",
    help: "Pick the closest.",
    type: "single",
    options: [
      "Doing the technical work",
      "Selling & managing customer relationships",
      "Managing people & operations",
      "Leading strategy & growth",
      "Split across most of these",
    ],
    allowUnknown: false,
    feedsIndicators: ["S1"],
    required: false,
  },
  {
    id: "q7",
    section: "s1",
    prompt: "Owner time & freedom",
    help:
      "And in your own words: what pulls you back in when you try to step away?",
    type: "table",
    rows: [
      "Hours/week now",
      "Hours/week you want in 12 months",
      "Hours/week you want in 3 years",
      "Longest uninterrupted time away in the past 12 months",
      "What pulls you back in",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["S1", "S2"],
    required: false,
    mirror: true,
  },
  {
    id: "q8",
    section: "s1",
    prompt:
      "What do you believe is the single biggest bottleneck in the business right now?",
    help:
      "What symptoms tell you that, and how long has it been true? Your words are recorded exactly as you write them.",
    type: "long",
    allowUnknown: false,
    feedsIndicators: [],
    required: true,
    mirror: true,
  },

  // ── Section 2 — Business profile & money ──────────────────────────────────
  {
    id: "q9",
    section: "s2",
    prompt: "Age & ownership",
    type: "table",
    rows: [
      "Year founded",
      "Owners & percentages",
      "Any owner misalignment affecting decisions?",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: [],
    required: false,
  },
  {
    id: "q10",
    section: "s2",
    prompt: "Team",
    type: "table",
    rows: [
      "Full-time employees",
      "Part-time",
      "Regular contractors",
      "Managers / team leads",
      "People with direct reports",
    ],
    columns: [{ key: "count", label: "Count", type: "number" }],
    allowUnknown: true,
    feedsIndicators: ["S4"],
    required: false,
  },
  {
    id: "q11",
    section: "s2",
    prompt: "Reach",
    help: "And your primary markets.",
    type: "single",
    options: ["Local", "Regional", "Multi-state", "National", "Online"],
    allowUnknown: false,
    feedsIndicators: [],
    required: false,
  },
  {
    id: "q12",
    section: "s2",
    prompt: "Revenue model",
    help: "Roughly how revenue splits — the percentages should total about 100.",
    type: "table",
    rows: [
      "One-time projects",
      "Recurring contracts",
      "Repeat without contract",
      "Products",
      "Retainers",
      "Other",
    ],
    columns: [{ key: "pct", label: "% of revenue", type: "percent" }],
    allowUnknown: true,
    feedsIndicators: ["S9"],
    required: false,
  },
  {
    id: "q13",
    section: "s2",
    prompt: "Top offerings",
    help: "Up to five. Rough margins are fine.",
    type: "table",
    maxRows: 5,
    columns: [
      { key: "name", label: "Offering", type: "short", width: "wide" },
      { key: "pct", label: "% of revenue", type: "percent" },
      { key: "margin", label: "Gross margin %", type: "percent" },
      {
        key: "trend",
        label: "Trend",
        type: "single",
        options: ["Growing", "Flat", "Declining"],
      },
      { key: "importance", label: "Strategic importance", type: "short" },
    ],
    allowUnknown: true,
    feedsIndicators: ["P6", "P9"],
    required: false,
  },
  {
    id: "q14",
    section: "s2",
    prompt: "Customer mix",
    help:
      "The last line is a mirror question — answer it honestly, it is one of the most useful numbers in the whole intake.",
    type: "table",
    rows: [
      "Active customer count",
      "B2B / B2C / mixed",
      "% of revenue from your largest customer",
      "% of revenue from your top five",
      "% of revenue tied directly to YOUR personal relationships",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["S8", "S3"],
    required: false,
    mirror: true,
    feedsOverlay: ["customer_concentration"],
  },
  {
    id: "q15",
    section: "s2",
    prompt: "Revenue",
    help: "Ranges are fine.",
    type: "table",
    rows: [
      "Last completed year",
      "Prior year",
      "Year to date",
      "Full-year forecast",
    ],
    columns: [{ key: "amount", label: "Revenue", type: "currency" }],
    allowUnknown: true,
    feedsIndicators: [],
    required: false,
  },
  {
    id: "q16",
    section: "s2",
    prompt: "Two-year revenue trend",
    help: "And what caused it?",
    type: "single",
    options: [
      "Declined more than 10%",
      "Declined 10% or less",
      "Flat",
      "Up 10% or less",
      "Up 11–25%",
      "Up more than 25%",
    ],
    allowUnknown: true,
    feedsIndicators: ["S9"],
    required: false,
  },
  {
    id: "q17",
    section: "s2",
    prompt: "Gross margin",
    help:
      "Approximate % if known, your main direct costs, and whether margin is tracked by job, service or customer.",
    type: "table",
    rows: [
      "Approximate gross margin %",
      "Main direct costs",
      "Tracked by job / service / customer?",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["P9"],
    required: false,
  },
  {
    id: "q18",
    section: "s2",
    prompt: "Profit & owner pay",
    help:
      "Used to size opportunities. This is not a valuation, and nothing here is shared outside your engagement.",
    type: "table",
    rows: [
      "Operating profit estimate",
      "Owner salary",
      "Owner distributions",
      "Unusual one-off expenses",
    ],
    columns: [{ key: "amount", label: "Amount", type: "currency" }],
    allowUnknown: true,
    feedsIndicators: ["P9", "P10"],
    required: false,
  },
  {
    id: "q19",
    section: "s2",
    prompt: "Cash pressure",
    help: "Check everything that is true.",
    type: "multi",
    options: [
      "Comfortable",
      "Profitable but tight",
      "Customer payment timing",
      "Materials / inventory",
      "Payroll timing",
      "Debt payments",
      "Seasonality",
      "Big expense coming",
      "Cash not reviewed regularly",
    ],
    allowUnknown: true,
    feedsIndicators: ["P10"],
    required: false,
    feedsOverlay: ["cash_distress"],
  },
  {
    id: "q20",
    section: "s2",
    prompt: "Financial visibility",
    help: "And which reports actually get reviewed?",
    type: "single",
    options: [
      "Monthly, within 15 days",
      "Monthly, delayed",
      "Quarterly",
      "Tax time only",
      "Inconsistent",
      "Reports exist but go unused",
    ],
    allowUnknown: true,
    feedsIndicators: ["P10", "L3"],
    required: false,
    feedsOverlay: ["unreliable_financials"],
  },
  {
    id: "q21",
    section: "s2",
    prompt: "Targets",
    help: '"No target" is a real answer — and a finding.',
    type: "table",
    rows: [
      "Revenue",
      "Gross margin",
      "Operating profit",
      "Cash reserve",
      "Owner compensation",
    ],
    columns: [{ key: "target", label: "Target", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["P10"],
    required: false,
  },
  {
    id: "q22",
    section: "s2",
    prompt: "Documents you can send",
    help:
      "Optional, and nothing is uploaded here. List what you have — P&L (last 2–3 years), balance sheet, sales reports, KPI dashboard — and your advisor will send a secure link for them.",
    type: "upload_note",
    allowUnknown: true,
    feedsIndicators: ["P9", "P10"],
    required: false,
  },

  // ── Section 3 — The growth engine (Profit) ────────────────────────────────
  {
    id: "q23",
    section: "s3",
    prompt: "Lead sources",
    help: "Your top five. Leave anything you don't track blank.",
    type: "table",
    maxRows: 5,
    columns: [
      { key: "source", label: "Source", type: "short", width: "wide" },
      { key: "per_month", label: "Leads/month", type: "number" },
      { key: "cost", label: "Cost", type: "currency" },
      { key: "quality", label: "Quality 1–5", type: "number" },
      {
        key: "tracked",
        label: "Tracked?",
        type: "single",
        options: ["Yes", "No"],
      },
    ],
    allowUnknown: true,
    feedsIndicators: ["P1"],
    required: false,
  },
  {
    id: "q24",
    section: "s3",
    prompt: "What happens when an inquiry comes in?",
    help: "Walk through it as it really happens, not as it should.",
    type: "table",
    rows: [
      "What happens, step by step",
      "Typical response time",
      "Who is responsible",
      "Is every inquiry captured in one system?",
      "Automated follow-up?",
      "% of leads that get 2+ follow-ups",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["P2", "P3"],
    required: false,
    mirror: true,
  },
  {
    id: "q25",
    section: "s3",
    prompt: "Conversion",
    type: "table",
    rows: [
      "Lead→sale or proposal→close %",
      "Tracked by source / person / service?",
      "Defined sales process?",
      "Most common reason you lose",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["P4"],
    required: false,
  },
  {
    id: "q26",
    section: "s3",
    prompt: "Transaction value",
    type: "table",
    rows: [
      "Typical first sale",
      "Typical annual customer value",
      "Most valuable segment",
      "Tracked?",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["P4", "P6"],
    required: false,
  },
  {
    id: "q27",
    section: "s3",
    prompt: "Repeat & retention",
    type: "table",
    rows: [
      "% who buy again",
      "Renewal rate if applicable",
      "Are inactive customers identified?",
      "Reactivation campaigns ever run?",
      "Why customers leave",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["P7"],
    required: false,
  },
  {
    id: "q28",
    section: "s3",
    prompt: "Pricing",
    help: "Check everything that is true — and tell us when prices last really changed.",
    type: "multi",
    options: [
      "Reviewed annually",
      "Based on real job economics",
      "Varies by scope or value",
      "Discount rules defined",
      "The team can defend the price",
      "Unchanged for 2+ years",
      "Set against competitors",
      "Set on the owner's gut",
      "Pricing is a current worry",
    ],
    allowUnknown: true,
    feedsIndicators: ["P5"],
    required: false,
  },
  {
    id: "q29",
    section: "s3",
    prompt: "Offers",
    type: "table",
    rows: [
      "Complementary services routinely offered?",
      "Bundles or packages?",
      "Premium option?",
      "Entry-level option?",
      "Customer needs you can't currently serve",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["P6"],
    required: false,
  },
  {
    id: "q30",
    section: "s3",
    prompt: "Ownership of growth",
    type: "table",
    rows: [
      "Who owns marketing",
      "Who owns sales",
      "Monthly marketing budget",
      "Do sales & marketing review results together?",
      "Are leads, conversion, CAC and customer value ever reviewed together?",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["P8"],
    required: false,
  },
  {
    id: "q31",
    section: "s3",
    prompt: "If sales jumped 20% in the next 90 days, what breaks first?",
    type: "single",
    options: [
      "We'd absorb it comfortably",
      "Minor adjustments",
      "Quality would slip",
      "We'd have to hire",
      "We'd need equipment or capital",
      "Don't know",
    ],
    allowUnknown: true,
    feedsIndicators: ["S7"],
    required: false,
    mirror: true,
  },
  {
    id: "q32",
    section: "s3",
    prompt:
      "Which three areas do you think hold the most near-term profit?",
    help: "Your guess, before we look. We compare it with the findings later.",
    type: "table",
    rows: ["1", "2", "3"],
    columns: [{ key: "area", label: "Area", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["P8"],
    required: false,
    mirror: true,
  },

  // ── Section 4 — Operations & systems (Systems) ────────────────────────────
  {
    id: "q33",
    section: "s4",
    prompt: "Critical workflows",
    help:
      "Up to ten: the workflows that generate revenue, deliver work, collect cash and keep quality — lead handling, quoting, scheduling, onboarding, delivery, QC, invoicing, collections, hiring…",
    type: "table",
    maxRows: 10,
    columns: [{ key: "workflow", label: "Workflow", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["S5"],
    required: false,
  },
  {
    id: "q34",
    section: "s4",
    prompt: "Workflow ownership",
    help: "Across those workflows, how often is each of these true?",
    type: "table",
    rows: [
      "One clear accountable role",
      "Defined handoffs",
      "Consistent exception escalation",
    ],
    columns: [
      {
        key: "frequency",
        label: "How often",
        type: "single",
        options: ALWAYS_SOMETIMES,
      },
    ],
    allowUnknown: true,
    feedsIndicators: ["S5", "S4"],
    required: false,
  },
  {
    id: "q35",
    section: "s4",
    prompt: "Documentation",
    help: "Of the critical recurring work, roughly what share is…",
    type: "table",
    rows: ["Documented", "Current", "Accessible", "Used in training", "Actually followed"],
    columns: [{ key: "pct", label: "%", type: "percent" }],
    allowUnknown: true,
    feedsIndicators: ["S5"],
    required: false,
  },
  {
    id: "q36",
    section: "s4",
    prompt: "Recurring failures",
    help: "Check all that happen — then tell us which one costs the most.",
    type: "multi",
    options: [
      "Missed handoffs",
      "Scheduling delays",
      "Incomplete information",
      "Complaints",
      "Quality inconsistency",
      "Rework",
      "Late billing",
      "Slow collections",
      "Unclear priorities",
      "The owner has to step in",
      "Accountability problems",
    ],
    allowUnknown: true,
    feedsIndicators: ["S7", "S5"],
    required: false,
    mirror: true,
  },
  {
    id: "q37",
    section: "s4",
    prompt: "What is your limiting resource right now?",
    help: "And what is the evidence for it?",
    type: "single",
    options: [
      "Owner time",
      "Leadership",
      "Skilled labor",
      "Sales capacity",
      "Delivery capacity",
      "Equipment",
      "Working capital",
      "Technology",
      "Process consistency",
      "Demand",
    ],
    allowUnknown: true,
    feedsIndicators: ["S7"],
    required: false,
  },
  {
    id: "q38",
    section: "s4",
    prompt: "Roles & accountability",
    type: "single",
    options: [
      "Clear and followed",
      "Mostly clear, with gaps",
      "Informal",
      "Everything falls back to the owner",
      "Recurring accountability problems",
    ],
    allowUnknown: true,
    feedsIndicators: ["S1", "S4"],
    required: false,
    mirror: true,
  },
  {
    id: "q39",
    section: "s4",
    prompt: "Scoreboard",
    type: "table",
    rows: [
      "How many KPIs reviewed weekly",
      "Does each have one owner?",
      "Are targets visible?",
      "Does a miss trigger action?",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["S6"],
    required: false,
  },
  {
    id: "q40",
    section: "s4",
    prompt: "Meeting rhythm",
    help: "And what happens to issues that don't get resolved?",
    type: "single",
    options: [
      "Weekly, structured and action-oriented",
      "Weekly but loose",
      "Biweekly to monthly",
      "Reactive only",
      "None",
    ],
    allowUnknown: true,
    feedsIndicators: ["S6"],
    required: false,
  },

  // ── Section 5 — Technology, AI & automation (Leverage) ────────────────────
  {
    id: "q41",
    section: "s5",
    prompt: "Core systems",
    help: 'Name the tool you use for each, or write "none".',
    type: "table",
    rows: [
      "CRM",
      "Marketing",
      "Sales / proposals",
      "Scheduling / project management",
      "Delivery",
      "Accounting",
      "Reporting",
      "Communication",
      "Files / knowledge",
      "HR / payroll",
    ],
    columns: [{ key: "tool", label: "Tool", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["L1"],
    required: false,
  },
  {
    id: "q42",
    section: "s5",
    prompt: "Integration",
    help: "And where does duplicate entry hurt most?",
    type: "single",
    options: [
      "Systems share data cleanly",
      "Some integrations",
      "Mostly separate, plus spreadsheets",
      "The same data is entered in several places",
      "One person is the integration",
    ],
    allowUnknown: true,
    feedsIndicators: ["L2"],
    required: false,
    mirror: true,
  },
  {
    id: "q43",
    section: "s5",
    prompt: "Data trust",
    help: "Check what is true today.",
    type: "multi",
    options: [
      "KPI definitions are agreed",
      "Data is generally accurate",
      "Reports don't need manual cleanup",
      "Customer and financial data can be connected",
      "Backups exist",
      "We know where sensitive data lives",
    ],
    allowUnknown: true,
    feedsIndicators: ["L3", "L8"],
    required: false,
  },
  {
    id: "q44",
    section: "s5",
    prompt: "Repetitive work inventory",
    help:
      "The five most repetitive tasks in the business. Minutes per occurrence is the number that matters — a rough count is fine.",
    type: "table",
    maxRows: 5,
    columns: [
      { key: "task", label: "Task", type: "short", width: "wide" },
      { key: "who", label: "Who does it", type: "short" },
      {
        key: "frequency",
        label: "How often",
        type: "single",
        options: ["Daily", "Several times a week", "Weekly", "Monthly"],
      },
      { key: "occurrences", label: "Times per week", type: "number" },
      { key: "minutes", label: "Minutes each", type: "number" },
      {
        key: "errors",
        label: "Errors / rework?",
        type: "single",
        options: ["Yes", "No"],
      },
      { key: "systems", label: "Systems used", type: "short" },
    ],
    allowUnknown: true,
    feedsIndicators: ["L4"],
    required: false,
    mirror: true,
  },
  {
    id: "q45",
    section: "s5",
    prompt: "What is already automated?",
    help:
      "Scheduling, reminders, sequences, proposals, invoicing, reporting… and is it reliable?",
    type: "long",
    allowUnknown: true,
    feedsIndicators: ["L5"],
    required: false,
  },
  {
    id: "q46",
    section: "s5",
    prompt: "Current AI use",
    help: "Check what applies — then name the tools, who uses them, and what came of it.",
    type: "multi",
    options: [
      "Drafting",
      "Research",
      "Marketing content",
      "Sales support",
      "Customer communication",
      "Estimating / proposals",
      "Knowledge retrieval",
      "Reporting",
      "Scheduling",
      "None",
    ],
    allowUnknown: true,
    feedsIndicators: ["L6"],
    required: false,
  },
  {
    id: "q47",
    section: "s5",
    prompt: "AI & automation discipline",
    help: "Check what is consistently true.",
    type: "multi",
    options: [
      "Use cases picked by business impact",
      "Someone accountable per implementation",
      "Human-review rules are clear",
      "Sensitive-data rules are defined",
      "Results are measured",
      "Failures are detectable",
      "The process is documented before it is automated",
      "The team is trained",
    ],
    allowUnknown: true,
    feedsIndicators: ["L7"],
    required: false,
  },
  {
    id: "q48",
    section: "s5",
    prompt: "Tech & data risks",
    help: "Check all that apply. Nobody gets in trouble for an honest answer here.",
    type: "multi",
    options: [
      "Shared passwords",
      "Unclear access",
      "Ex-employees may retain access",
      "Inconsistent backups",
      "No tested recovery",
      "Sensitive data in unapproved tools",
      "Unclear account ownership",
      "One-vendor or one-person dependence",
      "None known",
    ],
    allowUnknown: true,
    feedsIndicators: ["L8"],
    required: false,
    feedsOverlay: ["data_risk"],
  },
  {
    id: "q49",
    section: "s5",
    prompt: "90-day readiness",
    type: "table",
    rows: [
      "Implementation budget range",
      "Owner hours/week available",
      "Team hours/week available",
      "Appetite for changing systems",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["L10"],
    required: false,
  },
  {
    id: "q58",
    section: "s5",
    prompt: "Has the team been trained on the tools you already own?",
    help:
      "Added after review — the instrument scores team readiness and nothing in the intake asked about it.",
    type: "single",
    options: [
      "No training, and there is resistance",
      "A few curious people, no training",
      "Pockets of capability",
      "Trained on the core tools, adoption uneven",
      "Trained, adopting, and improving it themselves",
    ],
    allowUnknown: true,
    feedsIndicators: ["L9"],
    required: false,
  },
  {
    id: "q59",
    section: "s5",
    prompt:
      "Who on the team would take a new system on, and who would resist it?",
    help: "Names are not needed — roles are enough.",
    type: "long",
    allowUnknown: true,
    feedsIndicators: ["L9", "L10"],
    required: false,
  },
  {
    id: "q56",
    section: "s5",
    prompt: "Loaded labor rate by role",
    help:
      "Wage plus taxes, benefits and overhead — your best estimate per hour. Added after review: the Leverage audit prices recovered hours at this rate, and without it every hour is priced on a guess.",
    type: "table",
    maxRows: 8,
    columns: [
      { key: "role", label: "Role", type: "short", width: "wide" },
      { key: "rate", label: "Loaded rate / hour", type: "currency" },
    ],
    allowUnknown: true,
    feedsIndicators: ["L4", "P9"],
    required: false,
  },

  // ── Section 6 — Owner independence & risk (Mirror finale) ─────────────────
  {
    id: "q50",
    section: "s6",
    prompt: "What still requires YOU?",
    help: "Check all — then tell us which three you would hand off first if you could.",
    type: "multi",
    options: [
      "Pricing exceptions",
      "Major sales",
      "Customer escalations",
      "Hiring / firing",
      "Purchasing",
      "Scheduling",
      "Quality sign-off",
      "Banking / payments",
      "Vendor relationships",
      "Technical decisions",
      "Strategy",
    ],
    allowUnknown: true,
    feedsIndicators: ["S1", "S3"],
    required: false,
    mirror: true,
  },
  {
    id: "q51",
    section: "s6",
    prompt:
      "If you were unreachable for four weeks starting tomorrow — what keeps running, what slows, what stops, who decides, and what can nobody else access?",
    type: "table",
    rows: [
      "What keeps running",
      "What slows down",
      "What stops",
      "Who decides",
      "What nobody else can access",
    ],
    columns: [{ key: "value", label: "", type: "short", width: "wide" }],
    allowUnknown: true,
    feedsIndicators: ["S2"],
    required: false,
    mirror: true,
  },
  {
    id: "q52",
    section: "s6",
    prompt: "Key-person & relationship risk",
    help:
      "Any employee, customer, vendor, license or piece of knowledge whose loss would seriously hurt.",
    type: "table",
    maxRows: 6,
    columns: [
      { key: "risk", label: "Who or what", type: "short", width: "wide" },
      { key: "impact", label: "What would happen", type: "short", width: "wide" },
    ],
    allowUnknown: true,
    feedsIndicators: ["S10"],
    required: false,
    feedsOverlay: ["key_person"],
  },
  {
    id: "q53",
    section: "s6",
    prompt: "Contracts & continuity",
    help: "Check what is true.",
    type: "multi",
    options: [
      "Customer agreements are written & accessible",
      "Vendor agreements are written",
      "Contracts are transferable",
      "Licenses & insurance are current",
      "Employment agreements are current",
      "The company owns its IP and digital accounts",
      "A continuity plan exists",
      "No known legal, tax or insurance issue",
    ],
    allowUnknown: true,
    feedsIndicators: ["S10"],
    required: false,
    feedsOverlay: ["nontransferable_contracts", "legal_exposure"],
  },
  {
    id: "q54",
    section: "s6",
    prompt: "Transferability priorities",
    help: "Pick the three that matter most to you.",
    type: "multi",
    options: [
      "Leadership depth",
      "Role clarity",
      "Financial reporting",
      "Sales without the owner",
      "Customer diversification",
      "Recurring revenue",
      "SOPs & knowledge transfer",
      "Tech & data ownership",
      "Delivery consistency",
      "Contracts & compliance",
      "Succession",
    ],
    allowUnknown: true,
    feedsIndicators: ["S10"],
    required: false,
  },
  {
    id: "q55",
    section: "s6",
    prompt: "Implementation readiness",
    help: "And what could stop the roadmap?",
    type: "single",
    options: [
      "Ready, with leadership capacity",
      "Ready if priorities stay tight",
      "Cash, staffing or leadership must be resolved first",
      "The owner would have to drive everything",
      "Uncertain",
    ],
    allowUnknown: true,
    feedsIndicators: ["L10"],
    required: false,
    mirror: true,
  },
  {
    id: "q57",
    section: "s6",
    prompt: "How are you doing, honestly?",
    help:
      "Added after review. Owner exhaustion is a risk to the business, and the diagnostic flags it rather than scoring around it. Nothing here is printed in your report without your say-so.",
    type: "single",
    options: [
      "Energised — this is the best it has been",
      "Steady",
      "Tired but managing",
      "Running on empty",
      "I need out of the day-to-day within 12 months",
    ],
    allowUnknown: true,
    feedsIndicators: ["S1", "S2"],
    required: false,
    mirror: true,
    feedsOverlay: ["owner_burnout"],
  },

  // ── Conditional module E — Ownership transition ───────────────────────────
  {
    id: "e1",
    section: "e",
    prompt: "Transition type",
    type: "single",
    options: [
      "Family",
      "Management",
      "Employee buyout",
      "Outside sale",
      "Partial sale / investment",
      "Merger",
      "Gradual withdrawal",
      "Unknown",
    ],
    allowUnknown: true,
    feedsIndicators: [],
    required: false,
  },
  {
    id: "e2",
    section: "e",
    prompt: "Horizon",
    type: "single",
    options: [
      "Less than 2 years",
      "2–3 years",
      "4–5 years",
      "6–10 years",
      "10+ years",
      "Unknown",
    ],
    allowUnknown: true,
    feedsIndicators: [],
    required: false,
  },
  {
    id: "e3",
    section: "e",
    prompt: "Desired post-transition role",
    type: "long",
    allowUnknown: true,
    feedsIndicators: [],
    required: false,
  },
  {
    id: "e4",
    section: "e",
    prompt:
      "What must be true, personally and financially, for it to feel successful?",
    help: "No valuation is implied by this question.",
    type: "long",
    allowUnknown: true,
    feedsIndicators: [],
    required: false,
  },
  {
    id: "e5",
    section: "e",
    prompt: "Advisors currently involved",
    type: "multi",
    options: [
      "CPA",
      "Tax",
      "Attorney",
      "Financial planner",
      "Insurance",
      "Broker / banker",
      "Valuation professional",
      "None",
    ],
    allowUnknown: true,
    feedsIndicators: [],
    required: false,
  },
  {
    id: "e6",
    section: "e",
    prompt: "What feels most uncertain about it?",
    type: "long",
    allowUnknown: true,
    feedsIndicators: [],
    required: false,
  },
];

export const INTAKE_QUESTIONS_BY_ID: Record<string, IntakeQuestion> =
  Object.fromEntries(INTAKE_QUESTIONS.map((q) => [q.id, q]));

export const INTAKE_QUESTION_IDS: string[] = INTAKE_QUESTIONS.map((q) => q.id);

export function questionsInSection(section: IntakeSectionId): IntakeQuestion[] {
  return INTAKE_QUESTIONS.filter((q) => q.section === section);
}

// ─────────────────────────────────────────────────────────────────────────────
// Copy the owner sees — taken from the Master Intake, not rewritten
// ─────────────────────────────────────────────────────────────────────────────

export const INTAKE_TITLE = "Owner Pre-Assessment Intake";

export const INTAKE_INTRO: string[] = [
  "This is the preparation for your Growth & AI Diagnostic. It takes about 45–60 minutes, and you do not need to finish it in one sitting — every answer saves as you type.",
  "Estimates are welcome. “Not currently known” is a real answer on almost every question, it is never scored as zero, and choosing it tells us something a guess would hide.",
  "You will not see a score at the end of this form. You'll receive a Pre-Assessment Summary; your CREAiT Score, your Primary Business Constraint and the full findings are presented live at your Results Session.",
];

/** Verbatim from the Master Intake's completion page. */
export const INTAKE_COMPLETION =
  "Thank you — your responses are in. You'll receive a Pre-Assessment Summary confirming your objectives, your baseline, and the topics we'll dig into during your Diagnostic Intensive. Your CREAiT Score, your Primary Business Constraint, and your full findings are presented live at your Results Session.";

export const UNKNOWN_LABEL = "Not currently known";

// ─────────────────────────────────────────────────────────────────────────────
// Storage shape
// ─────────────────────────────────────────────────────────────────────────────

/** One row of a table answer. For a fixed-row table, TABLE_ROW_KEY holds the label. */
export type IntakeTableRow = Record<string, string>;

/**
 * What one answer can be:
 *   - a string for every scalar type, stored exactly as the owner typed it,
 *     or the literal UNKNOWN;
 *   - string[] for `multi`;
 *   - IntakeTableRow[] for `table`.
 */
export type IntakeAnswer = string | string[] | IntakeTableRow[];

export type IntakeAnswers = Partial<Record<IntakeQuestionId, IntakeAnswer>>;

export function isUnknown(value: IntakeAnswer | undefined): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === UNKNOWN;
}

/** A real answer: something was said, and it wasn't "not currently known". */
export function isAnswered(value: IntakeAnswer | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (isUnknown(value)) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (!Array.isArray(value)) return false;
  return value.some((entry) =>
    typeof entry === "string"
      ? entry.trim().length > 0
      : entry && typeof entry === "object"
        ? Object.entries(entry).some(
            ([k, v]) => k !== TABLE_ROW_KEY && typeof v === "string" && v.trim().length > 0
          )
        : false
  );
}

function cleanRow(value: unknown): IntakeTableRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row: IntakeTableRow = {};
  for (const [key, cell] of Object.entries(value as Record<string, unknown>)) {
    if (typeof cell === "string") row[key] = cell;
    else if (typeof cell === "number" && Number.isFinite(cell)) row[key] = String(cell);
  }
  return row;
}

/**
 * Read the stored JSON into a typed answer map, dropping anything that is not
 * a known question id or does not match that question's shape.
 *
 * Deliberately lenient about the *content* and strict about the *shape*: an
 * owner's "about 60%" is a perfectly good answer and is kept verbatim, while
 * a number where a table belongs is a bug and is dropped rather than rendered
 * as an empty grid.
 */
export function parseIntake(json: unknown): IntakeAnswers {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: IntakeAnswers = {};
  for (const [key, raw] of Object.entries(json as Record<string, unknown>)) {
    const q = INTAKE_QUESTIONS_BY_ID[key];
    if (!q) continue;
    if (typeof raw === "string") {
      // UNKNOWN is legal on any question that offers it; every other string
      // belongs to a scalar question.
      if (raw.trim().toLowerCase() === UNKNOWN) {
        if (q.allowUnknown) out[q.id] = UNKNOWN;
        continue;
      }
      if (q.type !== "multi" && q.type !== "table") out[q.id] = raw;
      continue;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      if (q.type === "number" || q.type === "currency" || q.type === "percent") {
        out[q.id] = String(raw);
      }
      continue;
    }
    if (Array.isArray(raw)) {
      if (q.type === "multi") {
        const options = q.options ?? [];
        const picked = raw.filter(
          (v): v is string => typeof v === "string" && options.includes(v)
        );
        if (picked.length > 0) out[q.id] = picked;
        continue;
      }
      if (q.type === "table") {
        const rows = raw.map(cleanRow).filter((r): r is IntakeTableRow => r !== null);
        if (rows.length > 0) out[q.id] = rows;
      }
    }
  }
  return out;
}

/**
 * Narrow one patch of answers to what may actually be stored: known ids only,
 * shape-checked per question. This is the function the public server action
 * trusts — everything reaching it came from the open internet.
 */
export function sanitizeIntakePatch(patch: unknown): IntakeAnswers {
  return parseIntake(patch);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading answers back out
// ─────────────────────────────────────────────────────────────────────────────

export function answerText(value: IntakeAnswer | undefined): string | null {
  if (typeof value !== "string") return null;
  if (isUnknown(value)) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** One cell of a fixed-row table, by row label. */
export function tableCell(
  value: IntakeAnswer | undefined,
  rowLabel: string,
  column: string
): string | null {
  if (!Array.isArray(value)) return null;
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as IntakeTableRow;
    if (row[TABLE_ROW_KEY] !== rowLabel) continue;
    const cell = row[column];
    if (typeof cell !== "string") return null;
    const trimmed = cell.trim();
    if (!trimmed || trimmed.toLowerCase() === UNKNOWN) return null;
    return trimmed;
  }
  return null;
}

export function tableRows(value: IntakeAnswer | undefined): IntakeTableRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is IntakeTableRow =>
      !!entry && typeof entry === "object" && !Array.isArray(entry)
  );
}

const MULTIPLIERS: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };

/**
 * The first number an owner wrote, with $ / commas / k / m understood and a
 * range read as its low end. Returns null — never zero — for "unknown", for
 * an empty box, and for anything with no number in it at all.
 */
export function parseNumeric(raw: string | null | undefined): number | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.toLowerCase() === UNKNOWN) return null;
  const match = text
    .replace(/,/g, "")
    .match(/(-?\d+(?:\.\d+)?)\s*([kmb])?/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const suffix = match[2]?.toLowerCase();
  return suffix ? value * (MULTIPLIERS[suffix] ?? 1) : value;
}

/** A percent as a whole number (60 for "about 60%"), matching gross_margin. */
export function parsePercent(raw: string | null | undefined): number | null {
  const n = parseNumeric(raw);
  if (n === null) return null;
  // "0.6" from someone who thinks in fractions is still 60%.
  if (n > 0 && n <= 1) return Math.round(n * 1000) / 10;
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-fill — intake answers → the assessment's baseline columns
// ─────────────────────────────────────────────────────────────────────────────

export interface IntakeLoadedRate {
  role: string;
  rate: number;
}

export interface IntakePrefill {
  /** q3 — the primary objective, with any secondaries named after it. */
  owner_objective: string | null;
  /** q8 verbatim. The Mirror depends on these being their words, untouched. */
  owner_belief: string | null;
  annual_revenue: number | null;
  /** Whole percent, e.g. 62. */
  gross_margin: number | null;
  operating_profit: number | null;
  /** Whole percent of revenue from the largest customer (S8, overlay). */
  largest_customer_pct: number | null;
  headcount: number | null;
  /** Hours per week burned on the q44 repetitive-task inventory. */
  repetitive_hours_weekly: number | null;
  loaded_rates: IntakeLoadedRate[];
}

const WEEKLY_OCCURRENCES: Record<string, number> = {
  daily: 5,
  "several times a week": 3,
  weekly: 1,
  monthly: 0.25,
};

/**
 * Everything the advisor would otherwise re-key from the intake, as the types
 * the assessment columns actually hold.
 *
 * The one rule: an unknown or unanswered question yields null. Never 0. A zero
 * revenue or a zero margin reads as a finding, and the whole point of the
 * "Not currently known" option is that it is not a number.
 */
export function intakePrefill(intake: unknown): IntakePrefill {
  const answers = parseIntake(intake);

  // q3 — primary first, secondaries appended so the sentence still reads.
  const objectiveRows = tableRows(answers.q3);
  const primary = tableCell(answers.q3, "Primary", "objective");
  const secondaries = objectiveRows
    .filter((r) => r[TABLE_ROW_KEY] === "Secondary")
    .map((r) => r.objective?.trim())
    .filter((v): v is string => !!v && v.toLowerCase() !== UNKNOWN);
  const owner_objective = primary
    ? secondaries.length > 0
      ? `${primary} — then ${secondaries.join(", ")}`
      : primary
    : null;

  // q44 — hours per week, from times-per-week × minutes where the owner gave
  // both, falling back to the frequency they picked when they didn't.
  let repetitiveMinutes = 0;
  let sawTask = false;
  for (const row of tableRows(answers.q44)) {
    const minutes = parseNumeric(row.minutes ?? null);
    if (minutes === null || minutes <= 0) continue;
    const explicit = parseNumeric(row.occurrences ?? null);
    const perWeek =
      explicit !== null && explicit > 0
        ? explicit
        : WEEKLY_OCCURRENCES[(row.frequency ?? "").trim().toLowerCase()];
    if (!perWeek || perWeek <= 0) continue;
    repetitiveMinutes += minutes * perWeek;
    sawTask = true;
  }

  const loaded_rates: IntakeLoadedRate[] = [];
  for (const row of tableRows(answers.q56)) {
    const role = row.role?.trim();
    const rate = parseNumeric(row.rate ?? null);
    if (!role || rate === null || rate <= 0) continue;
    loaded_rates.push({ role, rate });
  }

  // Headcount is people, so contractors count: they consume the same owner
  // attention and appear in the same workflows.
  const headcountParts = ["Full-time employees", "Part-time", "Regular contractors"]
    .map((label) => parseNumeric(tableCell(answers.q10, label, "count")))
    .filter((n): n is number => n !== null);

  return {
    owner_objective,
    owner_belief: answerText(answers.q8),
    annual_revenue: parseNumeric(
      tableCell(answers.q15, "Last completed year", "amount")
    ),
    gross_margin: parsePercent(
      tableCell(answers.q17, "Approximate gross margin %", "value")
    ),
    operating_profit: parseNumeric(
      tableCell(answers.q18, "Operating profit estimate", "amount")
    ),
    largest_customer_pct: parsePercent(
      tableCell(answers.q14, "% of revenue from your largest customer", "value")
    ),
    headcount:
      headcountParts.length > 0
        ? headcountParts.reduce((a, b) => a + b, 0)
        : null,
    repetitive_hours_weekly: sawTask
      ? Math.round((repetitiveMinutes / 60) * 10) / 10
      : null,
    loaded_rates,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage — which indicators the intake actually gave the advisor evidence for
// ─────────────────────────────────────────────────────────────────────────────

export interface IndicatorCoverage {
  /** Every question that feeds this indicator. */
  asked: IntakeQuestionId[];
  /** Those the owner actually answered. */
  answered: IntakeQuestionId[];
  /** Those the owner explicitly marked "Not currently known" — itself a signal. */
  unknown: IntakeQuestionId[];
}

/**
 * Per indicator: which of its intake questions came back answered, which came
 * back "not currently known", and which were never asked at all.
 *
 * An indicator with no answered question is not a low score — it is an
 * indicator the intensive has to cover from scratch, and the workbench says so
 * before the session rather than after it.
 */
export function intakeCoverage(
  intake: unknown
): Record<IndicatorKey, IndicatorCoverage> {
  const answers = parseIntake(intake);
  const out = {} as Record<IndicatorKey, IndicatorCoverage>;
  for (const q of INTAKE_QUESTIONS) {
    for (const key of q.feedsIndicators) {
      const entry = (out[key] ??= { asked: [], answered: [], unknown: [] });
      entry.asked.push(q.id);
      const value = answers[q.id];
      if (isUnknown(value)) entry.unknown.push(q.id);
      else if (isAnswered(value)) entry.answered.push(q.id);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress & conditionals
// ─────────────────────────────────────────────────────────────────────────────

/** Module E only applies when q3 names a succession or an exit. */
export function moduleEApplies(intake: unknown): boolean {
  const answers = parseIntake(intake);
  return tableRows(answers.q3).some((row) =>
    TRANSITION_OBJECTIVES.includes((row.objective ?? "").trim())
  );
}

export interface SectionProgress {
  section: IntakeSectionId;
  /** Questions counted for this section (module E counts only when it applies). */
  total: number;
  /** Answered, including a deliberate "Not currently known". */
  done: number;
  /** Required questions still empty — what the submit button waits on. */
  missingRequired: IntakeQuestionId[];
}

export function intakeProgress(intake: unknown): SectionProgress[] {
  const answers = parseIntake(intake);
  const moduleE = moduleEApplies(intake);
  return INTAKE_SECTIONS.map((section) => {
    const questions = questionsInSection(section.id);
    const counted = section.id === "e" && !moduleE ? [] : questions;
    let done = 0;
    const missingRequired: IntakeQuestionId[] = [];
    for (const q of counted) {
      const value = answers[q.id];
      const resolved = isAnswered(value) || isUnknown(value);
      if (resolved) done += 1;
      else if (q.required) missingRequired.push(q.id);
    }
    return { section: section.id, total: counted.length, done, missingRequired };
  });
}

/** Required questions still unanswered anywhere in the form. */
export function missingRequired(intake: unknown): IntakeQuestionId[] {
  return intakeProgress(intake).flatMap((p) => p.missingRequired);
}
