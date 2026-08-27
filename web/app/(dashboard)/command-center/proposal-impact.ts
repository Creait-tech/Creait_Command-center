import "server-only";

/**
 * What accepting a proposal would actually cost — read live, every time.
 *
 * The proposal's own `payload.impact` is a snapshot taken when Hermes filed
 * it. It is worth showing (it is the agent's reasoning) but it is not evidence:
 * this is a multiplayer page, and a card can sit in the inbox for a day while
 * someone ticks a box, adds a deliverable or renames a KPI. So the numbers a
 * confirmation dialog displays, and the numbers the accept path checks, both
 * come from here rather than from the row.
 *
 * The two consequences that are otherwise invisible:
 *
 *  - **Journey deletions cascade.** `cc_client_journey.deliverable_id` is
 *    `ON DELETE CASCADE` and `journey_deliverables.milestone_id` is too, so
 *    removing a deliverable erases every client's tick against it and removing
 *    a milestone reaches two levels down. Postgres raises nothing.
 *  - **KPI renames orphan the sync.** `ghlSync` matches on exact `name` with
 *    `.maybeSingle()`, so a renamed KPI is simply never found again: no error,
 *    no write, a number that quietly stops moving.
 */

import { createClient } from "@/lib/supabase/server";
import {
  getDeliverableDeleteImpact,
  getMilestoneDeleteImpact,
} from "@/app/(dashboard)/journey/actions";
import {
  payloadChanges,
  payloadProposedValues,
  field,
  resolveTargetKind,
  resolveTargetTable,
  type AgentProposal,
} from "@/components/proposals/proposal-payload";
import type {
  KpiSyncImpact,
  LiveImpactReport,
  LiveImpactResult,
  ProposalAcknowledgement,
} from "@/components/proposals/proposal-impact-types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * The KPI names `ghlSync` writes by, copied from `lib/inngest-functions.ts`.
 *
 * Duplicated deliberately rather than imported: that module pulls in the
 * Inngest client and the whole GHL stack, which has no business being loaded
 * to render an inbox card. If the sync's list changes, this one has to change
 * with it — hence the name of the constant it mirrors.
 */
const GHL_SYNCED_KPI_NAMES = [
  "MRR",
  "Active Deals",
  "Conversations 7d",
  "New Contacts 7d",
  "Open Pipeline Value",
] as const;

/** "  active deals " and "Active Deals" are the same name to a human. */
function sameName(a: string | null, b: string | null): boolean {
  return (
    (a ?? "").toLowerCase().replace(/\s+/g, " ").trim() ===
    (b ?? "").toLowerCase().replace(/\s+/g, " ").trim()
  );
}

interface KpiRow {
  id: string;
  name: string;
  value: number | null;
  source: string | null;
  last_synced_at: string | null;
}

/**
 * The live sync consequence of a KPI proposal.
 *
 * `orphansSync` is deliberately keyed on the *name* rather than on
 * `source = 'ghl'`: the sync's lookup is a name match, so a KPI marked
 * `manual` but named "MRR" is still the row the job writes to, and a KPI
 * marked `ghl` under a name the job never writes was already receiving nothing.
 */
async function readKpiImpact(
  supabase: Supabase,
  orgId: string,
  proposal: AgentProposal,
): Promise<{ ok: true; impact: KpiSyncImpact } | { ok: false; error: string }> {
  if (!proposal.target_id) {
    return { ok: false, error: "This KPI proposal names no KPI to change" };
  }

  const { data, error } = await supabase
    .from("kpis")
    .select("id, name, value, source, last_synced_at")
    .eq("id", proposal.target_id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  const kpi = data as KpiRow | null;
  if (!kpi) {
    return { ok: false, error: "That KPI is no longer on the scoreboard" };
  }

  const removing = proposal.action === "delete";
  const rename = payloadChanges(proposal.payload).find((c) => c.field === "name");
  const proposedName =
    typeof rename?.to === "string"
      ? rename.to.trim()
      : field.string(payloadProposedValues(proposal.payload), "name");
  const renamingTo =
    proposal.action === "update" && proposedName && !sameName(proposedName, kpi.name)
      ? proposedName
      : null;

  const writtenBySync = GHL_SYNCED_KPI_NAMES.some((n) => sameName(n, kpi.name));

  let historyPoints = 0;
  if (removing) {
    const { count } = await supabase
      .from("cc_kpi_history")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("kpi_id", kpi.id);
    historyPoints = count ?? 0;
  }

  return {
    ok: true,
    impact: {
      kpiName: kpi.name,
      ghlSynced: writtenBySync || kpi.source === "ghl",
      orphansSync: writtenBySync && (removing || renamingTo !== null),
      renamingTo,
      removing,
      currentValue: kpi.value === null ? null : Number(kpi.value),
      lastSyncedAt: kpi.last_synced_at,
      historyPoints,
    },
  };
}

/**
 * Everything an approver must see before accepting this proposal.
 *
 * Returns `{ kind: "none" }` for the many proposals that destroy nothing —
 * a rename, a reorder, a new deliverable. Those accept in one click, as they
 * should; a confirmation on every card teaches people to click through the
 * ones that matter.
 */
export async function readLiveImpact(
  supabase: Supabase,
  orgId: string,
  proposal: AgentProposal,
): Promise<LiveImpactResult> {
  const kind = resolveTargetKind(proposal);
  const table = resolveTargetTable(proposal);

  if (kind === "journey_template" && proposal.action === "delete") {
    if (!proposal.target_id) {
      return { ok: false, error: "This proposal names nothing to remove" };
    }
    if (table === "journey_milestones") {
      const result = await getMilestoneDeleteImpact(proposal.target_id);
      if (!result.ok) return { ok: false, error: result.error };
      return {
        ok: true,
        report: {
          detail: { kind: "milestone_delete", impact: result.data },
          requiresAcknowledgement: true,
        },
      };
    }
    if (table === "journey_deliverables") {
      const result = await getDeliverableDeleteImpact(proposal.target_id);
      if (!result.ok) return { ok: false, error: result.error };
      return {
        ok: true,
        report: {
          detail: { kind: "deliverable_delete", impact: result.data },
          requiresAcknowledgement: true,
        },
      };
    }
    return { ok: false, error: "This proposal names no journey table to change" };
  }

  if (kind === "kpi" && (proposal.action === "delete" || proposal.action === "update")) {
    const result = await readKpiImpact(supabase, orgId, proposal);
    if (!result.ok) return { ok: false, error: result.error };
    return {
      ok: true,
      report: {
        detail: { kind: "kpi", impact: result.impact },
        // A rename that keeps the sync working needs no ceremony; a delete
        // always does, because the recorded history goes with the row.
        requiresAcknowledgement: result.impact.removing || result.impact.orphansSync,
      },
    };
  }

  return { ok: true, report: { detail: { kind: "none" }, requiresAcknowledgement: false } };
}

/**
 * Refuse an accept whose acknowledgement no longer matches reality.
 *
 * Returns the sentence to show the operator, or null when the accept may
 * proceed. The comparison is against the numbers just read, not the numbers
 * the card was rendered with — which is the whole point.
 */
export function acknowledgementProblem(
  report: LiveImpactReport,
  acknowledged: ProposalAcknowledgement | null | undefined,
): string | null {
  if (!report.requiresAcknowledgement) return null;

  const unseen =
    "This change destroys recorded history, so it has to be confirmed against the current " +
    "numbers. Nothing was applied — reopen Accept to see what it would take with it.";

  if (!acknowledged) return unseen;

  const detail = report.detail;

  if (detail.kind === "milestone_delete") {
    const live = detail.impact;
    if (
      acknowledged.trackedRows === undefined ||
      acknowledged.deliverableCount === undefined
    ) {
      return unseen;
    }
    if (
      acknowledged.trackedRows !== live.trackedRows ||
      acknowledged.deliverableCount !== live.deliverableCount
    ) {
      return (
        "Someone changed this milestone while the confirmation was open — it now holds " +
        `${live.deliverableCount} deliverable(s) and ${live.trackedRows} tracked client row(s). ` +
        "Nothing was applied. Reopen Accept to see the current impact."
      );
    }
    return null;
  }

  if (detail.kind === "deliverable_delete") {
    const live = detail.impact;
    if (acknowledged.trackedRows === undefined) return unseen;
    if (acknowledged.trackedRows !== live.trackedRows) {
      return (
        "Someone changed this deliverable's client progress while the confirmation was open — " +
        `${live.trackedRows} client row(s) are now tracked against it. Nothing was applied. ` +
        "Reopen Accept to see the current impact."
      );
    }
    return null;
  }

  if (detail.kind === "kpi") {
    // The dialog always echoes back the orphan state it displayed, so an
    // absent boolean means the warning was never on screen.
    if (typeof acknowledged.ghlSyncOrphan !== "boolean") return unseen;
    if (detail.impact.orphansSync && acknowledged.ghlSyncOrphan !== true) {
      return (
        `Accepting this stops the hourly GHL sync finding “${detail.impact.kpiName}” — the ` +
        "number would freeze where it is, with no error anywhere. Nothing was applied. " +
        "Reopen Accept to confirm that explicitly."
      );
    }
    return null;
  }

  return null;
}
