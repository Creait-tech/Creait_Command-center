"use server";

/**
 * Server actions for the Assessments module. All writes go through the
 * server-side Supabase client (Clerk JWT → RLS org_isolation), with explicit
 * org ownership checks so a child row can never be written across orgs even
 * when RLS is bypassed.
 */

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import {
  ASSESSMENT_DOCUMENT_KINDS,
  assessmentReadiness,
  computeScores,
  INDICATORS,
  normalizeOverlapFactor,
  OVERLAY_FLAGS,
  toScoreMap,
} from "@/lib/assessment-instrument";
import { BLOCK_IDS, ENGINE_METRICS } from "@/lib/assessment-session";
import type {
  AssessmentDocument,
  AssessmentPillar,
  AssessmentStatus,
  CcAssessment,
  CcAssessmentOpportunity,
  CcAssessmentScore,
  EvidenceConfidence,
  Json,
  OpportunityConfidence,
} from "@/lib/supabase/types";

const BLOCK_ID_VALUES: string[] = BLOCK_IDS;
const ENGINE_METRIC_KEYS: string[] = ENGINE_METRICS.map((m) => m.key);

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
const INDICATOR_KEYS = new Map<string, AssessmentPillar>(
  INDICATORS.map((i) => [i.key, i.pillar])
);
const OVERLAY_KEYS = new Set(OVERLAY_FLAGS.map((f) => f.key));
const DOCUMENT_KINDS = new Set<string>(ASSESSMENT_DOCUMENT_KINDS);

async function requireOrg(): Promise<{ orgId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  return { orgId: await getActiveOrgId() };
}

/**
 * The signed-in person's display name, for the release record. Same fallback
 * ladder the rest of the app uses (see lib/eos-actions.ts): a name if Clerk has
 * one, otherwise the email — an audit line that says "Teammate" records nothing.
 */
async function reviewerName(): Promise<string | null> {
  const user = await currentUser();
  return (
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.trim() ||
    null
  );
}

/**
 * Today in America/New_York, as YYYY-MM-DD.
 *
 * `new Date().toISOString().slice(0, 10)` is UTC, so an engagement started at
 * 8pm in Atlanta was being stamped with tomorrow's date — on the cover of the
 * client's report. Every session date in this module is a business date in the
 * office's own timezone.
 */
function etDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

/**
 * Indicator scores and opportunity edits fire dozens of times during a live
 * scoring session and change nothing on the list card or the workbench (which
 * holds its own state). Busting only the report keeps the printed deliverable
 * fresh without a full page refetch behind every click.
 */
function revalidateReport(id: string) {
  revalidatePath(`/assessments/${id}/report`);
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
      started_at: etDate(),
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export interface AssessmentPatch {
  /** The person in the room. */
  client_name?: string;
  /** The business being assessed — this is the report cover line. */
  company?: string | null;
  industry?: string | null;
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
  /** Data-room evidence (migration 0012). */
  pnl_on_file?: boolean;
  /** Who signs the release. Defaults to the signed-in user at delivery. */
  reviewed_by?: string | null;
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

  if (patch.client_name !== undefined) {
    const name = patch.client_name.trim();
    if (!name) return { ok: false, error: "Primary contact cannot be empty" };
    update.client_name = name;
  }
  if (patch.company !== undefined) update.company = patch.company?.trim() || null;
  if (patch.industry !== undefined)
    update.industry = patch.industry?.trim() || null;
  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status)) {
      return { ok: false, error: `Invalid status: ${patch.status}` };
    }
    update.status = patch.status;
    if (patch.status === "delivered" && patch.delivered_at === undefined) {
      update.delivered_at = etDate();
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
  if (patch.pnl_on_file !== undefined) {
    update.pnl_on_file = Boolean(patch.pnl_on_file);
  }
  if (patch.reviewed_by !== undefined) {
    update.reviewed_by = patch.reviewed_by?.trim() || null;
  }
  if (patch.overlay_flags !== undefined) {
    // Every flag is checked against OVERLAY_FLAGS. An unrecognised key would
    // store silently and then simply fail to render in the report — a critical
    // constraint warning that disappears is the one failure this module cannot
    // have.
    const flags = patch.overlay_flags.filter((f) => typeof f === "string");
    const unknown = flags.filter((f) => !OVERLAY_KEYS.has(f));
    if (unknown.length > 0) {
      return {
        ok: false,
        error: `Unknown overlay flag${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`,
      };
    }
    update.overlay_flags = Array.from(new Set(flags));
  }
  if (patch.plan_items !== undefined) {
    update.plan_items = patch.plan_items
      .filter((p) => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  if (patch.overlap_factor !== undefined) {
    // Out-of-range input silently becomes the default rather than inflating
    // (>1) or zeroing (<=0) the portfolio. The workbench re-renders from the
    // returned row so the input always shows what was actually stored.
    update.overlap_factor = normalizeOverlapFactor(patch.overlap_factor);
  }

  const supabase = await createClient();

  /**
   * "Delivered" is a release, not a status. The same readiness rules the
   * workbench shows are re-run here against the stored rows — a client with a
   * stale checklist, a second tab, or a direct action call cannot mark an
   * engagement delivered that would not pass the gate — and the moment it
   * passes we write down who released it and exactly what was released.
   */
  if (patch.status === "delivered") {
    const gate = await deliveryGate(supabase, id, ctx.orgId, patch, update);
    if ("error" in gate) return { ok: false, error: gate.error };
    Object.assign(update, gate.fields);
  }

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
 * Run the release gate and build the columns that record the release.
 * Readiness is computed from the STORED rows merged with this patch, so the
 * gate judges the engagement as it will exist after the write.
 */
async function deliveryGate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  orgId: string,
  patch: AssessmentPatch,
  update: Record<string, unknown>
): Promise<{ fields: Record<string, unknown> } | { error: string }> {
  const { data: row, error: readError } = await supabase
    .from("cc_assessments")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (readError) return { error: readError.message };
  if (!row) return { error: "Assessment not found" };
  const stored = row as CcAssessment;

  const [scoresRes, oppsRes] = await Promise.all([
    supabase.from("cc_assessment_scores").select("*").eq("assessment_id", id),
    supabase
      .from("cc_assessment_opportunities")
      .select("*")
      .eq("assessment_id", id)
      .order("rank", { ascending: true }),
  ]);
  if (scoresRes.error) return { error: scoresRes.error.message };
  if (oppsRes.error) return { error: oppsRes.error.message };

  const scoreRows = (scoresRes.data as CcAssessmentScore[] | null) ?? [];
  const oppRows = (oppsRes.data as CcAssessmentOpportunity[] | null) ?? [];
  const scores = toScoreMap(scoreRows);

  const reviewer =
    (typeof update.reviewed_by === "string" ? update.reviewed_by : null) ||
    stored.reviewed_by?.trim() ||
    (await reviewerName());

  const readiness = assessmentReadiness({
    scores,
    opportunities: oppRows,
    assessment: {
      primary_constraint:
        (update.primary_constraint as string | null | undefined) ??
        stored.primary_constraint,
      constraint_cost:
        (update.constraint_cost as string | null | undefined) ??
        stored.constraint_cost,
      pnl_on_file:
        (update.pnl_on_file as boolean | undefined) ?? stored.pnl_on_file,
      reviewed_by: reviewer,
      overlay_flags:
        (update.overlay_flags as unknown) ?? stored.overlay_flags,
      overlap_factor:
        (update.overlap_factor as number | undefined) ?? stored.overlap_factor,
    },
  });

  if (!readiness.ready) {
    return {
      error: `Not ready to deliver:\n• ${readiness.blockers.join("\n• ")}`,
    };
  }

  const now = new Date().toISOString();
  return {
    fields: {
      reviewed_by: reviewer,
      reviewed_at: now,
      delivered_at: patch.delivered_at ?? etDate(),
      delivered_snapshot: {
        at: now,
        reviewed_by: reviewer,
        scores: scoreRows,
        opportunities: oppRows,
        computed: computeScores(scores),
        readiness,
      } as unknown as Json,
    },
  };
}

/**
 * Plan items are edited one at a time, often in rapid succession at the end of
 * a session — and often by two founders on the same engagement at once.
 *
 * A read-modify-write round trip only survives a single editor: two callers
 * both read the same array and the second write silently discards the first
 * item. Both mutations therefore run inside Postgres (migration 0005), where
 * the row lock serializes them and nothing can be lost or reordered.
 *
 * The read-modify-write path below is kept only as a fallback for a database
 * that has not had 0005 applied yet, so a missing migration degrades to the
 * old behaviour instead of breaking the 90-day plan outright.
 */
function currentPlanItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** PostgREST reports a missing function as PGRST202 (schema-cache miss). */
function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /could not find the function|does not exist/i.test(error.message ?? "")
  );
}

async function writePlanItemsFallback(
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("cc_assessment_plan_append", {
      p_id: id,
      p_org: ctx.orgId,
      p_item: trimmed,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingFunction(error)) {
      return writePlanItemsFallback(id, ctx.orgId, (items) => [
        ...items,
        trimmed,
      ]);
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "Assessment not found" };

  revalidate(id);
  return { ok: true, data: { assessment: data as CcAssessment } };
}

export async function removePlanItem(
  id: string,
  item: string,
  index: number
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("cc_assessment_plan_remove", {
      p_id: id,
      p_org: ctx.orgId,
      p_item: item,
      p_index: Number.isInteger(index) ? index : -1,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingFunction(error)) {
      return writePlanItemsFallback(id, ctx.orgId, (items) => {
        // Prefer the exact index when it still holds the expected text; fall
        // back to the first text match so a concurrent insert can't delete the
        // wrong line.
        if (items[index] === item) return items.filter((_, i) => i !== index);
        const match = items.indexOf(item);
        return match === -1 ? items : items.filter((_, i) => i !== match);
      });
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "Assessment not found" };

  revalidate(id);
  return { ok: true, data: { assessment: data as CcAssessment } };
}

/**
 * Move one plan item up or down. Same atomicity as append/remove (0006): the
 * swap happens inside a single row lock in the database, because a
 * read-modify-write reorder built from a stale client array can resurrect a
 * deleted item or drop a concurrent insert.
 */
export async function reorderPlanItems(
  id: string,
  item: string,
  index: number,
  direction: "up" | "down"
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const trimmed = item.trim();
  if (!trimmed) return { ok: false, error: "Plan item is empty" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("cc_assessment_plan_reorder", {
      p_id: id,
      p_org: ctx.orgId,
      p_item: trimmed,
      p_index: Number.isInteger(index) ? index : -1,
      p_direction: direction,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingFunction(error)) {
      return writePlanItemsFallback(id, ctx.orgId, (items) => {
        const from =
          items[index] === trimmed ? index : items.indexOf(trimmed);
        if (from === -1) return items;
        const to = direction === "up" ? from - 1 : from + 1;
        if (to < 0 || to >= items.length) return items;
        const next = [...items];
        next[from] = items[to];
        next[to] = items[from];
        return next;
      });
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "Assessment not found" };

  revalidate(id);
  return { ok: true, data: { assessment: data as CcAssessment } };
}

/**
 * Live capture from the five-block Diagnostic Intensive (migration 0006).
 *
 * Merged on the server for the same reason the plan items are: during a session
 * a block's notes, its timer and an engine number can all be in flight at once,
 * and a client-side whole-object write would silently drop whichever landed
 * first. Each call reads the stored JSON, applies only the keys it was given,
 * and writes it back.
 */
export async function updateSessionNotes(
  id: string,
  patch: {
    blockId?: string;
    notes?: string;
    elapsedSeconds?: number;
    metrics?: Record<string, string>;
  }
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("cc_assessments")
    .select("session_notes")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .single();

  if (readError) return { ok: false, error: readError.message };

  const stored = (row as { session_notes: unknown }).session_notes;
  const base: Record<string, Json> =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? { ...(stored as Record<string, Json>) }
      : {};

  if (patch.blockId && BLOCK_ID_VALUES.includes(patch.blockId)) {
    if (patch.notes !== undefined) {
      const blocks: Record<string, Json> =
        base.blocks &&
        typeof base.blocks === "object" &&
        !Array.isArray(base.blocks)
          ? { ...(base.blocks as Record<string, Json>) }
          : {};
      blocks[patch.blockId] = patch.notes;
      base.blocks = blocks;
    }
    if (
      patch.elapsedSeconds !== undefined &&
      Number.isFinite(patch.elapsedSeconds) &&
      patch.elapsedSeconds >= 0
    ) {
      const elapsed: Record<string, Json> =
        base.elapsed &&
        typeof base.elapsed === "object" &&
        !Array.isArray(base.elapsed)
          ? { ...(base.elapsed as Record<string, Json>) }
          : {};
      elapsed[patch.blockId] = Math.round(patch.elapsedSeconds);
      base.elapsed = elapsed;
    }
  }

  if (patch.metrics) {
    for (const [key, value] of Object.entries(patch.metrics)) {
      if (ENGINE_METRIC_KEYS.includes(key) && typeof value === "string") {
        base[key] = value;
      }
    }
  }

  const { data, error } = await supabase
    .from("cc_assessments")
    .update({ session_notes: base, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidate(id);
  return { ok: true, data: { assessment: data as CcAssessment } };
}

export async function deleteAssessment(id: string): Promise<ActionResult> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  // A refused DELETE under RLS matches zero rows and returns 204 — without the
  // .select() the screen would say the engagement was deleted while it sits
  // untouched in the database.
  const { data, error } = await supabase
    .from("cc_assessments")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Nothing was deleted — you may not have access to this engagement." };
  }
  revalidate(id);
  return { ok: true };
}

/**
 * The data room behind the Profit pillar: which documents we actually hold.
 * Separate from updateAssessment because it is a list edit with its own
 * validation, and because "we have the P&L" is the single fact that decides
 * whether the report prints the unaudited-figures disclosure.
 */
export async function setAssessmentDocuments(
  id: string,
  input: {
    pnl_on_file?: boolean;
    documents?: Array<{ name: string; kind: string; received_on?: string | null }>;
  }
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.pnl_on_file !== undefined) {
    update.pnl_on_file = Boolean(input.pnl_on_file);
  }

  if (input.documents !== undefined) {
    const docs: AssessmentDocument[] = [];
    for (const doc of input.documents) {
      const name = typeof doc?.name === "string" ? doc.name.trim() : "";
      if (!name) continue;
      if (!DOCUMENT_KINDS.has(doc.kind)) {
        return { ok: false, error: `Unknown document kind: ${doc.kind}` };
      }
      docs.push({
        name,
        kind: doc.kind as AssessmentDocument["kind"],
        received_on: doc.received_on?.trim() || etDate(),
      });
    }
    update.documents = docs;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cc_assessments")
    .update(update)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Assessment not found" };
  revalidate(id);
  return { ok: true, data: { assessment: data as CcAssessment } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicator scores
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A whole 0–4 or null — or the error message to return. Anything fractional,
 * infinite or NaN is refused rather than coerced.
 */
function wholeScore(
  value: number | null | undefined,
  label: string
): number | null | string {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    return `${label} must be a whole number 0–4`;
  }
  if (value < 0 || value > 4) return `${label} must be 0–4`;
  return value;
}

export async function upsertIndicatorScore(input: {
  assessment_id: string;
  indicator_key: string;
  score?: number | null;
  /** Advisor-set target 0–4 (migration 0007). undefined = leave as stored. */
  potential_score?: number | null;
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

  // A 0–4 behavioral scale has no in-between values, so a 2.5 is a mistake
  // upstream, not a number to round: truncating it would store a score the
  // facilitator never chose and print it as though they had. Rejected, loudly.
  const score = wholeScore(input.score, "Score");
  if (typeof score === "string") return { ok: false, error: score };
  const potential = wholeScore(input.potential_score, "Potential");
  if (typeof potential === "string") return { ok: false, error: potential };

  const evidence = (input.evidence_confidence ?? "unknown") as EvidenceConfidence;
  if (!(EVIDENCE as string[]).includes(evidence)) {
    return { ok: false, error: `Invalid evidence confidence: ${evidence}` };
  }

  const supabase = await createClient();
  if (!(await ownAssessment(supabase, input.assessment_id, ctx.orgId))) {
    return { ok: false, error: "Assessment not found" };
  }

  const notApplicable = Boolean(input.not_applicable);
  const row: Record<string, unknown> = {
    assessment_id: input.assessment_id,
    indicator_key: input.indicator_key,
    pillar,
    score: notApplicable ? null : score,
    not_applicable: notApplicable,
    evidence_confidence: evidence,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  // Only touch the column when the caller sent it, so an older client that
  // doesn't know about potential can never wipe a stored target on update.
  if (input.potential_score !== undefined) {
    row.potential_score = notApplicable ? null : potential;
  }
  // Under RLS a refused UPDATE matches zero rows and reports success, so the
  // upsert has to hand a row back. It is also how the delivered-lock trigger
  // surfaces: a score edited after release raises, and the facilitator sees it.
  const { data, error } = await supabase
    .from("cc_assessment_scores")
    .upsert(row, { onConflict: "assessment_id,indicator_key" })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: `${input.indicator_key} did not save — the engagement may be delivered (move it back to Review to edit) or you may not have access.`,
    };
  }
  revalidateReport(input.assessment_id);
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
  /** AI Workflow Blueprint (migration 0007) — all optional. */
  blueprint?: string | null;
  replaces?: string | null;
  hours_recovered_weekly?: number | string | null;
  /**
   * Owner's own annual estimate (migration 0008). undefined = leave the
   * stored value alone, so an older client can never wipe it on update.
   */
  owner_estimate_annual?: number | string | null;
  /**
   * Every indicator behind this finding is Reported (migration 0012). Forces
   * the ±25% widening and the "based on your estimates" line in the report.
   */
  basis_reported_only?: boolean;
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

  const row: Record<string, unknown> = {
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
    blueprint: input.blueprint?.trim() || null,
    replaces: input.replaces?.trim() || null,
    hours_recovered_weekly: num(input.hours_recovered_weekly),
    updated_at: new Date().toISOString(),
  };
  // Only touch the column when the caller sent it — same rule as
  // potential_score, so a stale client can't wipe a stored estimate.
  if (input.owner_estimate_annual !== undefined) {
    row.owner_estimate_annual = num(input.owner_estimate_annual);
  }
  if (input.basis_reported_only !== undefined) {
    row.basis_reported_only = Boolean(input.basis_reported_only);
  }

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
  if (!data) return { ok: false, error: "Opportunity not found" };
  revalidateReport(input.assessment_id);
  return { ok: true, data: { opportunity: data as CcAssessmentOpportunity } };
}

/**
 * Narrow toggle for the "In report" checkbox. The workbench used to re-send
 * the whole opportunity from client state, which meant a stale row in the
 * browser could overwrite figures another editor had just saved. This touches
 * one column and nothing else.
 */
export async function setOpportunityIncluded(
  id: string,
  assessmentId: string,
  include: boolean
): Promise<ActionResult<{ opportunity: CcAssessmentOpportunity }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  if (!(await ownAssessment(supabase, assessmentId, ctx.orgId))) {
    return { ok: false, error: "Assessment not found" };
  }

  const { data, error } = await supabase
    .from("cc_assessment_opportunities")
    .update({
      include_in_report: Boolean(include),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("assessment_id", assessmentId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Opportunity not found" };
  revalidateReport(assessmentId);
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

  // Same RLS rule as deleteAssessment: an empty result is a refusal, not a
  // success with nothing to do.
  const { data, error } = await supabase
    .from("cc_assessment_opportunities")
    .delete()
    .eq("id", id)
    .eq("assessment_id", assessmentId)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Nothing was deleted — the opportunity may already be gone." };
  }
  revalidateReport(assessmentId);
  return { ok: true };
}
