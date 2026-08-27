"use server";

/**
 * Server actions for editing the EOS meeting agendas.
 *
 * Three things this module exists to guarantee:
 *
 *  1. **The rails hold on the server too.** The editor blocks a save that has
 *     no `conclude` section, or has one that isn't last — but a rule enforced
 *     only in a form is a rule anyone can skip. `validateAgenda()` runs here as
 *     well, and the table carries the same rule as a CHECK constraint. All
 *     three say the same thing so none of them can be the only one that's true.
 *
 *  2. **Attribution is resolved from the session, never accepted from the
 *     browser.** Mirrors `resolveActor()` in `lib/eos-actions.ts` and
 *     `app/(dashboard)/journey/actions.ts`.
 *
 *  3. **A save that didn't save is reported as a failure.** A rejected INSERT
 *     raises, but a rejected UPDATE matches zero rows and returns success — a
 *     trap this repo has fallen into repeatedly. Every write below selects the
 *     row back and treats "no row" as the error it is.
 */

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";

import { getActiveOrgId } from "@/lib/active-org";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/authorship";
import {
  defaultAgenda,
  parseAgendaRow,
  isMeetingType,
  validateAgenda,
  type MeetingType,
} from "@/lib/meeting-agendas";
import {
  type CcMeetingAgendaRow,
} from "@/components/meeting-agendas/agenda-source";
import type {
  AgendaDraft,
  StoredAgenda,
} from "@/components/meeting-agendas/agenda-draft";

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface Actor {
  id: string;
  name: string;
}

interface Context {
  supabase: Supabase;
  orgId: string;
  actor: Actor;
}

/**
 * Display name for the signed-in teammate. The `team_members` row wins because
 * that is the name the rest of the Command Center shows, and `display_name`
 * wins inside it because that is the name the person chose for themselves.
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

async function context(): Promise<Context | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  const orgId = await getActiveOrgId();
  const supabase = await createClient();
  return { supabase, orgId, actor: await resolveActor(supabase, orgId, userId) };
}

/**
 * Write one agenda. Returns the stored agenda as it will now be read back —
 * the caller renders that rather than its own form state, so what the room
 * will run is what Settings shows.
 */
async function writeAgenda(
  ctx: Context,
  draft: AgendaDraft,
): Promise<ActionResult<StoredAgenda>> {
  const checked = validateAgenda(draft);
  if (!checked.ok) return { ok: false, error: checked.errors.join(" ") };
  const agenda = checked.agenda;

  const { data, error } = await ctx.supabase
    .from("cc_meeting_agendas")
    .upsert(
      {
        org_id: ctx.orgId,
        type: agenda.type,
        label: agenda.label,
        cadence: agenda.cadence,
        purpose: agenda.purpose,
        title_prefix: agenda.titlePrefix,
        sections: agenda.sections,
        updated_by: ctx.actor.id,
        updated_by_name: ctx.actor.name,
        // `updated_at` has no trigger on this project — stamped explicitly so
        // "last edited" is real rather than the row's creation time.
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,type" },
    )
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  // Zero rows back means the write was filtered out, not that it succeeded.
  if (!data) {
    return {
      ok: false,
      error:
        "The agenda was not saved — the database accepted no rows for your workspace. Nothing has changed; try again, and if it keeps happening your session may need a refresh.",
    };
  }

  const row = data as CcMeetingAgendaRow;
  const stored = parseAgendaRow(row);
  if (!stored) {
    return {
      ok: false,
      error: "The agenda was saved but came back in a shape the meeting room can't run. Please reload and check it.",
    };
  }

  // The meeting picker and the meeting room live on /level-10.
  revalidatePath("/settings");
  revalidatePath("/level-10");

  return {
    ok: true,
    data: {
      agenda: stored,
      fromDatabase: true,
      updatedByName: row.updated_by_name,
      updatedAt: row.updated_at,
    },
  };
}

/** Save the edited agenda for one meeting type. */
export async function saveMeetingAgenda(
  draft: AgendaDraft,
): Promise<ActionResult<StoredAgenda>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  return writeAgenda(ctx, draft);
}

/**
 * Put the EOS standard back for one meeting type.
 *
 * Written from the code constants rather than by deleting the row, so the reset
 * is itself an edit with a name and a time against it — "reset to standard by
 * Maurice" is worth more than a row quietly disappearing.
 */
export async function resetMeetingAgenda(
  type: MeetingType,
): Promise<ActionResult<StoredAgenda>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!isMeetingType(type)) {
    return { ok: false, error: `"${type}" is not a meeting type this system knows.` };
  }
  const standard = defaultAgenda(type);
  return writeAgenda(ctx, {
    type: standard.type,
    label: standard.label,
    cadence: standard.cadence,
    purpose: standard.purpose,
    titlePrefix: standard.titlePrefix,
    sections: standard.sections,
  });
}
