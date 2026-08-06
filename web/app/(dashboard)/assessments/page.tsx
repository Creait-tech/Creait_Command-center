import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { AssessmentsView } from "@/components/assessments/assessments-view";
import type { CcAssessment } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AssessmentsPage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const { data } = await supabase
    .from("cc_assessments")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const assessments: CcAssessment[] = (data as CcAssessment[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Assessments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Growth &amp; AI Diagnostic engagements — score the 30 indicators,
          price the opportunities, name the constraint, deliver the Executive
          Blueprint. Cap: 4 real diagnostics per month.
        </p>
      </div>
      <AssessmentsView initialAssessments={assessments} />
    </div>
  );
}
