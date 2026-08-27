/**
 * The shapes the inbox uses to talk about *consequences*.
 *
 * These live outside the server modules that compute them so a "use client"
 * confirmation dialog can name them without dragging `server-only` code into
 * the browser bundle — the same split `client-progress-types.ts` uses.
 *
 * Two rules the types exist to make enforceable:
 *
 *  1. **Impact is read live, at accept time.** What a card rendered ten
 *     minutes ago is not evidence of anything; a teammate may have ticked a
 *     box or added a deliverable since. Every field here comes from a fresh
 *     read.
 *  2. **A destructive accept carries an acknowledgement.** The operator
 *     confirms a specific amount of damage, and only that amount is allowed
 *     through. If the live numbers moved while the confirmation was open, the
 *     accept is refused rather than quietly doing more than was agreed to.
 */

import type {
  DeliverableDeleteImpact,
  MilestoneDeleteImpact,
} from "@/app/(dashboard)/journey/actions";

export type {
  DeliverableDeleteImpact,
  MilestoneDeleteImpact,
} from "@/app/(dashboard)/journey/actions";

/**
 * What a KPI change would do to the hourly GHL sync.
 *
 * `ghlSync` (lib/inngest-functions.ts) finds each KPI with
 * `.eq('name', name).maybeSingle()`. There is no foreign key and no error
 * path: rename the row and the job keeps computing the number every hour and
 * writes it nowhere, so the scoreboard freezes at whatever it last held. The
 * only way anyone finds out is if someone notices a number that stopped moving.
 */
export interface KpiSyncImpact {
  /** The KPI's live name, not the one the proposal was filed against. */
  kpiName: string;
  /** The sync writes this KPI's value today. */
  ghlSynced: boolean;
  /** Accepting would leave the sync matching nothing. */
  orphansSync: boolean;
  /** The new name, when this proposal renames the KPI. */
  renamingTo: string | null;
  removing: boolean;
  currentValue: number | null;
  lastSyncedAt: string | null;
  /** `cc_kpi_history` points that go with the row on a delete. */
  historyPoints: number;
}

export type LiveProposalImpact =
  | { kind: "milestone_delete"; impact: MilestoneDeleteImpact }
  | { kind: "deliverable_delete"; impact: DeliverableDeleteImpact }
  | { kind: "kpi"; impact: KpiSyncImpact }
  | { kind: "none" };

export interface LiveImpactReport {
  detail: LiveProposalImpact;
  /**
   * True when accepting without a matching acknowledgement is refused. Set for
   * anything that destroys recorded history or silently breaks the sync.
   */
  requiresAcknowledgement: boolean;
}

/** Exactly what the operator confirmed, echoed back on accept. */
export interface ProposalAcknowledgement {
  /** `cc_client_journey` rows the cascade would erase. */
  trackedRows?: number;
  /** Deliverables a milestone delete would take with it. */
  deliverableCount?: number;
  /** Set when the operator was shown, and accepted, a sync-orphaning change. */
  ghlSyncOrphan?: boolean;
}

export type LiveImpactResult =
  | { ok: true; report: LiveImpactReport }
  | { ok: false; error: string };
