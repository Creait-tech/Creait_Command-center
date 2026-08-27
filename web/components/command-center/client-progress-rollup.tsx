/**
 * Client progress roll-up — the "where does every client stand?" panel.
 *
 * Detail lives on /journey; this is the glance. It answers three questions in
 * one screen: how far along is each client, which ones have gone quiet, and
 * what has actually moved lately. Every row links through to the deliverable
 * checklist rather than trying to reproduce it.
 *
 * Rendered on the server — the data arrives with the page, and the relative
 * timestamps are computed once rather than drifting between server and client
 * markup. The proposals inbox next door subscribes to realtime and refreshes
 * the route, which re-renders this panel with it.
 */

import Link from "next/link";
import { ArrowRight, Bot, Clock, Route, TriangleAlert, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeatureEmptyState } from "@/components/empty-states/feature-empty-state";
import { cn } from "@/lib/utils";
import { ACTIVITY_VERB, relativeTime } from "@/components/proposals/proposal-copy";
import {
  PROPOSALS_INBOX_ANCHOR,
  STALE_AFTER_DAYS,
  type ActivityRow,
  type ClientRollupRow,
} from "@/components/command-center/client-progress-types";

interface ClientProgressRollupProps {
  clients: ClientRollupRow[];
  activity: ActivityRow[];
  pendingProposals: number;
  errors?: string[];
}

export function ClientProgressRollup({
  clients,
  activity,
  pendingProposals,
  errors = [],
}: ClientProgressRollupProps) {
  const staleCount = clients.filter((c) => c.stale).length;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-[color:var(--color-brand-electric)]" />
          Client progress
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Journey completion across every live client. Tick individual
          deliverables on{" "}
          <Link href="/journey" className="underline underline-offset-2">
            Client Journey
          </Link>
          .
        </p>
        <CardAction className="flex flex-col items-end gap-1.5">
          <Link
            href={`#${PROPOSALS_INBOX_ANCHOR}`}
            className="group flex items-center gap-1.5 rounded-lg border border-[color:var(--color-brand-fog)] px-2 py-1 text-xs transition-colors hover:border-[color:var(--color-brand-aqua)]"
          >
            <Bot className="size-3.5 text-[color:var(--color-brand-aqua)]" />
            <span
              className={cn(
                "font-semibold tabular-nums",
                pendingProposals > 0
                  ? "text-[color:var(--color-brand-aqua)]"
                  : "text-muted-foreground",
              )}
            >
              {pendingProposals}
            </span>
            <span className="text-muted-foreground">
              Hermes {pendingProposals === 1 ? "proposal" : "proposals"}
            </span>
            <ArrowRight className="size-3 text-muted-foreground transition-colors group-hover:text-[color:var(--color-brand-aqua)]" />
          </Link>
          {staleCount > 0 && (
            <span className="text-[10px] text-[color:var(--color-brand-warning)]">
              {staleCount} quiet {staleCount === 1 ? "client" : "clients"}
            </span>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        {errors.length > 0 && (
          <div className="rounded-lg border border-[color:var(--color-brand-danger)]/40 bg-[color:var(--color-brand-danger)]/10 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-[color:var(--color-brand-danger)]">
              <TriangleAlert className="size-3.5" />
              These numbers may be incomplete
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-[color:var(--color-brand-mist)]">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Where each client stands
            </h4>
            {clients.length === 0 ? (
              <FeatureEmptyState
                compact
                icon={<Route className="size-5" />}
                title="No live clients to track"
                description="Every active client gets a row here showing how far through the seven-milestone journey they are and how long since anyone touched their account."
                useWhen={[
                  "You've just signed a client and want their onboarding tracked",
                  "You're checking in Level 10 which accounts have gone quiet",
                ]}
                footnote={
                  <>
                    Clients are added on{" "}
                    <Link href="/clients" className="underline underline-offset-2">
                      Clients
                    </Link>
                    ; the milestone template lives on{" "}
                    <Link href="/journey" className="underline underline-offset-2">
                      Client Journey
                    </Link>
                    .
                  </>
                }
              />
            ) : (
              <ul className="space-y-2.5">
                {clients.map((client) => (
                  <ClientRow key={client.id} client={client} />
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              What moved recently
            </h4>
            {activity.length === 0 ? (
              <FeatureEmptyState
                compact
                icon={<Clock className="size-5" />}
                title="No activity logged yet"
                description="Every tick, note, status change and accepted Hermes proposal lands here with who did it and when — so the team can see movement without asking."
                useWhen={[
                  "You want to know what happened on client accounts since yesterday",
                  "You're checking whether Hermes or a teammate made a change",
                ]}
                footnote="Entries appear the first time anyone ticks a deliverable on Client Journey."
              />
            ) : (
              <ul className="space-y-2.5">
                {activity.map((row) => (
                  <ActivityItem key={row.entry.id} row={row} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

function ClientRow({ client }: { client: ClientRollupRow }) {
  const quiet = client.stale;

  return (
    <li className="rounded-lg border border-[color:var(--color-brand-fog)]/70 bg-[color:var(--color-brand-charcoal)]/30 p-2.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href="/journey?view=client"
            className="text-sm font-medium hover:text-[color:var(--color-brand-electric)]"
          >
            {client.name}
          </Link>
          {client.company && client.company !== client.name && (
            <span className="ml-1.5 text-[11px] text-muted-foreground">
              {client.company}
            </span>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {client.currentMilestone}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">{client.percent}%</p>
          <p className="text-[10px] tabular-nums text-muted-foreground">
            {client.done}/{client.total}
          </p>
        </div>
      </div>

      <div
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[color:var(--color-brand-fog)]"
        role="progressbar"
        aria-valuenow={client.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${client.name} journey completion`}
      >
        <div
          className={cn(
            "h-full rounded-full",
            client.percent >= 100
              ? "bg-[color:var(--color-brand-success)]"
              : "bg-[color:var(--color-brand-electric)]",
          )}
          style={{ width: `${Math.min(100, Math.max(0, client.percent))}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "border-transparent text-[10px]",
            quiet
              ? "bg-[color:var(--color-brand-warning)]/15 text-[color:var(--color-brand-warning)]"
              : "bg-[color:var(--color-brand-fog)]/60 text-[color:var(--color-brand-mist)]",
          )}
        >
          {quiet && <TriangleAlert className="size-2.5" />}
          {client.staleDays === null
            ? "No activity yet"
            : `${quiet ? "Quiet " : ""}${client.staleDays}d`}
        </Badge>
        {quiet && (
          <span className="text-[10px] text-muted-foreground">
            {client.staleDays === null
              ? "nothing has ever been logged"
              : `nothing in ${STALE_AFTER_DAYS}+ days`}
          </span>
        )}
      </div>
    </li>
  );
}

function ActivityItem({ row }: { row: ActivityRow }) {
  const { entry } = row;
  const isAgent = entry.actor_type === "agent";

  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
          isAgent
            ? "bg-[color:var(--color-brand-aqua)]/15 text-[color:var(--color-brand-aqua)]"
            : "bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)]",
        )}
      >
        {isAgent ? <Bot className="size-3" /> : initials(entry.actor_name)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-xs leading-snug">
          <span
            className={cn(
              "font-medium",
              isAgent && "text-[color:var(--color-brand-aqua)]",
            )}
          >
            {entry.actor_name}
          </span>{" "}
          <span className="text-[color:var(--color-brand-mist)]">
            {ACTIVITY_VERB[entry.kind]}
          </span>
          {row.deliverableTitle && (
            <>
              {" "}
              <span className="text-[color:var(--color-brand-mist)]">
                {row.deliverableTitle}
              </span>
            </>
          )}
        </p>
        {entry.body && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
            {entry.body}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground">
          {row.clientName} · {relativeTime(entry.created_at)}
        </p>
      </div>
    </li>
  );
}

/** "Maurice Grant" → "MG". Falls back to the first character. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
