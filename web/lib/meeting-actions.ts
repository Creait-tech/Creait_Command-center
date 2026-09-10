"use server";

/**
 * Server actions for the meeting lifecycle: start, save progress, conclude,
 * discard.
 *
 * A meeting row is written only when someone presses Start in the dialog —
 * not when the page loads, not when the dialog opens — so an abandoned
 * intention leaves nothing behind. While it runs, the room persists its
 * timer state here so a refresh resumes rather than restarts. Concluding
 * writes one rating row per attendee and freezes the timings.
 *
 * Every UPDATE and DELETE reads the row back and treats "no row" as the
 * failure it is (RLS reports a refused write as success otherwise), and is
 * additionally guarded on `status = 'in_progress'` so a concluded meeting
 * can never be re-run or re-concluded by a stale tab.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { personName } from "@/lib/authorship";
import type { ActionResult } from "@/lib/authorship";
import { DEFAULT_MEETING_AGENDAS, isMeetingType, type MeetingType } from "@/lib/meeting-agendas";
import type { MeetingProgress } from "@/lib/meeting-progress";
import type { Json } from "@/lib/supabase/types";

/** `agenda_state` is a JSON column; the progress type has no index signature. */
function asJson(progress: MeetingProgress): Json {
  return progress as unknown as Json;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function context(): Promise<{ supabase: Supabase; orgId: string; userId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  const orgId = await getActiveOrgId();
  const supabase = await createClient();
  return { supabase, orgId, userId };
}

function meetingPaths(id: string): string[] {
  return ["/level-10", "/meetings", `/level-10/meeting/${id}`];
}

function revalidateMeeting(id: string): void {
  for (const p of meetingPaths(id)) revalidatePath(p);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create the meeting row and open it. Returns the id the room page lives at.
 */
export async function startMeeting(input: {
  type: MeetingType;
  attendeeIds: string[];
  presenterId: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!isMeetingType(input.type)) return { ok: false, error: "Unknown meeting type." };

  const attendeeIds = Array.from(new Set(input.attendeeIds.filter((id) => UUID.test(id))));
  const presenterId = input.presenterId && UUID.test(input.presenterId) ? input.presenterId : null;

  // Attendees must be on this org's roster — the ids come from the browser.
  if (attendeeIds.length > 0) {
    const { data: roster } = await ctx.supabase
      .from("team_members")
      .select("id")
      .eq("org_id", ctx.orgId)
      .in("id", attendeeIds);
    const known = new Set(((roster as { id: string }[] | null) ?? []).map((r) => r.id));
    for (const id of attendeeIds) {
      if (!known.has(id)) return { ok: false, error: "One of the attendees is not on the team roster." };
    }
  }

  const agenda = DEFAULT_MEETING_AGENDAS[input.type];
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
  const progress: MeetingProgress = {
    v: 2,
    activeIdx: 0,
    running: true,
    runningSince: now.toISOString(),
    sections: Object.fromEntries(
      agenda.sections.map((s) => [s.key, { durationSec: 0, budgetSec: s.budgetSec }]),
    ),
  };

  const { data, error } = await ctx.supabase
    .from("meetings")
    .insert({
      org_id: ctx.orgId,
      title: `${agenda.titlePrefix} — ${dateLabel}`,
      meeting_type: input.type,
      scheduled_at: now.toISOString(),
      started_at: now.toISOString(),
      status: "in_progress",
      source: "manual",
      presenter_id: presenterId,
      attendee_ids: attendeeIds,
      agenda_state: asJson(progress),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Couldn't start the meeting." };
  }
  const id = (data as { id: string }).id;
  revalidateMeeting(id);
  return { ok: true, data: { id } };
}

/** Persist the room's timer and section state. Cheap; called on every transition. */
export async function saveMeetingProgress(
  id: string,
  progress: MeetingProgress,
): Promise<ActionResult> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data, error } = await ctx.supabase
    .from("meetings")
    .update({ agenda_state: asJson(progress), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .eq("status", "in_progress")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "This meeting is no longer in progress — it was concluded or discarded elsewhere." };
  return { ok: true, data: undefined };
}

/**
 * Close the meeting: freeze timings, record a rating per attendee, stamp
 * `ended_at`. The meeting's own `rating` column holds the average so lists
 * that predate per-person ratings keep working.
 */
export async function concludeMeeting(input: {
  id: string;
  progress: MeetingProgress;
  ratings: Array<{ memberId: string; rating: number }>;
  comment?: string | null;
}): Promise<ActionResult> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const ratings = input.ratings.filter(
    (r) => UUID.test(r.memberId) && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 10,
  );
  if (ratings.length === 0) return { ok: false, error: "Rate the meeting before concluding." };

  const finalProgress: MeetingProgress = { ...input.progress, running: false, runningSince: null };
  const totalSec = Object.values(finalProgress.sections).reduce((a, s) => a + s.durationSec, 0);
  const average = Math.round((ratings.reduce((a, r) => a + r.rating, 0) / ratings.length) * 10) / 10;
  const endedAt = new Date().toISOString();

  const { data: meeting, error } = await ctx.supabase
    .from("meetings")
    .update({
      status: "concluded",
      ended_at: endedAt,
      rating: average,
      duration_minutes: Math.max(1, Math.round(totalSec / 60)),
      agenda_state: asJson(finalProgress),
      updated_at: endedAt,
    })
    .eq("id", input.id)
    .eq("org_id", ctx.orgId)
    .eq("status", "in_progress")
    .select("id, attendee_ids")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!meeting) return { ok: false, error: "This meeting is no longer in progress — it was concluded or discarded elsewhere." };

  // Names are captured at write time so the record survives a rename.
  const memberIds = ratings.map((r) => r.memberId);
  const { data: members } = await ctx.supabase
    .from("team_members")
    .select("id, full_name, display_name, clerk_user_id")
    .eq("org_id", ctx.orgId)
    .in("id", memberIds);
  const byId = new Map(
    (
      (members as Array<{ id: string; full_name: string; display_name: string | null; clerk_user_id: string | null }> | null) ??
      []
    ).map((m) => [m.id, m]),
  );
  const comment = input.comment?.trim() || null;
  const commentOwner =
    ratings.find((r) => byId.get(r.memberId)?.clerk_user_id === ctx.userId)?.memberId ?? ratings[0].memberId;

  const rows = ratings
    .filter((r) => byId.has(r.memberId))
    .map((r) => ({
      meeting_id: input.id,
      member_id: r.memberId,
      rater_name: personName(byId.get(r.memberId)!),
      rating: r.rating,
      comment: r.memberId === commentOwner ? comment : null,
    }));

  if (rows.length > 0) {
    const { error: ratingError } = await ctx.supabase
      .from("cc_meeting_ratings")
      .upsert(rows, { onConflict: "meeting_id,member_id" });
    if (ratingError) {
      return { ok: false, error: `Meeting concluded, but the ratings could not be saved: ${ratingError.message}` };
    }
  }

  revalidateMeeting(input.id);
  return { ok: true, data: undefined };
}

/**
 * Delete a meeting that is still in progress. Anything captured in the room
 * (to-dos, issues, headlines) is kept — its `meeting_id` is set to null by the
 * foreign keys — so discarding never loses work, only the meeting record.
 */
export async function discardMeeting(id: string): Promise<ActionResult> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data, error } = await ctx.supabase
    .from("meetings")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .eq("status", "in_progress")
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Only a meeting that is still in progress can be discarded." };
  }
  revalidateMeeting(id);
  return { ok: true, data: undefined };
}
