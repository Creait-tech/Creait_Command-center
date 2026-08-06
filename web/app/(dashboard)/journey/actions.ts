"use server";

/**
 * Server actions for the Customer Journey module.
 *
 * Why these exist: the browser Supabase client (`lib/supabase/client.ts`)
 * ships the anon key with **no Clerk token**, so every read and write it makes
 * arrives at Postgres as `anon` with no `org_id` JWT claim. The `org_isolation`
 * RLS policy on `journey_milestones` / `journey_deliverables` /
 * `cc_client_journey` then evaluates `org_id = NULL` → false, and the request
 * silently returns zero rows (reads) or errors (writes). Per-client journey
 * tracking could never have worked from the browser.
 *
 * Everything therefore goes through the server client, which carries the Clerk
 * JWT, plus explicit org ownership checks so a child row can never be written
 * across orgs even if RLS is bypassed. Mirrors `lib/assessment-actions.ts`.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import type { CcClientJourney, JourneyDeliverable } from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireOrg(): Promise<
  { orgId: string } | { error: string }
> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  return { orgId: await getActiveOrgId() };
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

// ─────────────────────────────────────────────────────────────────────────────
// Per-client progress
// ─────────────────────────────────────────────────────────────────────────────

/** Every journey row recorded for one client. */
export async function fetchClientJourney(
  clientId: string,
): Promise<ActionResult<CcClientJourney[]>> {
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
  return { ok: true, data: (data as CcClientJourney[] | null) ?? [] };
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
}): Promise<ActionResult<CcClientJourney>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { clientId, deliverableId, done } = input;
  if (!clientId) return { ok: false, error: "Client is required" };
  if (!deliverableId) return { ok: false, error: "Deliverable is required" };

  const supabase = await createClient();

  if (!(await ownsClient(supabase, clientId, ctx.orgId))) {
    return { ok: false, error: "Client not found in this workspace" };
  }

  // Resolve the parent milestone from the deliverable rather than trusting the
  // client, and use it to prove org ownership of the deliverable itself.
  const { data: deliverable } = await supabase
    .from("journey_deliverables")
    .select("id, milestone_id")
    .eq("id", deliverableId)
    .maybeSingle();

  if (!deliverable) {
    return { ok: false, error: "Deliverable not found" };
  }

  const milestoneId = (deliverable as Pick<
    JourneyDeliverable,
    "id" | "milestone_id"
  >).milestone_id;

  if (!(await ownsMilestone(supabase, milestoneId, ctx.orgId))) {
    return { ok: false, error: "Deliverable not found in this workspace" };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("cc_client_journey")
    .upsert(
      {
        org_id: ctx.orgId,
        client_id: clientId,
        deliverable_id: deliverableId,
        milestone_id: milestoneId,
        done,
        completed_at: done ? now : null,
        updated_at: now,
      },
      { onConflict: "client_id,deliverable_id" },
    )
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/journey");
  return { ok: true, data: data as CcClientJourney };
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
