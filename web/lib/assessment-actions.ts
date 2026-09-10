"use server";

/**
 * Server actions for the Assessments module. All writes go through the
 * server-side Supabase client (Clerk JWT → RLS org_isolation), with explicit
 * org ownership checks so a child row can never be written across orgs even
 * when RLS is bypassed.
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
// Every session date in this module is a business date in the office's own
// timezone — see lib/business-date.ts for why UTC was wrong on report covers.
import { todayInET } from "@/lib/business-date";
import { displayNameOf } from "@/lib/display-name";
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
import { intakePrefill, type IntakePrefill } from "@/lib/assessment-intake";
import { parseCalc } from "@/lib/opportunity-calculators";
import type {
  AssessmentDocument,
  AssessmentOutcomeReview,
  AssessmentOutcomes,
  AssessmentPillar,
  AssessmentStatus,
  CcAssessment,
  CcAssessmentOpportunity,
  CcAssessmentScore,
  CcClientStatus,
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
/**
 * Columns that may still be written on a delivered engagement, because none of
 * them change a word of the document that was handed over: the release record
 * itself, the housekeeping timestamp, and the link to the results-session
 * recording. Everything else needs the engagement reopened first. Mirrors the
 * cc_assessments_lock_delivered trigger in migration 0012.
 */
const RELEASE_SAFE_FIELDS = new Set([
  "updated_at",
  "status",
  "delivered_at",
  "reviewed_by",
  "reviewed_by_id",
  "reviewed_at",
  "delivered_snapshot",
  "meeting_id",
  // The client link and the released PDF exist only after delivery (0014).
  "client_token",
  "client_token_issued_at",
  "blueprint_storage_path",
  // What the engagement became is recorded after delivery by definition (0016).
  "converted_to",
  "converted_on",
  "converted_client_id",
]);
const CONVERSIONS = new Set(["build", "advisory"]);
const DOCUMENT_KINDS = new Set<string>(ASSESSMENT_DOCUMENT_KINDS);

async function requireOrg(): Promise<{ orgId: string } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Not signed in" };
  return { orgId: await getActiveOrgId() };
}

/** The signed-in person's display name, for the release record. */
async function reviewerName(): Promise<string | null> {
  return displayNameOf(await currentUser());
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
  // Whoever opens the engagement is presumed to be running it. Setup lets
  // them hand it to someone else; the release gate needs it filled either way.
  const { userId } = await auth();
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
      started_at: todayInET(),
      facilitator_id: userId ?? null,
      facilitator_name: userId ? await reviewerName() : null,
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
  /**
   * Who ran the engagement (migration 0016). Both or neither: an id without a
   * name records nothing a person can read, a name without an id cannot be
   * held against the releaser.
   */
  facilitator_id?: string | null;
  facilitator_name?: string | null;
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
  }
  if (patch.started_at !== undefined) {
    update.started_at = patch.started_at?.trim() || null;
  }
  if (patch.delivered_at !== undefined) {
    // Never let "" reach a DATE column — Postgres rejects it outright.
    update.delivered_at = patch.delivered_at?.trim() || null;
  }
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
  if (patch.facilitator_id !== undefined || patch.facilitator_name !== undefined) {
    const facilitatorId = patch.facilitator_id?.trim() || null;
    const facilitatorName = patch.facilitator_name?.trim() || null;
    if ((facilitatorId === null) !== (facilitatorName === null)) {
      return {
        ok: false,
        error: "Facilitator needs both a user and a name — or neither to clear it.",
      };
    }
    update.facilitator_id = facilitatorId;
    update.facilitator_name = facilitatorName;
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
   * A delivered engagement stops moving. The client is holding a PDF built
   * from these fields, so anything that would change what that document says
   * is refused until the engagement is reopened. The database enforces this
   * too (trigger cc_assessments_lock_delivered in 0012); this check exists to
   * say WHY in a sentence a person can act on.
   */
  const editsContent = Object.keys(update).some(
    (k) => !RELEASE_SAFE_FIELDS.has(k)
  );
  if (editsContent || patch.status !== undefined) {
    const { data: statusRow, error: statusError } = await supabase
      .from("cc_assessments")
      .select("status")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    if (statusError) return { ok: false, error: statusError.message };
    if (!statusRow) return { ok: false, error: "Assessment not found" };
    const storedStatus = (statusRow as { status: AssessmentStatus }).status;

    if (
      storedStatus === "delivered" &&
      editsContent &&
      patch.status !== "review"
    ) {
      return {
        ok: false,
        error:
          "This engagement is delivered. Reopen the engagement (status → review) before editing.",
      };
    }

    /**
     * Leaving "delivered" retires the release: the signature and its timestamp
     * belong to the document that went out, and the next release re-earns them.
     * delivered_snapshot is deliberately kept — it is the history of what was
     * actually handed over.
     */
    if (
      storedStatus === "delivered" &&
      patch.status !== undefined &&
      patch.status !== "delivered"
    ) {
      update.reviewed_by = null;
      update.reviewed_by_id = null;
      update.reviewed_at = null;
    }

    /**
     * Leaving "intake" retires the owner's link. The token is the only thing
     * standing between a URL in an inbox and a writable row, so it dies with
     * the phase it belongs to rather than staying live for the rest of the
     * engagement. Re-issuing from the workbench mints a fresh one.
     */
    if (
      storedStatus === "intake" &&
      patch.status !== undefined &&
      patch.status !== "intake"
    ) {
      update.intake_token = null;
    }
  }

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

  /**
   * The second signature (0016). A real engagement is released by someone
   * other than the person who ran it — the facilitator is too close to their
   * own findings to be the one who says "this is releasable". Judged on the
   * facilitator as it will be after this write, and on the Clerk user id of
   * the session rather than a name, because a name can be typed. Practice
   * engagements are rehearsals and are exempt.
   */
  const { userId } = await auth();
  if (!stored.is_practice) {
    const facilitatorId =
      ("facilitator_id" in update
        ? (update.facilitator_id as string | null)
        : stored.facilitator_id) ?? null;
    if (!facilitatorId) {
      return {
        error:
          "Record who facilitated this engagement in Setup before releasing it — a real engagement needs a second signature.",
      };
    }
    if (userId && userId === facilitatorId) {
      return {
        error:
          "You facilitated this engagement, so you can't release it. Ask another founder to review and release.",
      };
    }
  }

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

  /**
   * The value this field will HAVE after the write. `??` would resurrect the
   * stored value whenever the same patch is clearing the field to null, and
   * the gate would then pass on a constraint that is about to be erased.
   */
  const after = <T,>(field: keyof CcAssessment): T =>
    (field in update ? update[field as string] : stored[field]) as T;

  /**
   * The signed-in person signs this release — not whoever signed the last one.
   * A stored name is only a fallback for a session Clerk cannot name.
   */
  const reviewer =
    (typeof update.reviewed_by === "string"
      ? update.reviewed_by.trim() || null
      : null) ||
    (await reviewerName()) ||
    stored.reviewed_by?.trim() ||
    null;

  const readiness = assessmentReadiness({
    scores,
    opportunities: oppRows,
    assessment: {
      primary_constraint: after<string | null>("primary_constraint"),
      constraint_cost: after<string | null>("constraint_cost"),
      pnl_on_file: after<boolean>("pnl_on_file"),
      reviewed_by: reviewer,
      overlay_flags: after<unknown>("overlay_flags"),
      overlap_factor: after<number>("overlap_factor"),
      owner_belief: after<string | null>("owner_belief"),
      plan_items: after<unknown>("plan_items"),
    },
  });

  if (!readiness.ready) {
    return {
      error: `Not ready to deliver:\n• ${readiness.blockers.join("\n• ")}`,
    };
  }

  const now = new Date().toISOString();
  const deliveredAt = patch.delivered_at?.trim() || todayInET();

  /**
   * The snapshot has to be enough to reconstruct the delivered document on its
   * own, so it carries the parent row's report-relevant fields as they will be
   * after this write — not just the child rows.
   */
  const parent: Record<string, unknown> = {
    client_name: after("client_name"),
    company: after("company"),
    industry: after("industry"),
    started_at: after("started_at"),
    delivered_at: deliveredAt,
    annual_revenue: after("annual_revenue"),
    gross_margin: after("gross_margin"),
    operating_profit: after("operating_profit"),
    owner_objective: after("owner_objective"),
    owner_belief: after("owner_belief"),
    primary_constraint: after("primary_constraint"),
    constraint_symptoms: after("constraint_symptoms"),
    constraint_cost: after("constraint_cost"),
    constraint_fix: after("constraint_fix"),
    momentum_initiative: after("momentum_initiative"),
    overlay_flags: after("overlay_flags"),
    plan_items: after("plan_items"),
    overlap_factor: after("overlap_factor"),
    pnl_on_file: after("pnl_on_file"),
    documents: after("documents"),
    facilitator_id: after("facilitator_id"),
    facilitator_name: after("facilitator_name"),
    is_practice: stored.is_practice,
  };

  return {
    fields: {
      reviewed_by: reviewer,
      reviewed_by_id: userId ?? null,
      reviewed_at: now,
      delivered_at: deliveredAt,
      delivered_snapshot: {
        at: now,
        reviewed_by: reviewer,
        reviewed_by_id: userId ?? null,
        assessment: parent,
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
    /**
     * Live cross-check outcomes, keyed by check id (CROSS_CHECKS in
     * lib/assessment-session.ts). Merged per id so the facilitator's note and a
     * later recomputed status cannot overwrite each other. The ids are not
     * enumerated here on purpose — parseSessionNotes is the authority on which
     * checks render, so a check that is renamed or retired stops being read
     * without needing a second list kept in step; this side only guards the
     * shape and the key.
     */
    crossChecks?: Record<
      string,
      { status?: string; detail?: string; note?: string }
    >;
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

  if (patch.crossChecks) {
    const stored: Record<string, Json> =
      base.crossChecks &&
      typeof base.crossChecks === "object" &&
      !Array.isArray(base.crossChecks)
        ? { ...(base.crossChecks as Record<string, Json>) }
        : {};
    for (const [key, value] of Object.entries(patch.crossChecks)) {
      if (!/^[a-z][a-z0-9_]{2,39}$/.test(key)) continue;
      if (!value || typeof value !== "object") continue;
      const prior =
        stored[key] && typeof stored[key] === "object" && !Array.isArray(stored[key])
          ? (stored[key] as Record<string, Json>)
          : {};
      const merged: Record<string, Json> = { ...prior };
      if (
        value.status === "pass" ||
        value.status === "flag" ||
        value.status === "insufficient"
      ) {
        merged.status = value.status;
      }
      if (typeof value.detail === "string") merged.detail = value.detail;
      if (typeof value.note === "string") merged.note = value.note;
      stored[key] = merged;
    }
    base.crossChecks = stored;
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
    documents?: Array<{
      name: string;
      kind: string;
      received_on?: string | null;
      storage_path?: string | null;
      content_type?: string | null;
      size_bytes?: number | null;
    }>;
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
      // A stored file's path is only ever minted by uploadAssessmentDocument,
      // which puts it under this org and this engagement; anything else is
      // dropped rather than trusted.
      const storagePath =
        typeof doc.storage_path === "string" &&
        doc.storage_path.startsWith(`${ctx.orgId}/${id}/`)
          ? doc.storage_path
          : null;
      docs.push({
        name,
        kind: doc.kind as AssessmentDocument["kind"],
        received_on: doc.received_on?.trim() || todayInET(),
        ...(storagePath
          ? {
              storage_path: storagePath,
              content_type:
                typeof doc.content_type === "string" ? doc.content_type : null,
              size_bytes:
                typeof doc.size_bytes === "number" && Number.isFinite(doc.size_bytes)
                  ? doc.size_bytes
                  : null,
            }
          : {}),
      });
    }
    update.documents = docs;
  }

  const supabase = await createClient();

  // pnl_on_file and documents both change what the report says, so they are
  // locked after release exactly like the constraint block is.
  const { data: statusRow, error: statusError } = await supabase
    .from("cc_assessments")
    .select("status")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (statusError) return { ok: false, error: statusError.message };
  if (!statusRow) return { ok: false, error: "Assessment not found" };
  if ((statusRow as { status: AssessmentStatus }).status === "delivered") {
    return {
      ok: false,
      error:
        "This engagement is delivered. Reopen the engagement (status → review) before editing.",
    };
  }

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
  /**
   * The calculator record behind the range (migration 0013). `null` clears it —
   * which is what the editor sends the moment someone types over a computed
   * figure, because the range is no longer derived. `undefined` leaves the
   * stored record alone, so a client that predates calculators cannot wipe one.
   */
  calc?: unknown;
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
  // The calculator record. Same undefined/null rule as above, and a record
  // that does not validate is refused rather than stored — the report prints
  // this arithmetic to the client, so a half-written chain is worse than none.
  if (input.calc !== undefined) {
    if (input.calc === null) {
      row.calc = null;
    } else {
      const parsed = parseCalc(input.calc);
      if (!parsed) {
        return { ok: false, error: "Calculator record is not valid" };
      }
      row.calc = parsed;
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// Owner intake — the coordinator's side of the tokenised link (migration 0013)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The absolute origin to hand the client, for a link that will be pasted into
 * an email. The request's own host first — a preview deployment must produce a
 * preview link, not a production one — with NEXT_PUBLIC_APP_URL as the answer
 * for any context that has no request headers.
 */
async function requestOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.0.0.1")
          ? "http"
          : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // No request scope (a job, a test) — fall through to the configured URL.
  }
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://cc.getcreait.com").replace(
    /\/+$/,
    ""
  );
}

export interface IntakeLink {
  token: string;
  url: string;
}

/**
 * Mint a fresh intake link.
 *
 * Rotation is the point: every issue replaces the previous token, so a link
 * forwarded to the wrong inbox stops working the moment the coordinator
 * re-sends. Issuing also clears `intake_submitted_at` — the only reason to
 * issue a link on a submitted intake is to let the owner finish or correct it,
 * and a submitted timestamp with a live link would be a lie either way.
 *
 * Only while the engagement is in intake: the token is a phase, not a feature.
 */
export async function issueIntakeLink(
  id: string
): Promise<ActionResult<{ link: IntakeLink; assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("cc_assessments")
    .select("status")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!row) return { ok: false, error: "Assessment not found" };
  if ((row as { status: AssessmentStatus }).status !== "intake") {
    return {
      ok: false,
      error:
        "The intake link only works while the engagement is in Intake. Move it back to Intake to re-open the owner's form.",
    };
  }

  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from("cc_assessments")
    .update({
      intake_token: token,
      intake_submitted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .eq("status", "intake")
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  // A refused UPDATE matches zero rows and reports success (CLAUDE.md) — an
  // empty result here is a refusal, not a link.
  if (!data) {
    return { ok: false, error: "The link was not issued — try reloading." };
  }

  const origin = await requestOrigin();
  revalidate(id);
  return {
    ok: true,
    data: {
      link: { token, url: `${origin}/intake/${token}` },
      assessment: data as CcAssessment,
    },
  };
}

/** Kill the link without touching a single answer the owner already gave. */
export async function revokeIntakeLink(
  id: string
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cc_assessments")
    .update({ intake_token: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Assessment not found" };
  revalidate(id);
  return { ok: true, data: { assessment: data as CcAssessment } };
}

/** One field the pre-fill wrote, or refused to write, with its reason. */
export interface PrefillOutcome {
  field: string;
  label: string;
  value: string;
  /** false = the advisor had already typed something, so nothing was touched. */
  applied: boolean;
}

const PREFILL_LABELS: Record<string, string> = {
  owner_objective: "Owner objective",
  owner_belief: "Their bottleneck belief",
  annual_revenue: "Annual revenue",
  gross_margin: "Gross margin %",
  operating_profit: "Operating profit",
};

/**
 * Copy the intake's baseline into the assessment — and ONLY into columns that
 * are still empty.
 *
 * An advisor's typed number outranks an owner's form answer every time: they
 * may have seen the P&L, corrected a misread question, or agreed a different
 * figure in the room. So this fills blanks and reports what it skipped; it
 * never overwrites, and it is safe to press twice.
 *
 * The figures with no column of their own — largest-customer share, headcount,
 * repetitive hours, loaded rates — are returned for the workbench to show
 * beside S8, L4 and the opportunity calculators rather than being written
 * somewhere they would go stale.
 */
export async function applyIntakePrefill(id: string): Promise<
  ActionResult<{
    assessment: CcAssessment;
    outcomes: PrefillOutcome[];
    reference: IntakePrefill;
  }>
> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("cc_assessments")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!row) return { ok: false, error: "Assessment not found" };
  const stored = row as CcAssessment;

  if (stored.status === "delivered") {
    return {
      ok: false,
      error:
        "This engagement is delivered. Reopen the engagement (status → review) before editing.",
    };
  }

  const prefill = intakePrefill(stored.intake);
  const candidates: Array<{ field: keyof CcAssessment; value: string | number | null }> = [
    { field: "owner_objective", value: prefill.owner_objective },
    { field: "owner_belief", value: prefill.owner_belief },
    { field: "annual_revenue", value: prefill.annual_revenue },
    { field: "gross_margin", value: prefill.gross_margin },
    { field: "operating_profit", value: prefill.operating_profit },
  ];

  const update: Record<string, unknown> = {};
  const outcomes: PrefillOutcome[] = [];
  for (const { field, value } of candidates) {
    if (value === null || value === undefined || value === "") continue;
    const existing = stored[field];
    const empty =
      existing === null ||
      existing === undefined ||
      (typeof existing === "string" && existing.trim() === "");
    if (empty) update[field as string] = value;
    outcomes.push({
      field: field as string,
      label: PREFILL_LABELS[field as string] ?? (field as string),
      value: String(value),
      applied: empty,
    });
  }

  if (Object.keys(update).length === 0) {
    return {
      ok: true,
      data: { assessment: stored, outcomes, reference: prefill },
    };
  }

  update.updated_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("cc_assessments")
    .update(update)
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Nothing was pre-filled — try reloading." };
  revalidate(id);
  return {
    ok: true,
    data: {
      assessment: data as CcAssessment,
      outcomes,
      reference: prefill,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Follow-through — the day-30 and day-90 reviews (migration 0013)
// ─────────────────────────────────────────────────────────────────────────────

export type OutcomeDay = "day30" | "day90";

const OUTCOME_DAYS: OutcomeDay[] = ["day30", "day90"];
const OUTCOME_STATUSES: AssessmentOutcomeReview["items"][number]["status"][] = [
  "not_started",
  "in_progress",
  "done",
  "dropped",
];

function cleanLine(value: unknown, max = 400): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Record one follow-through review.
 *
 * Writes ONLY `outcomes`, which is deliberately absent from the delivered-lock
 * field list in migration 0012: a day-30 review by definition happens after
 * delivery, and a lock that refused it would make the instrument unable to
 * learn from its own deliveries. Nothing here can change a word of the
 * document that was handed over.
 */
export async function saveOutcomes(
  id: string,
  day: OutcomeDay,
  review: {
    reviewed_on?: string | null;
    reviewer?: string | null;
    items?: Array<{
      plan_item?: string;
      status?: string;
      kpi?: string | null;
      baseline?: string | null;
      actual?: string | null;
      note?: string | null;
    }>;
    summary?: string | null;
  }
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  if (!OUTCOME_DAYS.includes(day)) {
    return { ok: false, error: `Unknown review: ${day}` };
  }

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("cc_assessments")
    .select("outcomes")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!row) return { ok: false, error: "Assessment not found" };

  const storedOutcomes = (row as { outcomes: unknown }).outcomes;
  const base: AssessmentOutcomes =
    storedOutcomes && typeof storedOutcomes === "object" && !Array.isArray(storedOutcomes)
      ? ({ ...(storedOutcomes as AssessmentOutcomes) } as AssessmentOutcomes)
      : {};

  const items: AssessmentOutcomeReview["items"] = [];
  for (const item of review.items ?? []) {
    const planItem = cleanLine(item?.plan_item, 600);
    if (!planItem) continue;
    const status = OUTCOME_STATUSES.includes(
      item?.status as AssessmentOutcomeReview["items"][number]["status"]
    )
      ? (item!.status as AssessmentOutcomeReview["items"][number]["status"])
      : "not_started";
    items.push({
      plan_item: planItem,
      status,
      kpi: cleanLine(item?.kpi),
      baseline: cleanLine(item?.baseline, 120),
      actual: cleanLine(item?.actual, 120),
      note: cleanLine(item?.note, 1000),
    });
  }

  base[day] = {
    // A review with no date is a review nobody can place in time.
    reviewed_on: cleanLine(review.reviewed_on, 10) ?? todayInET(),
    reviewer: cleanLine(review.reviewer, 120) ?? (await reviewerName()),
    items,
    summary: cleanLine(review.summary, 4000),
  };

  const { data, error } = await supabase
    .from("cc_assessments")
    .update({
      outcomes: base as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: "The review did not save — you may not have access to this engagement.",
    };
  }
  revalidate(id);
  return { ok: true, data: { assessment: data as CcAssessment } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Second signature and conversion (migration 0016)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everyone in the active org, for the Facilitator picker in Setup. Read from
 * Clerk rather than from any table of ours because org membership IS the
 * roster — there is no second copy to drift. Names go through the same ladder
 * the release signature uses, ending at the identifier (an email) rather than
 * a placeholder.
 */
export async function listOrgMembers(): Promise<
  ActionResult<{ members: Array<{ id: string; name: string }> }>
> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  try {
    const client = await clerkClient();
    const { data } = await client.organizations.getOrganizationMembershipList({
      organizationId: ctx.orgId,
      limit: 100,
    });
    const members: Array<{ id: string; name: string }> = [];
    for (const membership of data) {
      const user = membership.publicUserData;
      if (!user?.userId) continue;
      const name =
        displayNameOf({
          firstName: user.firstName,
          lastName: user.lastName,
          primaryEmailAddress: { emailAddress: user.identifier },
        }) ?? user.identifier;
      members.push({ id: user.userId, name });
    }
    members.sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, data: { members } };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not load the team from Clerk",
    };
  }
}

/** The org's clients, for linking a delivered engagement to what it became. */
export async function listClientsForLink(): Promise<
  ActionResult<{
    clients: Array<{
      id: string;
      name: string;
      company: string | null;
      status: CcClientStatus;
    }>;
  }>
> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cc_clients")
    .select("id, name, company, status")
    .eq("org_id", ctx.orgId)
    .order("name", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: {
      clients: ((data ?? []) as Array<{
        id: string;
        name: string;
        company: string | null;
        status: CcClientStatus;
      }>),
    },
  };
}

/**
 * Record what a delivered Diagnostic became — a Build or an Advisory — and
 * which client row it is now. This is the fact the follow-through job's
 * $7,500 credit clock reads; before 0016 it guessed from a company-name match.
 *
 * Allowed on a delivered row: none of these columns change a word of the
 * document that went out, and by definition the conversion happens after it.
 * `null` in `converted_to` clears the record ("not yet"). A client id is only
 * accepted when the row belongs to this org — the FK alone would let an id
 * from another workspace through under the service role.
 */
export async function recordConversion(
  assessmentId: string,
  input: {
    converted_to: "build" | "advisory" | null;
    converted_on: string | null;
    converted_client_id: string | null;
  }
): Promise<ActionResult<{ assessment: CcAssessment }>> {
  const ctx = await requireOrg();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const convertedTo = input.converted_to ?? null;
  if (convertedTo !== null && !CONVERSIONS.has(convertedTo)) {
    return { ok: false, error: `Unknown conversion: ${String(convertedTo)}` };
  }

  // "Not yet" clears the whole record: a date or a client without a kind is
  // a half-statement nobody can read back.
  const convertedOn =
    convertedTo === null ? null : input.converted_on?.trim() || todayInET();
  if (convertedOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(convertedOn)) {
    return { ok: false, error: "Converted-on must be a date (YYYY-MM-DD)" };
  }
  const clientId =
    convertedTo === null ? null : input.converted_client_id?.trim() || null;

  const supabase = await createClient();

  if (clientId) {
    const { data: clientRow, error: clientError } = await supabase
      .from("cc_clients")
      .select("id")
      .eq("id", clientId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();
    if (clientError) return { ok: false, error: clientError.message };
    if (!clientRow) {
      return { ok: false, error: "That client is not in this workspace." };
    }
  }

  const { data, error } = await supabase
    .from("cc_assessments")
    .update({
      converted_to: convertedTo,
      converted_on: convertedOn,
      converted_client_id: clientId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assessmentId)
    .eq("org_id", ctx.orgId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  // A refused UPDATE under RLS matches zero rows and reports success — an
  // empty result is a refusal, not a saved conversion.
  if (!data) {
    return {
      ok: false,
      error: "The conversion did not save — you may not have access to this engagement.",
    };
  }
  revalidate(assessmentId);
  return { ok: true, data: { assessment: data as CcAssessment } };
}
