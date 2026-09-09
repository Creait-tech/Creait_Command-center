/**
 * Stand-in for web/lib/intake-actions.ts in the local harness.
 *
 * Same signature and same result union; the merge/close semantics live in
 * server.js. Only the transport is stubbed — components/intake/intake-form.tsx
 * and lib/assessment-intake.ts are the real files.
 */
export type IntakeActionResult =
  | { ok: true; submitted: boolean }
  | { ok: false; error: string; closed?: boolean };

export async function saveIntakeAnswers(
  token: string,
  patch: unknown,
  submit = false
): Promise<IntakeActionResult> {
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, patch, submit }),
  });
  return (await res.json()) as IntakeActionResult;
}
