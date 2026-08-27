"use client";

/**
 * Hermes proposals inbox — where a human confirms or refuses what the agent
 * suggests.
 *
 * Design rules this panel is built around:
 *  - Every proposal shows **why**. A suggestion without a rationale is an
 *    instruction, and this team decided Hermes proposes rather than instructs.
 *  - No uuids. Ids are resolved to titles server-side; when a deliverable has
 *    been deleted from the template the card says so in words.
 *  - Accept never claims success it can't prove. The action returns only after
 *    the write came back with a row; anything else surfaces as an error and
 *    the proposal stays in the list.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Check, Inbox, TriangleAlert, X } from "lucide-react";

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
import {
  PROPOSAL_ACTION_LABEL,
  UNKNOWN_DELIVERABLE,
  relativeTime,
} from "@/components/proposals/proposal-copy";
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

export function ProposalsInbox({
  pending,
  recentlyDecided,
  errors = [],
}: ProposalsInboxProps) {
  const router = useRouter();
  const orgId = useActiveOrgId();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ProposalRow | null>(null);
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
    why?: string,
  ) {
    setBusyId(row.proposal.id);
    try {
      const result = await decideProposal({
        proposalId: row.proposal.id,
        decision,
        reason: why ?? null,
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
            ? `Applied — ${result.summary}`
            : `Rejected — ${row.clientName}`,
        );
      }
      setRejecting(null);
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
          Hermes proposes, a human confirms. Accepting applies the change to the
          client&rsquo;s journey exactly as if you had ticked it yourself.
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
            description="Hermes hasn't proposed any client-journey changes yet. When it spots evidence that a deliverable has actually shipped — a transcript, an email, a GHL event — it files a proposal here instead of changing anything itself."
            useWhen={[
              "Hermes reports a deliverable as done and you want to check its reasoning before it counts",
              "You're reviewing what the agent has been doing on client accounts this week",
              "A client's progress looks wrong and you want to see what was accepted, by whom",
            ]}
            footnote="Nothing Hermes proposes changes a client record until someone here accepts it."
          />
        ) : (
          <ul className="space-y-3">
            {pending.map((row) => (
              <ProposalCard
                key={row.proposal.id}
                row={row}
                busy={busyId === row.proposal.id}
                disabled={busyId !== null && busyId !== row.proposal.id}
                onAccept={() => void decide(row, "accepted")}
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
                    &ldquo;{row.summary}&rdquo; for {row.clientName} ·{" "}
                    {relativeTime(row.proposal.decided_at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

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
                ? `${rejecting.summary} — for ${rejecting.clientName}. Nothing on the client's journey changes.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label
              htmlFor="reject-reason"
              className="text-xs font-medium text-[color:var(--color-brand-mist)]"
            >
              Why? (optional — saved to the client&rsquo;s activity feed)
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
                if (rejecting) void decide(rejecting, "rejected", reason.trim());
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

function ProposalCard({
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
  const missingDeliverable =
    proposal.deliverable_id !== null && row.deliverableTitle === null;

  return (
    <li className="rounded-lg border border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-charcoal)]/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)]">
          {PROPOSAL_ACTION_LABEL[proposal.action]}
        </Badge>
        <span className="text-sm font-semibold">{row.clientName}</span>
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
        {row.deliverableTitle ? (
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

      <div className="mt-2.5 space-y-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Why Hermes thinks so
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--color-brand-mist)]">
            {proposal.rationale?.trim() || (
              <span className="italic text-muted-foreground">
                Hermes filed no rationale — treat this as unverified and check
                the client record before accepting.
              </span>
            )}
          </p>
        </div>

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
        <Button size="sm" disabled={busy || disabled} onClick={onAccept}>
          <Check />
          {busy ? "Applying…" : "Accept"}
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
