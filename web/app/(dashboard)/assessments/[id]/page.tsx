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

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    supabase
      .from("cc_assessment_scores")
      .select("*")
      .eq("assessment_id", id),
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
    />
  );
}
