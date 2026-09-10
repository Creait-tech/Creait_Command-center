"use server";

/**
 * Server actions for the EOS surfaces that carry authorship: To-Dos, Rocks,
 * Wins, IDS items and Headlines.
 *
 * Why these writes moved off the browser client: the point of
 * `created_by` / `updated_by` is to answer "who did this?" later, and a name
 * the browser hands us is not an audit trail — it is whatever the caller felt
 * like sending. The actor is therefore resolved here, from the Clerk session,
 * exactly the way `app/(dashboard)/journey/actions.ts` does it. The org id
 * comes from the session too (`getActiveOrgId()`), never from the client.
 *
 * RLS still applies: `createClient()` attaches the same Clerk JWT the browser
 * client would, so these actions have no extra privilege — they only add a
 * trustworthy identity and a place to check the outcome of a write.
 *
 * The outcome check matters. A rejected INSERT raises, but a rejected
 * UPDATE or DELETE matches zero rows and returns success. Every mutating
 * helper below therefore selects the affected row back and treats "no row" as
 * the failure it is, rather than reporting a save that never happened.
 */

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import type {
  ActionResult,
  AuthoredHeadline,
  AuthoredIdsItem,
  AuthoredRock,
  AuthoredTodo,
  AuthoredWin,
} from "@/lib/authorship";
import type {
  HeadlineCategory,
  IdsStatus,
  Rock,
  RockType,
} from "@/lib/supabase/types";

/** Who is making the change. Always a signed-in human on these surfaces. */
interface Actor {
  id: string;
  name: string;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface Context {
  supabase: Supabase;
  orgId: string;
  actor: Actor;
}

/**
 * `lib/supabase/types.ts` still describes the pre-migration column set, so a
 * direct cast to the authored row shapes is rejected as non-overlapping. The
 * columns exist in Postgres — this keeps the widening to one place.
 */
function asRow<T>(row: unknown): T {
  return row as T;
}

/**
 * Display name for the signed-in teammate.
 *
 * The `team_members` row wins because that is the name the rest of the Command
 * Center shows ("Jaylyn", not "jaylyn.maddox@…"), and `display_name` wins
 * inside it because that is the name the person chose for themselves on their
 * own profile. Clerk's profile is the fallback for anyone not yet linked via
 * `team_members.clerk_user_id`.
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

/** Session, org and actor, or the reason we can't proceed. */
async function context(): Promise<Context | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  const orgId = await getActiveOrgId();
  const supabase = await createClient();
  return { supabase, orgId, actor: await resolveActor(supabase, orgId, userId) };
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * The message shown when an UPDATE matched nothing. Almost always RLS or a
 * stale id — either way the row on screen is not what the caller thinks it is.
 */
function noRowError(kind: string): string {
  return `Couldn't save that ${kind} — it no longer exists, or your session doesn't have permission for it. Try reloading the page.`;
}

// -- To-Dos -------------------------------------------------------------------

export async function createTodo(input: {
  title: string;
  description?: string | null;
  ownerId?: string | null;
  dueDate?: string | null;
  meetingId?: string | null;
}): Promise<ActionResult<AuthoredTodo>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };

  const { data, error } = await ctx.supabase
    .from("cc_todos")
    .insert({
      org_id: ctx.orgId,
      title,
      description: input.description?.trim() || null,
      owner_id: input.ownerId || null,
      due_date: input.dueDate || null,
      meeting_id: input.meetingId ?? null,
      created_by: ctx.actor.id,
      created_by_name: ctx.actor.name,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't add that To-Do." };
  }
  revalidatePath("/todos");
  return { ok: true, data: asRow<AuthoredTodo>(data) };
}

export async function updateTodo(
  id: string,
  patch: {
    title?: string;
    done?: boolean;
    ownerId?: string | null;
    dueDate?: string | null;
  },
): Promise<ActionResult<AuthoredTodo>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const update: Record<string, unknown> = {
    updated_at: nowIso(),
    updated_by: ctx.actor.id,
    updated_by_name: ctx.actor.name,
  };
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.done !== undefined) update.done = patch.done;
  if (patch.ownerId !== undefined) update.owner_id = patch.ownerId || null;
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate || null;

  const { data, error } = await ctx.supabase
    .from("cc_todos")
    .update(update)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: noRowError("To-Do") };
  revalidatePath("/todos");
  return { ok: true, data: asRow<AuthoredTodo>(data) };
}

// -- Rocks --------------------------------------------------------------------

export async function createRock(input: {
  title: string;
  description?: string | null;
  rockType: RockType;
  ownerId?: string | null;
  quarter: string;
  dueDate: string;
  smartSpecific?: string | null;
  smartMeasurable?: string | null;
  smartRelevant?: string | null;
}): Promise<ActionResult<AuthoredRock>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };

  const { data, error } = await ctx.supabase
    .from("cc_rocks")
    .insert({
      org_id: ctx.orgId,
      title,
      description: input.description?.trim() || null,
      rock_type: input.rockType,
      owner_id: input.ownerId || null,
      quarter: input.quarter,
      status: "on_track",
      smart_specific: input.smartSpecific?.trim() || null,
      smart_measurable: input.smartMeasurable?.trim() || null,
      smart_relevant: input.smartRelevant?.trim() || null,
      due_date: input.dueDate,
      sort_order: 0,
      created_by: ctx.actor.id,
      created_by_name: ctx.actor.name,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't add that Rock." };
  }
  revalidatePath("/rocks");
  return { ok: true, data: asRow<AuthoredRock>(data) };
}

export async function updateRockStatus(
  id: string,
  status: Rock["status"],
): Promise<ActionResult<AuthoredRock>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data, error } = await ctx.supabase
    .from("cc_rocks")
    .update({
      status,
      updated_at: nowIso(),
      updated_by: ctx.actor.id,
      updated_by_name: ctx.actor.name,
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: noRowError("Rock") };
  revalidatePath("/rocks");
  return { ok: true, data: asRow<AuthoredRock>(data) };
}

// -- Wins ---------------------------------------------------------------------

export async function createWin(input: {
  title: string;
  description?: string | null;
  meetingId?: string | null;
  winDate?: string | null;
  /** Whose win it is — the Segue captures one per person in the room. */
  ownerId?: string | null;
}): Promise<ActionResult<AuthoredWin>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };

  const { data, error } = await ctx.supabase
    .from("wins")
    .insert({
      org_id: ctx.orgId,
      title,
      description: input.description?.trim() || null,
      meeting_id: input.meetingId ?? null,
      owner_id: input.ownerId || null,
      win_date: input.winDate ?? new Date().toISOString().slice(0, 10),
      created_by: ctx.actor.id,
      created_by_name: ctx.actor.name,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't log that Win." };
  }
  revalidatePath("/level-10");
  return { ok: true, data: asRow<AuthoredWin>(data) };
}

// -- IDS items ----------------------------------------------------------------

export async function createIdsItem(input: {
  title: string;
  description?: string | null;
  priority?: number;
  isLongTerm?: boolean;
  ownerId?: string | null;
  meetingId?: string | null;
}): Promise<ActionResult<AuthoredIdsItem>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };

  const priority = Math.max(1, Math.min(10, Math.round(input.priority ?? 5)));

  const { data, error } = await ctx.supabase
    .from("ids_items")
    .insert({
      org_id: ctx.orgId,
      title,
      description: input.description?.trim() || null,
      status: "open",
      priority,
      is_long_term: input.isLongTerm ?? false,
      owner_id: input.ownerId ?? null,
      meeting_id: input.meetingId ?? null,
      created_by: ctx.actor.id,
      created_by_name: ctx.actor.name,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't add that issue." };
  }
  revalidatePath("/level-10");
  return { ok: true, data: asRow<AuthoredIdsItem>(data) };
}

export async function updateIdsItem(
  id: string,
  patch: { status?: IdsStatus; isLongTerm?: boolean },
): Promise<ActionResult<AuthoredIdsItem>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const update: Record<string, unknown> = {
    updated_at: nowIso(),
    updated_by: ctx.actor.id,
    updated_by_name: ctx.actor.name,
  };
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.isLongTerm !== undefined) update.is_long_term = patch.isLongTerm;

  const { data, error } = await ctx.supabase
    .from("ids_items")
    .update(update)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: noRowError("issue") };
  revalidatePath("/level-10");
  return { ok: true, data: asRow<AuthoredIdsItem>(data) };
}

export async function deleteIdsItem(id: string): Promise<ActionResult> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data, error } = await ctx.supabase
    .from("ids_items")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return {
      ok: false,
      error:
        "Couldn't delete — your session doesn't have permission for this issue. Try reloading the page.",
    };
  }
  revalidatePath("/level-10");
  return { ok: true, data: undefined };
}

// -- Headlines ----------------------------------------------------------------

export async function createHeadline(input: {
  text: string;
  category: HeadlineCategory;
  meetingId?: string | null;
  /** A cascading message: something the whole company needs to hear. */
  cascade?: boolean;
}): Promise<ActionResult<AuthoredHeadline>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const text = input.text.trim();
  if (!text) return { ok: false, error: "Headline text is required." };

  const { data, error } = await ctx.supabase
    .from("cc_headlines")
    .insert({
      org_id: ctx.orgId,
      text,
      category: input.category,
      cascade: input.cascade === true,
      meeting_id: input.meetingId ?? null,
      created_by: ctx.actor.id,
      created_by_name: ctx.actor.name,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't save that headline." };
  }
  revalidatePath("/level-10");
  return { ok: true, data: asRow<AuthoredHeadline>(data) };
}
