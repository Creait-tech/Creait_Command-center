/**
 * View models shared by the Command Center's client-progress server loader
 * (`app/(dashboard)/command-center/client-progress-data.ts`) and the client
 * components that render them.
 *
 * They live outside the loader because that module is `server-only`; keeping
 * the shapes here lets a "use client" panel import them without dragging a
 * server module into the browser bundle.
 */

import type {
  CcAgentProposal,
  CcClientActivity,
  CcClientHealth,
  CcClientStatus,
} from "@/lib/supabase/types";

/** A client this quiet is the signal the roll-up exists to surface. */
export const STALE_AFTER_DAYS = 14;

/** How many entries the "recently" feed shows. */
export const ACTIVITY_FEED_SIZE = 10;

/**
 * DOM id of the proposals inbox card. The roll-up's pending count links to
 * this anchor, so the two panels stay connected even though they render
 * independently.
 */
export const PROPOSALS_INBOX_ANCHOR = "hermes-proposals";

export interface ClientRollupRow {
  id: string;
  name: string;
  company: string | null;
  status: CcClientStatus;
  health: CcClientHealth;
  /** Deliverables ticked for this client. */
  done: number;
  /** Deliverables in the journey template. */
  total: number;
  percent: number;
  /** Name of the earliest milestone still carrying unfinished work. */
  currentMilestone: string;
  /** Newest of: activity entries, journey ticks, journey edits. */
  lastActivityAt: string | null;
  /** Whole days since `lastActivityAt`; null when nothing has ever happened. */
  staleDays: number | null;
  stale: boolean;
}

export interface ActivityRow {
  entry: CcClientActivity;
  clientName: string;
  deliverableTitle: string | null;
}

export interface ProposalRow {
  proposal: CcAgentProposal;
  clientName: string;
  deliverableTitle: string | null;
  milestoneName: string | null;
  /** One sentence describing what accepting would change. */
  summary: string;
}

export interface ClientProgressData {
  clients: ClientRollupRow[];
  activity: ActivityRow[];
  pending: ProposalRow[];
  recentlyDecided: ProposalRow[];
  totalDeliverables: number;
  /**
   * Read failures, surfaced rather than swallowed. An empty roll-up caused by
   * a denied read must not look like an empty roll-up caused by no clients.
   * Split by panel so neither one reports a problem it isn't showing.
   */
  errors: string[];
  proposalErrors: string[];
}
