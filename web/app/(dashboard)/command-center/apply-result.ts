/**
 * The one shape every proposal applier returns.
 *
 * Four families of proposal land in the same inbox and all four are applied
 * behind the same claim/apply/audit sequence, so they answer the same three
 * questions: did it land, what actually landed, and did anything secondary
 * fail. Sharing the type is what lets `decideProposal` stay one code path
 * instead of four.
 *
 * `warning` is the honest middle ground the accept path needs: the change is
 * committed and must not be reported as a failure, but something after it
 * didn't happen — a position that couldn't be set, an audit note that didn't
 * save. Silence there is how a system starts lying about its own state.
 */

export interface ApplyOutcome {
  ok: true;
  /** What actually landed, when the applier can say more than the summary. */
  detail: string | null;
  /** The change landed, but a follow-up step did not. Never a silent loss. */
  warning: string | null;
  /** Milestone to attribute a client-journey activity entry to, if any. */
  milestoneId: string | null;
}

export type ApplyResult = ApplyOutcome | { ok: false; error: string };

/**
 * What a write that "succeeded" but changed nothing gets reported as.
 *
 * Postgres treats an UPDATE or DELETE filtered out by RLS as a no-op rather
 * than an error: zero rows match and PostgREST answers 2xx. Every mutation in
 * the appliers therefore asks for its rows back with `.select()` and treats an
 * empty result as this failure.
 */
export const NOTHING_SAVED = "Nothing was saved — check workspace access";

export function fail(error: string): ApplyResult {
  return { ok: false, error };
}

export function done(
  detail: string | null = null,
  warning: string | null = null,
  milestoneId: string | null = null,
): ApplyResult {
  return { ok: true, detail, warning, milestoneId };
}
