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
 * This module is the sequence; the writes themselves live in `client-appliers`
 * and `config-appliers`. The RLS trap this project has hit four times — a
 * rejected UPDATE or DELETE matches zero rows and reports success — is handled
 * there, where every mutation ends in `.select()` and treats an empty result as
 * a hard failure.
 *
 * `cc_agent_proposals` now carries **configuration** proposals as well as
 * client-delivery ones, so the applier switches on `target_kind`, never on
 * `action`. `action` overlaps across families now (`update` means three
 * different things depending on the family), and `client_id` is nullable —
 * dereferencing it for a journey-template or KPI proposal is exactly the bug
 * this branch exists to prevent.
 */

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { describeProposalChange } from "@/components/proposals/proposal-copy";
import {
  asAgentProposal,
  isConfigProposal,
  resolveTargetKind,
  resolveTargetTable,
  type AgentProposal,
  type ProposalTargetKind,
} from "@/components/proposals/proposal-payload";
import type {
  LiveImpactReport,
  LiveProposalImpact,
  ProposalAcknowledgement,
} from "@/components/proposals/proposal-impact-types";
import { acknowledgementProblem, readLiveImpact } from "./proposal-impact";
import {
  AGENT_DISPLAY_NAME,
  applyClientJourneyProposal,
  applyClientRecordProposal,
} from "./client-appliers";
import { applyJourneyTemplateProposal, applyKpiProposal } from "./config-appliers";
import { fail, type ApplyResult } from "./apply-result";
import type {
  ActorType,
  ClientActivityKind,
  Json,
  ProposalStatus,
} from "@/lib/supabase/types";

export type ProposalActionResult =
  | {
      ok: true;
      /** What changed, for the confirmation toast. */
      summary: string;
      /** What actually landed, when the applier can say more than the summary. */
      detail: string | null;
      /** Set when the change landed but a follow-up step did not. */
      warning: string | null;
    }
  | { ok: false; error: string };

export type ProposalImpactResult =
  | { ok: true; report: LiveImpactReport }
  | { ok: false; error: string };

const MAX_REASON_LENGTH = 2000;

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

// ─────────────────────────────────────────────────────────────────────────────
// Naming — read before the change, because a delete removes the evidence
// ─────────────────────────────────────────────────────────────────────────────

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

/**
 * The live name of whatever `target_id` points at.
 *
 * Read *before* the change is applied: a delete removes the row, and an audit
 * entry that said "removed a deliverable" without naming which one would be
 * worse than useless.
 */
async function resolveTargetName(
  supabase: Supabase,
  orgId: string,
  proposal: AgentProposal,
): Promise<string | null> {
  const id = proposal.target_id;
  if (!id) return null;

  const named = async (
    table: "journey_milestones" | "kpis" | "cc_clients",
    column: "name",
  ) => {
    const { data } = await supabase
      .from(table)
      .select(column)
      .eq("id", id)
      .eq("org_id", orgId)
      .maybeSingle();
    return (data as { name: string } | null)?.name ?? null;
  };

  switch (resolveTargetTable(proposal)) {
    case "journey_milestones":
      return named("journey_milestones", "name");
    // `journey_deliverables` has no org_id of its own; the title lookup is
    // read-only and the write path re-proves ownership through the milestone.
    case "journey_deliverables":
      return deliverableTitle(supabase, id);
    case "kpis":
      return named("kpis", "name");
    case "cc_clients":
      return named("cc_clients", "name");
    // `cc_client_journey` target ids name a progress row, which has no name of
    // its own — the deliverable it points at is what a human recognises.
    default:
      return null;
  }
}

/** Client name for a client-scoped proposal, for the summary sentence. */
async function clientName(
  supabase: Supabase,
  orgId: string,
  clientId: string | null,
): Promise<string | null> {
  if (!clientId) return null;
  const { data } = await supabase
    .from("cc_clients")
    .select("name")
    .eq("id", clientId)
    .eq("org_id", orgId)
    .maybeSingle();
  return (data as { name: string } | null)?.name ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit
// ─────────────────────────────────────────────────────────────────────────────

/** Append one entry to the shared client activity log. Never throws. */
async function logActivity(
  supabase: Supabase,
  input: {
    orgId: string;
    clientId: string;
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
    actor_type: "human" satisfies ActorType,
    actor_id: input.actorId,
    actor_name: input.actorName,
    kind: input.kind,
    body: input.body,
    deliverable_id: input.deliverableId,
    milestone_id: input.milestoneId,
  });
  return error?.message ?? null;
}

/**
 * Where a configuration decision is recorded, since the activity feed can't
 * take it.
 *
 * `cc_client_activity.client_id` is **NOT NULL** — verified against the running
 * database, not assumed. A journey-template or KPI proposal has no client by
 * construction (the CHECK constraint requires `client_id IS NULL` for those
 * families), so there is no honest value to put in that column: inventing one
 * would file org-wide configuration under some unrelated client's timeline,
 * where it would be read as something that happened to *them*.
 *
 * So the activity row is skipped and the decision is written onto the proposal
 * itself instead. The row already carries `status`, `decided_by`,
 * `decided_by_name` and `decided_at`; this adds the operator's reason and what
 * actually landed, so nothing is lost by the skip. Best-effort, like the
 * activity insert: the change has already been applied, and failing the whole
 * action here would tell the caller a landed change did not land.
 */
async function recordConfigDecision(
  supabase: Supabase,
  orgId: string,
  proposal: AgentProposal,
  entry: {
    decision: ProposalStatus;
    decidedBy: string;
    decidedByName: string;
    decidedAt: string;
    reason: string | null;
    summary: string;
    applied: string | null;
  },
): Promise<string | null> {
  const base =
    proposal.payload &&
    typeof proposal.payload === "object" &&
    !Array.isArray(proposal.payload)
      ? (proposal.payload as Record<string, Json | undefined>)
      : {};

  const { data, error } = await supabase
    .from("cc_agent_proposals")
    .update({
      payload: {
        ...base,
        decision: {
          status: entry.decision,
          decided_by: entry.decidedBy,
          decided_by_name: entry.decidedByName,
          decided_at: entry.decidedAt,
          reason: entry.reason,
          summary: entry.summary,
          applied: entry.applied,
        },
      },
    })
    .eq("id", proposal.id)
    .eq("org_id", orgId)
    .select("id");

  if (error) return error.message;
  if (((data as { id: string }[] | null) ?? []).length === 0) {
    return "the decision note could not be written to the proposal";
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Claim / apply
// ─────────────────────────────────────────────────────────────────────────────

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
 * Apply what the proposal asks for, chosen by **family, not by action**.
 *
 * A configuration proposal has `client_id IS NULL` by database constraint, so
 * the client-ownership check below is reached only for the two families that
 * actually name a client. The previous version dereferenced `client_id`
 * unconditionally and would have failed every config proposal at
 * "Client not found".
 */
async function applyProposal(
  supabase: Supabase,
  orgId: string,
  proposal: AgentProposal,
  kind: ProposalTargetKind,
  live: LiveProposalImpact,
): Promise<ApplyResult> {
  if (kind === "journey_template") {
    return applyJourneyTemplateProposal(supabase, proposal, live);
  }
  if (kind === "kpi") {
    return applyKpiProposal(supabase, orgId, proposal);
  }

  if (!proposal.client_id) {
    return fail("This proposal names a client change but carries no client");
  }

  // Ownership of the client is checked explicitly rather than relying on RLS
  // alone, so a cross-org id can't slip through if a policy is ever relaxed.
  const { data: client } = await supabase
    .from("cc_clients")
    .select("id")
    .eq("id", proposal.client_id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!client) return fail("Client not found in this workspace");

  return kind === "client_record"
    ? applyClientRecordProposal(supabase, orgId, proposal, proposal.client_id)
    : applyClientJourneyProposal(supabase, orgId, proposal, proposal.client_id);
}

/** Read one pending-or-decided proposal this org owns. */
async function loadProposal(
  supabase: Supabase,
  orgId: string,
  proposalId: string,
): Promise<{ proposal: AgentProposal } | { error: string }> {
  const { data, error } = await supabase
    .from("cc_agent_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "That proposal isn't in this workspace any more" };
  return { proposal: asAgentProposal(data) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What accepting this proposal would destroy, read fresh from the database.
 *
 * Called when the confirmation opens, so the operator sees today's numbers
 * rather than the ones Hermes recorded when it filed. `decideProposal` reads
 * them again at accept time and refuses an acknowledgement that no longer
 * matches — a teammate can change something between the two.
 */
export async function fetchProposalImpact(
  proposalId: string,
): Promise<ProposalImpactResult> {
  const ctx = await requireCtx();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!proposalId) return { ok: false, error: "Proposal is required" };

  const supabase = await createClient();
  const found = await loadProposal(supabase, ctx.orgId, proposalId);
  if ("error" in found) return { ok: false, error: found.error };

  return readLiveImpact(supabase, ctx.orgId, found.proposal);
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
 *
 * The destructive-impact re-read happens **before** the claim, so a refusal
 * for a stale acknowledgement leaves the proposal untouched and still pending —
 * there is nothing to release.
 */
export async function decideProposal(input: {
  proposalId: string;
  decision: Extract<ProposalStatus, "accepted" | "rejected">;
  reason?: string | null;
  /** What the operator confirmed they were about to destroy. */
  acknowledged?: ProposalAcknowledgement | null;
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

  const found = await loadProposal(supabase, ctx.orgId, proposalId);
  if ("error" in found) return { ok: false, error: found.error };

  const proposal = found.proposal;
  if (proposal.status !== "pending") {
    return {
      ok: false,
      error: `Already ${proposal.status}${
        proposal.decided_by_name ? ` by ${proposal.decided_by_name}` : ""
      } — nothing was changed`,
    };
  }

  const kind = resolveTargetKind(proposal);
  if (!kind) {
    return {
      ok: false,
      error:
        `This proposal is filed against “${String(proposal.target_kind)}”, which this ` +
        "inbox doesn't know how to apply. Nothing was changed — reject it, or check " +
        "the agent that filed it.",
    };
  }

  // ── 0. Re-read the damage, before anything is claimed ─────────────────────
  let live: LiveProposalImpact = { kind: "none" };
  if (decision === "accepted") {
    const impact = await readLiveImpact(supabase, ctx.orgId, proposal);
    if (!impact.ok) {
      return {
        ok: false,
        error: `${impact.error} — nothing was applied and the proposal is still pending`,
      };
    }
    const problem = acknowledgementProblem(impact.report, input.acknowledged);
    if (problem) return { ok: false, error: problem };
    live = impact.report.detail;
  }

  // Names are resolved now, while the rows still exist.
  const [resolvedDeliverable, resolvedTarget, resolvedClient] = await Promise.all([
    deliverableTitle(supabase, proposal.deliverable_id),
    resolveTargetName(supabase, ctx.orgId, proposal),
    clientName(supabase, ctx.orgId, proposal.client_id),
  ]);

  const summary = describeProposalChange({
    action: proposal.action,
    targetKind: kind,
    targetTable: resolveTargetTable(proposal),
    payload: proposal.payload,
    deliverableTitle: resolvedDeliverable,
    targetName: resolvedTarget,
    clientName: resolvedClient,
  });

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
  let detail: string | null = null;
  let applyWarning: string | null = null;

  if (decision === "accepted") {
    const applied = await applyProposal(supabase, ctx.orgId, proposal, kind, live);
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
    detail = applied.detail;
    applyWarning = applied.warning;
  }

  // ── 3. Audit ──────────────────────────────────────────────────────────────
  const body =
    decision === "accepted"
      ? [`${AGENT_DISPLAY_NAME} proposed: ${summary}`, reason].filter(Boolean).join(" — ")
      : reason;

  const auditError =
    proposal.client_id && !isConfigProposal(kind)
      ? // The activity body names the deliverable, never its uuid — the feed on
        // the Command Center is read by people, not by joins.
        await logActivity(supabase, {
          orgId: ctx.orgId,
          clientId: proposal.client_id,
          actorId: decider.id,
          actorName: decider.name,
          kind:
            decision === "accepted"
              ? ("proposal_accepted" satisfies ClientActivityKind)
              : ("proposal_rejected" satisfies ClientActivityKind),
          body,
          deliverableId: proposal.deliverable_id,
          milestoneId,
        })
      : // No client to file it under — see `recordConfigDecision`.
        await recordConfigDecision(supabase, ctx.orgId, proposal, {
          decision,
          decidedBy: decider.id,
          decidedByName: decider.name,
          decidedAt,
          reason,
          summary,
          applied: decision === "accepted" ? (detail ?? summary) : null,
        });

  revalidatePath("/command-center");
  revalidatePath("/journey");
  if (kind === "kpi") revalidatePath("/level-10");
  if (kind === "client_record") revalidatePath("/clients");

  const warning =
    [
      applyWarning,
      auditError
        ? `The change was applied, but the decision record failed to save (${auditError})`
        : null,
    ]
      .filter(Boolean)
      .join(" ") || null;

  return { ok: true, summary, detail, warning };
}
