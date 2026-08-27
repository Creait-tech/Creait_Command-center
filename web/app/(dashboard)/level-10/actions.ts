"use server";

/**
 * Server actions for the Level 10 weekly scorecard.
 *
 * Weekly entry lives here rather than on the browser client for the same
 * reason To-Dos and the Journey do (`lib/eos-actions.ts`,
 * `app/(dashboard)/journey/actions.ts`): the point of `entered_by` /
 * `entered_by_name` is to answer "who put that number there?" weeks later,
 * and a name the browser supplies is whatever the caller felt like sending —
 * not an audit trail. The actor is resolved here from the Clerk session, and
 * the org id from the session too, never from the client.
 *
 * RLS is unchanged: `createClient()` attaches the same Clerk JWT the browser
 * would, so these actions have no extra privilege. What they add is a
 * trustworthy identity and a place to check the outcome of a write — which
 * matters because a rejected INSERT raises, while a rejected UPDATE matches
 * zero rows and reports success. Every write below reads its row back and
 * treats an empty result as the failure it is.
 */

import { auth, currentUser } from "@clerk/nextjs/server";

import { getActiveOrgId } from "@/lib/active-org";
import { createClient } from "@/lib/supabase/server";
import {
  asWeeklyRow,
  type CcKpiWeekly,
} from "@/components/level10/weekly-types";
import { isIsoDate, mondayOf } from "@/components/level10/weeks";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface Actor {
  id: string;
  name: string;
}

/**
 * Display name for the signed-in teammate. Mirrors `resolveActor()` in
 * `lib/eos-actions.ts`: the `team_members` row wins because that is the name
 * the rest of the Command Center shows, `display_name` wins inside it because
 * that is the name the person chose, and Clerk is the fallback for anyone not
 * yet linked by `clerk_user_id`.
 */
async function resolveActor(
  supabase: Supabase,
  orgId: string,
  userId: string,
): Promise<Actor> {
  const { data } = await supabase
    .from("team_members")
    .select("full_name, display_name")
    .eq("org_id", orgId)
    .eq("clerk_user_id", userId)
    .maybeSingle();

  const row = data as { full_name: string; display_name: string | null } | null;
  const chosen = row?.display_name?.trim() || row?.full_name?.trim();
  if (chosen) return { id: userId, name: chosen };

  const user = await currentUser();
  const clerkName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.trim() ||
    null;

  return { id: userId, name: clerkName ?? "Teammate" };
}

export interface SaveWeeklyValueInput {
  kpiId: string;
  /** Monday of the week being scored, `YYYY-MM-DD`. */
  weekStart: string;
  /**
   * `null` clears the week back to blank — which is a real state, distinct
   * from a recorded 0. A week with no number is unknown, not a miss.
   */
  value: number | null;
}

/**
 * Record (or correct) one KPI's number for one week.
 *
 * Any week is editable, not just the current one: the whole point of a
 * scorecard the team acts on is that "we said 100, it was closer to 80" can be
 * fixed after the fact. Corrections are logged, not silent — the phase17
 * `cc_kpi_weekly_record` function appends `{from, to, from_source, by,
 * by_name, at}` to the row's `corrections` array under a `FOR UPDATE` row
 * lock, so two founders editing the same cell during a live meeting can't drop
 * one another's entry.
 *
 * Every write here lands as `source = 'manual'`, and the
 * `cc_kpi_weekly_protect_manual` trigger then makes that permanent: a job that
 * tries to turn the row back into a `sync` row leaves the human's value alone.
 * A correction that quietly reverted an hour later would be worse than no
 * correction at all.
 */
export async function saveWeeklyKpiValue(
  input: SaveWeeklyValueInput,
): Promise<ActionResult<CcKpiWeekly>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Not signed in." };

  const kpiId = input.kpiId?.trim();
  if (!kpiId) return { ok: false, error: "Missing KPI." };

  const weekStart = input.weekStart?.trim();
  if (!weekStart || !isIsoDate(weekStart) || mondayOf(weekStart) !== weekStart) {
    return { ok: false, error: "That isn't the start of a week." };
  }

  const value = input.value;
  if (value !== null && !Number.isFinite(value)) {
    return { ok: false, error: "Value must be a number, or blank." };
  }

  const orgId = await getActiveOrgId();
  const supabase = await createClient();

  // Belt and braces alongside RLS: prove the KPI is in this workspace before
  // writing a child row against it, so a stale or foreign id fails loudly here
  // rather than as a confusing constraint error.
  const { data: kpi, error: kpiError } = await supabase
    .from("kpis")
    .select("id")
    .eq("id", kpiId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (kpiError) return { ok: false, error: kpiError.message };
  if (!kpi) {
    return {
      ok: false,
      error:
        "That KPI is no longer on this scorecard, or your session doesn't have permission for it. Try reloading the page.",
    };
  }

  const actor = await resolveActor(supabase, orgId, userId);

  const { data, error } = await supabase.rpc(
    "cc_kpi_weekly_record",
    {
      p_org: orgId,
      p_kpi: kpiId,
      p_week: weekStart,
      p_value: value,
      p_actor: actor.id,
      p_actor_name: actor.name,
    },
  );

  if (error) return { ok: false, error: error.message };

  // The function returns the affected row. An empty set means RLS refused the
  // write — which PostgREST reports as a success. Never tell someone a number
  // saved when it did not.
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) {
    return {
      ok: false,
      error:
        "That number didn't save — your session doesn't have permission for this scorecard. Try reloading the page.",
    };
  }

  return { ok: true, data: asWeeklyRow(rows[0]) };
}
