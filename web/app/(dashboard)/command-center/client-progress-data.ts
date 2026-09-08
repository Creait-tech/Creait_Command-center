import "server-only";

/**
 * Server-side loader for the Command Center's client progress roll-up and the
 * Hermes proposals inbox.
 *
 * Both panels answer the same question from different angles — "where does
 * every client stand, and what moved?" — so they share one fetch, one org
 * lookup and one set of id→name maps. Everything ships to the browser already
 * resolved; no component ever has to render a uuid.
 */

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import {
  resolveProposal,
  type DeliverableRef,
  type ProposalLookups,
} from "@/components/proposals/proposal-copy";
import {
  ACTIVITY_FEED_SIZE,
  STALE_AFTER_DAYS,
  type ActivityRow,
  type ClientProgressData,
  type ClientRollupRow,
  type ProposalRow,
} from "@/components/command-center/client-progress-types";
import {
  asAgentProposal,
  type AgentProposal,
} from "@/components/proposals/proposal-payload";
import type {
  CcClient,
  CcClientActivity,
  CcClientJourney,
  JourneyDeliverable,
  JourneyMilestone,
  Kpi,
} from "@/lib/supabase/types";

export {
  ACTIVITY_FEED_SIZE,
  STALE_AFTER_DAYS,
} from "@/components/command-center/client-progress-types";

/**
 * How many activity rows to pull. The newest 10 feed the panel; the rest are
 * only used to find each client's most recent entry. Well beyond a month of
 * real traffic for a four-person team — and when a client does fall outside
 * the window, `lastActivityAt` degrades to its journey-row timestamps rather
 * than to "never".
 */
const ACTIVITY_WINDOW = 250;

function percentOf(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

function newest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export async function loadClientProgress(): Promise<ClientProgressData> {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();
  const errors: string[] = [];
  const proposalErrors: string[] = [];

  const [
    clientsRes,
    milestonesRes,
    journeyRes,
    activityRes,
    kpisRes,
    pendingRes,
    decidedRes,
  ] = await Promise.all([
    supabase
      .from("cc_clients")
      .select("*")
      .eq("org_id", orgId)
      .order("name", { ascending: true }),
    supabase
      .from("journey_milestones")
      .select("*")
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true }),
    supabase.from("cc_client_journey").select("*").eq("org_id", orgId),
    supabase
      .from("cc_client_activity")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(ACTIVITY_WINDOW),
    // Only ever read here to turn a KPI proposal's `target_id` into a name.
    // The scoreboard itself is loaded by /level-10.
    supabase
      .from("kpis")
      .select("id, name")
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("cc_agent_proposals")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("cc_agent_proposals")
      .select("*")
      .eq("org_id", orgId)
      .in("status", ["accepted", "rejected"])
      .order("decided_at", { ascending: false })
      .limit(5),
  ]);

  for (const [label, res, bucket] of [
    ["clients", clientsRes, errors],
    ["journey template", milestonesRes, errors],
    ["journey progress", journeyRes, errors],
    ["activity", activityRes, errors],
    ["scorecard KPIs", kpisRes, proposalErrors],
    ["pending proposals", pendingRes, proposalErrors],
    ["decided proposals", decidedRes, proposalErrors],
  ] as const) {
    if (res.error) bucket.push(`Could not load ${label}: ${res.error.message}`);
  }

  // A client, template or KPI read that failed also breaks the inbox, because
  // that is where proposal ids are turned into names. Say so there too.
  if (clientsRes.error || milestonesRes.error || kpisRes.error) {
    proposalErrors.push(
      "Client, deliverable and KPI names could not all be resolved, so some proposals may read as unknown",
    );
  }

  const clients = ((clientsRes.data as CcClient[] | null) ?? []).filter(
    (c) => c.status !== "churned",
  );
  const milestones = (milestonesRes.data as JourneyMilestone[] | null) ?? [];
  const journeyRows = (journeyRes.data as CcClientJourney[] | null) ?? [];
  const activityRows = (activityRes.data as CcClientActivity[] | null) ?? [];

  // Deliverables hang off milestones, which is where org ownership lives.
  let deliverables: JourneyDeliverable[] = [];
  if (milestones.length > 0) {
    const deliverablesRes = await supabase
      .from("journey_deliverables")
      .select("*")
      .in(
        "milestone_id",
        milestones.map((m) => m.id),
      )
      .order("sort_order", { ascending: true });
    if (deliverablesRes.error) {
      errors.push(`Could not load deliverables: ${deliverablesRes.error.message}`);
    }
    deliverables = (deliverablesRes.data as JourneyDeliverable[] | null) ?? [];
  }

  // ── id → name lookups, built once and shared by every panel ───────────────
  const milestoneNames = new Map(milestones.map((m) => [m.id, m.name]));
  const deliverableRefs: Record<string, DeliverableRef> = {};
  for (const d of deliverables) {
    deliverableRefs[d.id] = {
      title: d.title,
      milestoneId: d.milestone_id,
      milestoneName: milestoneNames.get(d.milestone_id) ?? "Unassigned milestone",
    };
  }
  const clientNames: Record<string, string> = {};
  for (const c of clients) clientNames[c.id] = c.name;
  // Churned clients are filtered out of the roll-up but may still be named by
  // an activity entry or a proposal, so keep them resolvable.
  for (const c of (clientsRes.data as CcClient[] | null) ?? []) {
    clientNames[c.id] = c.name;
  }
  // Configuration proposals name a milestone or a KPI through `target_id`, so
  // both need the same id→name treatment the client families already had.
  const milestoneLookup: Record<string, string> = {};
  for (const m of milestones) milestoneLookup[m.id] = m.name;
  const kpiNames: Record<string, string> = {};
  for (const k of ((kpisRes.data as Pick<Kpi, "id" | "name">[] | null) ?? [])) {
    kpiNames[k.id] = k.name;
  }

  const lookups: ProposalLookups = {
    clients: clientNames,
    deliverables: deliverableRefs,
    milestones: milestoneLookup,
    kpis: kpiNames,
  };

  // ── per-client aggregation ────────────────────────────────────────────────
  const doneByClient = new Map<string, Set<string>>();
  const touchedByClient = new Map<string, string | null>();
  for (const row of journeyRows) {
    if (row.done) {
      const set = doneByClient.get(row.client_id) ?? new Set<string>();
      set.add(row.deliverable_id);
      doneByClient.set(row.client_id, set);
    }
    // Any write to the row counts as movement, tick or note alike.
    const touched = newest(newest(row.updated_at, row.completed_at), row.created_at);
    touchedByClient.set(
      row.client_id,
      newest(touchedByClient.get(row.client_id) ?? null, touched),
    );
  }

  const lastActivityByClient = new Map<string, string>();
  for (const entry of activityRows) {
    // Rows arrive newest-first, so the first one seen per client wins.
    if (!lastActivityByClient.has(entry.client_id)) {
      lastActivityByClient.set(entry.client_id, entry.created_at);
    }
  }

  const deliverablesByMilestone = new Map<string, JourneyDeliverable[]>();
  for (const d of deliverables) {
    const list = deliverablesByMilestone.get(d.milestone_id) ?? [];
    list.push(d);
    deliverablesByMilestone.set(d.milestone_id, list);
  }

  const now = Date.now();
  const totalDeliverables = deliverables.length;

  const rollup: ClientRollupRow[] = clients.map((client) => {
    const doneIds = doneByClient.get(client.id) ?? new Set<string>();

    // Current milestone = the earliest one that still has unfinished work.
    let currentMilestone = totalDeliverables === 0 ? "No journey template" : "Complete";
    for (const milestone of milestones) {
      const items = deliverablesByMilestone.get(milestone.id) ?? [];
      if (items.length === 0) continue;
      if (items.some((d) => !doneIds.has(d.id))) {
        currentMilestone = milestone.name;
        break;
      }
    }

    const lastActivityAt = newest(
      lastActivityByClient.get(client.id) ?? null,
      touchedByClient.get(client.id) ?? null,
    );
    const staleDays = lastActivityAt
      ? Math.max(0, Math.floor((now - new Date(lastActivityAt).getTime()) / 86_400_000))
      : null;

    return {
      id: client.id,
      name: client.name,
      company: client.company,
      status: client.status,
      health: client.health ?? "green",
      mrr: client.mrr,
      done: doneIds.size,
      total: totalDeliverables,
      percent: percentOf(doneIds.size, totalDeliverables),
      currentMilestone,
      lastActivityAt,
      staleDays,
      // "Nothing has ever happened here" is at least as loud a signal as
      // "nothing has happened in three weeks", so both count as stale.
      stale: staleDays === null || staleDays >= STALE_AFTER_DAYS,
    };
  });

  // Quietest first — the roll-up is read top-down for what needs attention.
  rollup.sort((a, b) => {
    if (a.lastActivityAt === b.lastActivityAt) return a.name.localeCompare(b.name);
    if (!a.lastActivityAt) return -1;
    if (!b.lastActivityAt) return 1;
    return a.lastActivityAt < b.lastActivityAt ? -1 : 1;
  });

  const activity: ActivityRow[] = activityRows
    .slice(0, ACTIVITY_FEED_SIZE)
    .map((entry) => ({
      entry,
      clientName: clientNames[entry.client_id] ?? "Unknown client",
      deliverableTitle: entry.deliverable_id
        ? (deliverableRefs[entry.deliverable_id]?.title ?? null)
        : null,
    }));

  const toRow = (row: unknown): ProposalRow => {
    const proposal: AgentProposal = asAgentProposal(row);
    return { proposal, ...resolveProposal(proposal, lookups) };
  };

  return {
    clients: rollup,
    activity,
    pending: ((pendingRes.data as unknown[] | null) ?? []).map(toRow),
    recentlyDecided: ((decidedRes.data as unknown[] | null) ?? []).map(toRow),
    totalDeliverables,
    errors,
    proposalErrors,
  };
}
