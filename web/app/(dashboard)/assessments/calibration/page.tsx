import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { CALIBRATION_CASE_FILES } from "@/lib/calibration-cases";
import { parseResult } from "@/lib/calibration";
import {
  CalibrationList,
  type CalibrationCaseSummary,
  type TraineeSummary,
} from "@/components/assessments/calibration/calibration-list";
import type { CcAssessmentCalibration } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function CalibrationPage() {
  const { userId } = await auth();
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const { data } = await supabase
    .from("cc_assessment_calibrations")
    .select("*")
    .eq("org_id", orgId)
    .order("started_at", { ascending: false });
  const attempts = (data as CcAssessmentCalibration[] | null) ?? [];

  const cases: CalibrationCaseSummary[] = Object.entries(CALIBRATION_CASE_FILES)
    .map(([slug, file]) => {
      const mine = attempts.filter((a) => a.case_slug === slug && a.trainee_id === userId);
      const team = attempts.filter((a) => a.case_slug === slug && a.submitted_at);
      return {
        slug,
        n: file.n,
        company: file.company,
        industry: file.industry,
        revenue: file.profile.revenue,
        headcount: file.profile.headcount,
        myOpenAttemptId: mine.find((a) => !a.submitted_at)?.id ?? null,
        myAttempts: mine
          .filter((a) => a.submitted_at)
          .map((a) => {
            const r = parseResult(a.result);
            return {
              id: a.id,
              submitted_at: a.submitted_at!,
              pass: r?.stats.pass ?? false,
              within_one: r?.stats.within_one ?? 0,
              exact: r?.stats.exact ?? 0,
            };
          }),
        teamSubmitted: team.length,
        teamPassed: team.filter((a) => parseResult(a.result)?.stats.pass).length,
      };
    })
    .sort((a, b) => a.n - b.n);

  const byTrainee = new Map<string, TraineeSummary & { sumWithin: number; caseSet: Set<string> }>();
  for (const a of attempts) {
    if (!a.submitted_at) continue;
    const r = parseResult(a.result);
    const t = byTrainee.get(a.trainee_id) ?? {
      trainee_id: a.trainee_id,
      trainee_name: a.trainee_name,
      submitted: 0,
      passed: 0,
      cases: 0,
      mean_within_one: null,
      sumWithin: 0,
      caseSet: new Set<string>(),
    };
    t.submitted += 1;
    if (r?.stats.pass) t.passed += 1;
    t.sumWithin += r?.stats.within_one ?? 0;
    t.caseSet.add(a.case_slug);
    if (!t.trainee_name && a.trainee_name) t.trainee_name = a.trainee_name;
    byTrainee.set(a.trainee_id, t);
  }
  const trainees: TraineeSummary[] = [...byTrainee.values()]
    .map((t) => ({
      trainee_id: t.trainee_id,
      trainee_name: t.trainee_name,
      submitted: t.submitted,
      passed: t.passed,
      cases: t.caseSet.size,
      mean_within_one: t.submitted > 0 ? t.sumWithin / t.submitted : null,
    }))
    .sort((a, b) => b.passed - a.passed || b.submitted - a.submitted);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Link
          href="/assessments"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Assessments
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Calibration</h1>
        <p className="mt-1 max-w-[72ch] text-sm text-muted-foreground">
          Score a known case blind — the intake, the session capture and the data room, without the
          key — then compare your thirty to the key&apos;s thirty. Two facilitators looking at the
          same evidence should land within a point of each other; this is where that gets proven
          before a client pays for it.
        </p>
      </div>
      <CalibrationList cases={cases} trainees={trainees} />
    </div>
  );
}
