"use server";

/**
 * Server actions for prep sessions — the solo questionnaire each person fills
 * in before a long meeting.
 *
 * Two rules shape this file.
 *
 * The reveal rule is enforced on the server, not in the UI. "Blind until
 * everyone submits" is the default because seeing someone else's proposed
 * rocks first anchors your own, and an answer you can read by opening dev
 * tools is not blind. `loadPrepSession` therefore decides what a given member
 * may see and returns only that.
 *
 * The synthesis is a draft, never a decision. Accepting a proposed rock or
 * issue writes a real row through the same `createRock` / `createIdsItem`
 * actions a human uses, so it carries normal authorship and normal RLS. The
 * synthesis itself never writes to `cc_rocks` or `ids_items`.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { personName, type ActionResult, type Person } from "@/lib/authorship";
import { createIdsItem, createRock } from "@/lib/eos-actions";
import { startMeeting } from "@/lib/meeting-actions";
import { buildCompanyBrief } from "@/lib/company-brief";
import { DEFAULT_MEETING_AGENDAS, isMeetingType, type MeetingType } from "@/lib/meeting-agendas";
import { defaultPrepQuestions } from "@/lib/prep-questions";
import { synthesizePrepAnswers } from "@/lib/prep-synthesis";
import {
  canSeeOthers,
  type PrepReveal,
  type PrepAnswerRow,
  type PrepParticipantRow,
  type PrepQuestionRow,
  type PrepSessionRow,
  type PrepSessionView,
  type PrepStatus,
} from "@/lib/prep-types";
import type { Json } from "@/lib/supabase/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function context(): Promise<{ supabase: Supabase; orgId: string; userId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  return { supabase: await createClient(), orgId: await getActiveOrgId(), userId };
}

/** The signed-in person's `team_members.id`, or null if they aren't on the roster. */
async function memberIdFor(supabase: Supabase, orgId: string, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("team_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("clerk_user_id", userId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

function revalidatePrep(id: string): void {
  revalidatePath("/prep");
  revalidatePath(`/prep/${id}`);
}

/** Load one prep session, filtered to what this viewer may see. */
export async function loadPrepSession(id: string): Promise<PrepSessionView | null> {
  const ctx = await context();
  if ("error" in ctx) return null;

  const { data } = await ctx.supabase
    .from("cc_prep_sessions")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  const session = data as PrepSessionRow | null;
  if (!session) return null;

  const [questionsRes, participantsRes, peopleRes, answersRes] = await Promise.all([
    ctx.supabase.from("cc_prep_questions").select("*").eq("session_id", id).order("sort_order"),
    ctx.supabase.from("cc_prep_participants").select("*").eq("session_id", id),
    ctx.supabase.from("team_members").select("*").eq("org_id", ctx.orgId).order("full_name"),
    ctx.supabase.from("cc_prep_answers").select("*").eq("session_id", id),
  ]);

  const participants = (participantsRes.data as PrepParticipantRow[] | null) ?? [];
  const viewerMemberId = await memberIdFor(ctx.supabase, ctx.orgId, ctx.userId);
  const revealed = canSeeOthers(session, participants);
  const allAnswers = (answersRes.data as PrepAnswerRow[] | null) ?? [];

  return {
    session,
    questions: (questionsRes.data as PrepQuestionRow[] | null) ?? [],
    participants,
    people: (peopleRes.data as Person[] | null) ?? [],
    // The filter is here, on the server. Sending every answer and hiding some
    // in the browser would make "blind" a decoration.
    answers: revealed ? allAnswers : allAnswers.filter((a) => a.member_id === viewerMemberId),
    viewerMemberId,
    revealed,
  };
}

export async function createPrepSession(input: {
  meetingType: MeetingType;
  title?: string;
  reveal?: PrepReveal;
  dueAt?: string | null;
  participantIds: string[];
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!isMeetingType(input.meetingType)) return { ok: false, error: "Unknown meeting type." };

  const participantIds = Array.from(new Set(input.participantIds.filter((id) => UUID.test(id))));
  if (participantIds.length === 0) return { ok: false, error: "Choose at least one person to answer." };

  const { data: roster } = await ctx.supabase
    .from("team_members")
    .select("id, full_name, display_name, clerk_user_id")
    .eq("org_id", ctx.orgId)
    .in("id", participantIds);
  const known = (roster as Array<{ id: string; full_name: string; display_name: string | null; clerk_user_id: string | null }> | null) ?? [];
  if (known.length !== participantIds.length) {
    return { ok: false, error: "One of the people chosen is not on the team roster." };
  }

  const agenda = DEFAULT_MEETING_AGENDAS[input.meetingType];
  const creator = known.find((m) => m.clerk_user_id === ctx.userId) ?? null;
  const title =
    input.title?.trim() ||
    `${agenda.titlePrefix} prep — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}`;

  const { data: created, error } = await ctx.supabase
    .from("cc_prep_sessions")
    .insert({
      org_id: ctx.orgId,
      meeting_type: input.meetingType,
      title,
      reveal: input.reveal ?? "after_all",
      due_at: input.dueAt || null,
      participant_ids: participantIds,
      created_by: ctx.userId,
      created_by_name: creator ? personName(creator) : null,
    })
    .select("id")
    .single();

  if (error || !created) return { ok: false, error: error?.message ?? "Couldn't create the prep session." };
  const sessionId = (created as { id: string }).id;

  const questions = defaultPrepQuestions(input.meetingType).map((q, i) => ({
    org_id: ctx.orgId,
    session_id: sessionId,
    section_key: q.section_key,
    prompt: q.prompt,
    help: q.help ?? null,
    kind: q.kind,
    sort_order: i,
  }));
  const { error: qError } = await ctx.supabase.from("cc_prep_questions").insert(questions);
  if (qError) return { ok: false, error: `Session created but the questions failed: ${qError.message}` };

  const { error: pError } = await ctx.supabase
    .from("cc_prep_participants")
    .insert(participantIds.map((member_id) => ({ session_id: sessionId, member_id, org_id: ctx.orgId })));
  if (pError) return { ok: false, error: `Session created but the participants failed: ${pError.message}` };

  revalidatePrep(sessionId);
  return { ok: true, data: { id: sessionId } };
}

/** Save (or clear) one person's answer to one question. Their own only. */
export async function savePrepAnswer(input: {
  sessionId: string;
  questionId: string;
  answer?: string | null;
  items?: string[];
}): Promise<ActionResult> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const memberId = await memberIdFor(ctx.supabase, ctx.orgId, ctx.userId);
  if (!memberId) return { ok: false, error: "You're not on the team roster, so you can't answer yet." };

  const { data: session } = await ctx.supabase
    .from("cc_prep_sessions")
    .select("status")
    .eq("id", input.sessionId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!session) return { ok: false, error: "That prep session no longer exists." };
  if ((session as { status: PrepStatus }).status === "closed") {
    return { ok: false, error: "This prep session is closed." };
  }

  const { data, error } = await ctx.supabase
    .from("cc_prep_answers")
    .upsert(
      {
        org_id: ctx.orgId,
        session_id: input.sessionId,
        question_id: input.questionId,
        member_id: memberId,
        answer: input.answer?.trim() || null,
        items: (input.items ?? []).map((i) => i.trim()).filter(Boolean),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "question_id,member_id" },
    )
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "That answer didn't save — your session may not have permission for it." };
  }
  return { ok: true, data: undefined };
}

/** Mark the signed-in person as done. Reversible until the session closes. */
export async function setPrepSubmitted(sessionId: string, submitted: boolean): Promise<ActionResult> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const memberId = await memberIdFor(ctx.supabase, ctx.orgId, ctx.userId);
  if (!memberId) return { ok: false, error: "You're not on the team roster." };

  const { data, error } = await ctx.supabase
    .from("cc_prep_participants")
    .update({ submitted_at: submitted ? new Date().toISOString() : null })
    .eq("session_id", sessionId)
    .eq("member_id", memberId)
    .eq("org_id", ctx.orgId)
    .select("member_id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "You're not a participant in this prep session." };
  revalidatePrep(sessionId);
  return { ok: true, data: undefined };
}

/** Read every answer, ask the model to synthesize, store the draft. */
export async function synthesizePrep(sessionId: string): Promise<ActionResult<{ model: string }>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: sessionData } = await ctx.supabase
    .from("cc_prep_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  const session = sessionData as PrepSessionRow | null;
  if (!session) return { ok: false, error: "That prep session no longer exists." };

  const [questionsRes, answersRes, peopleRes] = await Promise.all([
    ctx.supabase.from("cc_prep_questions").select("*").eq("session_id", sessionId).order("sort_order"),
    ctx.supabase.from("cc_prep_answers").select("*").eq("session_id", sessionId),
    ctx.supabase.from("team_members").select("*").eq("org_id", ctx.orgId),
  ]);

  const questions = (questionsRes.data as PrepQuestionRow[] | null) ?? [];
  const answers = (answersRes.data as PrepAnswerRow[] | null) ?? [];
  const people = (peopleRes.data as Person[] | null) ?? [];
  const byQuestion = new Map(questions.map((q) => [q.id, q]));
  const byMember = new Map(people.map((p) => [p.id, p]));

  const forSynthesis = answers
    .map((a) => {
      const q = byQuestion.get(a.question_id);
      const member = byMember.get(a.member_id);
      if (!q || !member) return null;
      const body = a.items.length > 0 ? a.items.map((i) => `• ${i}`).join("\n") : (a.answer ?? "").trim();
      if (!body) return null;
      return { section_key: q.section_key, prompt: q.prompt, person: personName(member), answer: body };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  if (forSynthesis.length === 0) return { ok: false, error: "Nobody has written anything yet." };

  const brief = await buildCompanyBrief(ctx.supabase, ctx.orgId);
  const label = isMeetingType(session.meeting_type)
    ? DEFAULT_MEETING_AGENDAS[session.meeting_type].label
    : session.meeting_type;

  const result = await synthesizePrepAnswers({
    meetingLabel: label,
    brief,
    answers: forSynthesis,
    people: [...new Set(forSynthesis.map((a) => a.person))],
  });
  if (!result.ok) return { ok: false, error: result.error };

  const { data: saved, error } = await ctx.supabase
    .from("cc_prep_sessions")
    .update({
      synthesis: result.synthesis as unknown as Json,
      synthesized_at: result.synthesis.generated_at,
      synthesis_model: result.synthesis.model,
      status: "synthesized",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("org_id", ctx.orgId)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!saved || saved.length === 0) return { ok: false, error: "The synthesis could not be saved." };

  revalidatePrep(sessionId);
  return { ok: true, data: { model: result.synthesis.model } };
}

/**
 * Accept one proposed rock from the synthesis. Writes a real rock through the
 * same action a human uses, so authorship, RLS and the /rocks page all behave
 * normally — the synthesis itself never touches `cc_rocks`.
 */
export async function acceptProposedRock(input: {
  sessionId: string;
  title: string;
  doneLooksLike?: string | null;
  ownerId?: string | null;
  rockType?: "company" | "individual";
  quarter: string;
  dueDate: string;
}): Promise<ActionResult<{ id: string }>> {
  const result = await createRock({
    title: input.title,
    description: input.doneLooksLike?.trim() || null,
    rockType: input.rockType ?? "company",
    ownerId: input.ownerId ?? null,
    quarter: input.quarter,
    dueDate: input.dueDate,
    smartMeasurable: input.doneLooksLike?.trim() || null,
  });
  if (!result.ok) return result;
  revalidatePrep(input.sessionId);
  revalidatePath("/rocks");
  return { ok: true, data: { id: result.data.id } };
}

/** Accept one proposed issue from the synthesis onto the IDS list. */
export async function acceptProposedIssue(input: {
  sessionId: string;
  title: string;
  why?: string | null;
  isLongTerm?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const result = await createIdsItem({
    title: input.title,
    description: input.why?.trim() || null,
    priority: 5,
    isLongTerm: input.isLongTerm ?? false,
  });
  if (!result.ok) return result;
  revalidatePrep(input.sessionId);
  return { ok: true, data: { id: result.data.id } };
}

/**
 * Open the meeting this prep session was for. The meeting carries the link
 * back, so each section of the room can show what the team already wrote.
 */
export async function startMeetingFromPrep(input: {
  sessionId: string;
  attendeeIds: string[];
  presenterId: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await context();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data } = await ctx.supabase
    .from("cc_prep_sessions")
    .select("meeting_type, meeting_id")
    .eq("id", input.sessionId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  const session = data as { meeting_type: string; meeting_id: string | null } | null;
  if (!session) return { ok: false, error: "That prep session no longer exists." };
  if (session.meeting_id) return { ok: true, data: { id: session.meeting_id } };
  if (!isMeetingType(session.meeting_type)) return { ok: false, error: "That prep session has an unknown meeting type." };

  const started = await startMeeting({
    type: session.meeting_type,
    attendeeIds: input.attendeeIds,
    presenterId: input.presenterId,
    prepSessionId: input.sessionId,
  });
  if (!started.ok) return started;

  const { error } = await ctx.supabase
    .from("cc_prep_sessions")
    .update({ meeting_id: started.data.id, status: "closed", updated_at: new Date().toISOString() })
    .eq("id", input.sessionId)
    .eq("org_id", ctx.orgId)
    .select("id");
  if (error) {
    // The meeting exists and is usable; only the back-link failed.
    console.error("[prep] could not link the meeting to its prep session:", error.message);
  }

  revalidatePrep(input.sessionId);
  return { ok: true, data: { id: started.data.id } };
}
