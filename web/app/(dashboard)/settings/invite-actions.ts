"use server";

/**
 * Server actions behind the Team panel in Settings.
 *
 * Inviting is an admin action that reaches two external systems (Clerk and
 * Resend) with the org's secret key, so it can only run on the server and only
 * after the caller's role has been checked here — not in the component that
 * renders the button.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

import { getActiveOrgId } from "@/lib/active-org";
import { createServiceClient } from "@/lib/supabase/server";
import {
  inviteTeammate,
  type InviteResult,
  type InviteRole,
} from "@/lib/team-invites";
import type { TeamMember } from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Only an org admin may invite. Clerk's session claim is the authority — a
 * `team_members.role` of 'admin' is roster metadata anyone with database write
 * access could set, and is not an authorization decision.
 */
async function requireAdmin(): Promise<
  { orgId: string } | { error: string }
> {
  const { userId, orgRole } = await auth();
  if (!userId) return { error: "Not signed in." };
  if (orgRole !== "org:admin") {
    return { error: "Only an organization admin can invite teammates." };
  }
  return { orgId: await getActiveOrgId() };
}

export async function inviteTeammateAction(input: {
  email: string;
  name: string;
  role: InviteRole;
}): Promise<ActionResult<InviteResult>> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const result = await inviteTeammate({
    email: input.email,
    name: input.name,
    role: input.role,
  });
  if (!result.ok) return result;

  revalidatePath("/settings");
  revalidatePath("/team");
  return { ok: true, data: result.data };
}

/** The roster as the Team panel shows it — everyone who isn't offboarded. */
export async function fetchRoster(): Promise<ActionResult<TeamMember[]>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Not signed in." };

  const orgId = await getActiveOrgId();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("org_id", orgId)
    .neq("status", "offboarded")
    .order("status")
    .order("full_name");

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as TeamMember[] };
}
