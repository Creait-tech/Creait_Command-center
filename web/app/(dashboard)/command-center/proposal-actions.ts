"use server";

/**
 * Server actions for the Hermes proposals inbox.
 *
 * Hermes proposes, humans confirm. Accepting a proposal is not one write —
 * it is a claim, an effect, and an audit entry — so it runs here rather than
 * from the browser for three reasons:
 *
 *  1. **The decider's identity must not be caller-supplied.** `decided_by`
 *     and `decided_by_name` come from the Clerk session and `team_members`,
 *     never from the client. A name the browser can choose is not an audit
 *     trail. (Same reasoning as `app/(dashboard)/journey/actions.ts`.)
 *  2. **The proposal has to be claimed before it is applied.** Two people
 *     looking at the same inbox must not both apply the same change.
 *  3. **A failed effect has to un-claim the proposal**, so the inbox never
 *     shows "accepted" for something that never happened.
 *
 * The RLS trap this project has hit twice: a rejected INSERT throws, but a
 * rejected UPDATE matches zero rows and reports success. Every UPDATE below
 * therefore ends in `.select()` and treats an empty result as a hard failure.
 */

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import {
  describeProposalChange,
  proposedNote,
  proposedStatus,
} from "@/components/proposals/proposal-copy";
import type {
  ActorType,
  CcAgentProposal,
  CcClientStatus,
  ClientActivityKind,
  JourneyDeliverable,
  ProposalStatus,
} from "@/lib/supabase/types";

export type ProposalActionResult =
  | {
      ok: true;
      /** What changed, for the confirmation toast. */
      summary: string;
      /** Set when the change landed but the audit entry did not. */
      warning: string | null;
    }
  | { ok: false; error: string };

/**
 * Hermes owns the *work* recorded on the journey row; the human owns the
 * *decision* recorded on the proposal and in the activity feed. Keeping those
 * two attributions separate is the whole point of propose-then-confirm.
 */
const AGENT_DISPLAY_NAME = "Hermes";

const MAX_REASON_LENGTH = 2000;

const CLIENT_STATUSES: readonly CcClientStatus[] = [
  "lead",
  "onboarding",
  "active",
  "paused",
  "churned",
  "complete",
];

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface Decider {
  id: string;
  name: string;
}

async function requireCtx(): Promise<
  { orgId: string; userId: string } | { error: string }
> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  return { orgId: await getActiveOrgId(), userId };
}

/**
 * Display name for the teammate making the call. `team_members` wins so the
 * feed reads "Jaylyn Maddox", matching the rest of the Command Center; Clerk's
 * profile is the fallback for anyone not yet linked by `clerk_user_id`.
 */
async function resolveDecider(
  supabase: Supabase,
  orgId: string,
  userId: string,
): Promise<Decider> {
  const { data } = await supabase
    .from("team_members")
    .select("full_name")
    .eq("org_id", orgId)
    .eq("clerk_user_id", userId)
    .maybeSingle();

  const teamName = (data as { full_name: string } | null)?.full_name?.trim();
  if (teamName) return { id: userId, name: teamName };

  const user = await currentUser();
  const clerkName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.trim() ||
    null;

  return { id: userId, name: clerkName ?? "Teammate" };
}

/**
 * Resolve a deliverable's parent milestone and prove this org owns it.
 * `journey_deliverables` carries no `org_id` — ownership is inherited through
 * the milestone, exactly as the journey module resolves it.
 */
async function resolveOwnedDeliverable(
  supabase: Supabase,
  deliverableId: string,
  orgId: string,
): Promise<{ milestoneId: string } | { error: string }> {
  const { data: deliverable } = await supabase
    .from("journey_deliverables")
    .select("id, milestone_id")
    .eq("id", deliverableId)
    .maybeSingle();

  if (!deliverable) return { error: "That deliverable no longer exists" };

  const milestoneId = (
    deliverable as Pick<JourneyDeliverable, "id" | "milestone_id">
  ).milestone_id;

  const { data: milestone } = await supabase
    .from("journey_milestones")
    .select("id")
    .eq("id", milestoneId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!milestone) return { error: "That deliverable is not in this workspace" };
  return { milestoneId };
}

/** Title of one deliverable, or null when it no longer exists. */
async function deliverableTitle(
  supabase: Supabase,
  deliverableId: string | null,
): Promise<string | null> {
  if (!deliverableId) return null;
  const { data } = await supabase
    .from("journey_deliverables")
    .select("title")
    .eq("id", deliverableId)
    .maybeSingle();
  return (data as { title: string } | null)?.title ?? null;
}

/** Append one entry to the shared client activity log. Never throws. */
async function logActivity(
  supabase: Supabase,
  input: {
    orgId: string;
    clientId: string;
    actorType: ActorType;
    actorId: string | null;
    actorName: string;
    kind: ClientActivityKind;
    body: string | null;
    deliverableId: string | null;
    milestoneId: string | null;
  },
): Promise<string | null> {
  const { error } = await supabase.from("cc_client_activity").insert({
    org_id: input.orgId,
    client_id: input.clientId,
    actor_type: input.actorType,
    actor_id: input.actorId,
    actor_name: input.actorName,
    kind: input.kind,
    body: input.body,
    deliverable_id: input.deliverableId,
    milestone_id: input.milestoneId,
  });
  return error?.message ?? null;
}

/** Put a claimed proposal back in the inbox after its effect failed. */
async function releaseClaim(
  supabase: Supabase,
  proposalId: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("cc_agent_proposals")
    .update({
      status: "pending" satisfies ProposalStatus,
      decided_by: null,
      decided_by_name: null,
      decided_at: null,
    })
    .eq("id", proposalId)
    .eq("org_id", orgId)
    .select("id");

  return (data?.length ?? 0) > 0;
}

/**
 * Apply what the proposal asks for.
 *
 * `mark_done` / `reopen` write `cc_client_journey` through the **same upsert
 * as a human tick** in `app/(dashboard)/journey/actions.ts#setDeliverableDone`:
 * same table, same `(client_id, deliverable_id)` conflict target, same column
 * set, same `.select().single()` proof-of-write. The only difference is the
 * attribution triple — `agent` / `Hermes` instead of the signed-in teammate —
 * which is exactly what the propose-then-confirm model is meant to record.
 * The resulting row is otherwise indistinguishable from a manual tick, so
 * `/journey`, the roll-up and any milestone maths all read it identically.
 */
async function applyProposal(
  supabase: Supabase,
  orgId: string,
  proposal: CcAgentProposal,
): Promise<{ ok: true; milestoneId: string | null } | { ok: false; error: string }> {
  // Ownership of the client is checked explicitly rather than relying on RLS
  // alone, so a cross-org id can't slip through if a policy is ever relaxed.
  const { data: client } = await supabase
    .from("cc_clients")
    .select("id")
    .eq("id", proposal.client_id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!client) return { ok: false, error: "Client not found in this workspace" };

  const now = new Date().toISOString();
  const attribution = {
    updated_at: now,
    updated_by: proposal.proposed_by,
    updated_by_name: AGENT_DISPLAY_NAME,
    // `as const` keeps the literal type: `satisfies` alone still widens the
    // property to `string`, which no longer matches the ActorType column.
    updated_by_type: "agent" as const satisfies ActorType,
  };

  switch (proposal.action) {
    case "mark_done":
    case "reopen": {
      if (!proposal.deliverable_id) {
        return { ok: false, error: "This proposal names no deliverable to change" };
      }
      const owned = await resolveOwnedDeliverable(
        supabase,
        proposal.deliverable_id,
        orgId,
      );
      if ("error" in owned) return { ok: false, error: owned.error };

      const done = proposal.action === "mark_done";
      const { data, error } = await supabase
        .from("cc_client_journey")
        .upsert(
          {
            org_id: orgId,
            client_id: proposal.client_id,
            deliverable_id: proposal.deliverable_id,
            milestone_id: owned.milestoneId,
            done,
            completed_at: done ? now : null,
            ...attribution,
          },
          { onConflict: "client_id,deliverable_id" },
        )
        .select("*")
        .single();

      // The returned row is the only proof the write happened — an
      // RLS-rejected UPDATE reports success against zero rows.
      if (error || !data) {
        return {
          ok: false,
          error: error?.message ?? "Nothing was saved — check workspace access",
        };
      }
      return { ok: true, milestoneId: owned.milestoneId };
    }

    case "add_note": {
      const note = proposedNote(proposal.payload) ?? proposal.rationale?.trim() ?? null;
      if (!note) {
        return { ok: false, error: "This proposal carries no note text to save" };
      }

      // A client-scoped note lives only in the activity feed; the
      // `proposal_accepted` entry written by the caller carries the text.
      if (!proposal.deliverable_id) return { ok: true, milestoneId: null };

      const owned = await resolveOwnedDeliverable(
        supabase,
        proposal.deliverable_id,
        orgId,
      );
      if ("error" in owned) return { ok: false, error: owned.error };

      // Only the note columns are sent, so an existing row keeps its `done`
      // and `completed_at`; a fresh row falls back to the `done = false`
      // default. Mirrors `addClientNote` in the journey module.
      const { data, error } = await supabase
        .from("cc_client_journey")
        .upsert(
          {
            org_id: orgId,
            client_id: proposal.client_id,
            deliverable_id: proposal.deliverable_id,
            milestone_id: owned.milestoneId,
            notes: note.slice(0, MAX_REASON_LENGTH),
            ...attribution,
          },
          { onConflict: "client_id,deliverable_id" },
        )
        .select("*")
        .single();

      if (error || !data) {
        return {
          ok: false,
          error: error?.message ?? "Nothing was saved — check workspace access",
        };
      }
      return { ok: true, milestoneId: owned.milestoneId };
    }

    case "change_status": {
      const requested = proposedStatus(proposal.payload);
      if (!requested) {
        return { ok: false, error: "This proposal names no status to move to" };
      }
      if (!CLIENT_STATUSES.includes(requested as CcClientStatus)) {
        return { ok: false, error: `“${requested}” is not a valid client status` };
      }

      const { data, error } = await supabase
        .from("cc_clients")
        .update({ status: requested as CcClientStatus, updated_at: now })
        .eq("id", proposal.client_id)
        .eq("org_id", orgId)
        .select("id");

      if (error) return { ok: false, error: error.message };
      if (!data || data.length === 0) {
        return { ok: false, error: "Nothing was saved — check workspace access" };
      }
      return { ok: true, milestoneId: null };
    }
  }
}

/**
 * Accept or reject one pending proposal.
 *
 * Ordering is deliberate: **claim first, apply second.** Claiming with a
 * `status = 'pending'` predicate makes the decision atomic — a second person
 * clicking Accept on the same row updates zero rows and is told so, instead of
 * applying the change twice. If the effect then fails, the claim is released
 * and the proposal returns to the inbox. The caller is never told a change
 * landed unless a row came back to prove it.
 */
export async function decideProposal(input: {
  proposalId: string;
  decision: Extract<ProposalStatus, "accepted" | "rejected">;
  reason?: string | null;
}): Promise<ProposalActionResult> {
  const ctx = await requireCtx();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { proposalId, decision } = input;
  if (!proposalId) return { ok: false, error: "Proposal is required" };
  if (decision !== "accepted" && decision !== "rejected") {
    return { ok: false, error: "Unknown decision" };
  }

  const reason = (input.reason ?? "").trim().slice(0, MAX_REASON_LENGTH) || null;

  const supabase = await createClient();

  const { data: found, error: readError } = await supabase
    .from("cc_agent_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!found) {
    return { ok: false, error: "That proposal isn't in this workspace any more" };
  }

  const proposal = found as CcAgentProposal;
  if (proposal.status !== "pending") {
    return {
      ok: false,
      error: `Already ${proposal.status}${
        proposal.decided_by_name ? ` by ${proposal.decided_by_name}` : ""
      } — nothing was changed`,
    };
  }

  const decider = await resolveDecider(supabase, ctx.orgId, ctx.userId);
  const decidedAt = new Date().toISOString();

  // ── 1. Claim ──────────────────────────────────────────────────────────────
  const { data: claimed, error: claimError } = await supabase
    .from("cc_agent_proposals")
    .update({
      status: decision,
      decided_by: decider.id,
      decided_by_name: decider.name,
      decided_at: decidedAt,
    })
    .eq("id", proposalId)
    .eq("org_id", ctx.orgId)
    .eq("status", "pending")
    .select("id");

  if (claimError) return { ok: false, error: claimError.message };
  if (!claimed || claimed.length === 0) {
    return {
      ok: false,
      error:
        "Nothing was saved — someone else decided this proposal first, or you don't have access to this workspace",
    };
  }

  // ── 2. Apply (accept only) ────────────────────────────────────────────────
  let milestoneId: string | null = null;

  if (decision === "accepted") {
    const applied = await applyProposal(supabase, ctx.orgId, proposal);
    if (!applied.ok) {
      const released = await releaseClaim(supabase, proposalId, ctx.orgId);
      return {
        ok: false,
        error: released
          ? `${applied.error} — the proposal is still pending`
          : `${applied.error}. The proposal could not be returned to pending either; reopen it in Supabase before retrying`,
      };
    }
    milestoneId = applied.milestoneId;
  }

  // ── 3. Audit ──────────────────────────────────────────────────────────────
  // The activity body names the deliverable, never its uuid — the feed on the
  // Command Center is read by people, not by joins.
  const summary = describeProposalChange({
    action: proposal.action,
    payload: proposal.payload,
    deliverableTitle: await deliverableTitle(supabase, proposal.deliverable_id),
  });

  const body =
    decision === "accepted"
      ? [`${AGENT_DISPLAY_NAME} proposed: ${summary}`, reason]
          .filter(Boolean)
          .join(" — ")
      : reason;

  const activityError = await logActivity(supabase, {
    orgId: ctx.orgId,
    clientId: proposal.client_id,
    actorType: "human",
    actorId: decider.id,
    actorName: decider.name,
    kind:
      decision === "accepted"
        ? ("proposal_accepted" satisfies ClientActivityKind)
        : ("proposal_rejected" satisfies ClientActivityKind),
    body,
    deliverableId: proposal.deliverable_id,
    milestoneId,
  });

  revalidatePath("/command-center");
  revalidatePath("/journey");

  return {
    ok: true,
    summary,
    warning: activityError
      ? `The change was applied, but the activity entry failed to save (${activityError})`
      : null,
  };
}
