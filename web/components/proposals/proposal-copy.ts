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
 */

import type {
  ClientActivityKind,
  Json,
  ProposalAction,
} from "@/lib/supabase/types";

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
}

export const PROPOSAL_ACTION_LABEL: Record<ProposalAction, string> = {
  mark_done: "Mark done",
  reopen: "Reopen",
  add_note: "Add note",
  change_status: "Change status",
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

/**
 * One sentence describing what accepting this proposal would change.
 * Used in the inbox card, in the confirmation toast, and as the body of the
 * `proposal_accepted` activity entry — so the feed and the inbox agree.
 */
export function describeProposalChange(input: {
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

/** Resolve a proposal's ids into the strings the UI renders. */
export function resolveProposal(
  proposal: {
    client_id: string;
    deliverable_id: string | null;
    action: ProposalAction;
    payload: Json | null;
  },
  lookups: ProposalLookups,
): {
  clientName: string;
  deliverableTitle: string | null;
  milestoneName: string | null;
  summary: string;
} {
  const ref = proposal.deliverable_id
    ? (lookups.deliverables[proposal.deliverable_id] ?? null)
    : null;

  return {
    clientName: lookups.clients[proposal.client_id] ?? UNKNOWN_CLIENT,
    deliverableTitle: ref?.title ?? null,
    milestoneName: ref?.milestoneName ?? null,
    summary: describeProposalChange({
      action: proposal.action,
      payload: proposal.payload,
      deliverableTitle: ref?.title ?? null,
    }),
  };
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
