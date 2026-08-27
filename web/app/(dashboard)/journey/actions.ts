"use server";

/**
 * Server actions for the Customer Journey module.
 *
 * Every read and write goes through the server client. The browser client does
 * now attach a Clerk token (`lib/supabase/client.ts`), so RLS would accept it —
 * but these actions add what RLS alone cannot: explicit org ownership checks on
 * the parent client and milestone, so a child row can never be written across
 * orgs, and a single trustworthy place to resolve *who* made a change. An actor
 * name the browser could choose is not an audit trail.
 *
 * The browser client is still used, for the realtime subscription only — see
 * `components/journey/use-client-journey-realtime.ts`. Postgres emits from the
 * WAL after commit, so writes made here reach every other open tab regardless.
 *
 * Mirrors `lib/assessment-actions.ts`.
 */

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import type {
  ActorType,
  CcClientActivity,
  CcClientJourney,
  ClientActivityKind,
  JourneyDeliverable,
} from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * `CcClientJourney` in lib/supabase/types.ts predates migration
 * `phase14_shared_client_progress` and doesn't declare the three attribution
 * columns. That file is owned by other work, so the shape is widened here
 * instead. Writes type-check either way (the generated Insert type accepts
 * unknown keys) — this only restores read-side safety.
 */
export interface ClientJourneyRow extends CcClientJourney {
  updated_by: string | null;
  updated_by_name: string | null;
  updated_by_type: ActorType | null;
}

/**
 * The generated `Row` type still describes the pre-migration column set, so a
 * direct cast is rejected as non-overlapping. The columns exist in Postgres —
 * these two narrow the widening to one documented place instead of sprinkling
 * `as unknown as` through every query.
 */
function asJourneyRow(row: unknown): ClientJourneyRow {
  return row as ClientJourneyRow;
}

function asJourneyRows(rows: unknown): ClientJourneyRow[] {
  return (rows as ClientJourneyRow[] | null) ?? [];
}

/** Who is making the change. Humans come from Clerk; Hermes writes its own. */
export interface Actor {
  id: string;
  name: string;
  type: ActorType;
}

const MAX_NOTE_LENGTH = 2000;

async function requireOrg(): Promise<
  { orgId: string; userId: string } | { error: string }
> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  return { orgId: await getActiveOrgId(), userId };
}

/**
 * Display name for the signed-in teammate.
 *
 * Resolved server-side from the Clerk session rather than accepted from the
 * browser — an actor name the caller can choose is not an audit trail. The
 * `team_members` row wins because that's the name the rest of the Command
 * Center shows ("Jaylyn", not "jaylyn.maddox@…"); Clerk's profile is the
 * fallback for anyone not yet linked in `team_members.clerk_user_id`.
 */
async function resolveActor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  userId: string,
): Promise<Actor> {
  const { data } = await supabase
    .from("team_members")
    .select("full_name")
    .eq("org_id", orgId)
    .eq("clerk_user_id", userId)
    .maybeSingle();

  const teamName = (data as { full_name: string } | null)?.full_name?.trim();
  if (teamName) return { id: userId, name: teamName, type: "human" };

  const user = await currentUser();
  const clerkName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.trim() ||
    null;

  return { id: userId, name: clerkName ?? "Teammate", type: "human" };
}

/**
 * The signed-in teammate as the activity log will record them.
 *
 * Rendered into the page so an optimistic tick can show the right name
 * immediately, without a second round trip and without the browser getting to
 * pick its own label. Falls back to a generic actor when signed out — the
 * write itself would be refused, so the label never reaches the database.
 */
export async function getCurrentActor(): Promise<Actor> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { id: "", name: "You", type: "human" };
  const supabase = await createClient();
  return resolveActor(supabase, ctx.orgId, ctx.userId);
}

/**
 * Append one entry to the client's shared activity log.
 *
 * Returns the error message instead of throwing: the caller has usually
 * already committed the underlying change, and failing the whole action
 * would make the UI roll back a write that actually landed.
 */
async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    orgId: string;
    clientId: string;
    actor: Actor;
    kind: ClientActivityKind;
    body?: string | null;
    deliverableId?: string | null;
    milestoneId?: string | null;
  },
): Promise<{ activity: CcClientActivity | null; error: string | null }> {
  const { data, error } = await supabase
    .from("cc_client_activity")
    .insert({
      org_id: input.orgId,
      client_id: input.clientId,
      actor_type: input.actor.type,
      actor_id: input.actor.id,
      actor_name: input.actor.name,
      kind: input.kind,
      body: input.body ?? null,
      deliverable_id: input.deliverableId ?? null,
      milestone_id: input.milestoneId ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { activity: null, error: error?.message ?? "Activity log write failed" };
  }
  return { activity: data as CcClientActivity, error: null };
}

/** True when the milestone exists and belongs to the caller's org. */
async function ownsMilestone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  milestoneId: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("journey_milestones")
    .select("id")
    .eq("id", milestoneId)
    .eq("org_id", orgId)
    .maybeSingle();
  return data !== null;
}

/** True when the client exists and belongs to the caller's org. */
async function ownsClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("cc_clients")
    .select("id")
    .eq("id", clientId)
    .eq("org_id", orgId)
    .maybeSingle();
  return data !== null;
}

/**
 * Resolve a deliverable's parent milestone and prove the caller's org owns it.
 *
 * The milestone is read from the deliverable rather than trusted from the
 * browser, and `journey_deliverables` has no `org_id` of its own — ownership
 * is inherited through the milestone.
 */
async function resolveOwnedDeliverable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  deliverableId: string,
  orgId: string,
): Promise<{ milestoneId: string } | { error: string }> {
  const { data: deliverable } = await supabase
    .from("journey_deliverables")
    .select("id, milestone_id")
    .eq("id", deliverableId)
    .maybeSingle();

  if (!deliverable) return { error: "Deliverable not found" };

  const milestoneId = (
    deliverable as Pick<JourneyDeliverable, "id" | "milestone_id">
  ).milestone_id;

  if (!(await ownsMilestone(supabase, milestoneId, orgId))) {
    return { error: "Deliverable not found in this workspace" };
  }
  return { milestoneId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-client progress
// ─────────────────────────────────────────────────────────────────────────────

/** Every journey row recorded for one client. */
export async function fetchClientJourney(
  clientId: string,
): Promise<ActionResult<ClientJourneyRow[]>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!clientId) return { ok: false, error: "Client is required" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cc_client_journey")
    .select("*")
    .eq("client_id", clientId)
    .eq("org_id", ctx.orgId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: asJourneyRows(data) };
}

/** Recent shared activity for one client, newest first. */
export async function fetchClientActivity(
  clientId: string,
  limit = 25,
): Promise<ActionResult<CcClientActivity[]>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!clientId) return { ok: false, error: "Client is required" };

  const capped = Math.min(Math.max(Math.trunc(limit) || 25, 1), 100);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cc_client_activity")
    .select("*")
    .eq("client_id", clientId)
    .eq("org_id", ctx.orgId)
    .order("created_at", { ascending: false })
    .limit(capped);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data as CcClientActivity[] | null) ?? [] };
}

/**
 * Tick or untick one deliverable for one client.
 *
 * Upserts on the `(client_id, deliverable_id)` unique constraint. The previous
 * browser implementation branched on local state to choose insert-vs-update and
 * hit a duplicate-key error whenever a checkbox was toggled twice before the
 * refetch landed; letting Postgres resolve the conflict removes that race.
 */
export async function setDeliverableDone(input: {
  clientId: string;
  deliverableId: string;
  done: boolean;
}): Promise<
  ActionResult<{
    journey: ClientJourneyRow;
    activity: CcClientActivity | null;
    /** Set when the tick saved but the log entry didn't — never rolls back. */
    activityError: string | null;
  }>
> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { clientId, deliverableId, done } = input;
  if (!clientId) return { ok: false, error: "Client is required" };
  if (!deliverableId) return { ok: false, error: "Deliverable is required" };

  const supabase = await createClient();

  if (!(await ownsClient(supabase, clientId, ctx.orgId))) {
    return { ok: false, error: "Client not found in this workspace" };
  }

  const owned = await resolveOwnedDeliverable(supabase, deliverableId, ctx.orgId);
  if ("error" in owned) return { ok: false, error: owned.error };

  const actor = await resolveActor(supabase, ctx.orgId, ctx.userId);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("cc_client_journey")
    .upsert(
      {
        org_id: ctx.orgId,
        client_id: clientId,
        deliverable_id: deliverableId,
        milestone_id: owned.milestoneId,
        done,
        completed_at: done ? now : null,
        updated_at: now,
        updated_by: actor.id,
        updated_by_name: actor.name,
        updated_by_type: actor.type,
      },
      { onConflict: "client_id,deliverable_id" },
    )
    .select("*")
    .single();

  // `.select().single()` is load-bearing, not decoration. An RLS-rejected
  // UPDATE does not error — it matches zero rows and reports success — so the
  // returned row is the only proof the write actually happened.
  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Nothing was saved — check workspace access",
    };
  }

  const logged = await logActivity(supabase, {
    orgId: ctx.orgId,
    clientId,
    actor,
    kind: done ? "deliverable_completed" : "deliverable_reopened",
    deliverableId,
    milestoneId: owned.milestoneId,
  });

  return {
    ok: true,
    data: {
      journey: asJourneyRow(data),
      activity: logged.activity,
      activityError: logged.error,
    },
  };
}

/**
 * Leave context for a teammate: "waiting on their logo files".
 *
 * Client-scoped notes live only in the activity feed. Deliverable-scoped notes
 * additionally write `cc_client_journey.notes` so the text sits next to the
 * checkbox it's about. Passing an empty body for a deliverable clears its note
 * (and logs nothing — a retraction isn't news); a client-scoped note must have
 * a body.
 */
export async function addClientNote(input: {
  clientId: string;
  body: string;
  deliverableId?: string | null;
}): Promise<
  ActionResult<{
    activity: CcClientActivity | null;
    journey: ClientJourneyRow | null;
    /**
     * Set when a deliverable note persisted but its log entry didn't. A
     * client-scoped note *is* the log entry, so that case fails outright
     * instead — there'd be nothing left to have saved.
     */
    activityError: string | null;
  }>
> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { clientId, deliverableId } = input;
  if (!clientId) return { ok: false, error: "Client is required" };

  const body = (input.body ?? "").trim();
  if (body.length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      error: `Note is too long (max ${MAX_NOTE_LENGTH} characters)`,
    };
  }
  if (!body && !deliverableId) {
    return { ok: false, error: "Note can't be empty" };
  }

  const supabase = await createClient();

  if (!(await ownsClient(supabase, clientId, ctx.orgId))) {
    return { ok: false, error: "Client not found in this workspace" };
  }

  const actor = await resolveActor(supabase, ctx.orgId, ctx.userId);
  const now = new Date().toISOString();

  let journey: ClientJourneyRow | null = null;
  let milestoneId: string | null = null;

  if (deliverableId) {
    const owned = await resolveOwnedDeliverable(
      supabase,
      deliverableId,
      ctx.orgId,
    );
    if ("error" in owned) return { ok: false, error: owned.error };
    milestoneId = owned.milestoneId;

    // Only the note columns are sent, so an existing row keeps its `done` and
    // `completed_at`; a fresh row falls back to the `done = false` default.
    const { data, error } = await supabase
      .from("cc_client_journey")
      .upsert(
        {
          org_id: ctx.orgId,
          client_id: clientId,
          deliverable_id: deliverableId,
          milestone_id: milestoneId,
          notes: body || null,
          updated_at: now,
          updated_by: actor.id,
          updated_by_name: actor.name,
          updated_by_type: actor.type,
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
    journey = asJourneyRow(data);
  }

  if (!body) {
    return { ok: true, data: { activity: null, journey, activityError: null } };
  }

  const logged = await logActivity(supabase, {
    orgId: ctx.orgId,
    clientId,
    actor,
    kind: "note",
    body,
    deliverableId: deliverableId ?? null,
    milestoneId,
  });

  if (logged.error && !deliverableId) {
    return { ok: false, error: logged.error };
  }

  return {
    ok: true,
    data: { activity: logged.activity, journey, activityError: logged.error },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Template editing
// ─────────────────────────────────────────────────────────────────────────────

export async function createMilestone(input: {
  name: string;
  description?: string | null;
  durationDays?: number | null;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required" };

  const supabase = await createClient();

  // Append to the end. Derived server-side so two people adding at once can't
  // both claim the same slot from a stale client-side count.
  const { data: last } = await supabase
    .from("journey_milestones")
    .select("sort_order")
    .eq("org_id", ctx.orgId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder =
    ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const duration =
    input.durationDays === null || input.durationDays === undefined
      ? null
      : Number.isFinite(input.durationDays)
        ? Math.max(0, Math.trunc(input.durationDays))
        : null;

  const { data, error } = await supabase
    .from("journey_milestones")
    .insert({
      org_id: ctx.orgId,
      name,
      description: input.description?.trim() || null,
      sort_order: nextSortOrder,
      default_duration_days: duration,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/journey");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function createDeliverable(input: {
  milestoneId: string;
  title: string;
  description?: string | null;
  required?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Title is required" };
  if (!input.milestoneId) return { ok: false, error: "Milestone is required" };

  const supabase = await createClient();
  if (!(await ownsMilestone(supabase, input.milestoneId, ctx.orgId))) {
    return { ok: false, error: "Milestone not found in this workspace" };
  }

  const { data: last } = await supabase
    .from("journey_deliverables")
    .select("sort_order")
    .eq("milestone_id", input.milestoneId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder =
    ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("journey_deliverables")
    .insert({
      milestone_id: input.milestoneId,
      title,
      description: input.description?.trim() || null,
      required: input.required ?? true,
      sort_order: nextSortOrder,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/journey");
  return { ok: true, data: { id: (data as { id: string }).id } };
}
