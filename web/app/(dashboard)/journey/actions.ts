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
  JourneyMilestone,
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

// ─────────────────────────────────────────────────────────────────────────────
// Template editing — update, reorder, delete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a write that "succeeded" but changed nothing gets reported as.
 *
 * Postgres treats an UPDATE or DELETE filtered out by RLS as a no-op rather
 * than an error: zero rows match and PostgREST answers 2xx. The returned rows
 * are the only proof the write landed, so every mutation below asks for them
 * with `.select()` and treats an empty result as the failure it is. This
 * project has shipped that bug three times; it is not shipping it a fourth.
 */
const NOTHING_CHANGED =
  "Nothing was saved — the row may have just been deleted, or it isn't in this workspace";

/** Whole days, floored at 0. `null` clears it; anything unusable becomes null. */
function normaliseDays(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

/** A position is a whole number ≥ 0. `null` means the caller sent nonsense. */
function normaliseSortOrder(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const n = Math.trunc(value);
  return n < 0 ? null : n;
}

/**
 * What a delete would actually destroy, read live at confirm time.
 *
 * These numbers come from the real foreign keys, verified against the running
 * database rather than assumed:
 *
 *   cc_client_journey.deliverable_id  → ON DELETE CASCADE  (progress destroyed)
 *   cc_agent_proposals.deliverable_id → ON DELETE CASCADE  (proposals destroyed)
 *   cc_client_activity.deliverable_id → ON DELETE SET NULL (log kept, unlinked)
 *   cc_client_activity.milestone_id   → ON DELETE SET NULL
 *   journey_deliverables.milestone_id → ON DELETE CASCADE  (children destroyed)
 *
 * So deleting a milestone silently reaches two levels down into client
 * history. There is no FK error to catch and nothing to roll back — the
 * operator has to be told before they confirm, which is what this powers.
 */
export interface DeleteImpact {
  /** `cc_client_journey` rows the cascade would remove. */
  trackedRows: number;
  /** Of those, the ones actually ticked done — recorded history, not blanks. */
  tickedRows: number;
  /** Of those, the ones carrying a note. */
  notedRows: number;
  /** Names of the clients whose progress would be destroyed, A–Z. */
  clientNames: string[];
  /** Pending agent proposals the cascade would also remove. */
  proposalRows: number;
  /** Activity entries that survive but lose their link (FK is SET NULL). */
  orphanedActivity: number;
}

export interface MilestoneDeleteImpact extends DeleteImpact {
  milestoneId: string;
  name: string;
  /** Deliverables the cascade would remove along with the milestone. */
  deliverableCount: number;
  deliverableTitles: string[];
}

export interface DeliverableDeleteImpact extends DeleteImpact {
  deliverableId: string;
  title: string;
}

interface JourneyImpactRow {
  client_id: string;
  done: boolean;
  notes: string | null;
}

/**
 * Count everything downstream of a set of deliverables (and, for a milestone
 * delete, the milestone itself).
 *
 * Every query is org-scoped. `cc_client_journey`, `cc_client_activity` and
 * `cc_agent_proposals` all carry `org_id`; `journey_deliverables` does not, so
 * its ids are resolved by the caller through an owned milestone first.
 */
async function computeDeleteImpact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  deliverableIds: string[],
  milestoneIds: string[],
): Promise<DeleteImpact> {
  // One row can reference both a deliverable and its milestone; `.or()` counts
  // it once, which two separate counts would not.
  const orParts: string[] = [];
  if (deliverableIds.length > 0) {
    orParts.push(`deliverable_id.in.(${deliverableIds.join(",")})`);
  }
  if (milestoneIds.length > 0) {
    orParts.push(`milestone_id.in.(${milestoneIds.join(",")})`);
  }

  let orphanedActivity = 0;
  if (orParts.length > 0) {
    const { count } = await supabase
      .from("cc_client_activity")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .or(orParts.join(","));
    orphanedActivity = count ?? 0;
  }

  if (deliverableIds.length === 0) {
    return {
      trackedRows: 0,
      tickedRows: 0,
      notedRows: 0,
      clientNames: [],
      proposalRows: 0,
      orphanedActivity,
    };
  }

  const { data: journeyData } = await supabase
    .from("cc_client_journey")
    .select("client_id, done, notes")
    .eq("org_id", orgId)
    .in("deliverable_id", deliverableIds);

  const rows = (journeyData as JourneyImpactRow[] | null) ?? [];

  let clientNames: string[] = [];
  const clientIds = [...new Set(rows.map((r) => r.client_id))];
  if (clientIds.length > 0) {
    const { data: clientData } = await supabase
      .from("cc_clients")
      .select("name")
      .eq("org_id", orgId)
      .in("id", clientIds)
      .order("name", { ascending: true });
    clientNames = ((clientData as { name: string }[] | null) ?? []).map(
      (c) => c.name,
    );
  }

  const { count: proposalCount } = await supabase
    .from("cc_agent_proposals")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("deliverable_id", deliverableIds);

  return {
    trackedRows: rows.length,
    tickedRows: rows.filter((r) => r.done).length,
    notedRows: rows.filter((r) => (r.notes ?? "").trim().length > 0).length,
    clientNames,
    proposalRows: proposalCount ?? 0,
    orphanedActivity,
  };
}

/** Deliverable ids under one milestone, in display order. */
async function deliverablesOfMilestone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  milestoneId: string,
): Promise<Pick<JourneyDeliverable, "id" | "title">[]> {
  const { data } = await supabase
    .from("journey_deliverables")
    .select("id, title")
    .eq("milestone_id", milestoneId)
    .order("sort_order", { ascending: true });
  return (data as Pick<JourneyDeliverable, "id" | "title">[] | null) ?? [];
}

// ── Milestones ───────────────────────────────────────────────────────────────

export async function updateMilestone(input: {
  id: string;
  name?: string;
  description?: string | null;
  durationDays?: number | null;
  sortOrder?: number;
}): Promise<ActionResult<{ milestone: JourneyMilestone }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!input.id) return { ok: false, error: "Milestone is required" };

  const patch: Partial<JourneyMilestone> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Name is required" };
    patch.name = name;
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.durationDays !== undefined) {
    patch.default_duration_days = normaliseDays(input.durationDays);
  }
  if (input.sortOrder !== undefined) {
    const order = normaliseSortOrder(input.sortOrder);
    if (order === null) {
      return { ok: false, error: "Position must be a whole number, 0 or higher" };
    }
    patch.sort_order = order;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to change" };
  }
  // No trigger maintains this column (see CLAUDE.md) — set it by hand.
  patch.updated_at = new Date().toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journey_milestones")
    .update(patch)
    .eq("id", input.id)
    .eq("org_id", ctx.orgId)
    .select("*");

  if (error) return { ok: false, error: error.message };

  const rows = (data as JourneyMilestone[] | null) ?? [];
  if (rows.length === 0) return { ok: false, error: NOTHING_CHANGED };

  revalidatePath("/journey");
  return { ok: true, data: { milestone: rows[0] } };
}

/** What deleting this milestone would take with it. Read fresh, never cached. */
export async function getMilestoneDeleteImpact(
  milestoneId: string,
): Promise<ActionResult<MilestoneDeleteImpact>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!milestoneId) return { ok: false, error: "Milestone is required" };

  const supabase = await createClient();
  const { data: milestone } = await supabase
    .from("journey_milestones")
    .select("id, name")
    .eq("id", milestoneId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (!milestone) {
    return { ok: false, error: "Milestone not found in this workspace" };
  }

  const children = await deliverablesOfMilestone(supabase, milestoneId);
  const impact = await computeDeleteImpact(
    supabase,
    ctx.orgId,
    children.map((d) => d.id),
    [milestoneId],
  );

  return {
    ok: true,
    data: {
      ...impact,
      milestoneId,
      name: (milestone as { name: string }).name,
      deliverableCount: children.length,
      deliverableTitles: children.map((d) => d.title),
    },
  };
}

/**
 * Delete one milestone — and, by cascade, every deliverable under it and every
 * client's tracked progress against those deliverables.
 *
 * `acknowledged` is the count the confirm dialog put in front of the operator.
 * It is re-checked here because this is a multiplayer page: if a teammate added
 * a deliverable or ticked a box while the confirm sat open, the damage would no
 * longer be the damage that was agreed to, so the delete is refused instead of
 * quietly doing more than advertised.
 */
export async function deleteMilestone(input: {
  id: string;
  acknowledged?: { deliverableCount: number; trackedRows: number };
}): Promise<
  ActionResult<{ deletedDeliverables: number; deletedJourneyRows: number }>
> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!input.id) return { ok: false, error: "Milestone is required" };

  const supabase = await createClient();
  if (!(await ownsMilestone(supabase, input.id, ctx.orgId))) {
    return { ok: false, error: "Milestone not found in this workspace" };
  }

  const children = await deliverablesOfMilestone(supabase, input.id);
  const impact = await computeDeleteImpact(
    supabase,
    ctx.orgId,
    children.map((d) => d.id),
    [input.id],
  );

  if (
    input.acknowledged &&
    (input.acknowledged.deliverableCount !== children.length ||
      input.acknowledged.trackedRows !== impact.trackedRows)
  ) {
    return {
      ok: false,
      error:
        "Someone changed this milestone while the confirmation was open — " +
        `it now holds ${children.length} deliverable(s) and ${impact.trackedRows} ` +
        "tracked client row(s). Nothing was deleted. Reopen delete to see the current impact.",
    };
  }

  const { data, error } = await supabase
    .from("journey_milestones")
    .delete()
    .eq("id", input.id)
    .eq("org_id", ctx.orgId)
    .select("id");

  if (error) return { ok: false, error: error.message };

  // An RLS-rejected DELETE matches zero rows and reports success. The returned
  // rows are the only evidence anything was actually removed.
  const rows = (data as { id: string }[] | null) ?? [];
  if (rows.length === 0) {
    return { ok: false, error: "Nothing was deleted — check workspace access" };
  }

  revalidatePath("/journey");
  return {
    ok: true,
    data: {
      deletedDeliverables: children.length,
      deletedJourneyRows: impact.trackedRows,
    },
  };
}

/**
 * Write `sort_order = 0..n-1` across the given milestones, in the order given.
 *
 * Absolute positions rather than swaps, so a list with duplicate or gappy
 * sort_order values (which nothing in the schema prevents) comes out clean.
 */
export async function reorderMilestones(
  orderedIds: string[],
): Promise<ActionResult<{ moved: number }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const ids = [...new Set(orderedIds.filter(Boolean))];
  if (ids.length === 0) return { ok: false, error: "Nothing to reorder" };

  const supabase = await createClient();
  const { data: owned } = await supabase
    .from("journey_milestones")
    .select("id")
    .eq("org_id", ctx.orgId)
    .in("id", ids);

  if (((owned as { id: string }[] | null) ?? []).length !== ids.length) {
    return { ok: false, error: "Some milestones aren't in this workspace" };
  }

  const now = new Date().toISOString();
  const results = await Promise.all(
    ids.map((id, index) =>
      supabase
        .from("journey_milestones")
        .update({ sort_order: index, updated_at: now })
        .eq("id", id)
        .eq("org_id", ctx.orgId)
        .select("id"),
    ),
  );

  const moved = results.filter(
    (r) => !r.error && ((r.data as { id: string }[] | null) ?? []).length > 0,
  ).length;

  if (moved === 0) return { ok: false, error: NOTHING_CHANGED };
  if (moved !== ids.length) {
    return {
      ok: false,
      error: `Only ${moved} of ${ids.length} milestones were reordered — reload and try again`,
    };
  }

  revalidatePath("/journey");
  return { ok: true, data: { moved } };
}

// ── Deliverables ─────────────────────────────────────────────────────────────

export async function updateDeliverable(input: {
  id: string;
  title?: string;
  description?: string | null;
  required?: boolean;
  sortOrder?: number;
}): Promise<ActionResult<{ deliverable: JourneyDeliverable }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!input.id) return { ok: false, error: "Deliverable is required" };

  const patch: Partial<JourneyDeliverable> = {};

  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { ok: false, error: "Title is required" };
    patch.title = title;
  }
  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }
  if (input.required !== undefined) {
    patch.required = input.required;
  }
  if (input.sortOrder !== undefined) {
    const order = normaliseSortOrder(input.sortOrder);
    if (order === null) {
      return { ok: false, error: "Position must be a whole number, 0 or higher" };
    }
    patch.sort_order = order;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to change" };
  }

  const supabase = await createClient();
  // `journey_deliverables` has no org_id — ownership is inherited through the
  // milestone, so it is resolved first and then re-asserted in the statement.
  const owned = await resolveOwnedDeliverable(supabase, input.id, ctx.orgId);
  if ("error" in owned) return { ok: false, error: owned.error };

  const { data, error } = await supabase
    .from("journey_deliverables")
    .update(patch)
    .eq("id", input.id)
    .eq("milestone_id", owned.milestoneId)
    .select("*");

  if (error) return { ok: false, error: error.message };

  const rows = (data as JourneyDeliverable[] | null) ?? [];
  if (rows.length === 0) return { ok: false, error: NOTHING_CHANGED };

  revalidatePath("/journey");
  return { ok: true, data: { deliverable: rows[0] } };
}

/** What deleting this deliverable would take with it. Read fresh, never cached. */
export async function getDeliverableDeleteImpact(
  deliverableId: string,
): Promise<ActionResult<DeliverableDeleteImpact>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!deliverableId) return { ok: false, error: "Deliverable is required" };

  const supabase = await createClient();
  const owned = await resolveOwnedDeliverable(supabase, deliverableId, ctx.orgId);
  if ("error" in owned) return { ok: false, error: owned.error };

  const { data: deliverable } = await supabase
    .from("journey_deliverables")
    .select("title")
    .eq("id", deliverableId)
    .eq("milestone_id", owned.milestoneId)
    .maybeSingle();

  const impact = await computeDeleteImpact(
    supabase,
    ctx.orgId,
    [deliverableId],
    [],
  );

  return {
    ok: true,
    data: {
      ...impact,
      deliverableId,
      title: (deliverable as { title: string } | null)?.title ?? "This deliverable",
    },
  };
}

/**
 * Delete one deliverable — and, by cascade, every client's tick, completion
 * date and note recorded against it.
 *
 * Same acknowledgement re-check as `deleteMilestone`: the operator confirmed a
 * specific amount of damage, and only that amount is allowed through.
 */
export async function deleteDeliverable(input: {
  id: string;
  acknowledged?: { trackedRows: number };
}): Promise<ActionResult<{ deletedJourneyRows: number }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!input.id) return { ok: false, error: "Deliverable is required" };

  const supabase = await createClient();
  const owned = await resolveOwnedDeliverable(supabase, input.id, ctx.orgId);
  if ("error" in owned) return { ok: false, error: owned.error };

  const impact = await computeDeleteImpact(supabase, ctx.orgId, [input.id], []);

  if (
    input.acknowledged &&
    input.acknowledged.trackedRows !== impact.trackedRows
  ) {
    return {
      ok: false,
      error:
        "Someone changed this deliverable's client progress while the confirmation was open — " +
        `${impact.trackedRows} client row(s) are now tracked against it. Nothing was deleted. ` +
        "Reopen delete to see the current impact.",
    };
  }

  const { data, error } = await supabase
    .from("journey_deliverables")
    .delete()
    .eq("id", input.id)
    .eq("milestone_id", owned.milestoneId)
    .select("id");

  if (error) return { ok: false, error: error.message };

  const rows = (data as { id: string }[] | null) ?? [];
  if (rows.length === 0) {
    return { ok: false, error: "Nothing was deleted — check workspace access" };
  }

  revalidatePath("/journey");
  return { ok: true, data: { deletedJourneyRows: impact.trackedRows } };
}

/** Write `sort_order = 0..n-1` across one milestone's deliverables. */
export async function reorderDeliverables(input: {
  milestoneId: string;
  orderedIds: string[];
}): Promise<ActionResult<{ moved: number }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!input.milestoneId) return { ok: false, error: "Milestone is required" };

  const ids = [...new Set(input.orderedIds.filter(Boolean))];
  if (ids.length === 0) return { ok: false, error: "Nothing to reorder" };

  const supabase = await createClient();
  if (!(await ownsMilestone(supabase, input.milestoneId, ctx.orgId))) {
    return { ok: false, error: "Milestone not found in this workspace" };
  }

  // Every id must sit under the milestone we just proved we own — that check is
  // the only thing standing in for the org_id this table doesn't have.
  const { data: owned } = await supabase
    .from("journey_deliverables")
    .select("id")
    .eq("milestone_id", input.milestoneId)
    .in("id", ids);

  if (((owned as { id: string }[] | null) ?? []).length !== ids.length) {
    return { ok: false, error: "Some deliverables aren't in this milestone" };
  }

  const results = await Promise.all(
    ids.map((id, index) =>
      supabase
        .from("journey_deliverables")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("milestone_id", input.milestoneId)
        .select("id"),
    ),
  );

  const moved = results.filter(
    (r) => !r.error && ((r.data as { id: string }[] | null) ?? []).length > 0,
  ).length;

  if (moved === 0) return { ok: false, error: NOTHING_CHANGED };
  if (moved !== ids.length) {
    return {
      ok: false,
      error: `Only ${moved} of ${ids.length} deliverables were reordered — reload and try again`,
    };
  }

  revalidatePath("/journey");
  return { ok: true, data: { moved } };
}
