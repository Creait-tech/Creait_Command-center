import "server-only";

/**
 * Turning an accepted **configuration** proposal into the change it describes.
 *
 * The governing rule: an accepted proposal has to land in exactly the state a
 * teammate would have produced by hand. Where the human path is already a
 * server action — the journey template, all of it — this module calls that
 * action rather than writing a second implementation that can drift. Where
 * there is no server action (the scorecard and the client record are edited
 * from the browser today), the write is reproduced here column-for-column
 * against the human path, with the differences called out in comments.
 *
 * Two invariants every write below holds:
 *
 *  - **`.select()` is proof, not decoration.** An RLS-rejected UPDATE or
 *    DELETE does not error: it matches zero rows and PostgREST answers 2xx.
 *    The returned rows are the only evidence anything happened, so an empty
 *    result is treated as the failure it is. This project has shipped that bug
 *    four times.
 *  - **The payload is untrusted input.** It was written by an agent. Every
 *    value that becomes a column is read through a typed reader and checked
 *    against the same enum the human form uses; anything unrecognised is
 *    refused by name rather than coerced into a write.
 *
 * `skills` and `agents` appear nowhere in this module, by design — see
 * `components/proposals/proposal-payload.ts`.
 */

import type { createClient } from "@/lib/supabase/server";
import {
  createDeliverable,
  createMilestone,
  deleteDeliverable,
  deleteMilestone,
  reorderDeliverables,
  reorderMilestones,
  updateDeliverable,
  updateMilestone,
} from "@/app/(dashboard)/journey/actions";
import {
  field,
  payloadProposedOrder,
  payloadProposedValues,
  payloadTargetLabel,
  resolveTargetTable,
  type AgentProposal,
  type PayloadRecord,
} from "@/components/proposals/proposal-payload";
import type { LiveProposalImpact } from "@/components/proposals/proposal-impact-types";
import { NOTHING_SAVED, done, fail, type ApplyResult } from "./apply-result";
import type {
  CcClientHealth,
  CcClientStatus,
  KpiSource,
} from "@/lib/supabase/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const CLIENT_STATUSES: readonly CcClientStatus[] = [
  "lead",
  "onboarding",
  "active",
  "paused",
  "churned",
  "complete",
];
const CLIENT_HEALTH: readonly CcClientHealth[] = ["green", "yellow", "red"];
const KPI_SOURCES: readonly KpiSource[] = ["manual", "ghl", "stripe", "google", "other"];

/** A whole position ≥ 0, or null when the payload holds something else. */
function positionOf(proposed: PayloadRecord | null): number | null {
  const raw = field.number(proposed, "sort_order");
  if (raw === null || !Number.isFinite(raw)) return null;
  const n = Math.trunc(raw);
  return n < 0 ? null : n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Journey template — every path delegates to app/(dashboard)/journey/actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a create actually landed on.
 *
 * `createMilestone` / `createDeliverable` append to the end — the same thing
 * the Add dialogs do, because they are the same code. When a proposal asked
 * for a specific position, the reposition is issued as a second call to the
 * Edit action, which is also exactly what a human would do: add, then move.
 */
async function landedPosition(
  supabase: Supabase,
  table: "journey_milestones" | "journey_deliverables",
  id: string,
): Promise<number | null> {
  const query =
    table === "journey_milestones"
      ? supabase.from("journey_milestones").select("sort_order").eq("id", id)
      : supabase.from("journey_deliverables").select("sort_order").eq("id", id);
  const { data } = await query.maybeSingle();
  const value = (data as { sort_order: number | null } | null)?.sort_order;
  return typeof value === "number" ? value : null;
}

async function applyJourneyCreate(
  supabase: Supabase,
  proposal: AgentProposal,
  table: "journey_milestones" | "journey_deliverables",
): Promise<ApplyResult> {
  const proposed = payloadProposedValues(proposal.payload);
  const wantedPosition = positionOf(proposed);

  if (table === "journey_milestones") {
    const name =
      field.string(proposed, "name") ?? payloadTargetLabel(proposal.payload);
    if (!name) return fail("This proposal names no milestone to add");

    const created = await createMilestone({
      name,
      description: field.string(proposed, "description"),
    });
    if (!created.ok) return fail(created.error);

    const warning = await repositionIfAsked(
      supabase,
      "journey_milestones",
      created.data.id,
      wantedPosition,
      (sortOrder) => updateMilestone({ id: created.data.id, sortOrder }),
    );
    return done(`“${name}” added to the journey template`, warning);
  }

  const title = field.string(proposed, "title") ?? payloadTargetLabel(proposal.payload);
  if (!title) return fail("This proposal names no deliverable to add");

  const milestoneId = field.string(proposed, "milestone_id");
  if (!milestoneId) {
    return fail("This proposal doesn't say which milestone the deliverable belongs to");
  }

  const created = await createDeliverable({
    milestoneId,
    title,
    description: field.string(proposed, "description"),
    required: field.boolean(proposed, "required") ?? true,
  });
  if (!created.ok) return fail(created.error);

  const warning = await repositionIfAsked(
    supabase,
    "journey_deliverables",
    created.data.id,
    wantedPosition,
    (sortOrder) => updateDeliverable({ id: created.data.id, sortOrder }),
  );
  return done(`“${title}” added to the journey template`, warning);
}

/** Second step of a create, only when the proposal asked for a position. */
async function repositionIfAsked(
  supabase: Supabase,
  table: "journey_milestones" | "journey_deliverables",
  id: string,
  wanted: number | null,
  move: (sortOrder: number) => Promise<{ ok: boolean; error?: string }>,
): Promise<string | null> {
  if (wanted === null) return null;
  const landed = await landedPosition(supabase, table, id);
  if (landed === wanted) return null;

  const result = await move(wanted);
  if (result.ok) return null;
  return (
    `It was added at the end of the list. Moving it to position ${wanted} failed ` +
    `(${result.error ?? "unknown error"}) — drag it into place on Client Journey.`
  );
}

async function applyJourneyUpdate(
  proposal: AgentProposal,
  table: "journey_milestones" | "journey_deliverables",
): Promise<ApplyResult> {
  if (!proposal.target_id) return fail("This proposal names nothing to edit");
  const proposed = payloadProposedValues(proposal.payload);
  if (!proposed) return fail("This proposal carries no values to write");

  const sortOrder = positionOf(proposed);
  const hasPosition = field.present(proposed, "sort_order");
  if (hasPosition && sortOrder === null) {
    return fail("The proposed position is not a whole number, 0 or higher");
  }

  if (table === "journey_milestones") {
    const result = await updateMilestone({
      id: proposal.target_id,
      ...(field.present(proposed, "name")
        ? { name: field.string(proposed, "name") ?? "" }
        : {}),
      ...(field.present(proposed, "description")
        ? { description: field.string(proposed, "description") }
        : {}),
      ...(sortOrder !== null ? { sortOrder } : {}),
    });
    if (!result.ok) return fail(result.error);
    return done(`“${result.data.milestone.name}” updated`);
  }

  const result = await updateDeliverable({
    id: proposal.target_id,
    ...(field.present(proposed, "title")
      ? { title: field.string(proposed, "title") ?? "" }
      : {}),
    ...(field.present(proposed, "description")
      ? { description: field.string(proposed, "description") }
      : {}),
    ...(field.present(proposed, "required")
      ? { required: field.boolean(proposed, "required") ?? true }
      : {}),
    ...(sortOrder !== null ? { sortOrder } : {}),
  });
  if (!result.ok) return fail(result.error);
  return done(`“${result.data.deliverable.title}” updated`);
}

/**
 * A journey deletion, with the freshly-read impact reported back.
 *
 * The `acknowledged` numbers handed to the journey action are the *live* ones
 * read moments ago, not anything the card was rendered with — the action
 * re-checks them itself, which is a second guard against a teammate changing
 * something between the read and the write.
 */
async function applyJourneyDelete(
  proposal: AgentProposal,
  table: "journey_milestones" | "journey_deliverables",
  live: LiveProposalImpact,
): Promise<ApplyResult> {
  if (!proposal.target_id) return fail("This proposal names nothing to remove");

  if (table === "journey_milestones") {
    if (live.kind !== "milestone_delete") {
      return fail("The impact of this deletion could not be re-checked, so nothing was applied");
    }
    const result = await deleteMilestone({
      id: proposal.target_id,
      acknowledged: {
        deliverableCount: live.impact.deliverableCount,
        trackedRows: live.impact.trackedRows,
      },
    });
    if (!result.ok) return fail(result.error);
    return done(
      `“${live.impact.name}” removed, with ${result.data.deletedDeliverables} deliverable(s) ` +
        `and ${result.data.deletedJourneyRows} tracked client row(s)`,
    );
  }

  if (live.kind !== "deliverable_delete") {
    return fail("The impact of this deletion could not be re-checked, so nothing was applied");
  }
  const result = await deleteDeliverable({
    id: proposal.target_id,
    acknowledged: { trackedRows: live.impact.trackedRows },
  });
  if (!result.ok) return fail(result.error);
  return done(
    `“${live.impact.title}” removed, with ${result.data.deletedJourneyRows} tracked client row(s)`,
  );
}

async function applyJourneyReorder(
  proposal: AgentProposal,
  table: "journey_milestones" | "journey_deliverables",
): Promise<ApplyResult> {
  const orderedIds = payloadProposedOrder(proposal.payload).map((entry) => entry.id);
  if (orderedIds.length === 0) {
    return fail("This proposal carries no order to apply");
  }

  if (table === "journey_milestones") {
    const result = await reorderMilestones(orderedIds);
    if (!result.ok) return fail(result.error);
    return done(`${result.data.moved} milestones reordered`);
  }

  // Deliverables are reordered inside one milestone; the proposal names it as
  // its target, which is also the ownership check the table itself can't make.
  if (!proposal.target_id) {
    return fail("This proposal doesn't say which milestone's deliverables to reorder");
  }
  const result = await reorderDeliverables({
    milestoneId: proposal.target_id,
    orderedIds,
  });
  if (!result.ok) return fail(result.error);
  return done(`${result.data.moved} deliverables reordered`);
}

export async function applyJourneyTemplateProposal(
  supabase: Supabase,
  proposal: AgentProposal,
  live: LiveProposalImpact,
): Promise<ApplyResult> {
  const table = resolveTargetTable(proposal);
  if (table !== "journey_milestones" && table !== "journey_deliverables") {
    return fail("This proposal names no journey table to change");
  }

  switch (proposal.action) {
    case "create":
      return applyJourneyCreate(supabase, proposal, table);
    case "update":
      return applyJourneyUpdate(proposal, table);
    case "delete":
      return applyJourneyDelete(proposal, table, live);
    case "reorder":
      return applyJourneyReorder(proposal, table);
    default:
      return fail(
        `“${proposal.action}” isn't something that can be done to the journey template`,
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scorecard KPIs — no server action exists, so the browser path is mirrored
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reproduces `components/level10/kpi-form-dialog.tsx` and the scoreboard's
 * delete, column for column, with two deliberate differences:
 *
 *  - every statement ends in `.select()`, because an RLS-rejected write here
 *    would otherwise report success against zero rows;
 *  - `updated_at` is left alone on an edit, exactly as the dialog leaves it,
 *    so an accepted proposal is indistinguishable from a manual edit. (That
 *    column has no trigger in this database — see CLAUDE.md — and nothing
 *    reads it for KPIs; `cc_kpi_history.recorded_at` is the sync evidence.)
 */
export async function applyKpiProposal(
  supabase: Supabase,
  orgId: string,
  proposal: AgentProposal,
): Promise<ApplyResult> {
  const proposed = payloadProposedValues(proposal.payload);

  if (proposal.action === "create") {
    const name = field.string(proposed, "name") ?? payloadTargetLabel(proposal.payload);
    if (!name) return fail("This proposal names no KPI to add");

    const source = field.string(proposed, "source") ?? "manual";
    if (!KPI_SOURCES.includes(source as KpiSource)) {
      return fail(`“${source}” is not a valid KPI source`);
    }

    // Position derived here rather than trusted from the payload, so two
    // proposals accepted minutes apart can't both claim the same slot from a
    // count taken when they were filed.
    const { data: last } = await supabase
      .from("kpis")
      .select("sort_order")
      .eq("org_id", orgId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSortOrder =
      ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from("kpis")
      .insert({
        org_id: orgId,
        name,
        description: field.string(proposed, "description"),
        value: 0,
        target: field.number(proposed, "target"),
        unit: field.string(proposed, "unit"),
        source: source as KpiSource,
        sort_order: positionOf(proposed) ?? nextSortOrder,
      })
      .select("id, name")
      .single();

    if (error || !data) return fail(error?.message ?? NOTHING_SAVED);
    return done(`“${name}” added to the scoreboard at 0`);
  }

  if (!proposal.target_id) return fail("This proposal names no KPI to change");

  if (proposal.action === "delete") {
    const { data, error } = await supabase
      .from("kpis")
      .delete()
      .eq("id", proposal.target_id)
      .eq("org_id", orgId)
      .select("id, name");

    if (error) return fail(error.message);
    const rows = (data as { id: string; name: string }[] | null) ?? [];
    if (rows.length === 0) {
      return fail("Nothing was deleted — check workspace access");
    }
    return done(`“${rows[0].name}” removed from the scoreboard`);
  }

  if (proposal.action !== "update") {
    return fail(`“${proposal.action}” isn't something that can be done to a KPI`);
  }
  if (!proposed) return fail("This proposal carries no values to write");

  // `value` is deliberately absent: it is data written by the sync or by a
  // teammate on the scoreboard card, not configuration, and the proposal tools
  // refuse to carry it.
  const patch: Record<string, unknown> = {};
  if (field.present(proposed, "name")) {
    const name = field.string(proposed, "name");
    if (!name) return fail("A KPI needs a name");
    patch.name = name;
  }
  if (field.present(proposed, "description")) {
    patch.description = field.string(proposed, "description");
  }
  if (field.present(proposed, "target")) patch.target = field.number(proposed, "target");
  if (field.present(proposed, "unit")) patch.unit = field.string(proposed, "unit");
  if (field.present(proposed, "source")) {
    const source = field.string(proposed, "source");
    if (!source || !KPI_SOURCES.includes(source as KpiSource)) {
      return fail(`“${source ?? "empty"}” is not a valid KPI source`);
    }
    patch.source = source;
  }
  if (field.present(proposed, "sort_order")) {
    const position = positionOf(proposed);
    if (position === null) {
      return fail("The proposed position is not a whole number, 0 or higher");
    }
    patch.sort_order = position;
  }

  if (Object.keys(patch).length === 0) return fail("Nothing to change");

  const { data, error } = await supabase
    .from("kpis")
    .update(patch)
    .eq("id", proposal.target_id)
    .eq("org_id", orgId)
    .select("id, name");

  if (error) return fail(error.message);
  const rows = (data as { id: string; name: string }[] | null) ?? [];
  if (rows.length === 0) return fail(NOTHING_SAVED);
  return done(`“${rows[0].name}” updated on the scoreboard`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Client record
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors the edit sheet in `components/clients/clients-view.tsx` for the five
 * fields the proposal tool can carry, including its `updated_at` stamp — that
 * column has no trigger, and the client list orders and reads by it.
 */
export async function applyClientRecordUpdate(
  supabase: Supabase,
  orgId: string,
  proposal: AgentProposal,
): Promise<ApplyResult> {
  const clientId = proposal.target_id ?? proposal.client_id;
  if (!clientId) return fail("This proposal names no client to change");

  const proposed = payloadProposedValues(proposal.payload);
  if (!proposed) return fail("This proposal carries no values to write");

  const patch: Record<string, unknown> = {};

  if (field.present(proposed, "status")) {
    const status = field.string(proposed, "status");
    if (!status || !CLIENT_STATUSES.includes(status as CcClientStatus)) {
      return fail(`“${status ?? "empty"}” is not a valid client status`);
    }
    patch.status = status;
  }
  if (field.present(proposed, "health")) {
    const health = field.string(proposed, "health");
    if (!health || !CLIENT_HEALTH.includes(health as CcClientHealth)) {
      return fail(`“${health ?? "empty"}” is not a valid client health`);
    }
    patch.health = health;
  }
  if (field.present(proposed, "tier")) patch.tier = field.string(proposed, "tier");
  if (field.present(proposed, "company")) patch.company = field.string(proposed, "company");
  if (field.present(proposed, "mrr")) {
    const mrr = field.number(proposed, "mrr");
    if (mrr === null || mrr < 0) return fail("MRR must be a number of 0 or more");
    patch.mrr = mrr;
  }

  if (Object.keys(patch).length === 0) return fail("Nothing to change");
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("cc_clients")
    .update(patch)
    .eq("id", clientId)
    .eq("org_id", orgId)
    .select("id, name");

  if (error) return fail(error.message);
  const rows = (data as { id: string; name: string }[] | null) ?? [];
  if (rows.length === 0) return fail(NOTHING_SAVED);
  return done(`${rows[0].name}'s record updated`);
}
