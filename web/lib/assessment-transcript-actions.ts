"use server";

/**
 * The recording as a second note-taker.
 *
 * Zoom sync already lands every cloud recording's transcript in `meetings`
 * (lib/zoom-sync.ts). This turns one of those transcripts into a DRAFT of the
 * five block notes, the engine metrics and the Block 1 baseline, and parks it
 * under `session_notes.transcriptDraft`. It never writes a block note, a
 * metric or a baseline field: the facilitator reads each proposal against the
 * quote it rests on and accepts it, or doesn't. That is the same posture as
 * every other AI surface in the diagnostic, and it is what lets the report
 * keep saying "not an AI-generated audit".
 */

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import {
  DEFAULT_MODEL,
  describeFallback,
  generateWithFallback,
} from "@/lib/ai";
import { SESSION_BLOCK_SCRIPTS } from "@/lib/assessment-facilitation";
import {
  BLOCK_IDS,
  ENGINE_METRICS,
  SESSION_BLOCKS,
  TRANSCRIPT_BASELINE_KEYS,
  type BlockId,
  type EngineMetricKey,
  type TranscriptBaselineKey,
  type TranscriptDraft,
} from "@/lib/assessment-session";
import type { ActionResult } from "@/lib/assessment-actions";
import type { CcAssessment, Json } from "@/lib/supabase/types";
import { vttToText } from "@/lib/zoom-sync";

/** A Zoom transcript of a four-hour intensive runs to ~250 KB; this is headroom, not a target. */
const MAX_TRANSCRIPT_CHARS = 700_000;

/**
 * Uploads: `serverActions.bodySizeLimit` in next.config.ts is set just above
 * this so the file fits the request; Vercel refuses any body past 4.5 MB.
 */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const UPLOAD_EXTENSIONS = new Set(["vtt", "srt", "txt"]);
/** Below this a transcript is a fragment, not a session — same bar as the draft action. */
const MIN_TRANSCRIPT_CHARS = 200;

export interface TranscriptMeetingOption {
  id: string;
  title: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  source: string;
}

async function requireOrg(): Promise<{ orgId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  return { orgId: await getActiveOrgId() };
}

/**
 * Recordings that carry a transcript, newest first. The list is the picker's;
 * the transcript itself is only read once one is chosen.
 */
export async function listTranscriptMeetings(): Promise<
  ActionResult<{ meetings: TranscriptMeetingOption[] }>
> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("meetings")
    .select("id, title, scheduled_at, duration_minutes, source")
    .eq("org_id", ctx.orgId)
    .not("transcript", "is", null)
    .gte("created_at", since)
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .limit(40);

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: { meetings: (data ?? []) as TranscriptMeetingOption[] },
  };
}

// ── The prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the second note-taker in a CREAiT Growth & AI Diagnostic intensive: a four-hour structured interview between a facilitator and a business owner. You are given the transcript and the facilitator's own question script, and you draft the working notes the facilitator will score from tonight.

Rules, none optional:
- Use only what is in the transcript. If the recording does not answer a question, list that question under not_covered. Never fill a gap from general knowledge of the industry.
- Quote the owner verbatim wherever a line carries a score: a number, a "we don't", an "I'm the only one who", a customer name. The scoring rubric wants quotes, not paraphrase.
- Numbers only as the owner said them. Keep "about", "roughly", "I think" in the value when they said it. Never convert a monthly figure to annual or vice versa unless the owner did the arithmetic on the call.
- Do not score, rate, judge or diagnose. No "this suggests", no "clearly". Notes, not verdicts.
- Each block note is at most 220 words, organised under short headings that follow the block's questions in order. Plain English. Skip questions that were not asked.
- The transcript labels speakers; treat the facilitator's lines as questions and the owner's as evidence. If the labels are missing or ambiguous, say so once at the top of Block 1's note.
- Return one JSON object and nothing else. No markdown fence, no preamble.`;

function blockBrief(id: BlockId): string {
  const block = SESSION_BLOCKS.find((b) => b.id === id)!;
  const script = SESSION_BLOCK_SCRIPTS[id];
  const questions = script.prompts
    .map((p, i) => `  ${i + 1}. ${p.ask}${p.capture ? ` (write down: ${p.capture})` : ""}`)
    .join("\n");
  return `${id} — ${block.label} (${block.minutes} min)\n${script.purpose}\n${questions}`;
}

function buildPrompt(input: {
  company: string;
  owner: string;
  meetingTitle: string;
  transcript: string;
}): string {
  const blocks = BLOCK_IDS.map(blockBrief).join("\n\n");
  const metrics = ENGINE_METRICS.map(
    (m) => `  ${m.key} — ${m.label}. ${m.hint}`
  ).join("\n");
  const baseline = [
    "  owner_objective — what success in twelve months means, in their words",
    "  owner_belief — what THEY think the bottleneck is, verbatim (this is the Mirror page of the report)",
    "  annual_revenue — last twelve months revenue in dollars, digits only if they gave a number",
    "  gross_margin — gross margin percent, digits only if they gave a number",
    "  operating_profit — operating profit in dollars, digits only if they gave a number",
  ].join("\n");

  return `ENGAGEMENT
Company: ${input.company}
Owner: ${input.owner}
Recording: ${input.meetingTitle}

THE FIVE BLOCKS AND THEIR QUESTIONS
${blocks}

ENGINE METRICS (a value and the verbatim line it comes from; null when not stated)
${metrics}

BASELINE FIELDS (same rule)
${baseline}

OUTPUT SHAPE (exactly this; every block key present)
{
  "blocks": {
    "b1": { "note": "...", "quotes": ["..."], "not_covered": ["..."] },
    "b2": { "note": "...", "quotes": ["..."], "not_covered": ["..."] },
    "b3": { "note": "...", "quotes": ["..."], "not_covered": ["..."] },
    "b4": { "note": "...", "quotes": ["..."], "not_covered": ["..."] },
    "b5": { "note": "...", "quotes": ["..."], "not_covered": ["..."] }
  },
  "metrics": { "leads_per_month": { "value": "...", "quote": "..." } | null, ... },
  "baseline": { "owner_belief": { "value": "...", "quote": "..." } | null, ... }
}

TRANSCRIPT
${input.transcript}`;
}

// ── Parsing what comes back ─────────────────────────────────────────────────

const Item = z
  .object({ value: z.string(), quote: z.string().nullable().optional() })
  .nullable();

const Shape = z.object({
  blocks: z.record(
    z.string(),
    z.object({
      note: z.string().default(""),
      quotes: z.array(z.string()).default([]),
      not_covered: z.array(z.string()).default([]),
    })
  ),
  metrics: z.record(z.string(), Item).default({}),
  baseline: z.record(z.string(), Item).default({}),
});

/** The model is told to return bare JSON; this forgives a fence or a preamble. */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in the response");
  return JSON.parse(text.slice(start, end + 1));
}

const BLOCK_SET = new Set<string>(BLOCK_IDS);
const METRIC_SET = new Set<string>(ENGINE_METRICS.map((m) => m.key));
const BASELINE_SET = new Set<string>(TRANSCRIPT_BASELINE_KEYS);

function toDraft(
  parsed: z.infer<typeof Shape>,
  meta: Pick<TranscriptDraft, "meeting_id" | "meeting_title" | "model">
): TranscriptDraft {
  const draft: TranscriptDraft = {
    ...meta,
    drafted_at: new Date().toISOString(),
    blocks: {},
    metrics: {},
    baseline: {},
  };
  for (const [key, b] of Object.entries(parsed.blocks)) {
    if (!BLOCK_SET.has(key)) continue;
    draft.blocks[key as BlockId] = {
      note: b.note.trim(),
      quotes: b.quotes.map((q) => q.trim()).filter(Boolean),
      not_covered: b.not_covered.map((q) => q.trim()).filter(Boolean),
    };
  }
  for (const [key, item] of Object.entries(parsed.metrics)) {
    if (!METRIC_SET.has(key) || !item || !item.value.trim()) continue;
    draft.metrics[key as EngineMetricKey] = {
      value: item.value.trim(),
      quote: item.quote?.trim() || null,
    };
  }
  for (const [key, item] of Object.entries(parsed.baseline)) {
    if (!BASELINE_SET.has(key) || !item || !item.value.trim()) continue;
    draft.baseline[key as TranscriptBaselineKey] = {
      value: item.value.trim(),
      quote: item.quote?.trim() || null,
    };
  }
  return draft;
}

// ── The actions ─────────────────────────────────────────────────────────────

async function writeDraft(
  assessmentId: string,
  orgId: string,
  draft: TranscriptDraft | null
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("cc_assessments")
    .select("session_notes, status")
    .eq("id", assessmentId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!row) return { ok: false, error: "Assessment not found" };

  const current = (row as { session_notes: unknown; status: string });
  if (current.status === "delivered") {
    return {
      ok: false,
      error:
        "This engagement is delivered. Reopen it for edits before drafting from a recording.",
    };
  }
  const stored = current.session_notes;
  const base: Record<string, Json> =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? { ...(stored as Record<string, Json>) }
      : {};
  if (draft) {
    base.transcriptDraft = draft as unknown as Json;
  } else {
    delete base.transcriptDraft;
  }

  // Under RLS a refused update reports success with no rows — hand a row back.
  const { data, error } = await supabase
    .from("cc_assessments")
    .update({ session_notes: base, updated_at: new Date().toISOString() })
    .eq("id", assessmentId)
    .eq("org_id", orgId)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: "The draft did not save — the engagement may be delivered or you may not have access.",
    };
  }
  revalidatePath(`/assessments/${assessmentId}`);
  return { ok: true, data: { assessment: data as CcAssessment } };
}

/**
 * Read one recording's transcript and park a draft on the engagement.
 * Nothing the facilitator wrote is touched.
 */
export async function draftSessionFromTranscript(
  assessmentId: string,
  meetingId: string
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const [{ data: assessmentRow, error: aError }, { data: meetingRow, error: mError }] =
    await Promise.all([
      supabase
        .from("cc_assessments")
        .select("id, company, client_name, status")
        .eq("id", assessmentId)
        .eq("org_id", ctx.orgId)
        .maybeSingle(),
      supabase
        .from("meetings")
        .select("id, title, transcript")
        .eq("id", meetingId)
        .eq("org_id", ctx.orgId)
        .maybeSingle(),
    ]);
  if (aError) return { ok: false, error: aError.message };
  if (mError) return { ok: false, error: mError.message };
  if (!assessmentRow) return { ok: false, error: "Assessment not found" };
  if (!meetingRow) return { ok: false, error: "Recording not found" };

  const assessment = assessmentRow as Pick<
    CcAssessment,
    "id" | "company" | "client_name" | "status"
  >;
  const meeting = meetingRow as { id: string; title: string; transcript: string | null };
  if (assessment.status === "delivered") {
    return {
      ok: false,
      error:
        "This engagement is delivered. Reopen it for edits before drafting from a recording.",
    };
  }
  const transcript = (meeting.transcript ?? "").trim();
  if (transcript.length < 200) {
    return {
      ok: false,
      error: "That recording has no usable transcript yet — Zoom sync fills it in once the cloud recording finishes processing.",
    };
  }

  const prompt = buildPrompt({
    company: assessment.company?.trim() || assessment.client_name,
    owner: assessment.client_name,
    meetingTitle: meeting.title,
    transcript:
      transcript.length > MAX_TRANSCRIPT_CHARS
        ? `${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}\n\n[transcript truncated at ${MAX_TRANSCRIPT_CHARS.toLocaleString("en-US")} characters]`
        : transcript,
  });

  let text: string;
  let servedModel: string;
  try {
    const out = await generateWithFallback({
      model: DEFAULT_MODEL,
      system: SYSTEM_PROMPT,
      prompt,
      temperature: 0.2,
      maxOutputTokens: 6000,
    });
    text = out.result.text;
    servedModel = out.servedModel;
    if (out.fellBack) {
      console.warn(
        `[assessment-transcript] served by ${out.servedModel} — ${describeFallback(out.fallback)}`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "The model did not answer.";
    return { ok: false, error: `Could not draft from the recording: ${message}` };
  }

  let parsed: z.infer<typeof Shape>;
  try {
    parsed = Shape.parse(extractJson(text));
  } catch {
    return {
      ok: false,
      error:
        "The model's answer was not in the expected shape. Try once more; if it repeats, the transcript may be too fragmented to read.",
    };
  }

  const draft = toDraft(parsed, {
    meeting_id: meeting.id,
    meeting_title: meeting.title,
    model: servedModel,
  });
  return writeDraft(assessmentId, ctx.orgId, draft);
}

/** Drop the parked draft. Accepted text stays where it was accepted. */
export async function discardTranscriptDraft(
  assessmentId: string
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  return writeDraft(assessmentId, ctx.orgId, null);
}

/**
 * An in-person session has no Zoom recording. The facilitator records on a
 * phone or another tool and uploads the transcript here; it becomes a
 * `meetings` row like the ones Zoom sync writes, so the picker and the draft
 * action treat it exactly like a cloud recording. The file's own name never
 * reaches the row — the title is composed from the engagement.
 */
export async function uploadTranscriptFile(
  assessmentId: string,
  form: FormData
): Promise<ActionResult<{ meeting: TranscriptMeetingOption }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a transcript file to upload." };
  }
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (!file.name.includes(".") || !UPLOAD_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      error: "Transcripts must be a .vtt, .srt or .txt file.",
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error:
        "That file is over 4 MB, which is as much as a server action will carry. Export the transcript as plain text, or split it.",
    };
  }

  const sessionDateRaw = form.get("session_date");
  let scheduledAt = new Date().toISOString();
  if (typeof sessionDateRaw === "string" && sessionDateRaw.trim()) {
    const parsed = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(sessionDateRaw.trim());
    const date = parsed.success ? new Date(`${parsed.data}T12:00:00Z`) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return { ok: false, error: "The session date must be a calendar date (YYYY-MM-DD)." };
    }
    scheduledAt = date.toISOString();
  }

  const rawText = await file.text();
  const transcript = (extension === "txt" ? rawText : vttToText(rawText)).trim();
  if (transcript.length < MIN_TRANSCRIPT_CHARS) {
    return {
      ok: false,
      error:
        "That file holds almost no speech once the timestamps are stripped. Check it is the transcript, not the audio or a summary.",
    };
  }

  const supabase = await createClient();
  const { data: assessmentRow, error: aError } = await supabase
    .from("cc_assessments")
    .select("id, company, client_name, status")
    .eq("id", assessmentId)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (aError) return { ok: false, error: aError.message };
  if (!assessmentRow) return { ok: false, error: "Assessment not found" };
  const assessment = assessmentRow as Pick<
    CcAssessment,
    "id" | "company" | "client_name" | "status"
  >;
  if (assessment.status === "delivered") {
    return {
      ok: false,
      error:
        "This engagement is delivered. Reopen it for edits before drafting from a recording.",
    };
  }

  const who = assessment.company?.trim() || assessment.client_name;
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      org_id: ctx.orgId,
      title: `Diagnostic session — ${who} (uploaded transcript)`,
      meeting_type: "client",
      scheduled_at: scheduledAt,
      duration_minutes: null,
      attendees: [],
      source: "manual",
      source_id: null,
      transcript,
    })
    .select("id, title, scheduled_at, duration_minutes, source")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: "The transcript did not save — you may not have access to this workspace.",
    };
  }
  return { ok: true, data: { meeting: data as TranscriptMeetingOption } };
}
