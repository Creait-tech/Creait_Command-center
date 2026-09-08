import "server-only";

/**
 * The token path of the owner intake — the only part of this application that
 * a person with no account can write to.
 *
 * Everything on this path obeys four rules:
 *
 *  1. The token is a UUID or it is nothing. It is checked against a UUID shape
 *     before it is ever sent to Postgres, so a hand-typed path segment cannot
 *     become a query at all.
 *  2. The row is matched on intake_token AND status = 'intake' AND
 *     intake_submitted_at IS NULL, on every read and again on every write. An
 *     old link is dead the moment the coordinator moves the engagement on,
 *     rotates the token, or the owner presses submit.
 *  3. The service-role client bypasses RLS, so the query itself is the only
 *     scope there is. It selects the handful of columns the form needs and
 *     writes exactly two: `intake`, and `intake_submitted_at` at submit.
 *  4. Nothing about the engagement leaves this module beyond the company name
 *     the owner already knows they are filling this in for. No scores, no
 *     findings, no org, no ids beyond the row's own.
 */

import { createServiceClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isIntakeToken(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/** What the owner's form is allowed to know about the engagement. */
export interface OpenIntake {
  id: string;
  client_name: string;
  company: string | null;
  intake: unknown;
}

/**
 * The one lookup. Returns null for a token that is malformed, unknown,
 * already submitted, or belongs to an engagement that has moved past intake —
 * all four are the same answer to the visitor ("this link is closed"), because
 * distinguishing them would turn the page into an oracle.
 */
export async function findOpenIntake(
  token: unknown
): Promise<OpenIntake | null> {
  if (!isIntakeToken(token)) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("cc_assessments")
    .select("id, client_name, company, intake")
    .eq("intake_token", token.trim())
    .eq("status", "intake")
    .is("intake_submitted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as OpenIntake;
  return {
    id: row.id,
    client_name: row.client_name,
    company: row.company,
    intake: row.intake,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Courtesy rate limit
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_MS = 60_000;
const MAX_WRITES_PER_WINDOW = 60;

/**
 * Sixty writes a minute per token, in memory.
 *
 * A courtesy guard, not a security control: this process is one of several on
 * Vercel and the map dies with it. It exists so an autosaving form with a
 * stuck keystroke cannot hammer the database, and it is deliberately generous
 * — a fast typist moving through a table fires a handful of writes a minute.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function intakeWriteAllowed(token: string): boolean {
  const now = Date.now();
  // Sweep expired entries so an abandoned link cannot hold a slot forever.
  if (hits.size > 500) {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }
  const entry = hits.get(token);
  if (!entry || entry.resetAt <= now) {
    hits.set(token, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_WRITES_PER_WINDOW) return false;
  entry.count += 1;
  return true;
}
