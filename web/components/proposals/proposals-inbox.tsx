"use client";

/**
 * Hermes proposals inbox — where a human confirms or refuses what the agent
 * suggests.
 *
 * It now takes four families of proposal, not one: a client's delivery
 * progress, a client's record, the journey template every client is measured
 * against, and the scoreboard. They share this inbox because they share one
 * lifecycle — pending, claimed, applied, audited — and splitting them would
 * mean two places to look and two ways to get the claim wrong.
 *
 * Design rules this panel is built around:
 *  - Every proposal shows **why**. A suggestion without a rationale is an
 *    instruction, and this team decided Hermes proposes rather than instructs.
 *  - No uuids. Ids are resolved to titles server-side — client, deliverable,
 *    milestone and KPI alike; when the row a proposal points at has been
 *    deleted, the card says so in words.
 *  - Accept never claims success it can't prove. The action returns only after
 *    the write came back with a row; anything else surfaces as an error and
 *    the proposal stays in the list.
 *  - Anything that destroys recorded history or breaks the GHL sync goes
 *    through a confirmation that re-reads the damage first.
 *
 * `skills` and `agents` are not in the allow-list this inbox can apply — the
 * owner's rule is that agents never propose changes to their own instructions
 * or schedules, and the database enforces it. There is deliberately no code
 * path here that would accept one.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Inbox, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FeatureEmptyState } from "@/components/empty-states/feature-empty-state";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/components/proposals/proposal-copy";
import {
  isDestructiveAction,
  needsDestructiveConfirm,
} from "@/components/proposals/proposal-payload";
import { ProposalCard } from "@/components/proposals/proposal-card";
import { ProposalConfirmDialog } from "@/components/proposals/proposal-confirm-dialog";
import type { ProposalAcknowledgement } from "@/components/proposals/proposal-impact-types";
import {
  PROPOSALS_INBOX_ANCHOR,
  type ProposalRow,
} from "@/components/command-center/client-progress-types";
import { decideProposal } from "@/app/(dashboard)/command-center/proposal-actions";

interface ProposalsInboxProps {
  pending: ProposalRow[];
  recentlyDecided: ProposalRow[];
  /** Read errors from the server loader, shown instead of a false "all clear". */
  errors?: string[];
}

/** "for Rad Media" / "to the journey template" — a scope a human recognises. */
function scopeSuffix(row: ProposalRow): string {
  if (row.clientName) return `for ${row.clientName}`;
  return "to the workspace configuration";
}

export function ProposalsInbox({
  pending,
  recentlyDecided,
  errors = [],
}: ProposalsInboxProps) {
  const router = useRouter();
  const orgId = useActiveOrgId();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ProposalRow | null>(null);
  const [confirming, setConfirming] = useState<ProposalRow | null>(null);
  const [reason, setReason] = useState("");
  const [, startTransition] = useTransition();

  // Proposals arrive from Hermes without anyone reloading, and two teammates
  // may be looking at this list at once. Re-render from the server rather than
  // patching local state so the resolved titles stay authoritative.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("hermes-proposals-inbox")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cc_agent_proposals",
          filter: `org_id=eq.${orgId}`,
        },
        () => startTransition(() => router.refresh()),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, router]);

  async function decide(
    row: ProposalRow,
    decision: "accepted" | "rejected",
    options: { reason?: string; acknowledged?: ProposalAcknowledgement } = {},
  ) {
    setBusyId(row.proposal.id);
    try {
      const result = await decideProposal({
        proposalId: row.proposal.id,
        decision,
        reason: options.reason ?? null,
        acknowledged: options.acknowledged ?? null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success(
          decision === "accepted"
            ? `Applied — ${result.detail ?? result.summary}`
            : `Rejected — ${row.summary}`,
        );
      }
      setRejecting(null);
      setConfirming(null);
      setReason("");
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Nothing was saved: ${error.message}`
          : "Nothing was saved — the request failed",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card id={PROPOSALS_INBOX_ANCHOR} className="scroll-mt-20">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-4 text-[color:var(--color-brand-aqua)]" />
          Hermes proposals
          {pending.length > 0 && (
            <Badge className="bg-[color:var(--color-brand-aqua)]/15 text-[color:var(--color-brand-aqua)]">
              {pending.length} pending
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Hermes proposes, a human confirms. Accepting applies the change
          exactly as if you had made it yourself — on a client&rsquo;s journey,
          on their record, on the journey template, or on the scoreboard.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {errors.length > 0 && (
          <div className="rounded-lg border border-[color:var(--color-brand-danger)]/40 bg-[color:var(--color-brand-danger)]/10 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-[color:var(--color-brand-danger)]">
              <TriangleAlert className="size-3.5" />
              This list may be incomplete
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-[color:var(--color-brand-mist)]">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        {pending.length === 0 ? (
          <FeatureEmptyState
            compact
            icon={<Inbox className="size-5" />}
            title="Nothing waiting on you"
            description="Hermes hasn't proposed anything yet. When it spots evidence that a deliverable has shipped, that a client's record is out of date, or that the journey template or scoreboard no longer matches how the team actually works, it files a proposal here instead of changing anything itself."
            useWhen={[
              "Hermes reports a deliverable as done and you want to check its reasoning before it counts",
              "Hermes wants to add, rename, reorder or remove part of the journey template every client is measured against",
              "Hermes wants to change what the scoreboard measures — where a rename can quietly stop a number updating",
              "A client's progress looks wrong and you want to see what was accepted, by whom",
            ]}
            footnote="Nothing Hermes proposes changes a record until someone here accepts it. Agents can never propose changes to their own instructions or schedules — the database refuses them."
          />
        ) : (
          <ul className="space-y-3">
            {pending.map((row) => (
              <ProposalCard
                key={row.proposal.id}
                row={row}
                busy={busyId === row.proposal.id}
                disabled={busyId !== null && busyId !== row.proposal.id}
                onAccept={() => {
                  // Anything that can destroy history or break the GHL sync
                  // never applies straight from the card. The confirmation
                  // re-reads what it would cost before it can be accepted.
                  if (needsDestructiveConfirm(row.proposal)) {
                    setConfirming(row);
                    return;
                  }
                  void decide(row, "accepted");
                }}
                onReject={() => {
                  setReason("");
                  setRejecting(row);
                }}
              />
            ))}
          </ul>
        )}

        {recentlyDecided.length > 0 && (
          <div className="pt-1">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recently decided
            </p>
            <ul className="space-y-1">
              {recentlyDecided.map((row) => (
                <li
                  key={row.proposal.id}
                  className="flex items-start gap-2 text-[11px] text-muted-foreground"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1 size-1.5 shrink-0 rounded-full",
                      row.proposal.status === "accepted"
                        ? "bg-[color:var(--color-brand-success)]"
                        : "bg-[color:var(--color-brand-mist)]",
                    )}
                  />
                  <span className="min-w-0" suppressHydrationWarning>
                    <span className="text-[color:var(--color-brand-mist)]">
                      {row.proposal.decided_by_name ?? "Someone"}
                    </span>{" "}
                    {row.proposal.status === "accepted" ? "accepted" : "rejected"}{" "}
                    &ldquo;{row.summary}&rdquo; {scopeSuffix(row)} ·{" "}
                    {relativeTime(row.proposal.decided_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <ProposalConfirmDialog
        proposalId={confirming?.proposal.id ?? null}
        summary={confirming?.summary ?? ""}
        destructive={confirming ? isDestructiveAction(confirming.proposal) : false}
        busy={busyId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        onConfirm={(acknowledged) => {
          if (confirming) void decide(confirming, "accepted", { acknowledged });
        }}
      />

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejecting(null);
            setReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this proposal?</DialogTitle>
            <DialogDescription>
              {rejecting
                ? `${rejecting.summary} — ${scopeSuffix(rejecting)}. Nothing changes.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label
              htmlFor="reject-reason"
              className="text-xs font-medium text-[color:var(--color-brand-mist)]"
            >
              Why? (optional — saved{" "}
              {rejecting?.clientName
                ? "to the client’s activity feed"
                : "on the proposal itself"}
              )
            </label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. the client hasn't signed off on this yet"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejecting(null);
                setReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busyId !== null}
              onClick={() => {
                if (rejecting) {
                  void decide(rejecting, "rejected", { reason: reason.trim() });
                }
              }}
            >
              {busyId ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
