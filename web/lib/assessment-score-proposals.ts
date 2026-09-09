"use server";

/**
 * Proposed scores: the model reads the notes against the rubric, a person decides.
 *
 * After the intensive, someone sits with five blocks of notes, the intake
 * and thirty indicators with four anchors each, and writes thirty evidence
 * notes. This does the first pass: for every indicator it proposes a 0–4
 * against the written anchors, quotes the line it rests on, says why in one
 * sentence, and — when the notes do not support any score — names what to
 * ask instead of guessing. Proposals are parked under
 * `session_notes.scoreProposals` and shown beside each indicator with an
 * Accept button. Nothing touches a score row until the facilitator clicks.
 *
 * Guardrails, in the prompt and again in the parser:
 *   - never N/A (that is a judgement about the business model, a person's call);
 *   - evidence never above Reported unless the notes say the thing was SHOWN,
 *     and never Documented — a document is a fact the facilitator confirms;
 *   - a score without a quote is returned as a gap, not a score;
 *   - the accept records what the facilitator actually applied, so the gap
 *     between proposed and applied is the calibration statistic the training
 *     system needs.
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
import { FACILITATION } from "@/lib/assessment-facilitation";
import {
  anchorsOf,
  INDICATORS,
  NA_RULE,
  SCALE_LABELS,
  type IndicatorKey,
} from "@/lib/assessment-instrument";
import {
  answerText,
  INTAKE_QUESTIONS,
  isUnknown,
  parseIntake,
  tableRows,
} from "@/lib/assessment-intake";
import {
  BLOCK_IDS,
  ENGINE_METRICS,
  parseSessionNotes,
  SESSION_BLOCKS,
  type ScoreProposal,
  type ScoreProposals,
} from "@/lib/assessment-session";
import type { ActionResult } from "@/lib/assessment-actions";
import type {
  CcAssessment,
  CcAssessmentScore,
  Json,
} from "@/lib/supabase/types";

async function requireOrg(): Promise<{ orgId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  return { orgId: await getActiveOrgId() };
}

// ── Building the brief ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the scoring assistant for a CREAiT Growth & AI Diagnostic. A facilitator has run a four-hour structured interview with a business owner and captured notes; the owner also completed a written intake. You propose a score for each of thirty indicators against a written rubric. A person will accept, change or reject every proposal — you are the first pass, not the verdict.

Rules, none optional:
- Score ONLY from the notes and the intake you are given. Never from what businesses like this usually do.
- Every score must rest on a quote: a verbatim line from the notes or the intake. If you cannot quote a line that supports the score, do not score — return score null and name in "gap" the one question the facilitator should ask (a number or an artifact, so answering it also upgrades the evidence).
- Match the anchor text. The rubric writes an anchor at every level 0–4; pick the level whose anchor the evidence actually matches. When the evidence sits between two anchors, take the LOWER one — the rubric's own rule is that a score needs the evidence to reach the anchor, not approach it.
- "Don't know" and "I think so" score the lowest anchor the evidence supports. Never award credit for an intention or a plan.
- Evidence is "reported" when the owner said it. It is "demonstrated" ONLY when the notes say the facilitator saw it on screen or in a report during the session. Never propose "documented" — that is set by the facilitator against the data room.
- Never propose N/A. ${NA_RULE}
- "reason" is one plain sentence, at most 30 words, that a reviewer can check against the quote.
- Return one JSON object and nothing else. No markdown fence, no preamble.`;

function indicatorBrief(key: IndicatorKey): string {
  const def = INDICATORS.find((i) => i.key === key)!;
  const script = FACILITATION[key];
  const anchors = anchorsOf(def)
    .map((a, n) => `    ${n} ${SCALE_LABELS[n]}: ${a}`)
    .join("\n");
  return [
    `${key} — ${def.label} (${def.pillar})`,
    anchors,
    def.note ? `    Note: ${def.note}` : null,
    `    How to score: ${script.scoreHint}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function intakeBrief(intake: unknown): string {
  const answers = parseIntake(intake);
  const lines: string[] = [];
  for (const q of INTAKE_QUESTIONS) {
    const v = answers[q.id];
    if (v === undefined) continue;
    if (isUnknown(v)) {
      lines.push(`${q.id} ${q.prompt}: [not currently known]`);
      continue;
    }
    if (q.type === "table") {
      const rows = tableRows(v)
        .map((r) =>
          Object.entries(r)
            .map(([k, val]) => `${k}=${val}`)
            .join(", ")
        )
        .join(" | ");
      if (rows) lines.push(`${q.id} ${q.prompt}: ${rows}`);
      continue;
    }
    const text = Array.isArray(v)
      ? v.filter((s): s is string => typeof s === "string").join("; ")
      : answerText(v);
    if (text) lines.push(`${q.id} ${q.prompt}: ${text}`);
  }
  return lines.join("\n");
}

function buildPrompt(input: {
  company: string;
  assessment: CcAssessment;
  existing: CcAssessmentScore[];
}): string {
  const notes = parseSessionNotes(input.assessment.session_notes);
  const blocks = BLOCK_IDS.map((id) => {
    const block = SESSION_BLOCKS.find((b) => b.id === id)!;
    const text = notes.blocks?.[id]?.trim();
    const draft = notes.transcriptDraft?.blocks[id];
    return [
      `## ${id} — ${block.label}`,
      text ? text : "(no notes captured for this block)",
      draft?.note
        ? `\n[Draft from the session recording, not yet accepted by the facilitator — treat as reported]\n${draft.note}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
  }).join("\n\n");

  const metrics = ENGINE_METRICS.map((m) => {
    const v = notes[m.key];
    return v ? `${m.label}: ${v}` : null;
  })
    .filter(Boolean)
    .join("\n");

  const crossChecks = Object.entries(notes.crossChecks ?? {})
    .map(([id, r]) => `${id}: ${r?.status} — ${r?.detail}${r?.note ? ` — owner said: ${r.note}` : ""}`)
    .join("\n");

  const already = input.existing
    .filter((s) => s.score !== null || s.not_applicable)
    .map((s) => `${s.indicator_key}: ${s.not_applicable ? "N/A" : s.score}${s.notes ? ` (${s.notes})` : ""}`)
    .join("\n");

  const baseline = [
    input.assessment.annual_revenue !== null ? `Annual revenue: $${input.assessment.annual_revenue}` : null,
    input.assessment.gross_margin !== null ? `Gross margin: ${input.assessment.gross_margin}%` : null,
    input.assessment.operating_profit !== null ? `Operating profit: $${input.assessment.operating_profit}` : null,
    input.assessment.owner_belief ? `Owner's bottleneck belief: "${input.assessment.owner_belief}"` : null,
    `P&L on file: ${input.assessment.pnl_on_file ? "yes" : "no"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const indicators = INDICATORS.map((i) => indicatorBrief(i.key)).join("\n\n");

  return `ENGAGEMENT: ${input.company}
${baseline}

THE THIRTY INDICATORS AND THEIR ANCHORS
${indicators}

SESSION NOTES (the facilitator's own capture, by block)
${blocks}

ENGINE NUMBERS CAPTURED IN THE SESSION
${metrics || "(none)"}

CROSS-CHECKS RUN IN THE SESSION
${crossChecks || "(none)"}

OWNER'S WRITTEN INTAKE (question id, prompt, answer)
${intakeBrief(input.assessment.intake) || "(no intake)"}

SCORES THE FACILITATOR HAS ALREADY ENTERED (propose anyway; the comparison is useful)
${already || "(none yet)"}

OUTPUT SHAPE — one entry for every indicator key P1–P10, S1–S10, L1–L10:
{
  "P1": { "score": 2, "evidence": "reported", "quote": "verbatim line", "reason": "one sentence", "gap": null },
  "P2": { "score": null, "evidence": null, "quote": null, "reason": "why nothing here supports a score", "gap": "the one question to ask" },
  ...
}`;
}

// ── Parsing what comes back ─────────────────────────────────────────────────

const Item = z.object({
  score: z.number().int().min(0).max(4).nullable(),
  evidence: z.enum(["reported", "demonstrated"]).nullable().optional(),
  quote: z.string().nullable().optional(),
  reason: z.string().default(""),
  gap: z.string().nullable().optional(),
});
const Shape = z.record(z.string(), Item);

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in the response");
  return JSON.parse(text.slice(start, end + 1));
}

const KEYS = new Set<string>(INDICATORS.map((i) => i.key));

function toProposals(
  parsed: z.infer<typeof Shape>,
  model: string
): ScoreProposals {
  const items: ScoreProposals["items"] = {};
  for (const [key, item] of Object.entries(parsed)) {
    if (!KEYS.has(key)) continue;
    const quote = item.quote?.trim() || null;
    // A score with nothing to quote is a guess; return it as a gap.
    const score = item.score !== null && quote ? item.score : null;
    items[key] = {
      score,
      evidence: score === null ? null : (item.evidence ?? "reported"),
      quote,
      reason: item.reason.trim(),
      gap:
        score === null
          ? item.gap?.trim() || FACILITATION[key as IndicatorKey].askIfMissing
          : null,
    };
  }
  return { proposed_at: new Date().toISOString(), model, items };
}

// ── Writing ─────────────────────────────────────────────────────────────────

async function writeProposals(
  assessmentId: string,
  orgId: string,
  mutate: (current: ScoreProposals | null) => ScoreProposals | null
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
  const current = row as { session_notes: unknown; status: string };
  if (current.status === "delivered") {
    return {
      ok: false,
      error: "This engagement is delivered. Reopen it for edits before proposing scores.",
    };
  }
  const stored = current.session_notes;
  const base: Record<string, Json> =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? { ...(stored as Record<string, Json>) }
      : {};
  const next = mutate(parseSessionNotes(stored as Json).scoreProposals ?? null);
  if (next) base.scoreProposals = next as unknown as Json;
  else delete base.scoreProposals;

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
      error: "The proposals did not save — the engagement may be delivered or you may not have access.",
    };
  }
  revalidatePath(`/assessments/${assessmentId}`);
  return { ok: true, data: { assessment: data as CcAssessment } };
}

/** Propose a score for all thirty indicators from the notes and intake. */
export async function proposeScores(
  assessmentId: string
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const [{ data: row, error: aError }, { data: scoreRows }] = await Promise.all([
    supabase
      .from("cc_assessments")
      .select("*")
      .eq("id", assessmentId)
      .eq("org_id", ctx.orgId)
      .maybeSingle(),
    supabase.from("cc_assessment_scores").select("*").eq("assessment_id", assessmentId),
  ]);
  if (aError) return { ok: false, error: aError.message };
  if (!row) return { ok: false, error: "Assessment not found" };
  const assessment = row as CcAssessment;
  if (assessment.status === "delivered") {
    return {
      ok: false,
      error: "This engagement is delivered. Reopen it for edits before proposing scores.",
    };
  }

  const notes = parseSessionNotes(assessment.session_notes);
  const captured = BLOCK_IDS.filter((id) => (notes.blocks?.[id] ?? "").trim().length > 0).length;
  const hasIntake = Boolean(assessment.intake_submitted_at);
  if (captured === 0 && !hasIntake) {
    return {
      ok: false,
      error: "There is nothing to score from yet — capture session notes or receive the intake first.",
    };
  }

  const prompt = buildPrompt({
    company: assessment.company?.trim() || assessment.client_name,
    assessment,
    existing: (scoreRows as CcAssessmentScore[] | null) ?? [],
  });

  let text: string;
  let servedModel: string;
  try {
    const out = await generateWithFallback({
      model: DEFAULT_MODEL,
      system: SYSTEM_PROMPT,
      prompt,
      temperature: 0.1,
      maxOutputTokens: 8000,
    });
    text = out.result.text;
    servedModel = out.servedModel;
    if (out.fellBack) {
      console.warn(
        `[score-proposals] served by ${out.servedModel} — ${describeFallback(out.fallback)}`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "The model did not answer.";
    return { ok: false, error: `Could not propose scores: ${message}` };
  }

  let parsed: z.infer<typeof Shape>;
  try {
    parsed = Shape.parse(extractJson(text));
  } catch {
    return {
      ok: false,
      error: "The model's answer was not in the expected shape. Try once more.",
    };
  }

  const proposals = toProposals(parsed, servedModel);
  return writeProposals(assessmentId, ctx.orgId, () => proposals);
}

/**
 * Record what the facilitator applied against one proposal. Called after the
 * score row is written, never instead of it; the proposal itself is untouched
 * so the comparison survives.
 */
export async function recordProposalOutcome(
  assessmentId: string,
  indicatorKey: string,
  appliedScore: number | null
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!KEYS.has(indicatorKey)) return { ok: false, error: `Unknown indicator: ${indicatorKey}` };
  return writeProposals(assessmentId, ctx.orgId, (current) => {
    if (!current?.items[indicatorKey]) return current;
    const item: ScoreProposal = {
      ...current.items[indicatorKey]!,
      applied_score: appliedScore,
      applied_at: new Date().toISOString(),
    };
    return { ...current, items: { ...current.items, [indicatorKey]: item } };
  });
}

/** Drop every proposal. Scores already applied stay where they were applied. */
export async function discardScoreProposals(
  assessmentId: string
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  return writeProposals(assessmentId, ctx.orgId, () => null);
}
