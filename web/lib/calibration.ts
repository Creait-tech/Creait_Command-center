/**
 * Calibration — scoring a known case blind and comparing to the key.
 *
 * Why this exists: the Growth & AI Diagnostic is only defensible if two
 * facilitators looking at the same evidence land on the same scores. The
 * Facilitator Guide's L2 certification says a trainee scores a case blind
 * from the intake and the session facts, then compares to the key. This
 * module is the pure half of that: the case file shape, what the trainee is
 * allowed to see, and the comparison arithmetic. Nothing here touches the
 * database or the network, so the pass rule can be unit-tested and the same
 * code runs on the server for the stored result.
 *
 * The pass bar is the one written in the Summit Exterior answer key
 * (resources/CREAIT-Summit-Exterior-Answer-Key.md): within ±1 on 27 of 30,
 * exact on 18+, the same pillar ranking, evidence labels within one step, and
 * no score without a note. The Primary Constraint is compared side by side
 * and left to a reviewer — a sentence cannot be auto-graded honestly.
 */

import {
  computeScores,
  INDICATORS,
  PILLARS,
  type IndicatorKey,
} from "@/lib/assessment-instrument";
import type {
  AssessmentPillar,
  CcAssessmentScore,
  EvidenceConfidence,
} from "@/lib/supabase/types";

// ── The case file ───────────────────────────────────────────────────────────

/** One scored indicator in the key. */
export interface CalibrationKeyScore {
  score: number | null;
  na: boolean;
  evidence: EvidenceConfidence;
  note: string;
  why_not_higher?: string;
}

export interface CalibrationDocument {
  name: string;
  kind: string;
  received_on: string | null;
}

/**
 * A case as stored in lib/calibration-cases/*.json. Cases 01–20 were built by
 * the simulation (resources/calibration-cases/README.md); case 00 is Summit
 * Exterior, transcribed from the founder-facing answer key.
 */
export interface CalibrationCaseFile {
  n: number;
  company: string;
  owner: string;
  industry: string;
  profile: {
    revenue: number | null;
    grossMarginPct: number | null;
    operatingProfit: number | null;
    headcount: number | null;
    founded: number | null;
    story: string;
  };
  /** What the case was designed to test — shown only after submission. */
  edge_cases: string[];
  /** Structured intake answers keyed by question id (lib/assessment-intake.ts). */
  intake?: Record<string, unknown>;
  /** A prose intake export, for cases that predate the in-app form. */
  intake_markdown?: string;
  session: {
    engine: Record<string, string>;
    blockNotes: Record<string, string>;
    demonstrated: string[];
    documents_seen: string[];
  };
  dataRoom: { pnl_on_file: boolean; documents: CalibrationDocument[] };
  scores: Record<string, CalibrationKeyScore>;
  assessment: {
    owner_objective?: string;
    owner_belief?: string;
    primary_constraint?: string;
    constraint_symptoms?: string;
    constraint_cost?: string;
    constraint_fix?: string;
    momentum_initiative?: string;
    overlay_flags?: string[];
    plan_items?: string[];
  };
  expected?: { band_guess?: string };
  key_version?: string;
}

/** The version string an attempt is stamped with when the file carries none. */
export const DEFAULT_KEY_VERSION = "Rubrics v2, 9 Sep 2026 — draft key";

export function keyVersionOf(file: CalibrationCaseFile): string {
  return file.key_version?.trim() || DEFAULT_KEY_VERSION;
}

// ── What the trainee sees ───────────────────────────────────────────────────

/**
 * Everything a trainee may see before submitting. Deliberately a separate
 * type rather than `Omit<CalibrationCaseFile, …>`, so adding a field to the
 * file never leaks it to the browser by default.
 */
export interface CalibrationMaterials {
  slug: string;
  n: number;
  company: string;
  owner: string;
  industry: string;
  profile: CalibrationCaseFile["profile"];
  intake: Record<string, unknown> | null;
  intake_markdown: string | null;
  session: CalibrationCaseFile["session"];
  dataRoom: CalibrationCaseFile["dataRoom"];
  key_version: string;
}

export function caseMaterials(
  slug: string,
  file: CalibrationCaseFile
): CalibrationMaterials {
  return {
    slug,
    n: file.n,
    company: file.company,
    owner: file.owner,
    industry: file.industry,
    profile: file.profile,
    intake: file.intake ?? null,
    intake_markdown: file.intake_markdown ?? null,
    session: file.session,
    dataRoom: file.dataRoom,
    key_version: keyVersionOf(file),
  };
}

/** The key, released only once an attempt is submitted. */
export interface CalibrationKey {
  scores: Record<string, CalibrationKeyScore>;
  assessment: CalibrationCaseFile["assessment"];
  edge_cases: string[];
  band: string | null;
  pillars: Record<AssessmentPillar, number | null>;
  creaitScore: number | null;
}

export function caseKey(file: CalibrationCaseFile): CalibrationKey {
  const computed = computeScores(toScoreMap(keyAsAnswers(file.scores)));
  return {
    scores: file.scores,
    assessment: file.assessment,
    edge_cases: file.edge_cases ?? [],
    band: computed.band ?? file.expected?.band_guess ?? null,
    pillars: computed.pillars,
    creaitScore: computed.creaitScore,
  };
}

// ── The trainee's answers ───────────────────────────────────────────────────

export interface CalibrationAnswer {
  score: number | null;
  na: boolean;
  evidence: EvidenceConfidence;
  note: string;
}

export interface CalibrationAnswers {
  scores: Partial<Record<IndicatorKey, CalibrationAnswer>>;
  primary_constraint: string;
  momentum_initiative: string;
}

const EVIDENCE_VALUES: EvidenceConfidence[] = [
  "unknown",
  "reported",
  "demonstrated",
  "documented",
];
const INDICATOR_KEY_SET = new Set<string>(INDICATORS.map((i) => i.key));

export function emptyAnswers(): CalibrationAnswers {
  return { scores: {}, primary_constraint: "", momentum_initiative: "" };
}

/** Tolerant parse of the stored JSONB; anything malformed is dropped, never thrown. */
export function parseAnswers(value: unknown): CalibrationAnswers {
  const out = emptyAnswers();
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  const v = value as Record<string, unknown>;
  if (typeof v.primary_constraint === "string") {
    out.primary_constraint = v.primary_constraint;
  }
  if (typeof v.momentum_initiative === "string") {
    out.momentum_initiative = v.momentum_initiative;
  }
  const scores = v.scores;
  if (scores && typeof scores === "object" && !Array.isArray(scores)) {
    for (const [key, raw] of Object.entries(scores as Record<string, unknown>)) {
      if (!INDICATOR_KEY_SET.has(key)) continue;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const r = raw as Record<string, unknown>;
      const na = r.na === true;
      const score =
        !na && typeof r.score === "number" && Number.isInteger(r.score)
          ? Math.min(4, Math.max(0, r.score))
          : null;
      const evidence = EVIDENCE_VALUES.includes(r.evidence as EvidenceConfidence)
        ? (r.evidence as EvidenceConfidence)
        : "unknown";
      out.scores[key as IndicatorKey] = {
        score,
        na,
        evidence,
        note: typeof r.note === "string" ? r.note : "",
      };
    }
  }
  return out;
}

function keyAsAnswers(
  key: Record<string, CalibrationKeyScore>
): CalibrationAnswers["scores"] {
  const out: CalibrationAnswers["scores"] = {};
  for (const [k, v] of Object.entries(key)) {
    if (!INDICATOR_KEY_SET.has(k)) continue;
    out[k as IndicatorKey] = {
      score: v.na ? null : v.score,
      na: v.na,
      evidence: v.evidence,
      note: v.note,
    };
  }
  return out;
}

/**
 * The score rows computeScores() expects, built from answers. Only the fields
 * the arithmetic reads are meaningful; the rest are placeholders.
 */
function toScoreMap(
  scores: CalibrationAnswers["scores"]
): Record<string, CcAssessmentScore> {
  const map: Record<string, CcAssessmentScore> = {};
  for (const ind of INDICATORS) {
    const a = scores[ind.key];
    if (!a) continue;
    if (!a.na && a.score === null) continue;
    map[ind.key] = {
      id: ind.key,
      assessment_id: "calibration",
      indicator_key: ind.key,
      pillar: ind.pillar,
      score: a.na ? null : a.score,
      potential_score: null,
      not_applicable: a.na,
      evidence_confidence: a.evidence,
      notes: a.note || null,
      created_at: "",
      updated_at: "",
    };
  }
  return map;
}

/** Live pillar and composite numbers for the trainee's answers so far. */
export function computeAnswers(answers: CalibrationAnswers) {
  return computeScores(toScoreMap(answers.scores));
}

/** Indicators still open (no score and not N/A). */
export function unresolved(answers: CalibrationAnswers): IndicatorKey[] {
  return INDICATORS.filter((i) => {
    const a = answers.scores[i.key];
    return !a || (!a.na && a.score === null);
  }).map((i) => i.key);
}

/** Scored indicators whose note is too short to defend the score. */
export const MIN_NOTE_CHARS = 12;

export function missingNotes(answers: CalibrationAnswers): IndicatorKey[] {
  return INDICATORS.filter((i) => {
    const a = answers.scores[i.key];
    if (!a || (!a.na && a.score === null)) return false;
    return a.note.trim().length < MIN_NOTE_CHARS;
  }).map((i) => i.key);
}

// ── The comparison ──────────────────────────────────────────────────────────

export interface CalibrationItemResult {
  yours: number | null;
  yours_na: boolean;
  key: number | null;
  key_na: boolean;
  /**
   * yours − key on the 0–4 scale; null when either side is N/A and the other
   * isn't (an N/A disagreement is a miss, not a distance).
   */
  delta: number | null;
  exact: boolean;
  within_one: boolean;
  your_evidence: EvidenceConfidence;
  key_evidence: EvidenceConfidence;
  /** |steps apart| on unknown < reported < demonstrated < documented; unknown vs anything else is 3. */
  evidence_steps: number;
  has_note: boolean;
}

export interface CalibrationStats {
  total: number;
  exact: number;
  within_one: number;
  /** Disagreements of 2+ points, or an N/A on one side only — the calibration agenda. */
  disagreements: number;
  evidence_within_one: number;
  notes_missing: number;
  /** Mean absolute deviation over indicators scored on both sides. */
  mad: number | null;
  your_pillars: Record<AssessmentPillar, number | null>;
  key_pillars: Record<AssessmentPillar, number | null>;
  your_score: number | null;
  key_score: number | null;
  pillar_ranking_match: boolean;
  pass: boolean;
}

export interface CalibrationResult {
  items: Record<string, CalibrationItemResult>;
  stats: CalibrationStats;
  /** The bar the attempt was judged against, so a later change never rewrites history. */
  rule: typeof PASS_RULE;
}

export const PASS_RULE = {
  within_one_min: 27,
  exact_min: 18,
  evidence_within_one_min: 27,
  notes_missing_max: 0,
  pillar_ranking: true,
} as const;

/** Rank of each pillar (1 = highest score); equal scores share a rank. */
function pillarRanks(
  pillars: Record<AssessmentPillar, number | null>
): Record<AssessmentPillar, number | null> {
  const out: Record<AssessmentPillar, number | null> = {
    profit: null,
    systems: null,
    leverage: null,
  };
  for (const p of PILLARS) {
    const mine = pillars[p.key];
    if (mine === null) continue;
    let higher = 0;
    for (const q of PILLARS) {
      const other = pillars[q.key];
      if (other !== null && other > mine) higher += 1;
    }
    out[p.key] = higher + 1;
  }
  return out;
}

function evidenceSteps(a: EvidenceConfidence, b: EvidenceConfidence): number {
  if (a === b) return 0;
  if (a === "unknown" || b === "unknown") return 3;
  return Math.abs(EVIDENCE_VALUES.indexOf(a) - EVIDENCE_VALUES.indexOf(b));
}

export function compareToKey(
  answers: CalibrationAnswers,
  key: Record<string, CalibrationKeyScore>
): CalibrationResult {
  const items: Record<string, CalibrationItemResult> = {};
  let exact = 0;
  let withinOne = 0;
  let evidenceWithinOne = 0;
  let notesMissing = 0;
  let disagreements = 0;
  const deviations: number[] = [];

  for (const ind of INDICATORS) {
    const a = answers.scores[ind.key] ?? {
      score: null,
      na: false,
      evidence: "unknown" as EvidenceConfidence,
      note: "",
    };
    const k = key[ind.key] ?? {
      score: null,
      na: false,
      evidence: "unknown" as EvidenceConfidence,
      note: "",
    };
    const yours = a.na ? null : a.score;
    const theirs = k.na ? null : k.score;
    const bothNa = a.na && k.na;
    const bothScored = yours !== null && theirs !== null;
    const delta = bothScored ? yours - theirs : null;
    const isExact = bothNa || (bothScored && delta === 0);
    const isWithinOne = bothNa || (bothScored && Math.abs(delta ?? 9) <= 1);
    const steps = evidenceSteps(a.evidence, k.evidence);
    const hasNote = a.na || a.note.trim().length >= MIN_NOTE_CHARS;

    if (isExact) exact += 1;
    if (isWithinOne) withinOne += 1;
    else disagreements += 1;
    if (bothNa || steps <= 1) evidenceWithinOne += 1;
    if (!hasNote) notesMissing += 1;
    if (bothScored && delta !== null) deviations.push(Math.abs(delta));

    items[ind.key] = {
      yours,
      yours_na: a.na,
      key: theirs,
      key_na: k.na,
      delta,
      exact: isExact,
      within_one: isWithinOne,
      your_evidence: a.evidence,
      key_evidence: k.evidence,
      evidence_steps: steps,
      has_note: hasNote,
    };
  }

  const yourComputed = computeAnswers(answers);
  const keyComputed = computeScores(toScoreMap(keyAsAnswers(key)));
  const yourRanks = pillarRanks(yourComputed.pillars);
  const keyRanks = pillarRanks(keyComputed.pillars);
  const rankingMatch = PILLARS.every(
    (p) => yourRanks[p.key] === keyRanks[p.key]
  );

  const stats: CalibrationStats = {
    total: INDICATORS.length,
    exact,
    within_one: withinOne,
    disagreements,
    evidence_within_one: evidenceWithinOne,
    notes_missing: notesMissing,
    mad:
      deviations.length > 0
        ? Math.round(
            (deviations.reduce((s, d) => s + d, 0) / deviations.length) * 100
          ) / 100
        : null,
    your_pillars: yourComputed.pillars,
    key_pillars: keyComputed.pillars,
    your_score: yourComputed.creaitScore,
    key_score: keyComputed.creaitScore,
    pillar_ranking_match: rankingMatch,
    pass:
      withinOne >= PASS_RULE.within_one_min &&
      exact >= PASS_RULE.exact_min &&
      evidenceWithinOne >= PASS_RULE.evidence_within_one_min &&
      notesMissing <= PASS_RULE.notes_missing_max &&
      (!PASS_RULE.pillar_ranking || rankingMatch),
  };

  return { items, stats, rule: PASS_RULE };
}

/** Tolerant parse of a stored result; null when it isn't one. */
export function parseResult(value: unknown): CalibrationResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!v.items || typeof v.items !== "object") return null;
  if (!v.stats || typeof v.stats !== "object") return null;
  return v as unknown as CalibrationResult;
}

/** Display label for a case: the key case first, then the numbered cohort. */
export function caseLabel(materials: Pick<CalibrationMaterials, "n" | "company">): string {
  return materials.n === 0
    ? `Key case · ${materials.company}`
    : `Case ${String(materials.n).padStart(2, "0")} · ${materials.company}`;
}
