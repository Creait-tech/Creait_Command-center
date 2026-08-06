"use server";

/**
 * Server actions for the Assessments module. All writes go through the
 * server-side Supabase client (Clerk JWT → RLS org_isolation), with explicit
 * org ownership checks so a child row can never be written across orgs even
 * when RLS is bypassed.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { INDICATORS } from "@/lib/assessment-instrument";
import type {
  AssessmentStatus,
  CcAssessment,
  CcAssessmentOpportunity,
  EvidenceConfidence,
  OpportunityConfidence,
} from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const STATUSES: AssessmentStatus[] = [
  "practice",
  "intake",
  "scoring",
  "review",
  "delivered",
];
const EVIDENCE: EvidenceConfidence[] = [
  "reported",
  "demonstrated",
  "documented",
  "unknown",
];
const CONFIDENCE: OpportunityConfidence[] = ["high", "medium", "low"];
const INDICATOR_KEYS = new Map(INDICATORS.map((i) => [i.key, i.pillar]));

async function requireOrg(): Promise<{ orgId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  return { orgId: await getActiveOrgId() };
}

/** Verify the assessment exists and belongs to the caller's org. */
async function ownAssessment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  orgId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("cc_assessments")
    .select("id")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  return data !== null;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function revalidate(id?: string) {
  revalidatePath("/assessments");
  if (id) {
    revalidatePath(`/assessments/${id}`);
    revalidatePath(`/assessments/${id}/report`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Assessments
// ─────────────────────────────────────────────────────────────────────────────

export async function createAssessment(input: {
  client_name: string;
  company?: string;
  industry?: string;
  is_practice?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const clientName = input.client_name?.trim();
  if (!clientName) return { ok: false, error: "Client name is required" };

  const isPractice = Boolean(input.is_practice);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cc_assessments")
    .insert({
      org_id: ctx.orgId,
      client_name: clientName,
      company: input.company?.trim() || null,
      industry: input.industry?.trim() || null,
      status: (isPractice ? "practice" : "intake") satisfies AssessmentStatus,
      is_practice: isPractice,
      started_at: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export interface AssessmentPatch {
  status?: AssessmentStatus;
  started_at?: string | null;
  delivered_at?: string | null;
  annual_revenue?: number | string | null;
  gross_margin?: number | string | null;
  operating_profit?: number | string | null;
  owner_objective?: string | null;
  owner_belief?: string | null;
  primary_constraint?: string | null;
  constraint_symptoms?: string | null;
  constraint_cost?: string | null;
  constraint_fix?: string | null;
  momentum_initiative?: string | null;
  overlay_flags?: string[];
  plan_items?: string[];
  overlap_factor?: number | string | null;
}

export async function updateAssessment(
  id: string,
  patch: AssessmentPatch
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status)) {
      return { ok: false, error: `Invalid status: ${patch.status}` };
    }
    update.status = patch.status;
    if (patch.status === "delivered" && patch.delivered_at === undefined) {
      update.delivered_at = new Date().toISOString().slice(0, 10);
    }
  }
  if (patch.started_at !== undefined) update.started_at = patch.started_at || null;
  if (patch.delivered_at !== undefined) update.delivered_at = patch.delivered_at || null;
  if (patch.annual_revenue !== undefined) update.annual_revenue = num(patch.annual_revenue);
  if (patch.gross_margin !== undefined) update.gross_margin = num(patch.gross_margin);
  if (patch.operating_profit !== undefined) update.operating_profit = num(patch.operating_profit);
  if (patch.owner_objective !== undefined) update.owner_objective = patch.owner_objective?.trim() || null;
  if (patch.owner_belief !== undefined) update.owner_belief = patch.owner_belief?.trim() || null;
  if (patch.primary_constraint !== undefined) update.primary_constraint = patch.primary_constraint?.trim() || null;
  if (patch.constraint_symptoms !== undefined) update.constraint_symptoms = patch.constraint_symptoms?.trim() || null;
  if (patch.constraint_cost !== undefined) update.constraint_cost = patch.constraint_cost?.trim() || null;
  if (patch.constraint_fix !== undefined) update.constraint_fix = patch.constraint_fix?.trim() || null;
  if (patch.momentum_initiative !== undefined) update.momentum_initiative = patch.momentum_initiative?.trim() || null;
  if (patch.overlay_flags !== undefined) {
    update.overlay_flags = patch.overlay_flags.filter((f) => typeof f === "string");
  }
  if (patch.plan_items !== undefined) {
    update.plan_items = patch.plan_items
      .filter((p) => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  if (patch.overlap_factor !== undefined) {
    const factor = num(patch.overlap_factor);
    update.overlap_factor =
      factor !== null && factor > 0 && factor <= 1 ? factor : 0.7;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cc_assessments")
    .update(update)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidate(id);
  return { ok: true, data: { assessment: data as CcAssessment } };
}

/**
 * Plan items are edited one at a time, often in rapid succession at the end of
 * a session. Sending the whole array from the client raced: a second write
 * built from pre-first-write state silently dropped the earlier item. These two
 * actions read the current array on the server and write the mutation, so each
 * item survives regardless of how fast they arrive.
 */
function currentPlanItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

async function writePlanItems(
  id: string,
  orgId: string,
  mutate: (items: string[]) => string[]
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("cc_assessments")
    .select("plan_items")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (readError) return { ok: false, error: readError.message };

  const next = mutate(currentPlanItems((row as { plan_items: unknown }).plan_items));

  const { data, error } = await supabase
    .from("cc_assessments")
    .update({ plan_items: next, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidate(id);
  return { ok: true, data: { assessment: data as CcAssessment } };
}

export async function appendPlanItem(
  id: string,
  item: string
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const trimmed = item.trim();
  if (!trimmed) return { ok: false, error: "Plan item is empty" };

  return writePlanItems(id, ctx.orgId, (items) => [...items, trimmed]);
}

export async function removePlanItem(
  id: string,
  item: string,
  index: number
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  return writePlanItems(id, ctx.orgId, (items) => {
    // Prefer the exact index when it still holds the expected text; fall back
    // to removing the first text match so a concurrent insert can't delete the
    // wrong line.
    if (items[index] === item) {
      return items.filter((_, i) => i !== index);
    }
    const match = items.indexOf(item);
    return match === -1 ? items : items.filter((_, i) => i !== match);
  });
}

export async function deleteAssessment(id: string): Promise<ActionResult> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("cc_assessments")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId);

  if (error) return { ok: false, error: error.message };
  revalidate(id);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicator scores
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertIndicatorScore(input: {
  assessment_id: string;
  indicator_key: string;
  score?: number | null;
  not_applicable?: boolean;
  evidence_confidence?: EvidenceConfidence;
  notes?: string | null;
}): Promise<ActionResult> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const pillar = INDICATOR_KEYS.get(input.indicator_key);
  if (!pillar) {
    return { ok: false, error: `Unknown indicator: ${input.indicator_key}` };
  }

  const score =
    input.score === null || input.score === undefined
      ? null
      : Math.trunc(input.score);
  if (score !== null && (score < 0 || score > 4)) {
    return { ok: false, error: "Score must be 0–4" };
  }
  const evidence = input.evidence_confidence ?? "unknown";
  if (!EVIDENCE.includes(evidence)) {
    return { ok: false, error: `Invalid evidence confidence: ${evidence}` };
  }

  const supabase = await createClient();
  if (!(await ownAssessment(supabase, input.assessment_id, ctx.orgId))) {
    return { ok: false, error: "Assessment not found" };
  }

  const notApplicable = Boolean(input.not_applicable);
  const { error } = await supabase.from("cc_assessment_scores").upsert(
    {
      assessment_id: input.assessment_id,
      indicator_key: input.indicator_key,
      pillar,
      score: notApplicable ? null : score,
      not_applicable: notApplicable,
      evidence_confidence: evidence,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "assessment_id,indicator_key" }
  );

  if (error) return { ok: false, error: error.message };
  revalidate(input.assessment_id);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Opportunities
// ─────────────────────────────────────────────────────────────────────────────

export interface OpportunityInput {
  id?: string;
  assessment_id: string;
  title: string;
  finding?: string | null;
  annual_low?: number | string | null;
  annual_expected?: number | string | null;
  annual_high?: number | string | null;
  fix_cost?: number | string | null;
  months_to_benefit?: number | string | null;
  confidence?: OpportunityConfidence;
  rank?: number;
  include_in_report?: boolean;
}

export async function saveOpportunity(
  input: OpportunityInput
): Promise<ActionResult<{ opportunity: CcAssessmentOpportunity }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Opportunity title is required" };
  const confidence = input.confidence ?? "medium";
  if (!CONFIDENCE.includes(confidence)) {
    return { ok: false, error: `Invalid confidence: ${confidence}` };
  }

  const supabase = await createClient();
  if (!(await ownAssessment(supabase, input.assessment_id, ctx.orgId))) {
    return { ok: false, error: "Assessment not found" };
  }

  const row = {
    assessment_id: input.assessment_id,
    title,
    finding: input.finding?.trim() || null,
    annual_low: num(input.annual_low),
    annual_expected: num(input.annual_expected),
    annual_high: num(input.annual_high),
    fix_cost: num(input.fix_cost),
    months_to_benefit: num(input.months_to_benefit),
    confidence,
    rank: input.rank ?? 0,
    include_in_report: input.include_in_report ?? true,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase
        .from("cc_assessment_opportunities")
        .update(row)
        .eq("id", input.id)
        .eq("assessment_id", input.assessment_id)
        .select("*")
        .single()
    : supabase
        .from("cc_assessment_opportunities")
        .insert(row)
        .select("*")
        .single();

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  revalidate(input.assessment_id);
  return { ok: true, data: { opportunity: data as CcAssessmentOpportunity } };
}

export async function deleteOpportunity(
  id: string,
  assessmentId: string
): Promise<ActionResult> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  if (!(await ownAssessment(supabase, assessmentId, ctx.orgId))) {
    return { ok: false, error: "Assessment not found" };
  }

  const { error } = await supabase
    .from("cc_assessment_opportunities")
    .delete()
    .eq("id", id)
    .eq("assessment_id", assessmentId);

  if (error) return { ok: false, error: error.message };
  revalidate(assessmentId);
  return { ok: true };
}
