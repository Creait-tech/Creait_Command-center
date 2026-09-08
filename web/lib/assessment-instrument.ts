/**
 * The CREAiT Growth & AI Diagnostic — instrument definition & scoring math.
 *
 * Source of truth: "Scoring-Engine-and-Rubrics v2 (Sep 8 2026)" and the
 * Advisor Calculator that implements it. Do not edit indicators, anchors,
 * weights, or bands without updating the product docs — the printed report's
 * credibility rests on this math matching the sold methodology exactly.
 *
 * The model:
 *  - 30 indicators, 10 per pillar, each scored 0–4 against a WRITTEN anchor at
 *    every level (0 Absent · 1 Informal · 2 Developing · 3 Established ·
 *    4 Scalable). v2 completes the scale: 1 and 3 are no longer implied
 *    in-betweens, they are stated, because a facilitator cannot defend a 3 the
 *    rubric never described.
 *    N/A allowed — removed from the denominator, never counted as zero. See
 *    NA_RULE for when N/A is legitimate; "don't know" is not one of them.
 *  - Evidence confidence tracked separately (Reported / Demonstrated /
 *    Documented). Confidence never changes the score — it widens financial
 *    ranges and is disclosed in the report.
 *  - Pillar score = average of scored indicators ÷ 4 × 100.
 *  - CREAiT Score (0–100) = Profit × 40% + Systems × 35% + Leverage × 25%,
 *    renormalized over the pillars that carry ENOUGH data (a pillar under
 *    MIN_PILLAR_SAMPLE scored indicators is excluded outright — see
 *    computeScores).
 *  - Bands: 0–20 Reactive · 21–40 Stabilizing · 41–60 Building ·
 *    61–80 Scaling · 81–100 Self-Running.
 *  - Portfolio totals = sum × overlap factor (default 0.7). Never the raw sum.
 */

import { parseCalc } from "@/lib/opportunity-calculators";
import type {
  AssessmentPillar,
  CcAssessmentScore,
  OpportunityConfidence,
} from "@/lib/supabase/types";

/**
 * The thirty indicator keys, written out rather than derived, so that a typo
 * anywhere that keys off an indicator (the facilitation scripts, a score row,
 * a report row) fails the typecheck instead of rendering an empty card.
 */
export type IndicatorKey =
  | "P1" | "P2" | "P3" | "P4" | "P5"
  | "P6" | "P7" | "P8" | "P9" | "P10"
  | "S1" | "S2" | "S3" | "S4" | "S5"
  | "S6" | "S7" | "S8" | "S9" | "S10"
  | "L1" | "L2" | "L3" | "L4" | "L5"
  | "L6" | "L7" | "L8" | "L9" | "L10";

export interface IndicatorDef {
  key: IndicatorKey;
  pillar: AssessmentPillar;
  label: string;
  /** Behavioral anchor for every level of the scale — 0 through 4, all written. */
  anchor0: string;
  anchor1: string;
  anchor2: string;
  anchor3: string;
  anchor4: string;
  /** Facilitator-only rider: what else to record, or how to read the anchors. */
  note?: string;
}

/**
 * When N/A is legitimate, and what to do with "I don't know". Printed beside
 * the N/A control in the workbench and quoted in the report's methodology, so
 * the rule the advisor follows and the rule the client is told are one string.
 */
export const NA_RULE =
  "N/A is valid only when the indicator cannot apply to the business model, never because the owner doesn't know or won't say. 'Don't know' scores the lowest anchor the evidence supports and is flagged Reported. More than two N/As in a pillar require a written reason; four or more make the pillar insufficient data.";

export const SCALE_LABELS: Record<number, string> = {
  0: "Absent",
  1: "Informal",
  2: "Developing",
  3: "Established",
  4: "Scalable",
};

export const PILLARS: Array<{
  key: AssessmentPillar;
  label: string;
  question: string;
  weight: number;
}> = [
  {
    key: "profit",
    label: "PROFIT",
    question: "Is the growth engine working?",
    weight: 0.4,
  },
  {
    key: "systems",
    label: "SYSTEMS",
    question: "Can it run and grow without the owner?",
    weight: 0.35,
  },
  {
    key: "leverage",
    label: "LEVERAGE",
    question: "How much runs on systems and AI?",
    weight: 0.25,
  },
];

export const PILLAR_WEIGHTS: Record<AssessmentPillar, number> = {
  profit: 0.4,
  systems: 0.35,
  leverage: 0.25,
};

export const INDICATORS: IndicatorDef[] = [
  // ── PROFIT (40%) ──────────────────────────────────────────────────────────
  {
    key: "P1",
    pillar: "profit",
    label: "Lead generation & tracking",
    anchor0: "No idea where leads come from or how many",
    anchor1: "Sources named from memory; no counts kept anywhere.",
    anchor2: "Some sources known; volume roughly tracked",
    anchor3:
      "Sources and monthly volume logged in one place; cost or quality tracked for the main source only.",
    anchor4: "Sources, volume, cost & quality tracked monthly",
  },
  {
    key: "P2",
    pillar: "profit",
    label: "Lead response & capture",
    anchor0: "Inquiries sit or get lost; no single system",
    anchor1:
      "Inquiries land in one inbox or phone; answered same day when the owner is free; no log.",
    anchor2: "Usually answered within a day; capture inconsistent",
    anchor3:
      "Every inquiry captured in one system; response within business hours the same half-day; partly automated.",
    anchor4: "Every inquiry in one system, response < 1 hr, automated",
  },
  {
    key: "P3",
    pillar: "profit",
    label: "Follow-up discipline",
    anchor0: "One touch, then nothing",
    anchor1:
      "A second touch happens when someone remembers; no record of who was followed up.",
    anchor2: "Some follow-up, person-dependent",
    anchor3:
      "A defined sequence exists and is used on most leads; missed follow-ups are visible in the system.",
    anchor4: "2+ automated/systematic touches on every lead",
  },
  {
    key: "P4",
    pillar: "profit",
    label: "Sales conversion process",
    anchor0: "No defined process; close rate unknown",
    anchor1:
      "The owner has a personal routine; no stages; close rate is a guess.",
    anchor2: "Loose process; rate roughly known",
    anchor3:
      "Stages defined and used; close rate tracked; loss reasons captured informally.",
    anchor4: "Defined stages, tracked close rate, loss reasons logged",
  },
  {
    key: "P5",
    pillar: "profit",
    label: "Pricing discipline",
    anchor0: "Gut/competitor pricing, unchanged 2+ yrs",
    anchor1:
      "One price change in two years, reason anecdotal; discounts at owner discretion.",
    anchor2: "Some economics behind prices; occasional reviews",
    anchor3:
      "Prices reviewed against costs annually; discount rules written; only the owner can defend them.",
    anchor4: "Annual reviews, value-based, discount rules, team can defend",
  },
  {
    key: "P6",
    pillar: "profit",
    label: "Offer architecture",
    anchor0: "One offer, take it or leave it",
    anchor1: "Add-ons exist but are offered only when the customer asks.",
    anchor2: "Some add-ons offered ad hoc",
    anchor3:
      "Named tiers or bundles; an upsell scripted for the core offer; not yet routine across the team.",
    anchor4: "Deliberate ladder: entry, core, premium, bundles, routine upsells",
  },
  {
    key: "P7",
    pillar: "profit",
    label: "Retention & reactivation",
    anchor0: "Customers leave silently; nobody looks back",
    anchor1: "Repeat customers recognised by name; no rate, no inactive list.",
    anchor2: "Repeat rate roughly known; no reactivation",
    anchor3:
      "Repeat or retention rate measured; inactive list pulled and worked at least twice a year.",
    anchor4: "Retention measured & worked; inactive list reactivated on cadence",
  },
  {
    key: "P8",
    pillar: "profit",
    label: "Growth ownership & measurement",
    anchor0: "Nobody owns marketing/sales; no numbers",
    anchor1:
      "Owner is de facto marketing and sales; numbers exist in scattered tools.",
    anchor2: "Owners named; numbers reviewed sometimes",
    anchor3:
      "Named owners; leads, conversion and value reviewed monthly, but not acquisition cost.",
    anchor4: "Accountable owners; leads/conversion/CAC/value reviewed together",
  },
  {
    key: "P9",
    pillar: "profit",
    label: "Margin knowledge",
    anchor0: "Gross margin unknown",
    anchor1: "Gross margin estimated from the tax return once a year.",
    anchor2: "Known overall, not by job/service",
    anchor3:
      "Margin by service line or job type known; used in pricing decisions occasionally.",
    anchor4: "Tracked by job/service/customer; decisions use it",
  },
  {
    key: "P10",
    pillar: "profit",
    label: "Financial visibility",
    anchor0: "Tax-time-only financials",
    anchor1: "Bookkeeper keeps the books; owner looks when cash feels tight.",
    anchor2: "Monthly-ish, late, lightly used",
    anchor3:
      "Monthly close within 30 days; reviewed by the owner; targets informal.",
    anchor4: "Monthly within 15 days, reviewed, targets exist",
  },
  // ── SYSTEMS (35%) ─────────────────────────────────────────────────────────
  {
    key: "S1",
    pillar: "systems",
    label: "Owner decision load",
    anchor0: "Nearly everything needs the owner",
    anchor1:
      "Routine tasks delegated; every decision above routine returns to the owner.",
    anchor2: "Several areas delegated; money/hiring/exceptions still owner-only",
    anchor3:
      "Decision rights written for most areas; owner still approves money and hiring.",
    anchor4: "Clear decision rights; owner handles strategy only",
  },
  {
    key: "S2",
    pillar: "systems",
    label: "Absence resilience (4-week test)",
    anchor0: "Business stops or bleeds within days",
    anchor1: "Runs about a week; owner answers calls daily from away.",
    anchor2: "Runs short-term; slows, decisions stack up",
    anchor3:
      "Runs two to four weeks with a named deputy; a few owner-locked items remain (banking, top accounts).",
    anchor4: "Runs 4+ weeks; someone decides; nothing critical is owner-locked",
  },
  {
    key: "S3",
    pillar: "systems",
    label: "Sales independence",
    anchor0: "Owner closes everything, relationships are the owner's",
    anchor1:
      "Someone else can quote; the owner closes and holds every relationship.",
    anchor2: "Team sells with owner rescue on big deals",
    anchor3: "Team closes standard deals; owner steps in on the largest 10–20%.",
    anchor4: "Team sells without owner; relationships institutional",
  },
  {
    key: "S4",
    pillar: "systems",
    label: "Management depth & accountability",
    anchor0: "No managers, or managers in title only",
    anchor1: "One lead with a title who escalates rather than decides.",
    anchor2: "Some real managers; accountability patchy",
    anchor3:
      "Managers own outcomes and metrics; misses get raised, but action needs the owner's push.",
    anchor4: "Leaders own outcomes; misses trigger action without owner",
  },
  {
    key: "S5",
    pillar: "systems",
    label: "Process documentation & adherence",
    anchor0: "In people's heads",
    anchor1:
      "A few checklists exist, not current; new hires learn by shadowing.",
    anchor2: "Partially documented, loosely followed",
    anchor3:
      "Core workflows documented and current; used in training; adherence not audited.",
    anchor4: "Documented, current, trained-from, actually followed",
  },
  {
    key: "S6",
    pillar: "systems",
    label: "Rhythm & scoreboard",
    anchor0: "No regular meeting, no KPIs",
    anchor1: "Ad-hoc huddles; numbers discussed from memory.",
    anchor2: "Meetings happen; few KPIs, loose follow-through",
    anchor3:
      "Weekly meeting with agenda and 3–7 KPIs; owners named; follow-through inconsistent.",
    anchor4: "Weekly structured rhythm; owned KPIs; visible targets",
  },
  {
    key: "S7",
    pillar: "systems",
    label: "Delivery consistency & capacity",
    anchor0: "Quality varies; +20% sales would break it",
    anchor1: "Quality depends on who is on the job; the owner inspects.",
    anchor2: "Mostly consistent; growth needs heroics",
    anchor3:
      "Standards and QC steps defined; +20% would strain but not break; no written capacity plan.",
    anchor4: "Consistent quality; capacity plan; +20% absorbable",
  },
  {
    // v2 rewrite: one axis, the largest customer's share of revenue. The old
    // scale mixed largest-customer share (0) with top-five share (2), so two
    // different businesses could both "score a 2" for opposite reasons.
    key: "S8",
    pillar: "systems",
    label: "Customer concentration",
    anchor0: "Largest customer is more than 30% of revenue.",
    anchor1: "Largest customer is 20–30% of revenue.",
    anchor2: "Largest customer is 15–20% of revenue.",
    anchor3: "Largest customer is 10–15% of revenue.",
    anchor4: "Largest customer is less than 10% of revenue.",
    note: "Record the top-five share as evidence in the note — it is context for the finding, never a scoring threshold. The score comes from the largest customer alone.",
  },
  {
    key: "S9",
    pillar: "systems",
    label: "Revenue predictability",
    anchor0: "All one-shot projects, restart every month",
    anchor1: "Some repeat customers; no contracts; the forecast is a hope.",
    anchor2: "Some repeat/contract revenue",
    anchor3:
      "Recurring or contracted revenue covers fixed costs or ≥ 40% of revenue; a rolling forecast exists.",
    anchor4: "Meaningful recurring/contracted base; forecastable",
  },
  {
    key: "S10",
    pillar: "systems",
    label: "Contracts, continuity & key-person risk",
    anchor0: "Handshakes; key knowledge in one head; no plan",
    anchor1: "Templates used sometimes; key-person risk known and unaddressed.",
    anchor2: "Some contracts written; known key-person gaps",
    anchor3:
      "Written contracts standard; cross-training started for key roles; continuity plan drafted, not tested.",
    anchor4: "Written transferable contracts; cross-training; continuity plan",
  },
  // ── LEVERAGE (25%) ────────────────────────────────────────────────────────
  {
    key: "L1",
    pillar: "leverage",
    label: "Core system coverage",
    anchor0: "Spreadsheets and memory",
    anchor1:
      "One real system (usually accounting); the rest is spreadsheets and texts.",
    anchor2: "Key tools exist with big gaps",
    anchor3: "Systems for most core areas; one significant gap remains.",
    anchor4: "Every core area has a real system",
  },
  {
    key: "L2",
    pillar: "leverage",
    label: "Integration",
    anchor0: "Same data typed into multiple places; a person is the glue",
    anchor1: "Manual export and import between systems on a schedule.",
    anchor2: "Some integrations; some double entry",
    anchor3: "Main systems connected; one or two double-entry points remain.",
    anchor4: "Core systems share data cleanly",
  },
  {
    key: "L3",
    pillar: "leverage",
    label: "Data trust & reporting",
    anchor0: "Numbers conflict; reports hand-built",
    anchor1: "One trusted report (the bank balance); everything else disputed.",
    anchor2: "Mostly right after cleanup",
    anchor3: "Definitions agreed for the key KPIs; reports need light cleanup.",
    anchor4: "Agreed definitions; reports on demand",
  },
  {
    // Named for the outcome, not the burden: the anchors already run
    // low-bad → high-good like every other indicator on the instrument.
    key: "L4",
    pillar: "leverage",
    label: "Manual work eliminated",
    anchor0: "Heavy manual repetitive load everywhere",
    anchor1: "Load acknowledged; nothing fixed.",
    anchor2: "Some load; a few fixes made",
    anchor3: "Major repetitive tasks reduced; a few hours a week remain per role.",
    anchor4: "Little manual repetition; work flows",
  },
  {
    key: "L5",
    pillar: "leverage",
    label: "Automation in place",
    anchor0: "None",
    anchor1: "One or two automations set up by a vendor; nobody owns them.",
    anchor2: "A few automations, reliability mixed",
    anchor3:
      "Automations in several functions; owned and monitored; occasional failures.",
    anchor4: "Reliable automations across functions, maintained",
  },
  {
    key: "L6",
    pillar: "leverage",
    label: "AI adoption",
    anchor0: "None",
    anchor1: "One person experiments on their own.",
    anchor2: "Individual/ad-hoc use",
    anchor3: "AI used in one or two defined workflows; results anecdotal.",
    anchor4: "Deliberate use in defined workflows with results",
  },
  {
    key: "L7",
    pillar: "leverage",
    label: "AI & automation discipline",
    anchor0: "No rules, no review, no measurement",
    anchor1: "A verbal rule (“don’t paste customer data”); no review.",
    anchor2: "Some practices; inconsistent",
    anchor3:
      "Written use-case selection and data rules; human review defined; measurement partial.",
    anchor4: "Impact-picked use cases, owners, human review, measured",
  },
  {
    key: "L8",
    pillar: "leverage",
    label: "Tech & data hygiene",
    anchor0: "Shared passwords, no backups, unknown access",
    anchor1: "Individual logins for most tools; backups assumed, never tested.",
    anchor2: "Partial hygiene; known gaps",
    anchor3:
      "Access controlled and off-boarding done; backups tested once; data map partial.",
    anchor4: "Access controlled, backups tested, data mapped",
  },
  {
    key: "L9",
    pillar: "leverage",
    label: "Team readiness",
    anchor0: "Resistant or untrained",
    anchor1: "Curious individuals; no training.",
    anchor2: "Pockets of capability",
    anchor3: "Team trained on the core tools; adoption uneven across roles.",
    anchor4: "Trained, adopting, improving",
  },
  {
    key: "L10",
    pillar: "leverage",
    label: "Change capacity",
    anchor0: "No budget/time/appetite",
    anchor1: "Appetite yes; no budget or time set aside.",
    anchor2: "Limited but real",
    anchor3: "Budget and time named; execution still depends on the owner.",
    anchor4: "Budget, time, and appetite committed",
  },
];

/** The five written anchors of one indicator, in scale order. */
export function anchorsOf(ind: IndicatorDef): string[] {
  return [ind.anchor0, ind.anchor1, ind.anchor2, ind.anchor3, ind.anchor4];
}

/** The anchor a given score actually matched — printed in the report appendix. */
export function anchorFor(
  ind: IndicatorDef,
  score: number | null | undefined
): string | null {
  if (score === null || score === undefined) return null;
  if (!Number.isInteger(score) || score < 0 || score > 4) return null;
  return anchorsOf(ind)[score];
}

export const INDICATORS_BY_PILLAR: Record<AssessmentPillar, IndicatorDef[]> = {
  profit: INDICATORS.filter((i) => i.pillar === "profit"),
  systems: INDICATORS.filter((i) => i.pillar === "systems"),
  leverage: INDICATORS.filter((i) => i.pillar === "leverage"),
};

// Maturity bands — score <= upper bound (matches the Advisor Calculator).
export const BANDS: Array<{ max: number; label: string }> = [
  { max: 20, label: "Reactive" },
  { max: 40, label: "Stabilizing" },
  { max: 60, label: "Building" },
  { max: 80, label: "Scaling" },
  { max: 100, label: "Self-Running" },
];

export function bandFor(score: number): string {
  const band = BANDS.find((b) => score <= b.max);
  return band ? band.label : "Self-Running";
}

// Critical Constraint Overlay — flagged regardless of scores; a warning can
// never be averaged away.
export const OVERLAY_FLAGS: Array<{ key: string; label: string }> = [
  // One number, matching S8's single axis — a range in a warning label makes
  // the flag a judgement call at exactly the moment it should not be one.
  { key: "customer_concentration", label: "Largest customer > 25% of revenue" },
  { key: "cash_distress", label: "Negative / dangerously tight cash or debt distress" },
  { key: "unreliable_financials", label: "Financials too unreliable for decisions" },
  { key: "key_person", label: "Key person or license whose loss stops the business" },
  { key: "nontransferable_contracts", label: "Nontransferable or unwritten critical contracts" },
  { key: "legal_exposure", label: "Known legal / tax / insurance exposure (refer out)" },
  { key: "owner_burnout", label: "Owner burnout or continuity risk" },
  { key: "data_risk", label: "Sensitive data uncontrolled / no backups" },
];

export const EVIDENCE_LABELS: Record<string, string> = {
  reported: "Reported",
  demonstrated: "Demonstrated",
  documented: "Documented",
  unknown: "—",
};

export const EVIDENCE_SHORT: Record<string, string> = {
  reported: "R",
  demonstrated: "D",
  documented: "Doc",
  unknown: "—",
};

// ─────────────────────────────────────────────────────────────────────────────
// Scoring math (mirrors the Advisor Calculator exactly)
// ─────────────────────────────────────────────────────────────────────────────

export type ScoreMap = Record<string, CcAssessmentScore>;

export function toScoreMap(scores: CcAssessmentScore[]): ScoreMap {
  const map: ScoreMap = {};
  for (const s of scores) map[s.indicator_key] = s;
  return map;
}

/**
 * Raw pillar score (0–100, unrounded) = average of scored indicators ÷ 4 × 100.
 * N/A and unscored indicators are removed from the denominator.
 * Returns null when no indicator in the pillar has a score.
 */
export function pillarRaw(pillar: AssessmentPillar, scores: ScoreMap): number | null {
  let sum = 0;
  let count = 0;
  for (const ind of INDICATORS_BY_PILLAR[pillar]) {
    const row = scores[ind.key];
    if (!row || row.not_applicable || row.score === null) continue;
    sum += row.score;
    count += 1;
  }
  return count > 0 ? (sum / count / 4) * 100 : null;
}

export interface ComputedScores {
  /** Rounded pillar scores for display (null = no data). */
  pillars: Record<AssessmentPillar, number | null>;
  /**
   * The same pillar scores UNROUNDED. The report's "check the math" block
   * prints these to one decimal and recomputes the composite from them, so a
   * client reproducing the arithmetic by hand lands on the printed number
   * instead of a point either side of it.
   */
  pillarsRaw: Record<AssessmentPillar, number | null>;
  /** How many of the ten indicators in each pillar carry a score. */
  pillarScoredCounts: Record<AssessmentPillar, number>;
  /** How many of the ten are marked N/A — the second exclusion rule. */
  pillarNaCounts: Record<AssessmentPillar, number>;
  /**
   * Pillars that are INSUFFICIENT DATA: either scored from fewer than
   * MIN_PILLAR_SAMPLE indicators, or carrying MAX_PILLAR_NA or more N/As. They
   * are shown as "insufficient data" rather than a number, and — since v2 —
   * they carry no weight in the composite either. Every surface that shows a
   * pillar number must agree with this flag.
   */
  thinPillars: Record<AssessmentPillar, boolean>;
  /**
   * Which rule dropped a pillar, so a message can say which one tripped
   * instead of guessing. null = the pillar counts normally.
   */
  pillarExclusions: Record<AssessmentPillar, PillarExclusionReason | null>;
  /**
   * Pillars left OUT of the composite. Their weight is redistributed across
   * the remaining pillars. Three indicators out of ten used to be able to pull
   * the headline number several points; a pillar we cannot state on its own
   * page has no business steering the composite.
   */
  excludedPillars: AssessmentPillar[];
  /** Composite CREAiT Score 0–100, weights renormalized over counted pillars. */
  creaitScore: number | null;
  band: string | null;
  scoredCount: number;
  naCount: number;
  /** Indicators with a verdict: scored + N/A. The report-readiness measure. */
  resolvedCount: number;
  /**
   * True when the composite rests on too little evidence to state flatly —
   * fewer than MIN_REPORT_RESOLVED indicators resolved, or any pillar thin
   * enough to have been dropped. The number is still computed exactly as the
   * methodology defines it; this only forces the disclosure.
   */
  provisional: boolean;
}

/**
 * A pillar scored from fewer than this many indicators is reported as
 * insufficient data rather than a number — two indicators out of ten can
 * read as a strength when the pillar is actually unexamined.
 */
export const MIN_PILLAR_SAMPLE = 4;

/**
 * The other half of the N/A rule: at this many N/As a pillar is insufficient
 * data no matter how well the remaining indicators scored. Six indicators can
 * average beautifully while four whole areas of the business were never in
 * scope, and the composite must not read that as strength.
 */
export const MAX_PILLAR_NA = 4;

/** Engagements below this many resolved indicators are not report-ready. */
export const MIN_REPORT_RESOLVED = 25;

/** Why a pillar was dropped from the composite. */
export type PillarExclusionReason = "thin_sample" | "too_many_na";

export function pillarScoredCount(
  pillar: AssessmentPillar,
  scores: ScoreMap
): number {
  let count = 0;
  for (const ind of INDICATORS_BY_PILLAR[pillar]) {
    const row = scores[ind.key];
    if (!row || row.not_applicable || row.score === null) continue;
    count += 1;
  }
  return count;
}

export function pillarNaCount(
  pillar: AssessmentPillar,
  scores: ScoreMap
): number {
  let count = 0;
  for (const ind of INDICATORS_BY_PILLAR[pillar]) {
    if (scores[ind.key]?.not_applicable) count += 1;
  }
  return count;
}

/**
 * The one place the exclusion rule lives: a pillar with data is dropped when
 * it was scored from too few indicators, or when too much of it was N/A.
 * Returns null when the pillar counts normally (including when it has no data
 * at all — an unexamined pillar is "not examined", not "excluded").
 */
export function pillarExclusion(
  scoredCount: number,
  naCount: number
): PillarExclusionReason | null {
  if (scoredCount === 0) return null;
  if (scoredCount < MIN_PILLAR_SAMPLE) return "thin_sample";
  if (naCount >= MAX_PILLAR_NA) return "too_many_na";
  return null;
}

export function computeScores(scores: ScoreMap): ComputedScores {
  const pillars: Record<AssessmentPillar, number | null> = {
    profit: null,
    systems: null,
    leverage: null,
  };
  const pillarsRaw: Record<AssessmentPillar, number | null> = {
    profit: null,
    systems: null,
    leverage: null,
  };
  const pillarScoredCounts: Record<AssessmentPillar, number> = {
    profit: 0,
    systems: 0,
    leverage: 0,
  };
  const pillarNaCounts: Record<AssessmentPillar, number> = {
    profit: 0,
    systems: 0,
    leverage: 0,
  };
  const thinPillars: Record<AssessmentPillar, boolean> = {
    profit: false,
    systems: false,
    leverage: false,
  };
  const pillarExclusions: Record<
    AssessmentPillar,
    PillarExclusionReason | null
  > = { profit: null, systems: null, leverage: null };
  const excludedPillars: AssessmentPillar[] = [];
  let total = 0;
  let weightSum = 0;

  for (const { key, weight } of PILLARS) {
    const raw = pillarRaw(key, scores);
    const examined = pillarScoredCount(key, scores);
    const na = pillarNaCount(key, scores);
    pillars[key] = raw === null ? null : Math.round(raw);
    pillarsRaw[key] = raw;
    pillarScoredCounts[key] = examined;
    pillarNaCounts[key] = na;
    const reason = pillarExclusion(examined, na);
    pillarExclusions[key] = reason;
    thinPillars[key] = reason !== null;
    if (reason !== null) excludedPillars.push(key);
    // An insufficient-data pillar is displayed as such but never weighted: its
    // share is renormalized onto the pillars that carry enough evidence.
    if (raw !== null && reason === null) {
      total += raw * weight;
      weightSum += weight;
    }
  }

  const creaitScore =
    weightSum > 0 && Number.isFinite(total / weightSum)
      ? Math.round(total / weightSum)
      : null;

  let scoredCount = 0;
  let naCount = 0;
  for (const ind of INDICATORS) {
    const row = scores[ind.key];
    if (!row) continue;
    if (row.not_applicable) naCount += 1;
    else if (row.score !== null) scoredCount += 1;
  }

  const resolvedCount = scoredCount + naCount;

  return {
    pillars,
    pillarsRaw,
    pillarScoredCounts,
    pillarNaCounts,
    thinPillars,
    pillarExclusions,
    excludedPillars,
    creaitScore,
    band: creaitScore === null ? null : bandFor(creaitScore),
    scoredCount,
    naCount,
    resolvedCount,
    provisional:
      creaitScore !== null &&
      (resolvedCount < MIN_REPORT_RESOLVED ||
        PILLARS.some((p) => thinPillars[p.key])),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Potential score — the advisor-set target (migration 0007)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The report only renders a potential composite when the advisor has set a
 * target on at least this many indicators. Below it, a "potential score"
 * would rest on a handful of guesses dressed up as a second reading — so the
 * report omits it entirely rather than hedging it.
 */
export const MIN_POTENTIAL_SET = 8;

export interface PotentialScores {
  /** Rounded potential pillar scores (null = pillar has no current data). */
  pillars: Record<AssessmentPillar, number | null>;
  /** Potential composite 0–100 — same weights and renormalization as current. */
  creaitScore: number | null;
  band: string | null;
  /** How many scored indicators carry an advisor-set target. */
  potentialSet: number;
  /** Thin pillars, dropped from the potential composite exactly as from the current one. */
  excludedPillars: AssessmentPillar[];
  /**
   * Indicator keys where the advisor's target sits BELOW the current score.
   * The math clamps those up to the current score — a "potential" that shows
   * the business getting worse is a typo, not a target — and the workbench
   * warns on every key in this list so the typo gets fixed rather than hidden.
   */
  potentialBelowCurrent: string[];
}

/**
 * The potential composite uses the SAME denominator as the current one: only
 * indicators that carry a current score participate, with potential_score
 * where the advisor set one and the current score where not. That keeps the
 * two composites directly comparable — the delta is exactly the sum of the
 * advisor's targets, never an artifact of a different sample.
 */
export function computePotentialScores(scores: ScoreMap): PotentialScores {
  const pillars: Record<AssessmentPillar, number | null> = {
    profit: null,
    systems: null,
    leverage: null,
  };
  const excludedPillars: AssessmentPillar[] = [];
  const potentialBelowCurrent: string[] = [];
  let total = 0;
  let weightSum = 0;
  let potentialSet = 0;

  for (const { key, weight } of PILLARS) {
    let sum = 0;
    let count = 0;
    let na = 0;
    for (const ind of INDICATORS_BY_PILLAR[key]) {
      const row = scores[ind.key];
      if (row?.not_applicable) na += 1;
      if (!row || row.not_applicable || row.score === null) continue;
      let target = row.score;
      if (row.potential_score !== null && row.potential_score !== undefined) {
        potentialSet += 1;
        if (row.potential_score < row.score) {
          // Never lower: the target is clamped to today's score and the key is
          // surfaced so an advisor can correct it before it prints.
          potentialBelowCurrent.push(ind.key);
        } else {
          target = row.potential_score;
        }
      }
      sum += target;
      count += 1;
    }
    const raw = count > 0 ? (sum / count / 4) * 100 : null;
    pillars[key] = raw === null ? null : Math.round(raw);
    // Identical exclusion to the current composite — the two numbers are only
    // comparable if they were built over the same pillars.
    const reason = pillarExclusion(count, na);
    if (reason !== null) excludedPillars.push(key);
    if (raw !== null && reason === null) {
      total += raw * weight;
      weightSum += weight;
    }
  }

  const creaitScore =
    weightSum > 0 && Number.isFinite(total / weightSum)
      ? Math.round(total / weightSum)
      : null;

  return {
    pillars,
    creaitScore,
    band: creaitScore === null ? null : bandFor(creaitScore),
    potentialSet,
    excludedPillars,
    potentialBelowCurrent,
  };
}

/**
 * Payback in months = fix cost ÷ expected monthly recovery
 * (expected monthly recovery = annual expected ÷ 12).
 *
 * Returns null rather than a number whenever the division cannot produce an
 * honest month count: no fix cost, no/zero/negative expected recovery, or a
 * negative fix cost. A printed "-4 months" or "Infinity" on a $7,500
 * deliverable is worse than an em dash.
 */
export function paybackMonths(
  fixCost: number | null,
  annualExpected: number | null
): number | null {
  if (fixCost === null || annualExpected === null) return null;
  if (!Number.isFinite(fixCost) || !Number.isFinite(annualExpected)) return null;
  if (fixCost < 0 || annualExpected <= 0) return null;
  return fixCost / (annualExpected / 12);
}

export const DEFAULT_OVERLAP_FACTOR = 0.7;

/**
 * Postgres NUMERIC arrives as a JSON number over PostgREST, but optimistic
 * client state briefly holds the raw string an <input> produced. Coercing here
 * keeps `0 + "12000"` from ever becoming the string "012000" and then NaN.
 */
function toFinite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Clamp to the sellable range: an overlap factor above 1 would inflate. */
export function normalizeOverlapFactor(value: unknown): number {
  const n = toFinite(value);
  if (n === null || n <= 0 || n > 1) return DEFAULT_OVERLAP_FACTOR;
  return n;
}

export interface PortfolioTotals {
  rawLow: number;
  rawExpected: number;
  rawHigh: number;
  adjLow: number;
  adjExpected: number;
  adjHigh: number;
  /** The factor actually applied — 1 when there is nothing to overlap. */
  overlapFactor: number;
  /** The engagement's configured factor, whether or not it was applied. */
  configuredFactor: number;
  /** How many opportunities are included in the total. */
  includedCount: number;
  /** False when a single initiative made the overlap discount meaningless. */
  overlapApplied: boolean;
}

/**
 * Portfolio total = sum × overlap factor (default 0.7) — never the raw sum,
 * because initiatives share the same customers and the same hours.
 *
 * With fewer than two included initiatives there is nothing to overlap, so the
 * discount is NOT applied: shaving 30% off a lone opportunity understates it
 * and contradicts the report's own "not additive with each other" wording.
 */
export function portfolioTotals(
  opportunities: Array<{
    annual_low: number | null;
    annual_expected: number | null;
    annual_high: number | null;
    include_in_report: boolean;
  }>,
  overlapFactor: unknown
): PortfolioTotals {
  const configuredFactor = normalizeOverlapFactor(overlapFactor);
  let rawLow = 0;
  let rawExpected = 0;
  let rawHigh = 0;
  let includedCount = 0;
  for (const opp of opportunities) {
    if (!opp.include_in_report) continue;
    includedCount += 1;
    rawLow += toFinite(opp.annual_low) ?? 0;
    rawExpected += toFinite(opp.annual_expected) ?? 0;
    rawHigh += toFinite(opp.annual_high) ?? 0;
  }
  const overlapApplied = includedCount > 1;
  const factor = overlapApplied ? configuredFactor : 1;
  return {
    rawLow,
    rawExpected,
    rawHigh,
    adjLow: rawLow * factor,
    adjExpected: rawExpected * factor,
    adjHigh: rawHigh * factor,
    overlapFactor: factor,
    configuredFactor,
    includedCount,
    overlapApplied,
  };
}

export interface MarginShift {
  /** Current operating margin, %, rounded to one decimal for display. */
  currentPct: number;
  /** Expected-case margin with the portfolio captured, revenue held flat. */
  expectedPct: number;
  /** expectedPct − currentPct, from the ROUNDED values so the printed line's implied arithmetic always checks out. */
  deltaPts: number;
}

/**
 * The margin-points headline: "9.0% → 15.1% (+6.1 points)". Margin POINTS,
 * never a profit-lift percentage — a lift % is a function of the starting
 * margin, not of the work, and it reads as hype on any thin-margin business.
 *
 * Expected-case margin holds revenue flat and adds the overlap-adjusted
 * expected portfolio to operating profit (the impact is priced as operating
 * profit, so this is the conservative reading). Returns null whenever the
 * line cannot be stated honestly: missing figures, non-positive revenue, an
 * unpriced portfolio, or a shift that rounds to zero points.
 */
export function marginShift(
  annualRevenue: unknown,
  operatingProfit: unknown,
  adjExpected: number
): MarginShift | null {
  const revenue = toFinite(annualRevenue);
  const profit = toFinite(operatingProfit);
  if (revenue === null || profit === null || revenue <= 0) return null;
  if (!Number.isFinite(adjExpected) || adjExpected <= 0) return null;
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const currentPct = round1((profit / revenue) * 100);
  const expectedPct = round1(((profit + adjExpected) / revenue) * 100);
  const deltaPts = round1(expectedPct - currentPct);
  if (deltaPts <= 0) return null;
  return { currentPct, expectedPct, deltaPts };
}

export interface ConcentrationWarning {
  title: string;
  /** Whole-percent share of the raw included expected sum. */
  sharePct: number;
}

/**
 * Advisor-only concentration check (never the report): when one included
 * opportunity carries more than half the raw expected recovery, the whole
 * projection stands or falls on that single number. Threshold 50% — we
 * typically carry three initiatives, so 25% would fire constantly. A lone
 * initiative is trivially 100% and the portfolio math already treats it as
 * its own range, so the check needs at least two included opportunities.
 */
export function concentrationWarning(
  opportunities: Array<{
    title: string;
    annual_expected: number | null;
    include_in_report: boolean;
  }>
): ConcentrationWarning | null {
  const included = opportunities.filter((o) => o.include_in_report);
  if (included.length < 2) return null;
  let sum = 0;
  let top: { title: string; expected: number } | null = null;
  for (const opp of included) {
    const expected = toFinite(opp.annual_expected);
    if (expected === null || expected <= 0) continue;
    sum += expected;
    if (!top || expected > top.expected) {
      top = { title: opp.title, expected };
    }
  }
  if (!top || sum <= 0) return null;
  const share = top.expected / sum;
  if (share <= 0.5) return null;
  return { title: top.title, sharePct: Math.round(share * 100) };
}

/**
 * An advisor can type a low above the expected (or a high below it) and the
 * printed range then reads as nonsense. Non-blocking — surfaced in the
 * workbench so it is caught before the client sees it.
 */
export function rangeOrderIssue(opp: {
  annual_low: number | null;
  annual_expected: number | null;
  annual_high: number | null;
}): string | null {
  const low = toFinite(opp.annual_low);
  const expected = toFinite(opp.annual_expected);
  const high = toFinite(opp.annual_high);
  if (low !== null && expected !== null && low > expected) {
    return "Low is above expected";
  }
  if (expected !== null && high !== null && expected > high) {
    return "Expected is above high";
  }
  if (low !== null && high !== null && low > high) {
    return "Low is above high";
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// The evidence rule — Reported-only money is stated as a wider range
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A range built only on what the owner told us gets widened before it prints:
 * low × 0.75, high × 1.25. The expected case is untouched — widening is a
 * statement about how well we know the edges, not a re-estimate of the middle.
 */
export const REPORTED_ONLY_LOW_FACTOR = 0.75;
export const REPORTED_ONLY_HIGH_FACTOR = 1.25;

export interface WidenableOpportunity {
  annual_low: number | null;
  annual_expected: number | null;
  annual_high: number | null;
  confidence: OpportunityConfidence;
  /** Set by the advisor when the finding rests only on Reported indicators. */
  basis_reported_only?: boolean | null;
}

/**
 * "Reported-only" — the two ways a priced finding can rest on nothing but the
 * owner's word:
 *   1. no P&L on file. Every dollar figure in the report is derived from
 *      revenue and margin, so with no statement to check them against EVERY
 *      opportunity rests on reported numbers — not just the ones the advisor
 *      happened to grade low-confidence. Confidence is a separate judgement
 *      about the finding and is disclosed on its own; it is deliberately not
 *      part of this test.
 *   2. the advisor ticked `basis_reported_only` because every indicator the
 *      finding draws on is Reported. (There is no indicator→opportunity
 *      mapping in the schema, so this is set by hand.)
 */
export function isReportedOnly(
  opp: WidenableOpportunity,
  pnlOnFile: boolean
): boolean {
  return !pnlOnFile || opp.basis_reported_only === true;
}

/**
 * Apply the widening to one opportunity, returning a row whose low/high are
 * the numbers that must appear everywhere — cards, totals, appendix. Widening
 * that lives in one exhibit and not the totals underneath it is worse than no
 * widening at all.
 */
export function widenOpportunity<T extends WidenableOpportunity>(
  opp: T,
  pnlOnFile: boolean
): T & { widened: boolean } {
  const widened = isReportedOnly(opp, pnlOnFile);
  if (!widened) return { ...opp, widened: false };
  const low = toFinite(opp.annual_low);
  const high = toFinite(opp.annual_high);
  return {
    ...opp,
    annual_low: low === null ? null : low * REPORTED_ONLY_LOW_FACTOR,
    annual_high: high === null ? null : high * REPORTED_ONLY_HIGH_FACTOR,
    widened: true,
  };
}

export function widenOpportunities<T extends WidenableOpportunity>(
  opportunities: T[],
  pnlOnFile: boolean
): Array<T & { widened: boolean }> {
  return opportunities.map((o) => widenOpportunity(o, pnlOnFile));
}

// ─────────────────────────────────────────────────────────────────────────────
// Release readiness — the pre-delivery gate, shared by workbench and server
// ─────────────────────────────────────────────────────────────────────────────

/** At least this many indicators must be Demonstrated or Documented, not just told to us. */
export const MIN_GRADED_EVIDENCE = 10;

export const ASSESSMENT_DOCUMENT_KINDS = [
  "pnl",
  "revenue_by_customer",
  "ar_aging",
  "rate_card",
  "job_cost",
  "other",
] as const;

export type AssessmentDocumentKind = (typeof ASSESSMENT_DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABELS: Record<AssessmentDocumentKind, string> = {
  pnl: "P&L",
  revenue_by_customer: "Revenue by customer",
  ar_aging: "AR aging",
  rate_card: "Rate card",
  job_cost: "Job cost example",
  other: "Other",
};

export interface ReadinessOpportunity extends WidenableOpportunity {
  title: string;
  finding: string | null;
  include_in_report: boolean;
  /**
   * The stored calculator record (migration 0013). Absent or unparseable means
   * the range was typed by hand — a warning, never a blocker.
   */
  calc?: unknown;
}

export interface ReadinessInput {
  scores: ScoreMap;
  opportunities: ReadinessOpportunity[];
  assessment: {
    primary_constraint: string | null;
    constraint_cost: string | null;
    pnl_on_file?: boolean | null;
    reviewed_by?: string | null;
    overlay_flags?: unknown;
    overlap_factor?: number | string | null;
    /** Intake Q8 verbatim — warned about, never blocked. */
    owner_belief?: string | null;
    /** The 90-day plan lines — warned about below three. */
    plan_items?: unknown;
  };
}

export interface Readiness {
  ready: boolean;
  /** Every one of these must clear before the engagement can be delivered. */
  blockers: string[];
  /** Things a reviewer should have a reason for, but which do not block. */
  warnings: string[];
}

/**
 * The release gate, as a pure function so the workbench's checklist and the
 * server's refusal to mark an engagement "delivered" are literally the same
 * rules. A checklist the server does not enforce is a suggestion; a server
 * rule the checklist does not show is an ambush.
 */
export function assessmentReadiness(input: ReadinessInput): Readiness {
  const { scores, opportunities, assessment } = input;
  const blockers: string[] = [];
  const warnings: string[] = [];

  const computed = computeScores(scores);
  const potential = computePotentialScores(scores);

  // 1 — enough of the instrument resolved.
  if (computed.resolvedCount < MIN_REPORT_RESOLVED) {
    blockers.push(
      `Only ${computed.resolvedCount} of ${INDICATORS.length} indicators resolved — ${MIN_REPORT_RESOLVED} required.`
    );
  }

  // 2 — no pillar dropped for insufficient data, and the message says which
  // rule tripped: too few scored, or too much of it N/A.
  for (const p of PILLARS) {
    const reason = computed.pillarExclusions[p.key];
    if (reason === null) continue;
    blockers.push(
      reason === "thin_sample"
        ? `${p.label} is scored from ${computed.pillarScoredCounts[p.key]} of 10 indicators — fewer than ${MIN_PILLAR_SAMPLE}, so the pillar is dropped from the composite.`
        : `${p.label} has ${computed.pillarNaCounts[p.key]} N/As — ${MAX_PILLAR_NA} or more makes the pillar insufficient data, so it is dropped from the composite.`
    );
  }

  // 3, 4, 5 — evidence and notes on every scored indicator.
  const ungraded: string[] = [];
  const unnoted: string[] = [];
  let graded = 0;
  for (const ind of INDICATORS) {
    const row = scores[ind.key];
    if (!row || row.not_applicable || row.score === null) continue;
    if (row.evidence_confidence === "unknown") ungraded.push(ind.key);
    if (
      row.evidence_confidence === "demonstrated" ||
      row.evidence_confidence === "documented"
    ) {
      graded += 1;
    }
    if (!row.notes || !row.notes.trim()) unnoted.push(ind.key);
  }
  if (ungraded.length > 0) {
    blockers.push(
      `Evidence level not set on ${ungraded.length} scored indicator${
        ungraded.length === 1 ? "" : "s"
      }: ${ungraded.join(", ")}.`
    );
  }
  if (graded < MIN_GRADED_EVIDENCE) {
    blockers.push(
      `Only ${graded} indicator${
        graded === 1 ? " is" : "s are"
      } Demonstrated or Documented — ${MIN_GRADED_EVIDENCE} required.`
    );
  }
  if (unnoted.length > 0) {
    blockers.push(
      `No evidence note on ${unnoted.length} scored indicator${
        unnoted.length === 1 ? "" : "s"
      }: ${unnoted.join(", ")}.`
    );
  }

  // 6 — the constraint and what it costs.
  if (!assessment.primary_constraint?.trim()) {
    blockers.push("Primary Business Constraint has not been named.");
  }
  if (!assessment.constraint_cost?.trim()) {
    blockers.push("The constraint's annual cost (with its basis) is missing.");
  }

  // 7 — every included opportunity is a defensible range.
  const included = opportunities.filter((o) => o.include_in_report);
  if (included.length === 0) {
    blockers.push("No priced opportunity is included in the report.");
  }
  for (const opp of included) {
    const label = opp.title?.trim() || "Untitled opportunity";
    const low = toFinite(opp.annual_low);
    const expected = toFinite(opp.annual_expected);
    const high = toFinite(opp.annual_high);
    // A capacity-only automation finding (hours recovered, not redeployed)
    // legitimately prices at $0: the rule is that recovered hours are only
    // dollars if redeployed or removed, and the report shows it as hours.
    const calc = parseCalc(opp.calc);
    const capacityOnly =
      calc !== null &&
      calc.kind === "automation_hours" &&
      calc.inputs.redeployed === false &&
      (calc.outputs.capacityHoursWeekly ?? 0) > 0;
    if ((expected === null || expected <= 0) && !capacityOnly) {
      blockers.push(`"${label}" has no expected annual impact.`);
    }
    if (low === null || high === null) {
      blockers.push(`"${label}" is missing a low or high figure.`);
    } else if (
      expected !== null &&
      !(low <= expected && expected <= high)
    ) {
      blockers.push(
        `"${label}" has a range out of order — low ≤ expected ≤ high.`
      );
    }
    if (!opp.finding || !opp.finding.trim()) {
      blockers.push(`"${label}" has no finding or basis written.`);
    }
  }

  // 8 — overlay flags are real flags.
  const validFlags = new Set(OVERLAY_FLAGS.map((f) => f.key));
  const rawFlags = Array.isArray(assessment.overlay_flags)
    ? assessment.overlay_flags
    : [];
  const unknownFlags = rawFlags.filter(
    (f) => typeof f !== "string" || !validFlags.has(f)
  );
  if (unknownFlags.length > 0) {
    blockers.push(
      `Overlay flags contain values that are not on the list: ${unknownFlags
        .map((f) => String(f))
        .join(", ")}.`
    );
  }

  // 9 — a person signed the release.
  if (!assessment.reviewed_by?.trim()) {
    blockers.push("No reviewer name recorded for the release.");
  }

  // ── Warnings ──────────────────────────────────────────────────────────────
  if (!assessment.pnl_on_file) {
    warnings.push(
      "No P&L on file — the report carries the unaudited-figures disclosure and Reported-only ranges are widened ±25%."
    );
  }
  const concentration = concentrationWarning(
    included.map((o) => ({
      title: o.title,
      annual_expected: o.annual_expected,
      include_in_report: true,
    }))
  );
  if (concentration) {
    warnings.push(
      `"${concentration.title}" carries ${concentration.sharePct}% of the projected recovery — if the client disputes that one number, most of the projection goes with it.`
    );
  }
  if (potential.potentialBelowCurrent.length > 0) {
    warnings.push(
      `Target below the current score on ${potential.potentialBelowCurrent.join(
        ", "
      )} — treated as equal to today's score. Fix the target or clear it.`
    );
  }
  // A hand-typed range is defensible only as far as the advisor's memory of
  // how they got it. It does not block delivery — some findings genuinely have
  // no formula — but Appendix B will print "entered by the advisor" next to it,
  // so the reviewer should see that here before the client does.
  const handEntered = included.filter((o) => parseCalc(o.calc) === null);
  if (handEntered.length > 0) {
    warnings.push(
      `${handEntered.length} included opportunit${
        handEntered.length === 1 ? "y has a hand-entered range" : "ies have hand-entered ranges"
      } — no calculator record, so the report cannot print the arithmetic: ${handEntered
        .map((o) => `"${o.title?.trim() || "Untitled opportunity"}"`)
        .join(", ")}.`
    );
  }
  const factor = normalizeOverlapFactor(assessment.overlap_factor);
  if (factor !== DEFAULT_OVERLAP_FACTOR) {
    warnings.push(
      `Overlap factor is ${factor}, not the standard ${DEFAULT_OVERLAP_FACTOR} — say why in the opportunity findings before this prints.`
    );
  }
  // Two things the gate will not refuse over, but which a reviewer should see
  // in the same place as everything else rather than in a second checklist.
  if (!assessment.owner_belief?.trim()) {
    warnings.push(
      "Their own bottleneck belief was never captured verbatim — the mirror page has nothing to set the evidence against."
    );
  }
  const planCount = Array.isArray(assessment.plan_items)
    ? assessment.plan_items.filter(
        (p) => typeof p === "string" && p.trim().length > 0
      ).length
    : 0;
  if (planCount < 3) {
    warnings.push(
      `The 90-day plan has ${planCount} ${planCount === 1 ? "priority" : "priorities"} — three is the working minimum.`
    );
  }

  return { ready: blockers.length === 0, blockers, warnings };
}

export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPayback(months: number | null): string {
  if (months === null || !Number.isFinite(months)) return "—";
  if (months < 1) return "< 1 month";
  const rounded = Math.round(months * 10) / 10;
  return `${rounded} month${rounded === 1 ? "" : "s"}`;
}
