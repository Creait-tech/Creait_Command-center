"use server";

/**
 * Self-service profile editing.
 *
 * The one rule this module exists to enforce: a member may edit their own
 * roster record and nobody else's. That is why no function here takes a member
 * id. The row is located by `clerk_user_id = <the caller's Clerk user id>`
 * inside the active org, both read from the session on the server. There is no
 * parameter a caller could tamper with to reach a teammate's record, so hiding
 * the button is a courtesy rather than the control.
 *
 * RLS on `team_members` is org-scoped only (`org_isolation`), so it would
 * happily accept one founder editing another's row — the `clerk_user_id`
 * predicate below is what actually narrows it to "yourself". Admin-side editing
 * of anyone's record still lives on the Team page and is unchanged.
 */

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import type { ActionResult, Person } from "@/lib/authorship";

const MAX_DISPLAY_NAME = 80;
const MAX_TITLE = 120;
const MAX_PRONOUNS = 40;

/** What the profile card renders. `member` is null when nothing is linked. */
export interface MyProfile {
  member: Person | null;
  /** Clerk's own name/email, shown when there is no roster record to edit. */
  fallbackName: string | null;
}

function asPerson(row: unknown): Person {
  return row as Person;
}

/** Trim, collapse whitespace, cap length, and treat empty as "unset". */
function clean(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * The caller's own roster record.
 *
 * Returns `member: null` rather than an error when the signed-in user has no
 * `team_members` row — that is a real state (a Clerk login nobody has linked
 * yet), and the card explains it instead of pretending the save failed.
 */
export async function getMyProfile(): Promise<ActionResult<MyProfile>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Not signed in" };

  const orgId = await getActiveOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("org_id", orgId)
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };

  const user = await currentUser();
  const fallbackName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.primaryEmailAddress?.emailAddress?.trim() ||
    null;

  return {
    ok: true,
    data: { member: data ? asPerson(data) : null, fallbackName },
  };
}

/**
 * Update the caller's own display name, title and pronouns.
 *
 * `full_name` is deliberately not editable here: it is the roster identity the
 * Team page and the org chart are keyed on, and changing it is an admin action.
 * `display_name` is the name a person picks for themselves and is what the rest
 * of the app now shows.
 */
export async function updateMyProfile(input: {
  displayName: string | null;
  title: string | null;
  pronouns: string | null;
}): Promise<ActionResult<Person>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Not signed in" };

  const orgId = await getActiveOrgId();
  const supabase = await createClient();

  // A rejected UPDATE matches zero rows and reports success, so the affected
  // row is selected back and an empty result is treated as the failure it is.
  // Here that empty result is also the security outcome: if the predicate
  // below ever failed to match, nothing is written and nothing is claimed.
  const { data, error } = await supabase
    .from("team_members")
    .update({
      display_name: clean(input.displayName, MAX_DISPLAY_NAME),
      title: clean(input.title, MAX_TITLE),
      pronouns: clean(input.pronouns, MAX_PRONOUNS),
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("clerk_user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error:
        "No roster record is linked to your login yet, so there was nothing to save. Ask an admin to link you on the Team page.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/team");
  return { ok: true, data: asPerson(data) };
}
