"use client";

/**
 * The confirmation a destructive proposal has to pass through.
 *
 * The numbers on the card are the ones Hermes recorded when it filed — which
 * may have been yesterday. This dialog reads the damage again, live, the
 * moment it opens, and the acknowledgement it sends back names exactly what it
 * displayed. The server reads it a third time on accept and refuses anything
 * that no longer matches, so a teammate ticking a box while this sat open
 * cannot turn a confirmed deletion into a larger one.
 *
 * The body is a separate component mounted only while the dialog is open, so
 * every open is a fresh read: there is no state left over from the last time
 * this was looked at, and nothing to reset. Stale impact numbers are the one
 * thing this dialog exists to prevent.
 *
 * The journey-deletion body is `DeleteImpactNotice` — the same component the
 * Client Journey page shows before a manual delete. Accepting a proposal and
 * deleting by hand destroy the same rows, so they say so in the same words.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, ShieldQuestionMark } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeleteImpactNotice } from "@/components/journey/delete-impact-notice";
import { GhlSyncOrphanNotice } from "@/components/proposals/proposal-impact-notice";
import type {
  LiveImpactReport,
  ProposalAcknowledgement,
} from "@/components/proposals/proposal-impact-types";
import { fetchProposalImpact } from "@/app/(dashboard)/command-center/proposal-actions";

interface ProposalConfirmDialogProps {
  proposalId: string | null;
  /** The one-line summary already shown on the card. */
  summary: string;
  /** The proposal deletes a row outright, so the header says so up front. */
  destructive: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (acknowledged: ProposalAcknowledgement) => void;
}

/** The numbers on screen, echoed back so the server can check them. */
function acknowledgementFor(report: LiveImpactReport): ProposalAcknowledgement {
  switch (report.detail.kind) {
    case "milestone_delete":
      return {
        trackedRows: report.detail.impact.trackedRows,
        deliverableCount: report.detail.impact.deliverableCount,
      };
    case "deliverable_delete":
      return { trackedRows: report.detail.impact.trackedRows };
    case "kpi":
      return { ghlSyncOrphan: report.detail.impact.orphansSync };
    default:
      return {};
  }
}

export function ProposalConfirmDialog({
  proposalId,
  summary,
  destructive,
  busy,
  onOpenChange,
  onConfirm,
}: ProposalConfirmDialogProps) {
  return (
    <Dialog open={proposalId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {destructive ? (
              <AlertTriangle
                className="size-4 shrink-0 text-[color:var(--color-brand-danger)]"
                aria-hidden
              />
            ) : (
              <ShieldQuestionMark
                className="size-4 shrink-0 text-[color:var(--color-brand-warning)]"
                aria-hidden
              />
            )}
            {destructive ? "Apply this deletion?" : "Before you apply this"}
          </DialogTitle>
          <DialogDescription>
            {summary}. Checked against the database just now, not against what
            Hermes recorded when it filed.
          </DialogDescription>
        </DialogHeader>

        {proposalId !== null && (
          <ConfirmBody
            proposalId={proposalId}
            busy={busy}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface Fetched {
  report: LiveImpactReport | null;
  error: string | null;
}

function ConfirmBody({
  proposalId,
  busy,
  onCancel,
  onConfirm,
}: {
  proposalId: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (acknowledged: ProposalAcknowledgement) => void;
}) {
  const [fetched, setFetched] = useState<Fetched | null>(null);

  useEffect(() => {
    let live = true;

    void fetchProposalImpact(proposalId)
      .then((result) => {
        if (!live) return;
        setFetched(
          result.ok
            ? { report: result.report, error: null }
            : { report: null, error: result.error },
        );
      })
      .catch((cause: unknown) => {
        if (!live) return;
        setFetched({
          report: null,
          error:
            cause instanceof Error
              ? `The impact could not be read: ${cause.message}`
              : "The impact could not be read, so nothing is safe to accept yet",
        });
      });

    return () => {
      live = false;
    };
  }, [proposalId]);

  const report = fetched?.report ?? null;
  const detail = report?.detail;

  return (
    <>
      <div className="max-h-[52vh] space-y-3 overflow-y-auto">
        {fetched === null && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Reading what this would destroy…
          </p>
        )}

        {fetched?.error && (
          <div className="rounded-lg border border-[color:var(--color-brand-danger)]/35 bg-[color:var(--color-brand-danger)]/8 p-3">
            <p className="text-xs font-semibold text-[color:var(--color-brand-danger)]">
              {fetched.error}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Nothing has been changed. Close this and try again, or reject the
              proposal.
            </p>
          </div>
        )}

        {detail?.kind === "milestone_delete" && (
          <DeleteImpactNotice impact={detail.impact} />
        )}
        {detail?.kind === "deliverable_delete" && (
          <DeleteImpactNotice impact={detail.impact} />
        )}
        {detail?.kind === "kpi" && detail.impact.orphansSync && (
          <GhlSyncOrphanNotice
            kpiName={detail.impact.kpiName}
            removing={detail.impact.removing}
            renamingTo={detail.impact.renamingTo}
            currentValue={detail.impact.currentValue}
          />
        )}
        {detail?.kind === "kpi" && !detail.impact.orphansSync && (
          <div className="rounded-lg border border-[color:var(--color-brand-warning)]/35 bg-[color:var(--color-brand-warning)]/8 p-3">
            <p className="text-xs font-semibold text-[color:var(--color-brand-warning)]">
              {detail.impact.removing
                ? `Removing “${detail.impact.kpiName}” also removes its recorded history`
                : `“${detail.impact.kpiName}” keeps its name, so the sync keeps finding it`}
            </p>
            {detail.impact.removing && (
              <p className="mt-1 text-[11px] leading-relaxed text-foreground/90">
                {detail.impact.historyPoints} recorded history point
                {detail.impact.historyPoints === 1 ? "" : "s"} go with the row,
                so the trend chart for this metric cannot be rebuilt.
                {detail.impact.ghlSynced
                  ? " Nothing external writes to it by name, so no sync breaks."
                  : " This KPI is entered by hand, so nothing external depends on it."}
              </p>
            )}
          </div>
        )}
        {detail?.kind === "none" && (
          <p className="text-xs text-muted-foreground">
            Nothing recorded is destroyed by this change.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={report?.requiresAcknowledgement ? "destructive" : "default"}
          disabled={busy || report === null}
          onClick={() => {
            if (report) onConfirm(acknowledgementFor(report));
          }}
        >
          {busy
            ? "Applying…"
            : report?.requiresAcknowledgement
              ? "Apply anyway"
              : "Apply"}
        </Button>
      </DialogFooter>
    </>
  );
}
