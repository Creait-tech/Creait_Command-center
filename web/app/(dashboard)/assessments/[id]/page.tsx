import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { AssessmentWorkbench } from "@/components/assessments/assessment-workbench";
import type {
  CcAssessment,
  CcAssessmentOpportunity,
  CcAssessmentScore,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * The workbench step lives in the query string so a refresh mid-session resumes
 * where the facilitator was. It is read here rather than with useSearchParams so
 * the client component never needs a Suspense boundary, and so that step changes
 * (which use history.replaceState) never round-trip to the server.
 */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AssessmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const { data: assessment } = await supabase
    .from("cc_assessments")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!assessment) notFound();

  const [scoresRes, oppsRes] = await Promise.all([
    supabase.from("cc_assessment_scores").select("*").eq("assessment_id", id),
    supabase
      .from("cc_assessment_opportunities")
      .select("*")
      .eq("assessment_id", id)
      .order("rank", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  return (
    <AssessmentWorkbench
      initialAssessment={assessment as CcAssessment}
      initialScores={(scoresRes.data as CcAssessmentScore[] | null) ?? []}
      initialOpportunities={
        (oppsRes.data as CcAssessmentOpportunity[] | null) ?? []
      }
      initialStep={first(query.step)}
      initialBlock={first(query.block)}
      initialIndicator={first(query.k)}
    />
  );
}
