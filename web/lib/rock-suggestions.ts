"use server";

/**
 * Rock ideas drawn from what the Command Center already knows about the
 * company: the vision and 1-year plan, the scorecard against target, what
 * shipped and what slipped last quarter, the client list, and the issues
 * nobody has solved.
 *
 * These are ideas, not rocks. Nothing is written until someone picks one and
 * edits it into the Add Rock form, because a rock nobody chose is a rock
 * nobody owns.
 */

import { z } from "zod";

import { DEFAULT_MODEL, describeFallback, generateWithFallback } from "@/lib/ai";
import { getActiveOrgId } from "@/lib/active-org";
import { buildCompanyBrief } from "@/lib/company-brief";
import { createClient } from "@/lib/supabase/server";
import { personName, type ActionResult, type Person } from "@/lib/authorship";

const Shape = z.object({
  rocks: z
    .array(
      z.object({
        title: z.string(),
        why: z.string().default(""),
        done_looks_like: z.string().default(""),
        suggested_owner: z.string().nullable().default(null),
        rock_type: z.enum(["company", "individual"]).default("company"),
        evidence: z.string().default(""),
      }),
    )
    .default([]),
});

export interface RockSuggestion {
  title: string;
  why: string;
  doneLooksLike: string;
  suggestedOwner: string | null;
  rockType: "company" | "individual";
  /** The fact in the company data this came from — the reason to trust it. */
  evidence: string;
}

const SYSTEM_PROMPT = `You propose quarterly Rocks (EOS) for a leadership team.

A Rock is one thing that must be done in the next 90 days, owned by exactly
one person, specific enough that on the last day of the quarter nobody argues
about whether it happened.

Rules:
- Ground every Rock in something in the company data you were given. Quote or
  name that fact in "evidence". A Rock you cannot ground is a Rock you must
  not propose.
- Aim at the gap between where the numbers are and where the plan says they
  should be. A scorecard number far from its target, a stalled offer, an
  unsolved issue that keeps costing the team — those are Rocks.
- Never propose work the company has said it will not do this period.
- Do not repeat a Rock the team already has this quarter.
- "done_looks_like" must be measurable: a number, a shipped thing, a date.
- Suggest an owner only when the data makes one obvious; otherwise null.
- Six to eight ideas. The team will pick three to seven.
- Return one JSON object and nothing else. No markdown fence, no preamble.

JSON shape:
{"rocks":[{"title":"...","why":"one sentence on why this quarter","done_looks_like":"...","suggested_owner":"Name or null","rock_type":"company" or "individual","evidence":"the fact from the data this rests on"}]}`;

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in the response");
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Propose rocks for `quarter`. Read-only: this writes nothing anywhere.
 */
export async function suggestRocks(input: {
  quarter: string;
  /** Anything the team wants the suggestions aimed at, in their words. */
  focus?: string | null;
}): Promise<ActionResult<{ suggestions: RockSuggestion[]; model: string; thin: boolean }>> {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const [brief, peopleRes] = await Promise.all([
    buildCompanyBrief(supabase, orgId, { quarter: input.quarter }),
    supabase.from("team_members").select("*").eq("org_id", orgId).eq("status", "active").order("full_name"),
  ]);
  const people = (peopleRes.data as Person[] | null) ?? [];

  const prompt = [
    `Quarter being planned: ${input.quarter}`,
    `People who could own a Rock: ${people.map(personName).join(", ") || "(nobody on the roster yet)"}`,
    input.focus?.trim() ? `What the team wants these aimed at: ${input.focus.trim()}` : null,
    "",
    "# The company",
    brief.text,
  ]
    .filter(Boolean)
    .join("\n");

  let text: string;
  let servedModel: string;
  try {
    const out = await generateWithFallback({
      model: DEFAULT_MODEL,
      system: SYSTEM_PROMPT,
      prompt,
      temperature: 0.4,
      maxOutputTokens: 3000,
    });
    text = out.result.text;
    servedModel = out.servedModel;
    if (out.fellBack) {
      console.warn(`[rock-suggestions] served by ${out.servedModel} — ${describeFallback(out.fallback)}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "The model did not answer.";
    return { ok: false, error: `Could not suggest rocks: ${message}` };
  }

  try {
    const parsed = Shape.parse(extractJson(text));
    return {
      ok: true,
      data: {
        suggestions: parsed.rocks.map((r) => ({
          title: r.title,
          why: r.why,
          doneLooksLike: r.done_looks_like,
          suggestedOwner: r.suggested_owner,
          rockType: r.rock_type,
          evidence: r.evidence,
        })),
        model: servedModel,
        thin: brief.thin,
      },
    };
  } catch {
    return { ok: false, error: "The model's answer was not in the expected shape. Try once more." };
  }
}
