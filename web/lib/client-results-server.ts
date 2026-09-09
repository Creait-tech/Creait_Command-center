import "server-only";

/**
 * The owner's results page, read by token.
 *
 * Mirrors lib/intake-server.ts: one lookup with the service role (the visitor
 * has no Clerk session), constrained to a single row matched on client_token
 * AND status = 'delivered'. Everything the page shows is built with the same
 * functions the Executive Blueprint uses, so the link and the PDF agree.
 * A malformed, unknown or revoked token, or an engagement that has been
 * reopened, all answer "closed" — distinguishing them would turn the page into
 * an oracle.
 */

import { createServiceClient } from "@/lib/supabase/server";
import {
  computeScores,
  MIN_REPORT_RESOLVED,
  PILLARS,
  portfolioTotals,
  toScoreMap,
  widenOpportunities,
} from "@/lib/assessment-instrument";
import type { PresentData } from "@/components/assessments/present/present-deck";
import type {
  AssessmentOutcomes,
  CcAssessment,
  CcAssessmentOpportunity,
  CcAssessmentScore,
} from "@/lib/supabase/types";

const DOCUMENTS_BUCKET = "assessment-documents";
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ClientResults extends PresentData {
  constraintSymptoms: string | null;
  constraintFix: string | null;
  momentum: string | null;
  reviewer: string | null;
  /** A short-lived URL to the released PDF, when one has been attached. */
  blueprintUrl: string | null;
  outcomes: AssessmentOutcomes;
}

function jsonToStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function formatLongDate(d: string | null): string {
  const date = d ? new Date(`${d}T00:00:00`) : new Date();
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function parseOutcomes(value: unknown): AssessmentOutcomes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AssessmentOutcomes;
}

export async function findClientResults(
  token: unknown
): Promise<ClientResults | null> {
  if (typeof token !== "string" || !TOKEN_RE.test(token.trim())) return null;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("cc_assessments")
    .select("*")
    .eq("client_token", token.trim())
    .eq("status", "delivered")
    .maybeSingle();
  if (error || !data) return null;
  const assessment = data as CcAssessment;

  const [scoresRes, oppsRes] = await Promise.all([
    supabase
      .from("cc_assessment_scores")
      .select("*")
      .eq("assessment_id", assessment.id),
    supabase
      .from("cc_assessment_opportunities")
      .select("*")
      .eq("assessment_id", assessment.id)
      .order("rank", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const scores = toScoreMap(
    (scoresRes.data as CcAssessmentScore[] | null) ?? []
  );
  const allOpps = (oppsRes.data as CcAssessmentOpportunity[] | null) ?? [];
  const opportunities = widenOpportunities(
    allOpps.filter((o) => o.include_in_report),
    Boolean(assessment.pnl_on_file)
  );
  const computed = computeScores(scores);
  const portfolio = portfolioTotals(opportunities, assessment.overlap_factor);

  let blueprintUrl: string | null = null;
  if (assessment.blueprint_storage_path) {
    const { data: signed } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(assessment.blueprint_storage_path, 60 * 60);
    blueprintUrl = signed?.signedUrl ?? null;
  }

  return {
    id: assessment.id,
    company: assessment.company?.trim() || assessment.client_name,
    client: assessment.client_name,
    date: formatLongDate(assessment.delivered_at ?? assessment.started_at),
    isPractice: Boolean(assessment.is_practice),
    isDraft: computed.resolvedCount < MIN_REPORT_RESOLVED || computed.provisional,
    resolved: computed.resolvedCount,
    score: computed.creaitScore,
    band: computed.band,
    pillars: PILLARS.map((p) => ({
      key: p.key,
      label: p.label,
      weight: p.weight,
      score: computed.pillars[p.key],
      scored: computed.pillarScoredCounts[p.key],
      thin: computed.thinPillars[p.key],
    })),
    ownerBelief: assessment.owner_belief?.trim() || null,
    constraint: assessment.primary_constraint?.trim() || null,
    constraintCost: assessment.constraint_cost?.trim() || null,
    constraintSymptoms: assessment.constraint_symptoms?.trim() || null,
    constraintFix: assessment.constraint_fix?.trim() || null,
    momentum: assessment.momentum_initiative?.trim() || null,
    reviewer: assessment.reviewed_by?.trim() || null,
    opportunities: opportunities
      .slice()
      .sort((a, b) => (b.annual_expected ?? 0) - (a.annual_expected ?? 0))
      .map((o) => ({
        title: o.title,
        low: o.annual_low,
        expected: o.annual_expected,
        high: o.annual_high,
      })),
    portfolioExpected: portfolio.adjExpected,
    portfolioLow: portfolio.adjLow,
    portfolioHigh: portfolio.adjHigh,
    overlapFactor: portfolio.overlapFactor,
    plan: jsonToStrings(assessment.plan_items),
    blueprintUrl,
    outcomes: parseOutcomes(assessment.outcomes),
  };
}
