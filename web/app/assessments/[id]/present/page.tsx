import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import {
  PresentDeck,
  type PresentData,
} from "@/components/assessments/present/present-deck";
import {
  computeScores,
  INDICATORS,
  MIN_REPORT_RESOLVED,
  PILLARS,
  portfolioTotals,
  toScoreMap,
  widenOpportunities,
} from "@/lib/assessment-instrument";
import type {
  CcAssessment,
  CcAssessmentOpportunity,
  CcAssessmentScore,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * Present mode for the results session.
 *
 * Lives beside the report, outside the dashboard route group, so no app
 * chrome shares the screen. The data is built exactly as the Executive
 * Blueprint builds it — same score function, same widening rule, same
 * overlap-adjusted total — so what goes on screen and what goes in the PDF
 * cannot disagree.
 */

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { userId } = await auth();
  if (!userId) return { title: "Present" };
  const { id } = await params;
  const supabase = await createClient();
  const orgId = await getActiveOrgId();
  const { data } = await supabase
    .from("cc_assessments")
    .select("client_name, company")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  const row = data as Pick<CcAssessment, "client_name" | "company"> | null;
  return {
    title: row ? `Present — ${row.company || row.client_name}` : "Present",
    robots: { index: false, follow: false },
  };
}

export default async function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const { data: assessmentRow } = await supabase
    .from("cc_assessments")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!assessmentRow) notFound();
  const assessment = assessmentRow as CcAssessment;

  const [scoresRes, oppsRes] = await Promise.all([
    supabase.from("cc_assessment_scores").select("*").eq("assessment_id", id),
    supabase
      .from("cc_assessment_opportunities")
      .select("*")
      .eq("assessment_id", id)
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

  const data: PresentData = {
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
  };

  // INDICATORS is imported so the "of 30" on screen can never drift from the instrument.
  void INDICATORS.length;

  return <PresentDeck data={data} />;
}
