/**
 * Shared plumbing for every proposal Hermes can file.
 *
 * The governing rule, decided by the owner: **Hermes proposes, humans
 * confirm.** `client-journey.ts` established that for client delivery state.
 * This module extends the same mechanism to *configuration* — the journey
 * template, the scorecard KPIs, and the client record itself — without adding
 * a second inbox, a second lifecycle or a second set of policies.
 *
 * THE BOUNDARY. Agents may propose changes to the org's configuration. They
 * may never touch their own. `skills` and `agents` are absent from
 * PROPOSAL_TARGET_TABLES below, and absent from the matching CHECK constraint
 * on cc_agent_proposals.target_table — so an agent cannot file a proposal that
 * would rewrite its own instructions, schedule or enabled flag even if some
 * future caller asked it to. That is a database guarantee, not a convention.
 * Nothing in this module reads those tables either.
 *
 * Nothing here mutates journey_milestones, journey_deliverables, kpis or
 * cc_clients. Every write in this module goes to cc_agent_proposals with
 * status='pending'. A teammate accepts it in the Command Center, and only that
 * acceptance changes anything.
 *
 * Org scoping: the service-role key bypasses RLS, so every query filters
 * org_id explicitly — the filter IS the tenant boundary. `journey_deliverables`
 * carries no org_id of its own; it inherits scope from its parent milestone,
 * which is why deliverable lookups always start from the org's milestone ids.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const ORG_ID = process.env.DEFAULT_ORG_ID ?? "org_3Ef1YcutwEZFZHEMLwhF57jbEEh";

/** Who the agent is, on every row it writes. */
export const AGENT_ACTOR_ID = "hermes";
export const AGENT_ACTOR_NAME = "Hermes";

export function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error("Supabase not configured on MCP server — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function jsonText(obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] };
}

export function errorText(code: string, message: string, extra: Record<string, unknown> = {}) {
  return jsonText({ ok: false, error: code, message, ...extra });
}

/** A proposal that would change nothing is noise in a human's inbox. */
export function noChangeText(message: string, extra: Record<string, unknown> = {}) {
  return jsonText({
    ok: true,
    filed: false,
    no_change_needed: true,
    message,
    ...extra,
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

// ============================================================================
// The allow-list — mirrored by cc_agent_proposals_target_table_check
// ============================================================================

/**
 * Every table an agent is permitted to propose a change against. `skills` and
 * `agents` are deliberately, permanently absent: an agent that can rewrite its
 * own instructions, schedule or enabled flag is how guardrails erode without
 * anyone noticing. Widening this list means changing the CHECK constraint too,
 * which makes widening a reviewable act rather than an accident.
 */
export const PROPOSAL_TARGET_TABLES = [
  "cc_client_journey",
  "cc_clients",
  "journey_milestones",
  "journey_deliverables",
  "kpis",
] as const;
export type ProposalTargetTable = (typeof PROPOSAL_TARGET_TABLES)[number];

/** Which family of change this is — selects the applier the inbox runs. */
export const PROPOSAL_TARGET_KINDS = [
  "client_journey",
  "client_record",
  "journey_template",
  "kpi",
] as const;
export type ProposalTargetKind = (typeof PROPOSAL_TARGET_KINDS)[number];

export const PROPOSAL_ACTIONS = [
  "mark_done",
  "reopen",
  "add_note",
  "change_status",
  "create",
  "update",
  "delete",
  "reorder",
] as const;
export type ProposalAction = (typeof PROPOSAL_ACTIONS)[number];

export const CLIENT_STATUSES = ["lead", "onboarding", "active", "paused", "churned", "complete"] as const;
export const CLIENT_HEALTH = ["green", "yellow", "red"] as const;
export const KPI_SOURCES = ["manual", "ghl", "stripe", "google", "other"] as const;

/**
 * The KPI names `ghlSync` writes by — it matches on `name` with an exact
 * equality filter and `.maybeSingle()`, so a rename produces no error, no
 * write, and a scoreboard number that quietly stops moving. Any proposal that
 * renames or removes one of these has to say so out loud.
 */
export const GHL_SYNCED_KPI_NAMES = [
  "MRR",
  "Active Deals",
  "Conversations 7d",
  "New Contacts 7d",
  "Open Pipeline Value",
] as const;

// ============================================================================
// Fuzzy resolution — same contract as client-journey.ts
// ============================================================================

type Candidate<T> = { row: T; labels: string[] };
type Ranked<T> = { row: T; score: number };

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(value: string): string[] {
  return normalize(value).split(" ").filter(Boolean);
}

/** 0 = no relationship. 100 = exact. Higher is a better match. */
function scoreLabel(query: string, label: string): number {
  const q = normalize(query);
  const l = normalize(label);
  if (!q || !l) return 0;
  if (q === l) return 100;
  if (l.startsWith(q)) return 85;
  if (l.includes(q)) return 70;
  if (q.includes(l)) return 60;

  const qTokens = tokens(query);
  const lTokens = new Set(tokens(label));
  if (qTokens.length === 0) return 0;
  const hits = qTokens.filter((t) => lTokens.has(t)).length;
  if (hits === 0) return 0;
  return Math.round((hits / qTokens.length) * 50);
}

const MIN_RESOLVE_SCORE = 40;

type Resolution<T> =
  | { ok: true; row: T }
  | { ok: false; reason: "not_found" | "ambiguous"; candidates: Ranked<T>[] };

export function resolveByName<T>(query: string, candidates: Candidate<T>[]): Resolution<T> {
  const ranked: Ranked<T>[] = candidates
    .map((c) => ({ row: c.row, score: Math.max(0, ...c.labels.map((l) => scoreLabel(query, l))) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0 || ranked[0].score < MIN_RESOLVE_SCORE) {
    return { ok: false, reason: "not_found", candidates: ranked.slice(0, 5) };
  }
  // A single survivor is unambiguous. Otherwise the top score must beat the
  // runner-up outright — a tie means we genuinely cannot tell, so we ask.
  if (ranked.length === 1 || ranked[0].score > ranked[1].score) {
    return { ok: true, row: ranked[0].row };
  }
  return { ok: false, reason: "ambiguous", candidates: ranked.slice(0, 5) };
}

/** True when two labels are the same thing to a human ("MRR" vs " mrr "). */
export function sameLabel(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalize(a ?? "") === normalize(b ?? "");
}

// ============================================================================
// Row types (mirror the applied schema exactly)
// ============================================================================

export type MilestoneRow = {
  id: string;
  org_id: string;
  name: string | null;
  description: string | null;
  sort_order: number | null;
  default_duration_days: number | null;
};

export type DeliverableRow = {
  id: string;
  milestone_id: string;
  title: string | null;
  description: string | null;
  required: boolean | null;
  sort_order: number | null;
};

export type KpiRow = {
  id: string;
  org_id: string;
  name: string | null;
  description: string | null;
  value: number | null;
  target: number | null;
  unit: string | null;
  source: string | null;
  sort_order: number | null;
  last_synced_at: string | null;
};

export type ClientRow = {
  id: string;
  org_id: string;
  name: string | null;
  company: string | null;
  status: string | null;
  tier: string | null;
  mrr: number | null;
  health: string | null;
  sort_order: number | null;
};

export const MILESTONE_COLS = "id, org_id, name, description, sort_order, default_duration_days";
export const DELIVERABLE_COLS = "id, milestone_id, title, description, required, sort_order";
export const KPI_COLS = "id, org_id, name, description, value, target, unit, source, sort_order, last_synced_at";
export const CLIENT_COLS = "id, org_id, name, company, status, tier, mrr, health, sort_order";

// ============================================================================
// Loaders — all org-filtered explicitly
// ============================================================================

export async function loadMilestones(supabase: SupabaseClient): Promise<MilestoneRow[]> {
  const { data, error } = await supabase
    .from("journey_milestones")
    .select(MILESTONE_COLS)
    .eq("org_id", ORG_ID)
    .order("sort_order", { nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MilestoneRow[];
}

/**
 * journey_deliverables carries no org_id — restricting to this org's milestone
 * ids IS the org filter.
 */
export async function loadDeliverables(
  supabase: SupabaseClient,
  milestones: MilestoneRow[],
): Promise<DeliverableRow[]> {
  if (milestones.length === 0) return [];
  const { data, error } = await supabase
    .from("journey_deliverables")
    .select(DELIVERABLE_COLS)
    .in("milestone_id", milestones.map((m) => m.id))
    .order("sort_order", { nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DeliverableRow[];
}

export async function loadTemplate(
  supabase: SupabaseClient,
): Promise<{ milestones: MilestoneRow[]; deliverables: DeliverableRow[] }> {
  const milestones = await loadMilestones(supabase);
  const deliverables = await loadDeliverables(supabase, milestones);
  return { milestones, deliverables };
}

export async function loadKpis(supabase: SupabaseClient): Promise<KpiRow[]> {
  const { data, error } = await supabase
    .from("kpis")
    .select(KPI_COLS)
    .eq("org_id", ORG_ID)
    .order("sort_order", { nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as KpiRow[];
}

export async function loadClients(supabase: SupabaseClient): Promise<ClientRow[]> {
  const { data, error } = await supabase
    .from("cc_clients")
    .select(CLIENT_COLS)
    .eq("org_id", ORG_ID)
    .order("sort_order", { nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientRow[];
}

// ============================================================================
// Resolvers — a partial name resolves, an ambiguous one comes back as candidates
// ============================================================================

export type ResolveFail = { ok: false; result: ReturnType<typeof errorText> };

export function resolveMilestone(
  query: string,
  milestones: MilestoneRow[],
): { ok: true; milestone: MilestoneRow } | ResolveFail {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, result: errorText("MILESTONE_REQUIRED", "Pass a milestone name or id.") };
  }
  const describe = (m: MilestoneRow) => ({ id: m.id, name: m.name, sort_order: m.sort_order });

  if (isUuid(trimmed)) {
    const hit = milestones.find((m) => m.id === trimmed);
    if (hit) return { ok: true, milestone: hit };
    return {
      ok: false,
      result: errorText("MILESTONE_NOT_FOUND", `No milestone with id ${trimmed} in this workspace.`, {
        known_milestones: milestones.map(describe),
      }),
    };
  }

  const resolved = resolveByName(
    trimmed,
    milestones.map((m) => ({ row: m, labels: [m.name ?? ""].filter(Boolean) })),
  );
  if (resolved.ok) return { ok: true, milestone: resolved.row };

  if (resolved.reason === "ambiguous") {
    return {
      ok: false,
      result: errorText(
        "MILESTONE_AMBIGUOUS",
        `"${trimmed}" matches more than one milestone. Say which one — do not guess.`,
        { candidates: resolved.candidates.map((c) => describe(c.row)) },
      ),
    };
  }
  return {
    ok: false,
    result: errorText("MILESTONE_NOT_FOUND", `No milestone matches "${trimmed}".`, {
      known_milestones: milestones.map(describe),
    }),
  };
}

export function resolveDeliverable(
  query: string,
  deliverables: DeliverableRow[],
  milestoneName: (id: string) => string | null,
): { ok: true; deliverable: DeliverableRow } | ResolveFail {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, result: errorText("DELIVERABLE_REQUIRED", "Pass a deliverable title or id.") };
  }
  const describe = (d: DeliverableRow) => ({
    id: d.id,
    title: d.title,
    milestone: milestoneName(d.milestone_id),
  });

  if (isUuid(trimmed)) {
    const hit = deliverables.find((d) => d.id === trimmed);
    if (hit) return { ok: true, deliverable: hit };
    return {
      ok: false,
      result: errorText("DELIVERABLE_NOT_FOUND", `No deliverable with id ${trimmed} in this workspace.`),
    };
  }

  const resolved = resolveByName(
    trimmed,
    deliverables.map((d) => ({ row: d, labels: [d.title ?? ""].filter(Boolean) })),
  );
  if (resolved.ok) return { ok: true, deliverable: resolved.row };

  if (resolved.reason === "ambiguous") {
    return {
      ok: false,
      result: errorText(
        "DELIVERABLE_AMBIGUOUS",
        `"${trimmed}" matches more than one deliverable. Say which one — do not guess.`,
        { candidates: resolved.candidates.map((c) => describe(c.row)) },
      ),
    };
  }
  return {
    ok: false,
    result: errorText("DELIVERABLE_NOT_FOUND", `No deliverable matches "${trimmed}".`, {
      closest: resolved.candidates.map((c) => describe(c.row)),
    }),
  };
}

export function resolveKpi(query: string, kpis: KpiRow[]): { ok: true; kpi: KpiRow } | ResolveFail {
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, result: errorText("KPI_REQUIRED", "Pass a KPI name or id.") };
  const describe = (k: KpiRow) => ({ id: k.id, name: k.name, target: k.target, unit: k.unit, source: k.source });

  if (isUuid(trimmed)) {
    const hit = kpis.find((k) => k.id === trimmed);
    if (hit) return { ok: true, kpi: hit };
    return {
      ok: false,
      result: errorText("KPI_NOT_FOUND", `No KPI with id ${trimmed} in this workspace.`, {
        known_kpis: kpis.map(describe),
      }),
    };
  }

  const resolved = resolveByName(
    trimmed,
    kpis.map((k) => ({ row: k, labels: [k.name ?? ""].filter(Boolean) })),
  );
  if (resolved.ok) return { ok: true, kpi: resolved.row };

  if (resolved.reason === "ambiguous") {
    return {
      ok: false,
      result: errorText("KPI_AMBIGUOUS", `"${trimmed}" matches more than one KPI. Say which one — do not guess.`, {
        candidates: resolved.candidates.map((c) => describe(c.row)),
      }),
    };
  }
  return {
    ok: false,
    result: errorText("KPI_NOT_FOUND", `No KPI matches "${trimmed}".`, { known_kpis: kpis.map(describe) }),
  };
}

export function resolveClient(query: string, clients: ClientRow[]): { ok: true; client: ClientRow } | ResolveFail {
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, result: errorText("CLIENT_REQUIRED", "Pass a client name or id.") };
  const describe = (c: ClientRow) => ({ id: c.id, name: c.name, company: c.company, status: c.status });

  if (isUuid(trimmed)) {
    const hit = clients.find((c) => c.id === trimmed);
    if (hit) return { ok: true, client: hit };
    return {
      ok: false,
      result: errorText("CLIENT_NOT_FOUND", `No client with id ${trimmed} in this workspace.`, {
        known_clients: clients.map(describe),
      }),
    };
  }

  const resolved = resolveByName(
    trimmed,
    clients.map((c) => ({ row: c, labels: [c.name ?? "", c.company ?? ""].filter(Boolean) })),
  );
  if (resolved.ok) return { ok: true, client: resolved.row };

  if (resolved.reason === "ambiguous") {
    return {
      ok: false,
      result: errorText(
        "CLIENT_AMBIGUOUS",
        `"${trimmed}" matches more than one client. Ask which one is meant — do not guess.`,
        { candidates: resolved.candidates.map((c) => describe(c.row)) },
      ),
    };
  }
  return {
    ok: false,
    result: errorText("CLIENT_NOT_FOUND", `No client matches "${trimmed}".`, {
      known_clients: clients.map(describe),
    }),
  };
}

// ============================================================================
// Filing — the ONLY write this module performs
// ============================================================================

export type PendingProposalRow = {
  id: string;
  client_id: string | null;
  deliverable_id: string | null;
  proposed_by: string | null;
  action: string | null;
  target_kind: string | null;
  target_table: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  rationale: string | null;
  evidence: string | null;
  status: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  created_at: string | null;
};

export const PROPOSAL_COLS =
  "id, client_id, deliverable_id, proposed_by, action, target_kind, target_table, target_id, payload, rationale, evidence, status, decided_by_name, decided_at, created_at";

/**
 * Every pending proposal in the org, optionally narrowed to one family. Used
 * both by cc_list_pending_proposals and by the duplicate guard below.
 */
export async function loadPendingProposals(
  supabase: SupabaseClient,
  targetKind?: ProposalTargetKind,
): Promise<PendingProposalRow[]> {
  let q = supabase
    .from("cc_agent_proposals")
    .select(PROPOSAL_COLS)
    .eq("org_id", ORG_ID)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (targetKind) q = q.eq("target_kind", targetKind);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as PendingProposalRow[];
}

/**
 * A second proposal about the same row, still waiting on the same human, is
 * noise. Matches on (action, target_table, target_id) for edits, and on the
 * proposed label for creates — where there is no row id yet.
 */
export function findPendingDuplicate(
  pending: PendingProposalRow[],
  match: { action: ProposalAction; targetTable: ProposalTargetTable; targetId?: string | null; label?: string | null },
): PendingProposalRow | null {
  for (const p of pending) {
    if (p.action !== match.action || p.target_table !== match.targetTable) continue;
    if (match.targetId) {
      if (p.target_id === match.targetId) return p;
      continue;
    }
    if (match.label) {
      const existingLabel = (p.payload?.target as { label?: string } | undefined)?.label ?? null;
      if (sameLabel(existingLabel, match.label)) return p;
    }
  }
  return null;
}

export function duplicateText(existing: PendingProposalRow, what: string) {
  return jsonText({
    ok: true,
    filed: false,
    duplicate_of: existing.id,
    message:
      `A proposal about ${what} is already pending (id ${existing.id}, filed ${existing.created_at}). ` +
      "Nothing new was filed — a teammate still has to decide on the one already waiting. " +
      "Say that rather than filing again.",
    existing: {
      id: existing.id,
      action: existing.action,
      target_kind: existing.target_kind,
      target_table: existing.target_table,
      target_id: existing.target_id,
      rationale: existing.rationale,
      created_at: existing.created_at,
    },
  });
}

export type FileProposalInput = {
  action: ProposalAction;
  targetKind: ProposalTargetKind;
  targetTable: ProposalTargetTable;
  targetId: string | null;
  clientId?: string | null;
  deliverableId?: string | null;
  payload: Record<string, unknown>;
  rationale: string;
  evidence?: string;
  /** One line a human reads first: what they would be approving. */
  summary: string;
  /** Consequences the approver must see before accepting. */
  impact?: Record<string, unknown> | null;
};

/**
 * Insert one pending row into cc_agent_proposals and describe it back. This
 * function is the only place in the config-proposal path that writes anything,
 * and cc_agent_proposals is the only table it writes to.
 */
export async function fileProposal(supabase: SupabaseClient, input: FileProposalInput) {
  const payload = {
    ...input.payload,
    summary: input.summary,
    impact: input.impact ?? null,
  };

  const { data, error } = await supabase
    .from("cc_agent_proposals")
    .insert({
      org_id: ORG_ID,
      client_id: input.clientId ?? null,
      deliverable_id: input.deliverableId ?? null,
      proposed_by: AGENT_ACTOR_ID,
      action: input.action,
      target_kind: input.targetKind,
      target_table: input.targetTable,
      target_id: input.targetId,
      payload,
      rationale: input.rationale.trim(),
      evidence: input.evidence?.trim() ?? null,
      status: "pending",
    })
    .select("id, created_at")
    .single();

  if (error) return errorText("INSERT_FAILED", error.message);

  const row = data as { id: string; created_at: string } | null;

  return jsonText({
    ok: true,
    filed: true,
    proposal_id: row?.id ?? null,
    status: "pending",
    requires_human_approval: true,
    applied: false,
    action: input.action,
    target: {
      kind: input.targetKind,
      table: input.targetTable,
      id: input.targetId,
    },
    summary: input.summary,
    payload,
    created_at: row?.created_at ?? null,
    message:
      "Proposal filed as pending. NOTHING has changed yet — the configuration is untouched. " +
      "A CREAIT teammate must accept it in the Command Center before it takes effect. " +
      "Say exactly that when you report back; do not describe the change as made.",
  });
}

// ============================================================================
// Diffing — the no-op guard every propose tool runs before filing
// ============================================================================

export type Change = { field: string; from: unknown; to: unknown };

/** numeric columns arrive as numbers, but compare defensively. */
function numEq(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return a == null && b == null;
  return Number(a) === Number(b);
}

/**
 * Only the fields that would actually move. An empty list means the proposal
 * would be a no-op — renaming something to the name it already has, or setting
 * a value it already holds — and the caller returns "no change needed" instead
 * of putting a pointless decision in a teammate's inbox.
 */
export function diff(current: Record<string, unknown>, proposed: Record<string, unknown>): Change[] {
  const changes: Change[] = [];
  for (const [field, to] of Object.entries(proposed)) {
    if (to === undefined) continue;
    const from = current[field] ?? null;
    const same =
      typeof to === "number" || typeof from === "number" ? numEq(from, to) : from === to;
    if (!same) changes.push({ field, from: from ?? null, to });
  }
  return changes;
}
