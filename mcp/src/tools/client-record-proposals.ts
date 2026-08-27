/**
 * Client-record proposals — how Hermes asks to change a `cc_clients` row:
 * lifecycle status, delivery health, offer tier, MRR, company name.
 *
 * Nothing here mutates `cc_clients`. Every path files a pending row in
 * `cc_agent_proposals`; a teammate accepts it in the Command Center and only
 * that acceptance changes the record.
 *
 * These proposals stay client-scoped — `client_id` is set as well as the
 * target triple — so the inbox can group them under the client they concern,
 * exactly as it already does for delivery proposals.
 */
import { z } from "zod";

import {
  CLIENT_HEALTH,
  CLIENT_STATUSES,
  client,
  diff,
  duplicateText,
  errorText,
  fileProposal,
  findPendingDuplicate,
  loadClients,
  loadPendingProposals,
  noChangeText,
  resolveClient,
  type ClientRow,
} from "./proposal-core.js";

// ============================================================================
// cc_propose_client_change
// ============================================================================

export const ccProposeClientChangeInput = {
  client: z
    .string()
    .min(1)
    .describe("Client name (e.g. 'Rad Media'), company, or uuid. Partial names resolve; ambiguous ones come back as candidates."),
  rationale: z
    .string()
    .min(10)
    .describe(
      "REQUIRED. Why the record should change, in a sentence a teammate can judge. Never restate the change — say what led you to it.",
    ),
  status: z.enum(CLIENT_STATUSES).optional().describe("Lifecycle status: lead, onboarding, active, paused, churned, complete."),
  health: z.enum(CLIENT_HEALTH).optional().describe("Delivery health: green, yellow, red."),
  tier: z.string().optional().describe("Offer tier the client sits in."),
  mrr: z.number().min(0).optional().describe("Monthly recurring revenue in USD."),
  company: z.string().optional().describe("Company name on the record."),
  evidence: z
    .string()
    .optional()
    .describe("Where the belief came from — meeting name and date, a quote from a message, a file path."),
};

export async function ccProposeClientChange(args: {
  client: string;
  rationale: string;
  status?: (typeof CLIENT_STATUSES)[number];
  health?: (typeof CLIENT_HEALTH)[number];
  tier?: string;
  mrr?: number;
  company?: string;
  evidence?: string;
}) {
  const supabase = client();

  let clients: ClientRow[];
  let pending: Awaited<ReturnType<typeof loadPendingProposals>>;
  try {
    const [clientRows, pendingRows] = await Promise.all([
      loadClients(supabase),
      loadPendingProposals(supabase, "client_record"),
    ]);
    clients = clientRows;
    pending = pendingRows;
  } catch (err) {
    return errorText("QUERY_FAILED", (err as Error).message);
  }

  const resolved = resolveClient(args.client, clients);
  if (!resolved.ok) return resolved.result;
  const row = resolved.client;

  const proposed: Record<string, unknown> = {};
  if (args.status !== undefined) proposed.status = args.status;
  if (args.health !== undefined) proposed.health = args.health;
  if (args.tier !== undefined) proposed.tier = args.tier.trim();
  if (args.mrr !== undefined) proposed.mrr = args.mrr;
  if (args.company !== undefined) proposed.company = args.company.trim();

  if (Object.keys(proposed).length === 0) {
    return errorText(
      "NOTHING_PROPOSED",
      "Pass at least one of status, health, tier, mrr or company — otherwise there is nothing to change.",
    );
  }

  const current = {
    status: row.status,
    health: row.health,
    tier: row.tier,
    mrr: row.mrr,
    company: row.company,
  };
  const changes = diff(current, proposed);
  if (changes.length === 0) {
    return noChangeText(
      `${row.name} already has those values. No change needed, so nothing was filed.`,
      { client: { id: row.id, ...current } },
    );
  }
  const dupe = findPendingDuplicate(pending, { action: "update", targetTable: "cc_clients", targetId: row.id });
  if (dupe) return duplicateText(dupe, `the ${row.name} record`);

  const statusChange = changes.find((c) => c.field === "status");
  const mrrChange = changes.find((c) => c.field === "mrr");
  const leavingRevenue =
    statusChange && (statusChange.to === "churned" || statusChange.to === "complete") ? Number(row.mrr ?? 0) : 0;

  return fileProposal(supabase, {
    action: "update",
    targetKind: "client_record",
    targetTable: "cc_clients",
    targetId: row.id,
    clientId: row.id,
    rationale: args.rationale,
    evidence: args.evidence,
    summary: `Edit ${row.name}: ${changes.map((c) => `${c.field} ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`).join(", ")}`,
    payload: {
      target: { kind: "client_record", table: "cc_clients", id: row.id, label: row.name },
      operation: "update",
      client_name: row.name,
      current,
      proposed,
      changes,
    },
    impact: {
      revenue_leaving_board: leavingRevenue > 0 ? leavingRevenue : null,
      mrr_delta: mrrChange ? Number(mrrChange.to ?? 0) - Number(mrrChange.from ?? 0) : null,
      note:
        leavingRevenue > 0
          ? `Moving ${row.name} to '${statusChange?.to}' takes $${leavingRevenue}/mo off the active roster.`
          : mrrChange
            ? `MRR on the roster moves by ${Number(mrrChange.to ?? 0) - Number(mrrChange.from ?? 0)}.`
            : "No revenue effect — this edits descriptive fields only.",
    },
  });
}
