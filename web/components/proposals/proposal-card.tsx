"use client";

/**
 * One proposal, as a human has to read it before deciding.
 *
 * Four families land in the same inbox now — a deliverable tick, a client
 * record edit, a change to the journey template every client is measured
 * against, and a change to the scoreboard. They share a card because they
 * share a lifecycle, but the card says which family it is, because "Edit" on a
 * client record and "Edit" on the template are not remotely the same risk.
 *
 * What every card owes the reader, in order:
 *  - **What**, in a sentence built from live names, never a uuid.
 *  - **Which fields**, for a configuration change, because "Edit" is not an
 *    answer.
 *  - **Why**, prominently. A suggestion without a rationale is an instruction,
 *    and this team decided Hermes proposes rather than instructs.
 *  - **What it costs**, when accepting destroys recorded history or breaks a
 *    sync — with the caveat that those numbers are the agent's snapshot and
 *    get re-read before anything is applied.
 */

import { Check, TriangleAlert, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PROPOSAL_ACTION_LABEL,
  PROPOSAL_SCOPE_LABEL,
  TARGET_NOUN,
  UNKNOWN_DELIVERABLE,
  relativeTime,
} from "@/components/proposals/proposal-copy";
import {
  isConfigProposal,
  isDestructiveAction,
  needsDestructiveConfirm,
  resolveTargetKind,
  resolveTargetTable,
} from "@/components/proposals/proposal-payload";
import { ProposalDetails } from "@/components/proposals/proposal-details";
import { FiledImpactNotice } from "@/components/proposals/proposal-impact-notice";
import type { ProposalRow } from "@/components/command-center/client-progress-types";

export function ProposalCard({
  row,
  busy,
  disabled,
  onAccept,
  onReject,
}: {
  row: ProposalRow;
  busy: boolean;
  disabled: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const { proposal } = row;
  const kind = resolveTargetKind(proposal);
  const table = resolveTargetTable(proposal);
  const config = isConfigProposal(kind);
  // Two different questions: does Accept open a confirmation, and does this
  // destroy a row? A KPI rename confirms without being destructive.
  const confirms = needsDestructiveConfirm(proposal);
  const destructive = isDestructiveAction(proposal);

  const missingDeliverable =
    proposal.deliverable_id !== null && row.deliverableTitle === null;
  const targetNoun = table ? TARGET_NOUN[table] : "record";

  // Client families lead with the client; configuration leads with the row it
  // would rewrite, falling back to the name Hermes filed it under.
  const heading = config
    ? (row.targetName ?? row.proposedLabel)
    : row.clientName;

  return (
    <li className="rounded-lg border border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-charcoal)]/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)]">
          {PROPOSAL_ACTION_LABEL[proposal.action]}
        </Badge>
        {kind && (
          <Badge className="bg-[color:var(--color-brand-fog)]/60 text-[color:var(--color-brand-mist)]">
            {PROPOSAL_SCOPE_LABEL[kind]}
          </Badge>
        )}
        {heading && <span className="text-sm font-semibold">{heading}</span>}
        {/* Relative times are re-derived at hydration; the server's clock and
            the browser's can straddle a boundary ("59m" vs "1h"). */}
        <span
          suppressHydrationWarning
          className="ml-auto text-[11px] text-muted-foreground"
        >
          {relativeTime(proposal.created_at)}
        </span>
      </div>

      <p className="mt-2 text-sm leading-snug">
        {!config && row.deliverableTitle ? (
          <>
            <span className="text-[color:var(--color-brand-mist)]">
              {PROPOSAL_ACTION_LABEL[proposal.action]}:
            </span>{" "}
            <span className="font-medium">{row.deliverableTitle}</span>
          </>
        ) : (
          row.summary
        )}
      </p>
      {row.milestoneName && (
        <p className="text-[11px] text-muted-foreground">{row.milestoneName}</p>
      )}

      {missingDeliverable && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-[color:var(--color-brand-warning)]">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
          This points at {UNKNOWN_DELIVERABLE}. Accepting will fail until the
          template is restored — reject it instead.
        </p>
      )}

      {row.targetMissing && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-[color:var(--color-brand-warning)]">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
          The {targetNoun} this would change
          {row.proposedLabel ? ` (filed as “${row.proposedLabel}”)` : ""} is no
          longer in this workspace. Accepting will fail — reject it instead.
        </p>
      )}

      <div className="mt-2.5 space-y-2.5">
        {config && <ProposalDetails proposal={proposal} />}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Why Hermes thinks so
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--color-brand-mist)]">
            {proposal.rationale?.trim() || (
              <span className="italic text-muted-foreground">
                Hermes filed no rationale — treat this as unverified and check
                the {config ? "current configuration" : "client record"} before
                accepting.
              </span>
            )}
          </p>
        </div>

        <FiledImpactNotice proposal={proposal} />

        {proposal.evidence?.trim() && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Evidence
            </p>
            <p className="mt-0.5 max-h-28 overflow-y-auto whitespace-pre-wrap rounded border border-[color:var(--color-brand-fog)]/60 bg-black/20 p-2 font-mono text-[11px] leading-relaxed text-[color:var(--color-brand-mist)]">
              {proposal.evidence.trim()}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant={destructive ? "destructive" : "default"}
          disabled={busy || disabled}
          onClick={onAccept}
        >
          <Check />
          {busy ? "Applying…" : confirms ? "Accept…" : "Accept"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || disabled}
          onClick={onReject}
        >
          <X />
          Reject
        </Button>
        <span className="ml-auto text-[10px] text-muted-foreground">
          proposed by {proposal.proposed_by}
        </span>
      </div>
    </li>
  );
}
