/**
 * The widened `cc_agent_proposals` contract, and safe readers for the jsonb
 * payload the MCP tools attach to it.
 *
 * Migration `widen_agent_proposals_for_config` widened the existing table
 * rather than adding a second one, so a configuration proposal arrives through
 * the same query, the same realtime subscription and the same inbox as a
 * client-journey one. What tells them apart is `target_kind` — never `action`,
 * which now overlaps across families (`change_status` is a client-record
 * change; `update` is used by three different kinds).
 *
 * `lib/supabase/types.ts` still describes the pre-migration column set and is
 * owned by other work, so the row shape is widened here instead. The generated
 * `Insert`/`Update` types already accept unknown keys, so writes type-check
 * either way; this only restores read-side safety.
 *
 * Everything here is a pure function over `Json`. No "use client", no server
 * imports — the same wording and the same decisions are produced whether a
 * proposal is resolved on the server for first paint or re-read in the browser
 * after a realtime update.
 *
 * THE BOUNDARY, mirrored from the MCP server and enforced by a database CHECK:
 * `skills` and `agents` are absent from `PROPOSAL_TARGET_TABLES`. An agent may
 * propose changes to the org's configuration; it may never propose a change to
 * its own instructions, schedule or enabled flag. Nothing in this module — or
 * anywhere in the inbox — reads or writes those tables, and widening the list
 * would also mean changing the constraint, which keeps it a reviewable act.
 */

import type { CcAgentProposal, Json, ProposalAction } from "@/lib/supabase/types";

// ─────────────────────────────────────────────────────────────────────────────
// The widened row
// ─────────────────────────────────────────────────────────────────────────────

/** Which family of change this is — selects the applier the inbox runs. */
export const PROPOSAL_TARGET_KINDS = [
  "client_journey",
  "client_record",
  "journey_template",
  "kpi",
] as const;
export type ProposalTargetKind = (typeof PROPOSAL_TARGET_KINDS)[number];

/**
 * Every table an acceptance is permitted to land in. Mirrors
 * `cc_agent_proposals_target_table_check`.
 */
export const PROPOSAL_TARGET_TABLES = [
  "cc_client_journey",
  "cc_clients",
  "journey_milestones",
  "journey_deliverables",
  "kpis",
] as const;
export type ProposalTargetTable = (typeof PROPOSAL_TARGET_TABLES)[number];

/** Actions the widened table added, on top of the client-journey four. */
export type ConfigProposalAction = "create" | "update" | "delete" | "reorder";

export type AnyProposalAction = ProposalAction | ConfigProposalAction;

/**
 * `cc_agent_proposals` as it exists in Postgres today: `client_id` nullable,
 * `action` widened, and the target triple present on every row.
 */
export interface AgentProposal
  extends Omit<CcAgentProposal, "client_id" | "action"> {
  client_id: string | null;
  action: AnyProposalAction;
  target_kind: ProposalTargetKind;
  target_table: ProposalTargetTable | null;
  target_id: string | null;
}

function isTargetKind(value: unknown): value is ProposalTargetKind {
  return (
    typeof value === "string" &&
    (PROPOSAL_TARGET_KINDS as readonly string[]).includes(value)
  );
}

function isTargetTable(value: unknown): value is ProposalTargetTable {
  return (
    typeof value === "string" &&
    (PROPOSAL_TARGET_TABLES as readonly string[]).includes(value)
  );
}

/**
 * Read one row from PostgREST as an `AgentProposal`.
 *
 * `target_kind` is `NOT NULL DEFAULT 'client_journey'` and every pre-existing
 * row was backfilled truthfully, so it is always present in practice. It is
 * still normalised here rather than trusted: an unrecognised value becomes
 * `null` on the way through `resolveTargetKind` below, and the applier refuses
 * it by name instead of silently falling through to the client-journey path
 * and writing to the wrong table.
 */
export function asAgentProposal(row: unknown): AgentProposal {
  return row as AgentProposal;
}

/** The row's family, or null when the column holds something we don't handle. */
export function resolveTargetKind(
  proposal: Pick<AgentProposal, "target_kind">,
): ProposalTargetKind | null {
  return isTargetKind(proposal.target_kind) ? proposal.target_kind : null;
}

/** The table an acceptance would land in, or null when unset/unrecognised. */
export function resolveTargetTable(
  proposal: Pick<AgentProposal, "target_table">,
): ProposalTargetTable | null {
  return isTargetTable(proposal.target_table) ? proposal.target_table : null;
}

/** True for the two families that carry no `client_id`. */
export function isConfigProposal(kind: ProposalTargetKind | null): boolean {
  return kind === "journey_template" || kind === "kpi";
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload readers
// ─────────────────────────────────────────────────────────────────────────────

/** A plain jsonb object, as read back from PostgREST. */
export type PayloadRecord = Record<string, Json | undefined>;

type JsonRecord = PayloadRecord;

function asRecord(value: Json | null | undefined): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

/** One nested object out of a payload, e.g. `payload.impact`. */
export function payloadObject(
  payload: Json | null,
  key: string,
): JsonRecord | null {
  return asRecord(asRecord(payload)?.[key]);
}

/** One nested array out of a payload, e.g. `payload.proposed.order`. */
function payloadArray(source: JsonRecord | null, key: string): Json[] {
  const value = source?.[key];
  return Array.isArray(value) ? value : [];
}

function readString(source: JsonRecord | null, key: string): string | null {
  const value = source?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(source: JsonRecord | null, key: string): number | null {
  const value = source?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(source: JsonRecord | null, key: string): boolean | null {
  const value = source?.[key];
  return typeof value === "boolean" ? value : null;
}

/** A whole count ≥ 0, or 0 when the field is missing or unusable. */
function readCount(source: JsonRecord | null, key: string): number {
  const n = readNumber(source, key);
  return n === null ? 0 : Math.max(0, Math.trunc(n));
}

/**
 * Typed readers over one jsonb object.
 *
 * The applier treats the payload as untrusted input, because it is: it was
 * written by an agent. Every value that becomes a column goes through one of
 * these, and anything of the wrong shape reads as absent rather than being
 * coerced into a write.
 */
export const field = {
  string: (source: PayloadRecord | null, key: string) => readString(source, key),
  number: (source: PayloadRecord | null, key: string) => readNumber(source, key),
  boolean: (source: PayloadRecord | null, key: string) => readBoolean(source, key),
  /** True when the key is present at all, even holding null. */
  present: (source: PayloadRecord | null, key: string) =>
    source !== null && Object.prototype.hasOwnProperty.call(source, key),
};

/** The one-line summary the filing tool wrote. */
export function proposalSummary(payload: Json | null): string | null {
  return readString(asRecord(payload), "summary");
}

/** `payload.target` — the label is what the row was called when proposed. */
export function payloadTargetLabel(payload: Json | null): string | null {
  return readString(payloadObject(payload, "target"), "label");
}

/** The `{ id, name }` milestone a deliverable change sits under, if named. */
export function payloadMilestone(
  payload: Json | null,
): { id: string | null; name: string | null } | null {
  const source =
    payloadObject(payload, "milestone") ?? payloadObject(payload, "scope_milestone");
  if (!source) return null;
  return { id: readString(source, "id"), name: readString(source, "name") };
}

export interface ProposedChange {
  field: string;
  from: Json;
  to: Json;
}

/** `payload.changes` — the fields that would actually move. */
export function payloadChanges(payload: Json | null): ProposedChange[] {
  return payloadArray(asRecord(payload), "changes").flatMap((entry) => {
    const row = asRecord(entry);
    const field = readString(row, "field");
    if (!row || !field) return [];
    return [{ field, from: row.from ?? null, to: row.to ?? null }];
  });
}

/** `payload.proposed` when it is an object of column values (not an order). */
export function payloadProposedValues(payload: Json | null): JsonRecord | null {
  return payloadObject(payload, "proposed");
}

/** `payload.current` — what the row holds today, as the tool saw it. */
export function payloadCurrentValues(payload: Json | null): JsonRecord | null {
  return payloadObject(payload, "current");
}

export interface OrderedEntry {
  id: string;
  label: string | null;
}

function readOrder(source: JsonRecord | null): OrderedEntry[] {
  return payloadArray(source, "order").flatMap((entry) => {
    const row = asRecord(entry);
    const id = readString(row, "id");
    if (!id) return [];
    return [{ id, label: readString(row, "label") }];
  });
}

/** The order a `reorder` proposal asks for, top to bottom. */
export function payloadProposedOrder(payload: Json | null): OrderedEntry[] {
  return readOrder(payloadObject(payload, "proposed"));
}

/** The order the set is in today, as the tool saw it. */
export function payloadCurrentOrder(payload: Json | null): OrderedEntry[] {
  return readOrder(payloadObject(payload, "current"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Impact — the consequences an approver has to see before accepting
// ─────────────────────────────────────────────────────────────────────────────

export interface AffectedClient {
  id: string;
  name: string | null;
  tracked: number;
  completed: number;
}

/**
 * Tracked client progress hanging off the rows a deletion would remove.
 *
 * The foreign keys cascade — `cc_client_journey.deliverable_id` is
 * `ON DELETE CASCADE` — so every tick counted here is erased permanently when
 * the delete lands. There is no error to catch and nothing to roll back.
 */
export interface TrackedProgressImpact {
  trackedRows: number;
  completed: number;
  notCompleted: number;
  clients: AffectedClient[];
}

function readTrackedProgress(
  source: JsonRecord | null,
): TrackedProgressImpact | null {
  if (!source) return null;
  const clients = payloadArray(source, "clients_affected").flatMap((entry) => {
    const row = asRecord(entry);
    const id = readString(row, "id");
    if (!row || !id) return [];
    return [
      {
        id,
        name: readString(row, "name"),
        tracked: readCount(row, "tracked"),
        completed: readCount(row, "completed"),
      },
    ];
  });

  return {
    trackedRows: readCount(source, "tracked_rows"),
    completed: readCount(source, "completed"),
    notCompleted: readCount(source, "not_completed"),
    clients,
  };
}

/** `impact.tracked_progress_lost` — what a journey deletion would destroy. */
export function impactTrackedProgressLost(
  payload: Json | null,
): TrackedProgressImpact | null {
  const impact = payloadObject(payload, "impact");
  return readTrackedProgress(asRecord(impact?.tracked_progress_lost));
}

/**
 * `impact.ghl_sync_orphan` — true when accepting would leave the hourly GHL
 * sync matching nothing.
 *
 * `ghlSync` finds each KPI with `.eq('name', name)` and `.maybeSingle()`, so a
 * rename produces no error, no write and no log line: the job keeps computing
 * the number every hour and puts it nowhere, and the scoreboard freezes at its
 * last value. This flag is the only warning anyone gets.
 */
export function impactGhlSyncOrphan(payload: Json | null): boolean {
  return payloadObject(payload, "impact")?.ghl_sync_orphan === true;
}

/** `impact.ghl_synced` — the KPI's value is written by the sync today. */
export function impactGhlSynced(payload: Json | null): boolean {
  return payloadObject(payload, "impact")?.ghl_synced === true;
}

/** `impact.ghl_sync_warning` — a create that would never receive a value. */
export function impactGhlSyncWarning(payload: Json | null): string | null {
  return readString(payloadObject(payload, "impact"), "ghl_sync_warning");
}

/** `impact.note` — the tool's own plain-English consequence line. */
export function impactNote(payload: Json | null): string | null {
  return readString(payloadObject(payload, "impact"), "note");
}

/** `impact.revenue_leaving_board` — MRR a status change takes off the roster. */
export function impactRevenueLeaving(payload: Json | null): number | null {
  return readNumber(payloadObject(payload, "impact"), "revenue_leaving_board");
}

/** Deliverables a milestone delete would take with it, as proposed. */
export function payloadDeliverablesRemoved(payload: Json | null): string[] {
  return payloadArray(asRecord(payload), "deliverables_removed").flatMap(
    (entry) => {
      const title = readString(asRecord(entry), "title");
      return title ? [title] : [];
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Destructiveness
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether accepting this has to go through the confirmation that re-reads the
 * damage first.
 *
 * Decided from the row's own **columns** — never from `impact.ghl_sync_orphan`
 * or `impact.destructive`, which the agent writes. A gate an agent can talk its
 * way past by omitting a flag is not a gate. Every KPI edit qualifies, not just
 * the renames: whether a change orphans the hourly sync depends on the KPI's
 * *current* name, which only a live read knows, and a rename that quietly
 * freezes a scoreboard number must never reach a one-click Accept.
 *
 * The confirmation is cheap for the safe cases — it reads the impact and says
 * "the sync keeps finding it" — and the server re-derives the same answer at
 * accept time and refuses a mismatched acknowledgement, so this is the routing
 * decision, not the enforcement.
 */
export function needsDestructiveConfirm(
  proposal: Pick<AgentProposal, "action" | "target_kind">,
): boolean {
  const kind = resolveTargetKind(proposal);
  if (kind === "journey_template") return proposal.action === "delete";
  if (kind === "kpi") {
    return proposal.action === "delete" || proposal.action === "update";
  }
  return false;
}

/** True for the actions that destroy a row outright, for button styling. */
export function isDestructiveAction(
  proposal: Pick<AgentProposal, "action" | "target_kind">,
): boolean {
  const kind = resolveTargetKind(proposal);
  return (
    proposal.action === "delete" && (kind === "journey_template" || kind === "kpi")
  );
}
