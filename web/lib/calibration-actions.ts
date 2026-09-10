"use server";

/**
 * Server actions for calibration attempts (migration 0015).
 *
 * The key stays on the server: the browser receives caseMaterials() while an
 * attempt is open, and the key only travels with a submitted attempt's
 * result. An attempt belongs to the trainee who started it — teammates can
 * read it (calibration is a team record) but not write it.
 */

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { displayNameOf } from "@/lib/display-name";
import type { ActionResult } from "@/lib/assessment-actions";
import {
  compareToKey,
  keyVersionOf,
  parseAnswers,
  unresolved,
  type CalibrationAnswers,
  type CalibrationResult,
} from "@/lib/calibration";
import { CALIBRATION_CASE_FILES } from "@/lib/calibration-cases";
import type { CcAssessmentCalibration, Json } from "@/lib/supabase/types";

async function requireUser(): Promise<
  { orgId: string; userId: string } | { error: string }
> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  return { orgId: await getActiveOrgId(), userId };
}

function revalidate(slug?: string) {
  revalidatePath("/assessments/calibration");
  if (slug) revalidatePath(`/assessments/calibration/${slug}`);
}

/**
 * Open an attempt at a case: the trainee's in-progress attempt if one exists,
 * otherwise a fresh row. Never reopens a submitted attempt — a retake is a
 * new row, so the first blind result is never overwritten.
 */
export async function startCalibration(
  slug: string
): Promise<ActionResult<{ attemptId: string }>> {
  const ctx = await requireUser();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const file = CALIBRATION_CASE_FILES[slug];
  if (!file) return { ok: false, error: "That calibration case doesn't exist." };

  const supabase = await createClient();
  const { data: open, error: readError } = await supabase
    .from("cc_assessment_calibrations")
    .select("id")
    .eq("org_id", ctx.orgId)
    .eq("trainee_id", ctx.userId)
    .eq("case_slug", slug)
    .is("submitted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (open) return { ok: true, data: { attemptId: (open as { id: string }).id } };

  const user = await currentUser();
  const { data, error } = await supabase
    .from("cc_assessment_calibrations")
    .insert({
      org_id: ctx.orgId,
      case_slug: slug,
      key_version: keyVersionOf(file),
      trainee_id: ctx.userId,
      trainee_name: displayNameOf(user),
      answers: {} as Json,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidate(slug);
  return { ok: true, data: { attemptId: (data as { id: string }).id } };
}

/** Autosave. Whole-object write: the answers are a few kilobytes at most. */
export async function saveCalibrationAnswers(
  attemptId: string,
  answers: CalibrationAnswers
): Promise<ActionResult> {
  const ctx = await requireUser();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const clean = parseAnswers(answers);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cc_assessment_calibrations")
    .update({
      answers: clean as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .eq("org_id", ctx.orgId)
    .eq("trainee_id", ctx.userId)
    .is("submitted_at", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  // Under RLS a refused update reports success with no rows.
  if (!data || data.length === 0) {
    return {
      ok: false,
      error:
        "That attempt didn't save — it may already be submitted, or it isn't yours.",
    };
  }
  return { ok: true };
}

/**
 * Freeze the answers and compare them to the key. Refuses while any indicator
 * is still open; a missing note is not refused, it fails the pass rule, so
 * the trainee sees exactly which rule they missed.
 */
export async function submitCalibration(
  attemptId: string,
  answers: CalibrationAnswers
): Promise<ActionResult<{ result: CalibrationResult }>> {
  const ctx = await requireUser();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("cc_assessment_calibrations")
    .select("*")
    .eq("id", attemptId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!row) return { ok: false, error: "Attempt not found" };
  const attempt = row as CcAssessmentCalibration;
  if (attempt.trainee_id !== ctx.userId) {
    return { ok: false, error: "Only the trainee can submit their own attempt." };
  }
  if (attempt.submitted_at) {
    return { ok: false, error: "This attempt is already submitted." };
  }
  const file = CALIBRATION_CASE_FILES[attempt.case_slug];
  if (!file) return { ok: false, error: "That calibration case no longer exists." };

  const clean = parseAnswers(answers);
  const open = unresolved(clean);
  if (open.length > 0) {
    return {
      ok: false,
      error: `Score every indicator before submitting — ${open.length} still open (${open.slice(0, 6).join(", ")}${open.length > 6 ? "…" : ""}).`,
    };
  }

  const result = compareToKey(clean, file.scores);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("cc_assessment_calibrations")
    .update({
      answers: clean as unknown as Json,
      result: result as unknown as Json,
      key_version: keyVersionOf(file),
      submitted_at: now,
      updated_at: now,
    })
    .eq("id", attemptId)
    .eq("org_id", ctx.orgId)
    .eq("trainee_id", ctx.userId)
    .is("submitted_at", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "The attempt didn't submit — reload and try again." };
  }
  revalidate(attempt.case_slug);
  return { ok: true, data: { result } };
}

/** Throw away an in-progress attempt. Submitted attempts are history and stay. */
export async function discardCalibration(
  attemptId: string
): Promise<ActionResult> {
  const ctx = await requireUser();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cc_assessment_calibrations")
    .delete()
    .eq("id", attemptId)
    .eq("org_id", ctx.orgId)
    .eq("trainee_id", ctx.userId)
    .is("submitted_at", null)
    .select("case_slug");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Nothing was discarded — the attempt may be submitted already." };
  }
  revalidate((data[0] as { case_slug: string }).case_slug);
  return { ok: true };
}
