/**
 * The CREAiT Growth & AI Diagnostic — instrument definition & scoring math.
 *
 * Source of truth: "Creait Assesment build/01-Product-Design/
 * Scoring-Engine-and-Rubrics.md" (v1, stress-tested July 31 2026) and the
 * Advisor Calculator that implements it. Do not edit indicators, anchors,
 * weights, or bands without updating the product docs — the printed report's
 * credibility rests on this math matching the sold methodology exactly.
 *
 * The model:
 *  - 30 indicators, 10 per pillar, each scored 0–4 (behaviorally anchored:
 *    0 Absent · 1 Informal · 2 Developing · 3 Established · 4 Scalable).
 *    N/A allowed — removed from the denominator, never counted as zero.
 *  - Evidence confidence tracked separately (Reported / Demonstrated /
 *    Documented). Confidence never changes the score — it widens financial
 *    ranges and is disclosed in the report.
 *  - Pillar score = average of scored indicators ÷ 4 × 100.
 *  - CREAiT Score (0–100) = Profit × 40% + Systems × 35% + Leverage × 25%
 *    (renormalized over pillars that have at least one scored indicator).
 *  - Bands: 0–20 Reactive · 21–40 Stabilizing · 41–60 Building ·
 *    61–80 Scaling · 81–100 Self-Running.
 *  - Portfolio totals = sum × overlap factor (default 0.7). Never the raw sum.
 */

import type {
  AssessmentPillar,
  CcAssessmentScore,
} from "@/lib/supabase/types";

export interface IndicatorDef {
  key: string;
  pillar: AssessmentPillar;
  label: string;
  /** Behavioral anchors for scores 0, 2 and 4 (1 and 3 are the in-betweens). */
  anchor0: string;
  anchor2: string;
  anchor4: string;
}

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
    anchor2: "Some sources known; volume roughly tracked",
    anchor4: "Sources, volume, cost & quality tracked monthly",
  },
  {
    key: "P2",
    pillar: "profit",
    label: "Lead response & capture",
    anchor0: "Inquiries sit or get lost; no single system",
    anchor2: "Usually answered within a day; capture inconsistent",
    anchor4: "Every inquiry in one system, response < 1 hr, automated",
  },
  {
    key: "P3",
    pillar: "profit",
    label: "Follow-up discipline",
    anchor0: "One touch, then nothing",
    anchor2: "Some follow-up, person-dependent",
    anchor4: "2+ automated/systematic touches on every lead",
  },
  {
    key: "P4",
    pillar: "profit",
    label: "Sales conversion process",
    anchor0: "No defined process; close rate unknown",
    anchor2: "Loose process; rate roughly known",
    anchor4: "Defined stages, tracked close rate, loss reasons logged",
  },
  {
    key: "P5",
    pillar: "profit",
    label: "Pricing discipline",
    anchor0: "Gut/competitor pricing, unchanged 2+ yrs",
    anchor2: "Some economics behind prices; occasional reviews",
    anchor4: "Annual reviews, value-based, discount rules, team can defend",
  },
  {
    key: "P6",
    pillar: "profit",
    label: "Offer architecture",
    anchor0: "One offer, take it or leave it",
    anchor2: "Some add-ons offered ad hoc",
    anchor4: "Deliberate ladder: entry, core, premium, bundles, routine upsells",
  },
  {
    key: "P7",
    pillar: "profit",
    label: "Retention & reactivation",
    anchor0: "Customers leave silently; nobody looks back",
    anchor2: "Repeat rate roughly known; no reactivation",
    anchor4: "Retention measured & worked; inactive list reactivated on cadence",
  },
  {
    key: "P8",
    pillar: "profit",
    label: "Growth ownership & measurement",
    anchor0: "Nobody owns marketing/sales; no numbers",
    anchor2: "Owners named; numbers reviewed sometimes",
    anchor4: "Accountable owners; leads/conversion/CAC/value reviewed together",
  },
  {
    key: "P9",
    pillar: "profit",
    label: "Margin knowledge",
    anchor0: "Gross margin unknown",
    anchor2: "Known overall, not by job/service",
    anchor4: "Tracked by job/service/customer; decisions use it",
  },
  {
    key: "P10",
    pillar: "profit",
    label: "Financial visibility",
    anchor0: "Tax-time-only financials",
    anchor2: "Monthly-ish, late, lightly used",
    anchor4: "Monthly within 15 days, reviewed, targets exist",
  },
  // ── SYSTEMS (35%) ─────────────────────────────────────────────────────────
  {
    key: "S1",
    pillar: "systems",
    label: "Owner decision load",
    anchor0: "Nearly everything needs the owner",
    anchor2: "Several areas delegated; money/hiring/exceptions still owner-only",
    anchor4: "Clear decision rights; owner handles strategy only",
  },
  {
    key: "S2",
    pillar: "systems",
    label: "Absence resilience (4-week test)",
    anchor0: "Business stops or bleeds within days",
    anchor2: "Runs short-term; slows, decisions stack up",
    anchor4: "Runs 4+ weeks; someone decides; nothing critical is owner-locked",
  },
  {
    key: "S3",
    pillar: "systems",
    label: "Sales independence",
    anchor0: "Owner closes everything, relationships are the owner's",
    anchor2: "Team sells with owner rescue on big deals",
    anchor4: "Team sells without owner; relationships institutional",
  },
  {
    key: "S4",
    pillar: "systems",
    label: "Management depth & accountability",
    anchor0: "No managers, or managers in title only",
    anchor2: "Some real managers; accountability patchy",
    anchor4: "Leaders own outcomes; misses trigger action without owner",
  },
  {
    key: "S5",
    pillar: "systems",
    label: "Process documentation & adherence",
    anchor0: "In people's heads",
    anchor2: "Partially documented, loosely followed",
    anchor4: "Documented, current, trained-from, actually followed",
  },
  {
    key: "S6",
    pillar: "systems",
    label: "Rhythm & scoreboard",
    anchor0: "No regular meeting, no KPIs",
    anchor2: "Meetings happen; few KPIs, loose follow-through",
    anchor4: "Weekly structured rhythm; owned KPIs; visible targets",
  },
  {
    key: "S7",
    pillar: "systems",
    label: "Delivery consistency & capacity",
    anchor0: "Quality varies; +20% sales would break it",
    anchor2: "Mostly consistent; growth needs heroics",
    anchor4: "Consistent quality; capacity plan; +20% absorbable",
  },
  {
    key: "S8",
    pillar: "systems",
    label: "Customer concentration",
    anchor0: "One customer > 30% of revenue",
    anchor2: "Top five = 40–60%",
    anchor4: "No customer > 10–15%; broad base",
  },
  {
    key: "S9",
    pillar: "systems",
    label: "Revenue predictability",
    anchor0: "All one-shot projects, restart every month",
    anchor2: "Some repeat/contract revenue",
    anchor4: "Meaningful recurring/contracted base; forecastable",
  },
  {
    key: "S10",
    pillar: "systems",
    label: "Contracts, continuity & key-person risk",
    anchor0: "Handshakes; key knowledge in one head; no plan",
    anchor2: "Some contracts written; known key-person gaps",
    anchor4: "Written transferable contracts; cross-training; continuity plan",
  },
  // ── LEVERAGE (25%) ────────────────────────────────────────────────────────
  {
    key: "L1",
    pillar: "leverage",
    label: "Core system coverage",
    anchor0: "Spreadsheets and memory",
    anchor2: "Key tools exist with big gaps",
    anchor4: "Every core area has a real system",
  },
  {
    key: "L2",
    pillar: "leverage",
    label: "Integration",
    anchor0: "Same data typed into multiple places; a person is the glue",
    anchor2: "Some integrations; some double entry",
    anchor4: "Core systems share data cleanly",
  },
  {
    key: "L3",
    pillar: "leverage",
    label: "Data trust & reporting",
    anchor0: "Numbers conflict; reports hand-built",
    anchor2: "Mostly right after cleanup",
    anchor4: "Agreed definitions; reports on demand",
  },
  {
    key: "L4",
    pillar: "leverage",
    label: "Repetitive-work burden (reverse-scored)",
    anchor0: "Heavy manual repetitive load everywhere",
    anchor2: "Some load; a few fixes made",
    anchor4: "Little manual repetition; work flows",
  },
  {
    key: "L5",
    pillar: "leverage",
    label: "Automation in place",
    anchor0: "None",
    anchor2: "A few automations, reliability mixed",
    anchor4: "Reliable automations across functions, maintained",
  },
  {
    key: "L6",
    pillar: "leverage",
    label: "AI adoption",
    anchor0: "None",
    anchor2: "Individual/ad-hoc use",
    anchor4: "Deliberate use in defined workflows with results",
  },
  {
    key: "L7",
    pillar: "leverage",
    label: "AI & automation discipline",
    anchor0: "No rules, no review, no measurement",
    anchor2: "Some practices; inconsistent",
    anchor4: "Impact-picked use cases, owners, human review, measured",
  },
  {
    key: "L8",
    pillar: "leverage",
    label: "Tech & data hygiene",
    anchor0: "Shared passwords, no backups, unknown access",
    anchor2: "Partial hygiene; known gaps",
    anchor4: "Access controlled, backups tested, data mapped",
  },
  {
    key: "L9",
    pillar: "leverage",
    label: "Team readiness",
    anchor0: "Resistant or untrained",
    anchor2: "Pockets of capability",
    anchor4: "Trained, adopting, improving",
  },
  {
    key: "L10",
    pillar: "leverage",
    label: "Change capacity",
    anchor0: "No budget/time/appetite",
    anchor2: "Limited but real",
    anchor4: "Budget, time, and appetite committed",
  },
];

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
  { key: "customer_concentration", label: "Largest customer > 25–30% of revenue" },
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
  /** How many of the ten indicators in each pillar carry a score. */
  pillarScoredCounts: Record<AssessmentPillar, number>;
  /**
   * Pillars carrying 1–3 scored indicators: they contribute to the composite
   * but are too thinly sampled to state as a pillar score. Every surface that
   * shows a pillar number must show these as "insufficient data" instead —
   * the score detail and the dashboard can never disagree.
   */
  thinPillars: Record<AssessmentPillar, boolean>;
  /** Composite CREAiT Score 0–100, weights renormalized over scored pillars. */
  creaitScore: number | null;
  band: string | null;
  scoredCount: number;
  naCount: number;
  /** Indicators with a verdict: scored + N/A. The report-readiness measure. */
  resolvedCount: number;
  /**
   * True when the composite rests on too little evidence to state flatly —
   * fewer than MIN_REPORT_RESOLVED indicators resolved, or any contributing
   * pillar below MIN_PILLAR_SAMPLE. The number is still computed exactly as
   * the methodology defines it; this only forces the disclosure.
   */
  provisional: boolean;
}

/**
 * A pillar scored from fewer than this many indicators is reported as
 * insufficient data rather than a number — two indicators out of ten can
 * read as a strength when the pillar is actually unexamined.
 */
export const MIN_PILLAR_SAMPLE = 4;

/** Engagements below this many resolved indicators are not report-ready. */
export const MIN_REPORT_RESOLVED = 25;

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

export function computeScores(scores: ScoreMap): ComputedScores {
  const pillars: Record<AssessmentPillar, number | null> = {
    profit: null,
    systems: null,
    leverage: null,
  };
  const pillarScoredCounts: Record<AssessmentPillar, number> = {
    profit: 0,
    systems: 0,
    leverage: 0,
  };
  const thinPillars: Record<AssessmentPillar, boolean> = {
    profit: false,
    systems: false,
    leverage: false,
  };
  let total = 0;
  let weightSum = 0;

  for (const { key, weight } of PILLARS) {
    const raw = pillarRaw(key, scores);
    const examined = pillarScoredCount(key, scores);
    pillars[key] = raw === null ? null : Math.round(raw);
    pillarScoredCounts[key] = examined;
    thinPillars[key] = examined > 0 && examined < MIN_PILLAR_SAMPLE;
    if (raw !== null) {
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
    pillarScoredCounts,
    thinPillars,
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
