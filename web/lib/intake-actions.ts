"use server";

/**
 * The owner intake's only write path, and the only server action in this
 * application that an anonymous visitor may call.
 *
 * It is deliberately tiny. It cannot create a row, cannot address a row by id,
 * cannot move a status, and cannot write any column but `intake` and (once)
 * `intake_submitted_at`. Every call re-validates the token and the status
 * against the database — a form left open in a tab for a week is refused the
 * moment the coordinator moves the engagement on, rather than writing into a
 * scoring engagement's intake.
 */

import {
  INTAKE_QUESTIONS_BY_ID,
  isClearedAnswer,
  missingRequired,
  parseIntake,
  sanitizeIntakePatch,
  type IntakeAnswers,
} from "@/lib/assessment-intake";
import {
  findOpenIntake,
  intakeWriteAllowed,
  isIntakeToken,
} from "@/lib/intake-server";
import { createServiceClient } from "@/lib/supabase/server";

export type IntakeActionResult =
  | { ok: true; submitted: boolean }
  | { ok: false; error: string; closed?: boolean };

/** The same sentence for every dead-link case — see findOpenIntake. */
const CLOSED =
  "This link is closed. Your advisor can send you a fresh one if you still need to finish.";

/**
 * Merge one patch of answers into the stored intake and save it.
 *
 * `submit` is the owner pressing the button at the end: it writes
 * intake_submitted_at in the same statement, which closes the link for good —
 * the next call finds no open row and says so.
 */
export async function saveIntakeAnswers(
  token: string,
  patch: unknown,
  submit = false
): Promise<IntakeActionResult> {
  if (!isIntakeToken(token)) return { ok: false, error: CLOSED, closed: true };
  const trimmed = token.trim();

  if (!intakeWriteAllowed(trimmed)) {
    return {
      ok: false,
      error: "That saved a lot of times in one minute — give it a moment.",
    };
  }

  const open = await findOpenIntake(trimmed);
  if (!open) return { ok: false, error: CLOSED, closed: true };

  // Only ids this instrument knows, only shapes those questions accept. The
  // patch arrived from the open internet; nothing else about it is trusted.
  const incoming = sanitizeIntakePatch(patch);
  const stored = parseIntake(open.intake);
  const merged: IntakeAnswers = { ...stored };
  let touched = 0;
  for (const [id, value] of Object.entries(incoming)) {
    if (!INTAKE_QUESTIONS_BY_ID[id]) continue;
    // An emptied table or multi arrives as `[]` — the owner deleted the last
    // row, which is a clear, not an answer worth storing.
    if (isClearedAnswer(value)) delete merged[id as keyof IntakeAnswers];
    else merged[id as keyof IntakeAnswers] = value;
    touched += 1;
  }

  // A patch that clears an answer arrives as an id with an empty value, which
  // sanitize drops — so an explicit clear list rides alongside it.
  for (const id of clearedIds(patch)) {
    if (!INTAKE_QUESTIONS_BY_ID[id]) continue;
    delete merged[id as keyof IntakeAnswers];
    touched += 1;
  }

  if (touched === 0 && !submit) return { ok: true, submitted: false };

  if (submit) {
    const missing = missingRequired(merged);
    if (missing.length > 0) {
      const labels = missing
        .map((id) => INTAKE_QUESTIONS_BY_ID[id]?.prompt ?? id)
        .join(" · ");
      return {
        ok: false,
        error: `A few answers are still needed before you can send this: ${labels}`,
      };
    }
  }

  const update: Record<string, unknown> = {
    intake: merged,
    updated_at: new Date().toISOString(),
  };
  if (submit) update.intake_submitted_at = new Date().toISOString();

  const supabase = createServiceClient();
  // The write repeats every condition the read used. Service role bypasses
  // RLS, so these predicates ARE the authorisation — and the .select("id") is
  // what turns a zero-row update into a reported failure instead of a silent
  // success (see CLAUDE.md).
  const { data, error } = await supabase
    .from("cc_assessments")
    .update(update)
    .eq("id", open.id)
    .eq("intake_token", trimmed)
    .eq("status", "intake")
    .is("intake_submitted_at", null)
    .select("id");

  if (error) {
    return { ok: false, error: "That didn't save. Try once more." };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: CLOSED, closed: true };
  }

  return { ok: true, submitted: submit };
}

/**
 * The ids the client explicitly cleared, carried on the patch as
 * `{ __cleared: ["q12", …] }`. Kept out of the answer map so a cleared answer
 * can never be confused with an empty one that simply failed validation.
 */
function clearedIds(patch: unknown): string[] {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return [];
  const raw = (patch as Record<string, unknown>).__cleared;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}
