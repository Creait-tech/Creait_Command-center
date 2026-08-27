/**
 * cc_list_pending_proposals — what Hermes has already asked for, and what
 * humans have decided.
 *
 * Read-only. This exists so the agent can check the queue before filing:
 * a second proposal about the same thing, still waiting on the same person,
 * is noise. The propose tools each run a duplicate guard of their own, but
 * this is how Hermes sees the whole board — including the client-delivery
 * proposals filed by cc_propose_client_update — and can say "that's already
 * with the team" instead of asking twice.
 */
import { z } from "zod";

import {
  ORG_ID,
  PROPOSAL_COLS,
  PROPOSAL_TARGET_KINDS,
  client,
  errorText,
  jsonText,
  loadClients,
  loadKpis,
  loadTemplate,
  type PendingProposalRow,
} from "./proposal-core.js";

const PROPOSAL_STATUSES = ["pending", "accepted", "rejected"] as const;

export const ccListPendingProposalsInput = {
  kind: z
    .enum([...PROPOSAL_TARGET_KINDS, "all"])
    .optional()
    .describe(
      "Narrow to one family: 'client_journey' (deliverable ticks and notes), 'client_record' (client status/health/tier/MRR), 'journey_template' (milestones and deliverables), 'kpi' (scorecard). Defaults to 'all'.",
    ),
  status: z
    .enum([...PROPOSAL_STATUSES, "all"])
    .optional()
    .describe("'pending' (default) shows what is still waiting on a human. 'accepted'/'rejected' show decisions already made."),
  limit: z.number().int().min(1).max(200).optional().describe("Max proposals to return. Defaults to 50."),
};

export async function ccListPendingProposals({
  kind = "all",
  status = "pending",
  limit = 50,
}: {
  kind?: (typeof PROPOSAL_TARGET_KINDS)[number] | "all";
  status?: (typeof PROPOSAL_STATUSES)[number] | "all";
  limit?: number;
}) {
  const supabase = client();

  let q = supabase
    .from("cc_agent_proposals")
    .select(PROPOSAL_COLS)
    .eq("org_id", ORG_ID)
    .order("created_at", { ascending: false });
  if (kind !== "all") q = q.eq("target_kind", kind);
  if (status !== "all") q = q.eq("status", status);

  const [proposalRes, templateRes, kpiRes, clientRes] = await Promise.allSettled([
    q,
    loadTemplate(supabase),
    loadKpis(supabase),
    loadClients(supabase),
  ]);

  if (proposalRes.status === "rejected") {
    return errorText("QUERY_FAILED", (proposalRes.reason as Error).message);
  }
  if (proposalRes.value.error) return errorText("QUERY_FAILED", proposalRes.value.error.message);

  const rows = (proposalRes.value.data ?? []) as PendingProposalRow[];

  // Names are a convenience, not the answer — a lookup failure degrades the
  // labels rather than the listing.
  const labels = new Map<string, string>();
  if (templateRes.status === "fulfilled") {
    for (const m of templateRes.value.milestones) if (m.name) labels.set(m.id, m.name);
    for (const d of templateRes.value.deliverables) if (d.title) labels.set(d.id, d.title);
  }
  if (kpiRes.status === "fulfilled") {
    for (const k of kpiRes.value) if (k.name) labels.set(k.id, k.name);
  }
  if (clientRes.status === "fulfilled") {
    for (const c of clientRes.value) if (c.name) labels.set(c.id, c.name);
  }

  const payloadString = (p: PendingProposalRow, key: string): string | null => {
    const value = p.payload?.[key];
    return typeof value === "string" ? value : null;
  };

  const items = rows.slice(0, limit).map((p) => ({
    id: p.id,
    status: p.status,
    action: p.action,
    target: {
      kind: p.target_kind,
      table: p.target_table,
      id: p.target_id,
      // The payload label is the truth for a create, where no row exists yet.
      label:
        (p.payload?.target as { label?: string } | undefined)?.label ??
        (p.target_id ? labels.get(p.target_id) ?? null : null),
    },
    summary: payloadString(p, "summary"),
    client: p.client_id ? { id: p.client_id, name: labels.get(p.client_id) ?? null } : null,
    deliverable: p.deliverable_id
      ? { id: p.deliverable_id, title: labels.get(p.deliverable_id) ?? null }
      : null,
    rationale: p.rationale,
    evidence: p.evidence,
    payload: p.payload,
    proposed_by: p.proposed_by,
    created_at: p.created_at,
    decided_by_name: p.decided_by_name,
    decided_at: p.decided_at,
  }));

  const byKind: Record<string, number> = {};
  for (const p of rows) byKind[p.target_kind ?? "unknown"] = (byKind[p.target_kind ?? "unknown"] ?? 0) + 1;

  return jsonText({
    total: rows.length,
    count: items.length,
    truncated: items.length < rows.length,
    filter: { kind, status },
    by_kind: byKind,
    items,
    note:
      "`total` is the exact number of proposals matching the filter. Everything listed with status='pending' is still " +
      "waiting on a CREAIT teammate and has changed nothing. Do not file another proposal about anything already listed here.",
  });
}
