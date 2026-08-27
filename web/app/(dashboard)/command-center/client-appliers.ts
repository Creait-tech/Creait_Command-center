import "server-only";

/**
 * Turning an accepted **client** proposal into the change it describes — the
 * original propose-then-confirm path, unchanged by the widening of
 * `cc_agent_proposals` to carry configuration.
 *
 * `mark_done` / `reopen` write `cc_client_journey` through the **same upsert as
 * a human tick** in `app/(dashboard)/journey/actions.ts#setDeliverableDone`:
 * same table, same `(client_id, deliverable_id)` conflict target, same column
 * set, same `.select().single()` proof-of-write. The only difference is the
 * attribution triple — `agent` / `Hermes` instead of the signed-in teammate —
 * which is exactly what the propose-then-confirm model is meant to record. The
 * resulting row is otherwise indistinguishable from a manual tick, so
 * `/journey`, the roll-up and any milestone maths all read it identically.
 *
 * This is verified behaviour and it is deliberately left alone: the file exists
 * to keep it that way while the configuration appliers evolve next door.
 */

import type { createClient } from "@/lib/supabase/server";
import {
  proposedNote,
  proposedStatus,
} from "@/components/proposals/proposal-copy";
import { applyClientRecordUpdate } from "./config-appliers";
import { NOTHING_SAVED, done, fail, type ApplyResult } from "./apply-result";
import type {
  AgentProposal,
} from "@/components/proposals/proposal-payload";
import type {
  ActorType,
  CcClientStatus,
  JourneyDeliverable,
} from "@/lib/supabase/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Hermes owns the *work* recorded on the journey row; the human owns the
 * *decision* recorded on the proposal and in the activity feed. Keeping those
 * two attributions separate is the whole point of propose-then-confirm.
 */
export const AGENT_DISPLAY_NAME = "Hermes";

/** Matches `MAX_NOTE_LENGTH` in the journey module's `addClientNote`. */
const MAX_NOTE_LENGTH = 2000;

const CLIENT_STATUSES: readonly CcClientStatus[] = [
  "lead",
  "onboarding",
  "active",
  "paused",
  "churned",
  "complete",
];

/**
 * Resolve a deliverable's parent milestone and prove this org owns it.
 * `journey_deliverables` carries no `org_id` — ownership is inherited through
 * the milestone, exactly as the journey module resolves it.
 */
export async function resolveOwnedDeliverable(
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

/** Apply a client **delivery** proposal — the original path, unchanged. */
export async function applyClientJourneyProposal(
  supabase: Supabase,
  orgId: string,
  proposal: AgentProposal,
  clientId: string,
): Promise<ApplyResult> {
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
        return fail("This proposal names no deliverable to change");
      }
      const owned = await resolveOwnedDeliverable(
        supabase,
        proposal.deliverable_id,
        orgId,
      );
      if ("error" in owned) return fail(owned.error);

      const isDone = proposal.action === "mark_done";
      const { data, error } = await supabase
        .from("cc_client_journey")
        .upsert(
          {
            org_id: orgId,
            client_id: clientId,
            deliverable_id: proposal.deliverable_id,
            milestone_id: owned.milestoneId,
            done: isDone,
            completed_at: isDone ? now : null,
            ...attribution,
          },
          { onConflict: "client_id,deliverable_id" },
        )
        .select("*")
        .single();

      // The returned row is the only proof the write happened — an
      // RLS-rejected UPDATE reports success against zero rows.
      if (error || !data) return fail(error?.message ?? NOTHING_SAVED);
      return done(null, null, owned.milestoneId);
    }

    case "add_note": {
      const note = proposedNote(proposal.payload) ?? proposal.rationale?.trim() ?? null;
      if (!note) return fail("This proposal carries no note text to save");

      // A client-scoped note lives only in the activity feed; the
      // `proposal_accepted` entry written by the caller carries the text.
      if (!proposal.deliverable_id) return done();

      const owned = await resolveOwnedDeliverable(
        supabase,
        proposal.deliverable_id,
        orgId,
      );
      if ("error" in owned) return fail(owned.error);

      // Only the note columns are sent, so an existing row keeps its `done`
      // and `completed_at`; a fresh row falls back to the `done = false`
      // default. Mirrors `addClientNote` in the journey module.
      const { data, error } = await supabase
        .from("cc_client_journey")
        .upsert(
          {
            org_id: orgId,
            client_id: clientId,
            deliverable_id: proposal.deliverable_id,
            milestone_id: owned.milestoneId,
            notes: note.slice(0, MAX_NOTE_LENGTH),
            ...attribution,
          },
          { onConflict: "client_id,deliverable_id" },
        )
        .select("*")
        .single();

      if (error || !data) return fail(error?.message ?? NOTHING_SAVED);
      return done(null, null, owned.milestoneId);
    }

    default:
      return fail(
        `“${proposal.action}” isn't something that can be done to a client's journey`,
      );
  }
}

/**
 * Apply a **client record** proposal.
 *
 * Two shapes reach here. `change_status` is the original single-column move
 * filed by `cc_propose_client_journey_change`, kept exactly as it was.
 * `update` is the newer multi-field edit filed by `cc_propose_client_change`,
 * which goes through the shared applier next door.
 */
export async function applyClientRecordProposal(
  supabase: Supabase,
  orgId: string,
  proposal: AgentProposal,
  clientId: string,
): Promise<ApplyResult> {
  if (proposal.action === "change_status") {
    const requested = proposedStatus(proposal.payload);
    if (!requested) return fail("This proposal names no status to move to");
    if (!CLIENT_STATUSES.includes(requested as CcClientStatus)) {
      return fail(`“${requested}” is not a valid client status`);
    }

    const { data, error } = await supabase
      .from("cc_clients")
      .update({
        status: requested as CcClientStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId)
      .eq("org_id", orgId)
      .select("id");

    if (error) return fail(error.message);
    if (!data || data.length === 0) return fail(NOTHING_SAVED);
    return done();
  }

  if (proposal.action === "update") {
    return applyClientRecordUpdate(supabase, orgId, proposal);
  }

  return fail(
    `“${proposal.action}” isn't something that can be done to a client record`,
  );
}
