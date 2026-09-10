import "server-only";

import { z } from "zod";

import { DEFAULT_MODEL, describeFallback, generateWithFallback } from "@/lib/ai";
import type { CompanyBrief } from "@/lib/company-brief";

/**
 * Reading every teammate's prep answers and writing back what the room
 * actually has to decide.
 *
 * The synthesis is a draft, never a decision: proposed rocks and issues are
 * accepted one at a time by a human in the meeting, the same rule the agent
 * proposals live under. Every point carries the names of who said it, so the
 * room can argue with a person rather than with the summary.
 */

const AgreementShape = z.object({
  point: z.string(),
  who: z.array(z.string()).default([]),
});

const TensionShape = z.object({
  question: z.string(),
  positions: z
    .array(
      z.object({
        view: z.string(),
        who: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

const RockShape = z.object({
  title: z.string(),
  done_looks_like: z.string().default(""),
  suggested_owner: z.string().nullable().default(null),
  proposed_by: z.array(z.string()).default([]),
  rock_type: z.enum(["company", "individual"]).default("company"),
});

const SectionShape = z.object({
  section_key: z.string(),
  headline: z.string().default(""),
  agreements: z.array(AgreementShape).default([]),
  tensions: z.array(TensionShape).default([]),
});

const SynthesisShape = z.object({
  overview: z.string().default(""),
  sections: z.array(SectionShape).default([]),
  proposed_rocks: z.array(RockShape).default([]),
  proposed_issues: z.array(z.object({ title: z.string(), why: z.string().default("") })).default([]),
  decisions_needed: z.array(z.string()).default([]),
});

export type PrepSynthesis = z.infer<typeof SynthesisShape> & {
  /** Stamped when written so the room can say how fresh the synthesis is. */
  generated_at: string;
  model: string;
};

export interface PrepAnswerForSynthesis {
  section_key: string;
  prompt: string;
  person: string;
  answer: string;
}

const SYSTEM_PROMPT = `You are preparing a leadership team's quarterly or annual planning session.

Everyone answered the same questions alone. Your job is to hand the room the
shortest possible thing that makes the meeting good: what they already agree
on (so they stop re-discussing it), where they genuinely disagree (so they
spend their time there), and the rocks and issues their answers imply.

Rules:
- Attribute every point to the people who made it, by the exact names given.
- A disagreement is only a disagreement if two people actually said different
  things. Do not manufacture tension for symmetry.
- Merge duplicate rock proposals into one, keeping every proposer's name.
- Do not invent facts, numbers, owners or commitments that nobody wrote.
- Write like a sharp operator: plain words, short sentences, no filler.
- Return one JSON object and nothing else. No markdown fence, no preamble.

JSON shape:
{
  "overview": "two or three sentences on where this team stands going in",
  "sections": [{
    "section_key": "the section key given with the questions",
    "headline": "one sentence on this section",
    "agreements": [{"point": "...", "who": ["Name"]}],
    "tensions": [{"question": "the decision to make", "positions": [{"view": "...", "who": ["Name"]}]}]
  }],
  "proposed_rocks": [{"title": "...", "done_looks_like": "...", "suggested_owner": "Name or null", "proposed_by": ["Name"], "rock_type": "company" or "individual"}],
  "proposed_issues": [{"title": "...", "why": "..."}],
  "decisions_needed": ["the decisions the room must actually make"]
}`;

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in the response");
  return JSON.parse(text.slice(start, end + 1));
}

function buildPrompt(input: {
  meetingLabel: string;
  brief: CompanyBrief;
  answers: PrepAnswerForSynthesis[];
  people: string[];
}): string {
  const bySection = new Map<string, PrepAnswerForSynthesis[]>();
  for (const a of input.answers) {
    const list = bySection.get(a.section_key) ?? [];
    list.push(a);
    bySection.set(a.section_key, list);
  }

  const blocks: string[] = [];
  for (const [key, list] of bySection) {
    const byPrompt = new Map<string, PrepAnswerForSynthesis[]>();
    for (const a of list) {
      const l = byPrompt.get(a.prompt) ?? [];
      l.push(a);
      byPrompt.set(a.prompt, l);
    }
    const questions = [...byPrompt.entries()].map(
      ([prompt, answers]) =>
        `Q: ${prompt}\n${answers.map((a) => `  ${a.person}: ${a.answer}`).join("\n")}`,
    );
    blocks.push(`### Section: ${key}\n${questions.join("\n\n")}`);
  }

  return [
    `Meeting: ${input.meetingLabel}`,
    `People who answered: ${input.people.join(", ")}`,
    "",
    "# The company",
    input.brief.text,
    "",
    "# What each person wrote",
    blocks.join("\n\n"),
  ].join("\n");
}

export type SynthesisResult =
  | { ok: true; synthesis: PrepSynthesis }
  | { ok: false; error: string };

export async function synthesizePrepAnswers(input: {
  meetingLabel: string;
  brief: CompanyBrief;
  answers: PrepAnswerForSynthesis[];
  people: string[];
}): Promise<SynthesisResult> {
  if (input.answers.length === 0) {
    return { ok: false, error: "Nobody has answered anything yet." };
  }

  let text: string;
  let servedModel: string;
  try {
    const out = await generateWithFallback({
      model: DEFAULT_MODEL,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(input),
      temperature: 0.2,
      maxOutputTokens: 6000,
    });
    text = out.result.text;
    servedModel = out.servedModel;
    if (out.fellBack) {
      console.warn(`[prep-synthesis] served by ${out.servedModel} — ${describeFallback(out.fallback)}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "The model did not answer.";
    return { ok: false, error: `Could not synthesize the answers: ${message}` };
  }

  try {
    const parsed = SynthesisShape.parse(extractJson(text));
    return {
      ok: true,
      synthesis: { ...parsed, generated_at: new Date().toISOString(), model: servedModel },
    };
  } catch {
    return { ok: false, error: "The model's answer was not in the expected shape. Try once more." };
  }
}
