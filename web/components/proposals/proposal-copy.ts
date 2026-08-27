/**
 * Presentation helpers shared by the server loader and the client inbox.
 *
 * Pure functions only — no "use client", no server imports — so the same
 * wording is produced whether a proposal is rendered on the server for the
 * first paint or re-resolved in the browser after a realtime update.
 *
 * The rule this file exists to enforce: **a raw uuid is never shown to a
 * human.** Every id that reaches the screen goes through a lookup here, and
 * when the lookup misses, the fallback is a sentence explaining the miss.
 * That now covers four families of proposal, not one: a config proposal names
 * a milestone, a deliverable or a KPI by `target_id`, and those resolve
 * through the same maps.
 *
 * The summary rendered here is derived from **live** names, not from the
 * `payload.summary` the filing tool wrote. The tool's sentence is a snapshot
 * of what things were called when it filed; a card that sat in the inbox while
 * someone renamed the row would otherwise show a name that no longer exists.
 */

import type {
  ClientActivityKind,
  Json,
  ProposalAction,
} from "@/lib/supabase/types";
import {
  payloadChanges,
  payloadMilestone,
  payloadProposedOrder,
  payloadProposedValues,
  payloadTargetLabel,
  resolveTargetKind,
  resolveTargetTable,
  type AgentProposal,
  type AnyProposalAction,
  type ProposalTargetKind,
  type ProposalTargetTable,
} from "@/components/proposals/proposal-payload";

/** One deliverable resolved out of the journey template. */
export interface DeliverableRef {
  title: string;
  milestoneId: string;
  milestoneName: string;
}

/** Everything needed to turn ids in a proposal row into readable text. */
export interface ProposalLookups {
  /** client_id → client name */
  clients: Record<string, string>;
  /** deliverable_id → title + parent milestone */
  deliverables: Record<string, DeliverableRef>;
  /** milestone_id → name */
  milestones: Record<string, string>;
  /** kpi_id → name */
  kpis: Record<string, string>;
}

export const PROPOSAL_ACTION_LABEL: Record<AnyProposalAction, string> = {
  mark_done: "Mark done",
  reopen: "Reopen",
  add_note: "Add note",
  change_status: "Change status",
  create: "Add",
  update: "Edit",
  delete: "Remove",
  reorder: "Reorder",
};

/** Which part of the business a proposal touches, in words the team uses. */
export const PROPOSAL_SCOPE_LABEL: Record<ProposalTargetKind, string> = {
  client_journey: "Client delivery",
  client_record: "Client record",
  journey_template: "Journey template",
  kpi: "Scorecard",
};

/** Singular noun for the row a proposal targets. */
export const TARGET_NOUN: Record<ProposalTargetTable, string> = {
  cc_client_journey: "deliverable",
  cc_clients: "client record",
  journey_milestones: "journey milestone",
  journey_deliverables: "deliverable",
  kpis: "scorecard KPI",
};

/** Shown when a deliverable_id no longer resolves — never the uuid itself. */
export const UNKNOWN_DELIVERABLE =
  "a deliverable that is no longer in the journey template";

const UNKNOWN_CLIENT = "Unknown client";

/** Safely pull a trimmed string out of a jsonb payload. */
export function payloadString(payload: Json | null, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const value = (payload as Record<string, Json | undefined>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The note text a `add_note` proposal wants to store, wherever it was put. */
export function proposedNote(payload: Json | null): string | null {
  return (
    payloadString(payload, "note") ??
    payloadString(payload, "body") ??
    payloadString(payload, "text")
  );
}

/** The status a `change_status` proposal wants to move the client to. */
export function proposedStatus(payload: Json | null): string | null {
  return payloadString(payload, "status") ?? payloadString(payload, "to");
}

/** `"Active Deals"` → `“Active Deals”`, or the fallback sentence. */
function quoted(name: string | null, fallback: string): string {
  return name ? `“${name}”` : fallback;
}

/** A value as it should read inside a diff line. */
export function formatFieldValue(value: Json): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim() ? value : "—";
  return JSON.stringify(value);
}

/** `sort_order` → `position`; column names are not a language humans speak. */
export const FIELD_LABEL: Record<string, string> = {
  name: "name",
  title: "title",
  description: "description",
  sort_order: "position",
  required: "required",
  target: "target",
  unit: "unit",
  source: "source",
  status: "status",
  health: "health",
  tier: "tier",
  mrr: "MRR",
  company: "company",
};

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field.replace(/_/g, " ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Summaries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The client-journey wording, unchanged.
 *
 * These strings land in `cc_client_activity.body` and are read back in the
 * feed, so they are deliberately frozen: a config proposal gets new phrasing,
 * an existing one keeps the sentence the team already recognises.
 */
function describeClientJourneyChange(input: {
  action: ProposalAction;
  payload: Json | null;
  deliverableTitle: string | null;
}): string {
  const target = input.deliverableTitle
    ? `“${input.deliverableTitle}”`
    : UNKNOWN_DELIVERABLE;

  switch (input.action) {
    case "mark_done":
      return `Mark ${target} complete`;
    case "reopen":
      return `Reopen ${target}`;
    case "add_note": {
      const note = proposedNote(input.payload);
      const where = input.deliverableTitle ? ` on ${target}` : "";
      return note ? `Add a note${where}: “${note}”` : `Add a note${where}`;
    }
    case "change_status": {
      const status = proposedStatus(input.payload);
      return status
        ? `Change client status to “${status}”`
        : "Change the client's status";
    }
  }
}

/** "status active → paused, MRR 1500 → 0" */
function describeChanges(payload: Json | null): string {
  const changes = payloadChanges(payload);
  if (changes.length === 0) return "";
  return changes
    .map(
      (c) =>
        `${fieldLabel(c.field)} ${formatFieldValue(c.from)} → ${formatFieldValue(c.to)}`,
    )
    .join(", ");
}

function describeConfigChange(input: {
  action: AnyProposalAction;
  targetTable: ProposalTargetTable | null;
  payload: Json | null;
  /** Live name of the row `target_id` points at, when it still resolves. */
  targetName: string | null;
}): string {
  const table = input.targetTable;
  const noun = table ? TARGET_NOUN[table] : "record";
  // A create has no row yet, so the label in the payload *is* the name.
  const label = input.targetName ?? payloadTargetLabel(input.payload);
  const named = quoted(label, `an unnamed ${noun}`);

  switch (input.action) {
    case "create": {
      const parent = payloadMilestone(input.payload)?.name;
      const where = parent && table === "journey_deliverables" ? ` to “${parent}”` : "";
      return `Add the ${noun} ${named}${where}`;
    }
    case "update": {
      const changes = payloadChanges(input.payload);
      const rename = changes.find((c) => c.field === "name" || c.field === "title");
      if (rename) {
        return `Rename the ${noun} ${named} to “${formatFieldValue(rename.to)}”`;
      }
      const summary = describeChanges(input.payload);
      return summary
        ? `Edit the ${noun} ${named}: ${summary}`
        : `Edit the ${noun} ${named}`;
    }
    case "delete":
      return `Remove the ${noun} ${named}`;
    case "reorder": {
      const count = payloadProposedOrder(input.payload).length;
      const scope = payloadMilestone(input.payload)?.name;
      if (table === "journey_deliverables") {
        return scope
          ? `Reorder the ${count} deliverables in “${scope}”`
          : `Reorder ${count} deliverables`;
      }
      return `Reorder the ${count} journey milestones`;
    }
    default:
      return `Change the ${noun} ${named}`;
  }
}

/**
 * One sentence describing what accepting this proposal would change.
 * Used in the inbox card, in the confirmation toast, and — for client-scoped
 * proposals — as the body of the `proposal_accepted` activity entry, so the
 * feed and the inbox agree.
 */
export function describeProposalChange(input: {
  action: AnyProposalAction;
  targetKind: ProposalTargetKind | null;
  targetTable: ProposalTargetTable | null;
  payload: Json | null;
  deliverableTitle: string | null;
  targetName: string | null;
  clientName: string | null;
}): string {
  // `client_journey`, and the `change_status` action that now files under
  // `client_record`, keep their original wording verbatim.
  if (
    input.targetKind === "client_journey" ||
    input.action === "mark_done" ||
    input.action === "reopen" ||
    input.action === "add_note" ||
    input.action === "change_status"
  ) {
    return describeClientJourneyChange({
      action: input.action as ProposalAction,
      payload: input.payload,
      deliverableTitle: input.deliverableTitle,
    });
  }

  if (input.targetKind === "client_record") {
    const who = input.clientName ?? input.targetName ?? UNKNOWN_CLIENT;
    const changes = describeChanges(input.payload);
    return changes ? `Edit ${who}: ${changes}` : `Edit the record for ${who}`;
  }

  return describeConfigChange({
    action: input.action,
    targetTable: input.targetTable,
    payload: input.payload,
    targetName: input.targetName,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolution
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedProposal {
  /** null when the proposal is org-wide configuration rather than a client's. */
  clientName: string | null;
  deliverableTitle: string | null;
  milestoneName: string | null;
  /** Live name of the row `target_id` points at. */
  targetName: string | null;
  /** The name the filing tool recorded, kept for creates and for reorders. */
  proposedLabel: string | null;
  /** `target_id` is set but names nothing that exists any more. */
  targetMissing: boolean;
  summary: string;
}

/** The live name of whatever `target_id` points at, per family. */
function resolveTargetName(
  proposal: Pick<AgentProposal, "target_id" | "target_kind" | "target_table">,
  lookups: ProposalLookups,
): { name: string | null; resolvable: boolean } {
  const id = proposal.target_id;
  if (!id) return { name: null, resolvable: false };

  switch (resolveTargetTable(proposal)) {
    case "journey_milestones":
      return { name: lookups.milestones[id] ?? null, resolvable: true };
    case "journey_deliverables":
      return { name: lookups.deliverables[id]?.title ?? null, resolvable: true };
    case "kpis":
      return { name: lookups.kpis[id] ?? null, resolvable: true };
    case "cc_clients":
      return { name: lookups.clients[id] ?? null, resolvable: true };
    // `cc_client_journey` target ids name a progress row, which has no name of
    // its own — the deliverable it points at is what a human recognises.
    default:
      return { name: null, resolvable: false };
  }
}

/** Resolve a proposal's ids into the strings the UI renders. */
export function resolveProposal(
  proposal: AgentProposal,
  lookups: ProposalLookups,
): ResolvedProposal {
  const ref = proposal.deliverable_id
    ? (lookups.deliverables[proposal.deliverable_id] ?? null)
    : null;

  const kind = resolveTargetKind(proposal);
  const table = resolveTargetTable(proposal);
  const target = resolveTargetName(proposal, lookups);
  const proposedLabel = payloadTargetLabel(proposal.payload);

  // A milestone reorder carries no target_id at all; its scope is the whole
  // set, so "missing" would be a lie.
  const targetMissing =
    target.resolvable && target.name === null && proposal.action !== "reorder";

  const clientName = proposal.client_id
    ? (lookups.clients[proposal.client_id] ?? UNKNOWN_CLIENT)
    : null;

  return {
    clientName,
    deliverableTitle: ref?.title ?? null,
    milestoneName: ref?.milestoneName ?? payloadMilestone(proposal.payload)?.name ?? null,
    targetName: target.name,
    proposedLabel,
    targetMissing,
    summary: describeProposalChange({
      action: proposal.action,
      targetKind: kind,
      targetTable: table,
      payload: proposal.payload,
      deliverableTitle: ref?.title ?? null,
      targetName: target.name,
      clientName,
    }),
  };
}

/** Fields a create would set, as `[label, value]` pairs ready to render. */
export function creationFields(payload: Json | null): [string, string][] {
  const proposed = payloadProposedValues(payload);
  if (!proposed) return [];
  const skip = new Set(["org_id", "milestone_id", "sort_order"]);
  return Object.entries(proposed)
    .filter(([key, value]) => !skip.has(key) && value !== undefined && value !== null)
    .map(([key, value]) => [fieldLabel(key), formatFieldValue(value as Json)]);
}

/** Verb phrase for an activity entry, e.g. "completed a deliverable". */
export const ACTIVITY_VERB: Record<ClientActivityKind, string> = {
  deliverable_completed: "completed",
  deliverable_reopened: "reopened",
  note: "left a note",
  status_change: "changed status",
  proposal_accepted: "accepted a Hermes proposal",
  proposal_rejected: "rejected a Hermes proposal",
};

/**
 * Compact relative time ("3h ago", "12d ago").
 *
 * Hand-rolled rather than date-fns so the same string is produced on the
 * server and in the browser without pulling a locale-sensitive formatter into
 * a hydration boundary.
 */
export function relativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";

  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Whole days since `iso`, or null when there is no timestamp at all. */
export function daysSince(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now - then) / 86_400_000));
}
