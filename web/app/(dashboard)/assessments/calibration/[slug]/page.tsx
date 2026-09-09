import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { CALIBRATION_CASE_FILES } from "@/lib/calibration-cases";
import {
  caseKey,
  caseLabel,
  caseMaterials,
  parseAnswers,
  parseResult,
} from "@/lib/calibration";
import { CalibrationWorkbench } from "@/components/assessments/calibration/calibration-workbench";
import { CalibrationResults } from "@/components/assessments/calibration/calibration-results";
import { StartCalibrationButton } from "@/components/assessments/calibration/start-button";
import type { CcAssessmentCalibration } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * One case. With ?attempt=<id> it shows that attempt (the scorer's open work,
 * or anyone's submitted comparison); without it, the signed-in trainee's open
 * attempt, else their latest submitted one, else the start screen. The key
 * only reaches this page's output once the attempt shown is submitted.
 */
export default async function CalibrationCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const file = CALIBRATION_CASE_FILES[slug];
  if (!file) notFound();

  const { userId } = await auth();
  const supabase = await createClient();
  const orgId = await getActiveOrgId();
  const materials = caseMaterials(slug, file);

  const requested = first(query.attempt);
  let attempt: CcAssessmentCalibration | null = null;
  if (requested) {
    const { data } = await supabase
      .from("cc_assessment_calibrations")
      .select("*")
      .eq("id", requested)
      .eq("org_id", orgId)
      .eq("case_slug", slug)
      .maybeSingle();
    attempt = (data as CcAssessmentCalibration | null) ?? null;
    if (!attempt) notFound();
  } else if (userId) {
    const { data } = await supabase
      .from("cc_assessment_calibrations")
      .select("*")
      .eq("org_id", orgId)
      .eq("case_slug", slug)
      .eq("trainee_id", userId)
      .order("submitted_at", { ascending: false, nullsFirst: true })
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    attempt = (data as CcAssessmentCalibration | null) ?? null;
  }

  const header = (
    <div>
      <Link
        href="/assessments/calibration"
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Calibration
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{caseLabel(materials)}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {materials.owner} · {materials.industry}
        <span className="mx-1.5 text-muted-foreground/40">·</span>
        <span className="text-[12px]">{materials.key_version}</span>
      </p>
    </div>
  );

  if (!attempt) {
    return (
      <div className="flex flex-col gap-6 p-6">
        {header}
        <div className="max-w-[64ch] rounded-xl bg-[color:var(--color-brand-slate)]/40 px-5 py-4">
          <p className="text-[13px] leading-relaxed">
            You&apos;ll see the intake as the owner typed it, the facilitator&apos;s session
            capture and the data room. Score all thirty indicators with an evidence label and a
            note naming the evidence, name the Primary Constraint, then submit. The key appears
            only after you submit, and the first attempt is kept — a retake is a new attempt.
          </p>
          <div className="mt-4">
            <StartCalibrationButton slug={slug} />
          </div>
        </div>
      </div>
    );
  }

  const answers = parseAnswers(attempt.answers);
  const isMine = attempt.trainee_id === userId;

  if (attempt.submitted_at) {
    const result = parseResult(attempt.result);
    return (
      <div className="flex flex-col gap-6 p-6">
        {header}
        <p className="text-[12px] text-muted-foreground">
          Scored blind by {attempt.trainee_name ?? "an unnamed trainee"} · submitted{" "}
          {formatWhen(attempt.submitted_at)}
          {attempt.key_version ? ` · against ${attempt.key_version}` : ""}
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          <StartCalibrationButton slug={slug} variant="link" label="Retake blind" />
        </p>
        {result ? (
          <CalibrationResults
            answers={answers}
            result={result}
            caseKey={caseKey(file)}
            traineeName={attempt.trainee_name}
          />
        ) : (
          <p className="text-sm text-[color:var(--color-brand-warning)]">
            This attempt was submitted but carries no comparison — it predates the current result
            format. Retake it to get one.
          </p>
        )}
      </div>
    );
  }

  if (!isMine) {
    return (
      <div className="flex flex-col gap-6 p-6">
        {header}
        <p className="text-sm text-muted-foreground">
          {attempt.trainee_name ?? "Another trainee"} is still scoring this attempt. It shows up here
          once they submit.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {header}
      <CalibrationWorkbench
        key={attempt.id}
        attemptId={attempt.id}
        materials={materials}
        initialAnswers={answers}
      />
    </div>
  );
}
