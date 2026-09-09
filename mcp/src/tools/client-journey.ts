/**
 * Client delivery-progress tools — how Hermes sees where every CREAIT client
 * sits in the delivery journey, and how it asks a human to move one.
 *
 * The governing rule, decided by the owner: **Hermes proposes, humans confirm.**
 * Reads are free. State changes are not. `cc_propose_client_update` writes a
 * row to `cc_agent_proposals` with status='pending' and NEVER touches
 * `cc_client_journey` — a teammate accepts or rejects it in the Command Center
 * UI, and only that acceptance moves the checkbox. `cc_add_client_note` is the
 * one direct write, because a note is commentary on the timeline rather than a
 * change to delivery state.
 *
 * Every write stamps actor_type='agent' / actor_name='Hermes' so the UI can
 * always tell agent activity apart from a teammate's.
 *
 * Org scoping: the service-role key bypasses RLS, so every query filters
 * org_id explicitly. `journey_deliverables` has no org_id of its own — it is
 * scoped through its parent milestone, which is why deliverable lookups always
 * start from the org's milestone ids.
 */
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ORG_ID = process.env.DEFAULT_ORG_ID ?? "org_3J6RO66XyUmqeMbZ8RwIyFTCf7J";

/** Who the agent is, on every row it writes. */
const AGENT_ACTOR_ID = "hermes";
const AGENT_ACTOR_NAME = "Hermes";

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error("Supabase not configured on MCP server — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function jsonText(obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] };
}

function errorText(code: string, message: string, extra: Record<string, unknown> = {}) {
  return jsonText({ ok: false, error: code, message, ...extra });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** Latest of a set of ISO timestamps, ignoring nulls. */
function latest(...values: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (!v) continue;
    if (best === null || v > best) best = v;
  }
  return best;
}

function pct(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

// ============================================================================
// Fuzzy resolution
// ============================================================================

/**
 * The agent is handed human names ("Rad Media", "A2P campaign approved"), never
 * uuids. These score candidates by how well a free-text query matches any of
 * their labels, so a partial name resolves — and an ambiguous one is reported
 * as ambiguous rather than guessed at.
 */
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

function resolveByName<T>(query: string, candidates: Candidate<T>[]): Resolution<T> {
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

// ============================================================================
// Row types (mirror the applied schema exactly)
// ============================================================================

type ClientRow = {
  id: string;
  org_id: string;
  name: string | null;
  company: string | null;
  status: string | null;
  tier: string | null;
  mrr: number | null;
  health: string | null;
  brain_path: string | null;
  sort_order: number | null;
};

type MilestoneRow = {
  id: string;
  name: string | null;
  description: string | null;
  sort_order: number | null;
};

type DeliverableRow = {
  id: string;
  milestone_id: string;
  title: string | null;
  description: string | null;
  required: boolean | null;
  sort_order: number | null;
};

type JourneyRow = {
  id: string;
  client_id: string;
  deliverable_id: string;
  milestone_id: string | null;
  done: boolean | null;
  completed_at: string | null;
  notes: string | null;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_by_type: string | null;
};

type ActivityRow = {
  id: string;
  client_id: string;
  actor_type: string | null;
  actor_id: string | null;
  actor_name: string | null;
  kind: string | null;
  body: string | null;
  deliverable_id: string | null;
  milestone_id: string | null;
  created_at: string | null;
};

type ProposalRow = {
  id: string;
  client_id: string;
  deliverable_id: string | null;
  proposed_by: string | null;
  action: string | null;
  payload: Record<string, unknown> | null;
  rationale: string | null;
  evidence: string | null;
  status: string | null;
  created_at: string | null;
};

const CLIENT_COLS = "id, org_id, name, company, status, tier, mrr, health, brain_path, sort_order";
const JOURNEY_COLS =
  "id, client_id, deliverable_id, milestone_id, done, completed_at, notes, updated_at, updated_by, updated_by_name, updated_by_type";
const ACTIVITY_COLS =
  "id, client_id, actor_type, actor_id, actor_name, kind, body, deliverable_id, milestone_id, created_at";
const PROPOSAL_COLS =
  "id, client_id, deliverable_id, proposed_by, action, payload, rationale, evidence, status, created_at";

// ============================================================================
// Shared loaders
// ============================================================================

/** Every client in the org — the pool both name-resolution and listing use. */
async function loadClients(supabase: SupabaseClient): Promise<ClientRow[]> {
  const { data, error } = await supabase
    .from("cc_clients")
    .select(CLIENT_COLS)
    .eq("org_id", ORG_ID)
    .order("sort_order", { nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClientRow[];
}

/** The org's journey template: milestones in order, with their deliverables. */
async function loadTemplate(
  supabase: SupabaseClient,
): Promise<{ milestones: MilestoneRow[]; deliverables: DeliverableRow[] }> {
  const { data: milestoneData, error: milestoneErr } = await supabase
    .from("journey_milestones")
    .select("id, name, description, sort_order")
    .eq("org_id", ORG_ID)
    .order("sort_order", { nullsFirst: false });
  if (milestoneErr) throw new Error(milestoneErr.message);

  const milestones = (milestoneData ?? []) as MilestoneRow[];
  if (milestones.length === 0) return { milestones, deliverables: [] };

  // journey_deliverables carries no org_id — it inherits scope from its
  // milestone, so restricting to this org's milestone ids IS the org filter.
  const { data: deliverableData, error: deliverableErr } = await supabase
    .from("journey_deliverables")
    .select("id, milestone_id, title, description, required, sort_order")
    .in(
      "milestone_id",
      milestones.map((m) => m.id),
    )
    .order("sort_order", { nullsFirst: false });
  if (deliverableErr) throw new Error(deliverableErr.message);

  return { milestones, deliverables: (deliverableData ?? []) as DeliverableRow[] };
}

/** Resolve a client name-or-id to one row, or explain why we could not. */
async function resolveClient(
  supabase: SupabaseClient,
  query: string,
): Promise<{ ok: true; client: ClientRow } | { ok: false; result: ReturnType<typeof errorText> }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, result: errorText("CLIENT_REQUIRED", "Pass a client name or id.") };
  }

  const clients = await loadClients(supabase);

  if (isUuid(trimmed)) {
    const hit = clients.find((c) => c.id === trimmed);
    if (hit) return { ok: true, client: hit };
    return {
      ok: false,
      result: errorText(
        "CLIENT_NOT_FOUND",
        `No client with id ${trimmed} in this workspace.`,
        { known_clients: clients.map((c) => ({ id: c.id, name: c.name, company: c.company })) },
      ),
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
        {
          candidates: resolved.candidates.map((c) => ({
            id: c.row.id,
            name: c.row.name,
            company: c.row.company,
            status: c.row.status,
          })),
        },
      ),
    };
  }

  return {
    ok: false,
    result: errorText(`CLIENT_NOT_FOUND`, `No client matches "${trimmed}".`, {
      known_clients: clients.map((c) => ({ id: c.id, name: c.name, company: c.company })),
    }),
  };
}

/** Resolve a deliverable title-or-id within the org's journey template. */
function resolveDeliverable(
  query: string,
  deliverables: DeliverableRow[],
  milestoneName: (id: string) => string | null,
): { ok: true; deliverable: DeliverableRow } | { ok: false; result: ReturnType<typeof errorText> } {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, result: errorText("DELIVERABLE_REQUIRED", "Pass a deliverable title or id.") };
  }

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

  const describe = (d: DeliverableRow) => ({
    id: d.id,
    title: d.title,
    milestone: milestoneName(d.milestone_id),
  });

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

// ============================================================================
// cc_list_clients — the roster with delivery progress
// ============================================================================

const CLIENT_STATUSES = ["lead", "onboarding", "active", "paused", "churned", "complete"] as const;

export const ccListClientsInput = {
  status: z
    .enum([...CLIENT_STATUSES, "all"])
    .optional()
    .describe("Filter to one lifecycle status. Defaults to 'all'."),
  sort: z
    .enum(["sort_order", "progress", "stalled", "mrr", "name"])
    .optional()
    .describe(
      "'sort_order' (default, the board order), 'progress' (least complete first), 'stalled' (longest since progress first), 'mrr' (highest first), 'name'.",
    ),
  limit: z.number().int().min(1).max(500).optional().describe("Max clients to return. Defaults to 100."),
};

export async function ccListClients({
  status,
  sort = "sort_order",
  limit = 100,
}: {
  status?: (typeof CLIENT_STATUSES)[number] | "all";
  sort?: "sort_order" | "progress" | "stalled" | "mrr" | "name";
  limit?: number;
}) {
  const supabase = client();

  let clients: ClientRow[];
  let milestones: MilestoneRow[];
  let deliverables: DeliverableRow[];
  try {
    const [allClients, template] = await Promise.all([loadClients(supabase), loadTemplate(supabase)]);
    clients = status && status !== "all" ? allClients.filter((c) => c.status === status) : allClients;
    milestones = template.milestones;
    deliverables = template.deliverables;
  } catch (err) {
    return errorText("QUERY_FAILED", (err as Error).message);
  }

  if (clients.length === 0) {
    return jsonText({
      total: 0,
      count: 0,
      truncated: false,
      items: [],
      journey_template: { milestones: milestones.length, deliverables: deliverables.length },
    });
  }

  const clientIds = clients.map((c) => c.id);

  const [journeyRes, activityRes, proposalRes] = await Promise.all([
    supabase.from("cc_client_journey").select(JOURNEY_COLS).eq("org_id", ORG_ID).in("client_id", clientIds),
    supabase
      .from("cc_client_activity")
      .select("client_id, created_at, kind, actor_type, actor_name")
      .eq("org_id", ORG_ID)
      .in("client_id", clientIds)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("cc_agent_proposals")
      .select("client_id")
      .eq("org_id", ORG_ID)
      .eq("status", "pending")
      .in("client_id", clientIds),
  ]);

  const firstError = journeyRes.error ?? activityRes.error ?? proposalRes.error;
  if (firstError) return errorText("QUERY_FAILED", firstError.message);

  const journeyRows = (journeyRes.data ?? []) as JourneyRow[];
  const activityRows = (activityRes.data ?? []) as Array<
    Pick<ActivityRow, "client_id" | "created_at" | "kind" | "actor_type" | "actor_name">
  >;
  const proposalRows = (proposalRes.data ?? []) as Array<{ client_id: string }>;

  const deliverablesByMilestone = new Map<string, DeliverableRow[]>();
  for (const d of deliverables) {
    const bucket = deliverablesByMilestone.get(d.milestone_id) ?? [];
    bucket.push(d);
    deliverablesByMilestone.set(d.milestone_id, bucket);
  }

  const validDeliverableIds = new Set(deliverables.map((d) => d.id));
  const requiredIds = new Set(deliverables.filter((d) => d.required !== false).map((d) => d.id));

  // journey rows → per-client map of deliverable_id → row
  const journeyByClient = new Map<string, Map<string, JourneyRow>>();
  for (const row of journeyRows) {
    if (!validDeliverableIds.has(row.deliverable_id)) continue; // template row deleted
    const bucket = journeyByClient.get(row.client_id) ?? new Map<string, JourneyRow>();
    bucket.set(row.deliverable_id, row);
    journeyByClient.set(row.client_id, bucket);
  }

  const latestActivityByClient = new Map<string, (typeof activityRows)[number]>();
  for (const a of activityRows) {
    if (!latestActivityByClient.has(a.client_id)) latestActivityByClient.set(a.client_id, a);
  }

  const pendingByClient = new Map<string, number>();
  for (const p of proposalRows) {
    pendingByClient.set(p.client_id, (pendingByClient.get(p.client_id) ?? 0) + 1);
  }

  const totalDeliverables = deliverables.length;
  const totalRequired = requiredIds.size;

  const items = clients.map((c) => {
    const rows = journeyByClient.get(c.id) ?? new Map<string, JourneyRow>();

    let done = 0;
    let requiredDone = 0;
    let lastProgressAt: string | null = null;
    let lastTouch: { by: string | null; type: string | null; at: string | null } = {
      by: null,
      type: null,
      at: null,
    };

    for (const [deliverableId, row] of rows) {
      if (row.done === true) {
        done += 1;
        if (requiredIds.has(deliverableId)) requiredDone += 1;
        lastProgressAt = latest(lastProgressAt, row.completed_at ?? row.updated_at);
      }
      const touchedAt = row.updated_at ?? row.completed_at;
      if (touchedAt && (lastTouch.at === null || touchedAt > lastTouch.at)) {
        lastTouch = { by: row.updated_by_name, type: row.updated_by_type, at: touchedAt };
      }
    }

    // The first milestone with anything left open is where the client is now.
    let currentMilestone: { id: string; name: string | null; done: number; total: number } | null = null;
    for (const m of milestones) {
      const bucket = deliverablesByMilestone.get(m.id) ?? [];
      if (bucket.length === 0) continue;
      const mDone = bucket.filter((d) => rows.get(d.id)?.done === true).length;
      if (mDone < bucket.length) {
        currentMilestone = { id: m.id, name: m.name, done: mDone, total: bucket.length };
        break;
      }
    }

    const lastActivity = latestActivityByClient.get(c.id) ?? null;
    const lastMovementAt = latest(lastProgressAt, lastActivity?.created_at ?? null);

    return {
      id: c.id,
      name: c.name,
      company: c.company,
      status: c.status,
      health: c.health,
      tier: c.tier,
      mrr: c.mrr,
      brain_path: c.brain_path,
      journey: {
        done,
        total: totalDeliverables,
        percent: pct(done, totalDeliverables),
        required_done: requiredDone,
        required_total: totalRequired,
        current_milestone: currentMilestone,
        complete: totalDeliverables > 0 && done === totalDeliverables,
        last_progress_at: lastProgressAt,
        last_touched_by: lastTouch.by,
        last_touched_by_type: lastTouch.type,
        last_activity_at: lastActivity?.created_at ?? null,
        days_since_movement: daysSince(lastMovementAt),
      },
      pending_proposals: pendingByClient.get(c.id) ?? 0,
    };
  });

  const sorted = [...items];
  if (sort === "progress") {
    sorted.sort((a, b) => a.journey.percent - b.journey.percent);
  } else if (sort === "stalled") {
    sorted.sort((a, b) => (b.journey.days_since_movement ?? 1e9) - (a.journey.days_since_movement ?? 1e9));
  } else if (sort === "mrr") {
    sorted.sort((a, b) => (b.mrr ?? 0) - (a.mrr ?? 0));
  } else if (sort === "name") {
    sorted.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }

  const page = sorted.slice(0, limit);

  return jsonText({
    total: sorted.length,
    count: page.length,
    truncated: page.length < sorted.length,
    filter: { status: status ?? "all", sort },
    journey_template: { milestones: milestones.length, deliverables: totalDeliverables },
    note: "`total` is the exact number of clients matching the filter; `journey.total` is the org's full deliverable template, so percent is comparable across clients.",
    items: page,
  });
}

// ============================================================================
// cc_get_client_progress — one client, every milestone and deliverable
// ============================================================================

export const ccGetClientProgressInput = {
  client: z
    .string()
    .min(1)
    .describe("Client name (e.g. 'Rad Media'), company, or uuid. Partial names resolve; ambiguous ones come back as candidates."),
  activity_limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("How many recent timeline entries to return. Defaults to 20."),
};

export async function ccGetClientProgress({
  client: clientQuery,
  activity_limit = 20,
}: {
  client: string;
  activity_limit?: number;
}) {
  const supabase = client();

  let target: ClientRow;
  let milestones: MilestoneRow[];
  let deliverables: DeliverableRow[];
  try {
    const resolved = await resolveClient(supabase, clientQuery);
    if (!resolved.ok) return resolved.result;
    target = resolved.client;
    const template = await loadTemplate(supabase);
    milestones = template.milestones;
    deliverables = template.deliverables;
  } catch (err) {
    return errorText("QUERY_FAILED", (err as Error).message);
  }

  const [journeyRes, activityRes, proposalRes] = await Promise.all([
    supabase.from("cc_client_journey").select(JOURNEY_COLS).eq("org_id", ORG_ID).eq("client_id", target.id),
    supabase
      .from("cc_client_activity")
      .select(ACTIVITY_COLS)
      .eq("org_id", ORG_ID)
      .eq("client_id", target.id)
      .order("created_at", { ascending: false })
      .limit(activity_limit),
    supabase
      .from("cc_agent_proposals")
      .select(PROPOSAL_COLS)
      .eq("org_id", ORG_ID)
      .eq("client_id", target.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const firstError = journeyRes.error ?? activityRes.error ?? proposalRes.error;
  if (firstError) return errorText("QUERY_FAILED", firstError.message);

  const journeyRows = (journeyRes.data ?? []) as JourneyRow[];
  const activityRows = (activityRes.data ?? []) as ActivityRow[];
  const proposalRows = (proposalRes.data ?? []) as ProposalRow[];

  const byDeliverable = new Map<string, JourneyRow>();
  for (const row of journeyRows) byDeliverable.set(row.deliverable_id, row);

  const milestoneName = new Map(milestones.map((m) => [m.id, m.name] as const));
  const deliverableTitle = new Map(deliverables.map((d) => [d.id, d.title] as const));

  const deliverablesByMilestone = new Map<string, DeliverableRow[]>();
  for (const d of deliverables) {
    const bucket = deliverablesByMilestone.get(d.milestone_id) ?? [];
    bucket.push(d);
    deliverablesByMilestone.set(d.milestone_id, bucket);
  }

  let done = 0;
  let requiredDone = 0;
  let requiredTotal = 0;
  let lastProgressAt: string | null = null;

  const milestoneViews = milestones.map((m) => {
    const bucket = deliverablesByMilestone.get(m.id) ?? [];
    let mDone = 0;

    const deliverableViews = bucket.map((d) => {
      const row = byDeliverable.get(d.id) ?? null;
      const isDone = row?.done === true;
      if (isDone) {
        mDone += 1;
        done += 1;
        lastProgressAt = latest(lastProgressAt, row?.completed_at ?? row?.updated_at ?? null);
      }
      if (d.required !== false) {
        requiredTotal += 1;
        if (isDone) requiredDone += 1;
      }
      return {
        id: d.id,
        title: d.title,
        description: d.description,
        required: d.required !== false,
        sort_order: d.sort_order,
        done: isDone,
        completed_at: row?.completed_at ?? null,
        notes: row?.notes ?? null,
        last_updated_at: row?.updated_at ?? null,
        last_updated_by: row?.updated_by_name ?? null,
        last_updated_by_type: row?.updated_by_type ?? null,
        tracked: row !== null,
      };
    });

    return {
      id: m.id,
      name: m.name,
      description: m.description,
      sort_order: m.sort_order,
      done: mDone,
      total: bucket.length,
      percent: pct(mDone, bucket.length),
      complete: bucket.length > 0 && mDone === bucket.length,
      deliverables: deliverableViews,
    };
  });

  const currentMilestone = milestoneViews.find((m) => m.total > 0 && !m.complete) ?? null;
  const nextUp = currentMilestone
    ? currentMilestone.deliverables.filter((d) => !d.done).slice(0, 5).map((d) => ({ id: d.id, title: d.title, required: d.required }))
    : [];

  const lastMovementAt = latest(lastProgressAt, activityRows[0]?.created_at ?? null);
  const totalDeliverables = deliverables.length;

  return jsonText({
    ok: true,
    client: {
      id: target.id,
      name: target.name,
      company: target.company,
      status: target.status,
      health: target.health,
      tier: target.tier,
      mrr: target.mrr,
      brain_path: target.brain_path,
    },
    progress: {
      done,
      total: totalDeliverables,
      percent: pct(done, totalDeliverables),
      required_done: requiredDone,
      required_total: requiredTotal,
      complete: totalDeliverables > 0 && done === totalDeliverables,
      current_milestone: currentMilestone
        ? { id: currentMilestone.id, name: currentMilestone.name, done: currentMilestone.done, total: currentMilestone.total }
        : null,
      next_up: nextUp,
      last_progress_at: lastProgressAt,
      last_activity_at: activityRows[0]?.created_at ?? null,
      days_since_movement: daysSince(lastMovementAt),
    },
    milestones: milestoneViews,
    recent_activity: activityRows.map((a) => ({
      id: a.id,
      kind: a.kind,
      body: a.body,
      actor_type: a.actor_type,
      actor_name: a.actor_name,
      deliverable_id: a.deliverable_id,
      deliverable_title: a.deliverable_id ? deliverableTitle.get(a.deliverable_id) ?? null : null,
      milestone_id: a.milestone_id,
      milestone_name: a.milestone_id ? milestoneName.get(a.milestone_id) ?? null : null,
      created_at: a.created_at,
    })),
    pending_proposals: proposalRows.map((p) => ({
      id: p.id,
      action: p.action,
      deliverable_id: p.deliverable_id,
      deliverable_title: p.deliverable_id ? deliverableTitle.get(p.deliverable_id) ?? null : null,
      payload: p.payload,
      rationale: p.rationale,
      evidence: p.evidence,
      proposed_by: p.proposed_by,
      created_at: p.created_at,
    })),
    note: "Read-only. To change any of this, file a proposal with cc_propose_client_update — a human accepts it before anything moves.",
  });
}

// ============================================================================
// cc_propose_client_update — file a pending proposal, change nothing
// ============================================================================

const PROPOSAL_ACTIONS = ["mark_done", "reopen", "add_note", "change_status"] as const;

export const ccProposeClientUpdateInput = {
  client: z.string().min(1).describe("Client name (e.g. 'Rad Media'), company, or uuid."),
  action: z
    .enum(PROPOSAL_ACTIONS)
    .describe(
      "'mark_done' = a delivery deliverable looks finished; 'reopen' = one marked done actually is not; 'add_note' = attach a note to a deliverable; 'change_status' = move the client's lifecycle status.",
    ),
  rationale: z
    .string()
    .min(10)
    .describe("REQUIRED. Why you believe this, in a sentence a teammate can judge. Never restate the action — say what led you to it."),
  deliverable: z
    .string()
    .optional()
    .describe("Deliverable title or uuid. Required for mark_done, reopen, and add_note."),
  evidence: z
    .string()
    .optional()
    .describe("Where the belief came from — meeting name and date, a quote from a message, a file path. Give the human something to check."),
  new_status: z
    .enum(CLIENT_STATUSES)
    .optional()
    .describe("Required for action='change_status'. The lifecycle status being proposed."),
  note: z.string().optional().describe("Required for action='add_note'. The note text being proposed for the deliverable."),
};

export async function ccProposeClientUpdate(args: {
  client: string;
  action: (typeof PROPOSAL_ACTIONS)[number];
  rationale: string;
  deliverable?: string;
  evidence?: string;
  new_status?: (typeof CLIENT_STATUSES)[number];
  note?: string;
}) {
  const supabase = client();

  let target: ClientRow;
  let milestones: MilestoneRow[];
  let deliverables: DeliverableRow[];
  try {
    const resolved = await resolveClient(supabase, args.client);
    if (!resolved.ok) return resolved.result;
    target = resolved.client;
    const template = await loadTemplate(supabase);
    milestones = template.milestones;
    deliverables = template.deliverables;
  } catch (err) {
    return errorText("QUERY_FAILED", (err as Error).message);
  }

  const needsDeliverable = args.action === "mark_done" || args.action === "reopen" || args.action === "add_note";
  if (needsDeliverable && !args.deliverable) {
    return errorText(
      "DELIVERABLE_REQUIRED",
      `action='${args.action}' needs a deliverable. Call cc_get_client_progress first to see the exact titles.`,
    );
  }
  if (args.action === "change_status" && !args.new_status) {
    return errorText("NEW_STATUS_REQUIRED", "action='change_status' needs new_status.");
  }
  if (args.action === "add_note" && !args.note?.trim()) {
    return errorText("NOTE_REQUIRED", "action='add_note' needs the note text in `note`.");
  }

  const milestoneName = new Map(milestones.map((m) => [m.id, m.name] as const));

  let deliverable: DeliverableRow | null = null;
  if (args.deliverable) {
    const resolvedDeliverable = resolveDeliverable(args.deliverable, deliverables, (id) => milestoneName.get(id) ?? null);
    if (!resolvedDeliverable.ok) return resolvedDeliverable.result;
    deliverable = resolvedDeliverable.deliverable;
  }

  // Tell the human what the current value actually is, so accepting is a
  // one-glance decision rather than a research task.
  let currentDone: boolean | null = null;
  let journeyRowId: string | null = null;
  if (deliverable) {
    const { data: existing, error: existingErr } = await supabase
      .from("cc_client_journey")
      .select("id, done")
      .eq("org_id", ORG_ID)
      .eq("client_id", target.id)
      .eq("deliverable_id", deliverable.id)
      .maybeSingle();
    if (existingErr) return errorText("QUERY_FAILED", existingErr.message);
    const row = existing as { id: string; done: boolean | null } | null;
    currentDone = row?.done ?? false;
    journeyRowId = row?.id ?? null;
  }

  if (args.action === "mark_done" && currentDone === true) {
    return errorText("ALREADY_DONE", `"${deliverable?.title}" is already marked done for ${target.name}. No proposal filed.`, {
      client_id: target.id,
      deliverable_id: deliverable?.id ?? null,
    });
  }
  if (args.action === "reopen" && currentDone === false) {
    return errorText("NOT_DONE", `"${deliverable?.title}" is not marked done for ${target.name}, so there is nothing to reopen.`, {
      client_id: target.id,
      deliverable_id: deliverable?.id ?? null,
    });
  }

  const payload: Record<string, unknown> = {
    client_name: target.name,
    deliverable_title: deliverable?.title ?? null,
    milestone_id: deliverable?.milestone_id ?? null,
    milestone_name: deliverable ? milestoneName.get(deliverable.milestone_id) ?? null : null,
    current_done: currentDone,
    proposed_done: args.action === "mark_done" ? true : args.action === "reopen" ? false : null,
    current_status: target.status,
    new_status: args.new_status ?? null,
    note: args.note?.trim() ?? null,
  };

  // `cc_agent_proposals` now carries both client-delivery and configuration
  // proposals, so every row names the family it belongs to and the table an
  // acceptance would land in. Stated explicitly rather than left to the column
  // default, so the inbox can switch on target_kind instead of sniffing action.
  const isStatusChange = args.action === "change_status";

  const { data, error } = await supabase
    .from("cc_agent_proposals")
    .insert({
      org_id: ORG_ID,
      client_id: target.id,
      deliverable_id: deliverable?.id ?? null,
      proposed_by: AGENT_ACTOR_ID,
      action: args.action,
      target_kind: isStatusChange ? "client_record" : "client_journey",
      target_table: isStatusChange ? "cc_clients" : "cc_client_journey",
      target_id: isStatusChange ? target.id : journeyRowId,
      payload,
      rationale: args.rationale.trim(),
      evidence: args.evidence?.trim() ?? null,
      status: "pending",
    })
    .select("id, created_at")
    .single();

  if (error) return errorText("INSERT_FAILED", error.message);

  return jsonText({
    ok: true,
    proposal_id: (data as { id: string } | null)?.id ?? null,
    status: "pending",
    requires_human_approval: true,
    applied: false,
    client: { id: target.id, name: target.name },
    deliverable: deliverable ? { id: deliverable.id, title: deliverable.title } : null,
    action: args.action,
    payload,
    created_at: (data as { created_at: string } | null)?.created_at ?? null,
    message:
      "Proposal filed as pending. NOTHING has changed yet — the client's journey record is untouched. A CREAIT teammate must accept it in the Command Center before it takes effect. Say exactly that when you report back; do not describe the deliverable as done.",
  });
}

// ============================================================================
// cc_add_client_note — commentary on the timeline (a direct write)
// ============================================================================

export const ccAddClientNoteInput = {
  client: z.string().min(1).describe("Client name (e.g. 'Rad Media'), company, or uuid."),
  body: z.string().min(2).describe("The note. Observation, context, or a summary — commentary only, never a claim that delivery state changed."),
  deliverable: z
    .string()
    .optional()
    .describe("Optional deliverable title or uuid to pin the note to. Its milestone is filled in automatically."),
};

export async function ccAddClientNote(args: { client: string; body: string; deliverable?: string }) {
  const supabase = client();

  let target: ClientRow;
  let milestones: MilestoneRow[];
  let deliverables: DeliverableRow[];
  try {
    const resolved = await resolveClient(supabase, args.client);
    if (!resolved.ok) return resolved.result;
    target = resolved.client;
    const template = await loadTemplate(supabase);
    milestones = template.milestones;
    deliverables = template.deliverables;
  } catch (err) {
    return errorText("QUERY_FAILED", (err as Error).message);
  }

  const milestoneName = new Map(milestones.map((m) => [m.id, m.name] as const));

  let deliverable: DeliverableRow | null = null;
  if (args.deliverable) {
    const resolvedDeliverable = resolveDeliverable(args.deliverable, deliverables, (id) => milestoneName.get(id) ?? null);
    if (!resolvedDeliverable.ok) return resolvedDeliverable.result;
    deliverable = resolvedDeliverable.deliverable;
  }

  const { data, error } = await supabase
    .from("cc_client_activity")
    .insert({
      org_id: ORG_ID,
      client_id: target.id,
      actor_type: "agent",
      actor_id: AGENT_ACTOR_ID,
      actor_name: AGENT_ACTOR_NAME,
      kind: "note",
      body: args.body.trim(),
      deliverable_id: deliverable?.id ?? null,
      milestone_id: deliverable?.milestone_id ?? null,
    })
    .select("id, created_at")
    .single();

  if (error) return errorText("INSERT_FAILED", error.message);

  return jsonText({
    ok: true,
    activity_id: (data as { id: string } | null)?.id ?? null,
    client: { id: target.id, name: target.name },
    deliverable: deliverable ? { id: deliverable.id, title: deliverable.title } : null,
    actor: { type: "agent", name: AGENT_ACTOR_NAME },
    created_at: (data as { created_at: string } | null)?.created_at ?? null,
    message:
      "Note added to the client's timeline, attributed to Hermes. This changed no delivery state — if a deliverable actually moved, file a proposal with cc_propose_client_update.",
  });
}
