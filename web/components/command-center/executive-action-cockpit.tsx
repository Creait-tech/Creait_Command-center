import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CircleAlert,
  ClipboardCheck,
  UsersRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  IdsItem,
  Kpi,
  TeamMember,
  Todo,
} from "@/lib/supabase/types";
import type { ClientRollupRow } from "./client-progress-types";

interface ExecutiveActionCockpitProps {
  todos: Todo[];
  issues: IdsItem[];
  clients: ClientRollupRow[];
  kpis: Kpi[];
  members: Pick<TeamMember, "id" | "full_name" | "display_name">[];
}

type QueueItem = {
  id: string;
  title: string;
  context: string;
  owner: string;
  href: string;
  urgency: "overdue" | "decision" | "recovery";
};

function ownerName(
  ownerId: string | null,
  members: ExecutiveActionCockpitProps["members"],
): string {
  if (!ownerId) return "Needs owner";
  const member = members.find((candidate) => candidate.id === ownerId);
  return member?.display_name || member?.full_name || "Assigned";
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTimestamp(value: string | null): string {
  if (!value) return "Not synced";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ExecutiveActionCockpit({
  todos,
  issues,
  clients,
  kpis,
  members,
}: ExecutiveActionCockpitProps) {
  const today = new Date().toISOString().slice(0, 10);
  const overdueTodos = todos
    .filter((todo) => todo.due_date && todo.due_date < today)
    .slice(0, 3);
  const highPriorityIssues = issues
    .filter((issue) => issue.priority >= 8 && issue.status !== "solved")
    .slice(0, 3);
  const recoveryClients = clients
    .filter((client) => client.stale || client.health === "red" || client.health === "yellow")
    .slice(0, 4);

  const queue: QueueItem[] = [
    ...overdueTodos.map((todo) => ({
      id: `todo-${todo.id}`,
      title: todo.title,
      context: `Overdue since ${todo.due_date}`,
      owner: ownerName(todo.owner_id, members),
      href: "/todos",
      urgency: "overdue" as const,
    })),
    ...highPriorityIssues.map((issue) => ({
      id: `issue-${issue.id}`,
      title: issue.title,
      context: `Priority ${issue.priority}${issue.description ? " · needs resolution" : " · needs context"}`,
      owner: ownerName(issue.owner_id, members),
      href: "/level-10?tab=ids",
      urgency: "decision" as const,
    })),
    ...recoveryClients.map((client) => ({
      id: `client-${client.id}`,
      title: `Recover ${client.name}`,
      context:
        client.staleDays === null
          ? "No activity has been recorded"
          : `${client.staleDays} days since meaningful activity`,
      owner: "Review next best action",
      href: "/journey",
      urgency: "recovery" as const,
    })),
  ].slice(0, 7);

  const activeClients = clients.filter(
    (client) => client.status === "active" || client.status === "onboarding",
  );
  const activeMrr = activeClients.reduce((sum, client) => sum + (client.mrr ?? 0), 0);
  const atRiskMrr = activeClients
    .filter((client) => client.health === "yellow" || client.health === "red")
    .reduce((sum, client) => sum + (client.mrr ?? 0), 0);
  const revenueKpis = kpis.filter((kpi) => /mrr|revenue|pipeline|sales/i.test(kpi.name)).slice(0, 3);
  const latestSync = kpis.reduce<string | null>((latest, kpi) => {
    if (!kpi.last_synced_at) return latest;
    return !latest || kpi.last_synced_at > latest ? kpi.last_synced_at : latest;
  }, null);

  return (
    <section aria-labelledby="executive-queue-heading" className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--color-brand-electric)]">
            Executive action cockpit
          </p>
          <h2 id="executive-queue-heading" className="text-xl font-bold mt-1">
            What needs a decision today
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            The highest-signal actions across delivery, client health, and revenue—each linked to its source workflow.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <ClipboardCheck className="size-3.5" />
          {queue.length} actions surfaced
        </Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleAlert className="size-4 text-[color:var(--color-brand-warning)]" />
              Today&apos;s executive queue
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {queue.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">All clear—there are no overdue, high-priority, or recovery actions to escalate.</p>
            ) : (
              <ul className="divide-y">
                {queue.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="group flex gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors">
                      <span className={item.urgency === "overdue" ? "mt-1 size-2 rounded-full bg-[color:var(--color-brand-danger)] shrink-0" : item.urgency === "decision" ? "mt-1 size-2 rounded-full bg-[color:var(--color-brand-warning)] shrink-0" : "mt-1 size-2 rounded-full bg-[color:var(--color-brand-electric)] shrink-0"} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug">{item.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{item.context}</span>
                        <span className="mt-1 block text-xs font-medium text-[color:var(--color-brand-mist)]">{item.owner}</span>
                      </span>
                      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-[color:var(--color-brand-electric)]" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UsersRound className="size-4 text-[color:var(--color-brand-electric)]" />
                Client recovery queue
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {recoveryClients.length === 0 ? (
                <p className="text-sm text-muted-foreground">Every active client has recent activity and a healthy delivery signal.</p>
              ) : (
                recoveryClients.map((client) => (
                  <Link key={client.id} href="/journey" className="flex items-center justify-between gap-3 rounded-md p-2 -mx-2 hover:bg-muted/40 transition-colors">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{client.name}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {client.currentMilestone} · {client.staleDays === null ? "no activity yet" : `${client.staleDays}d quiet`}
                      </span>
                    </span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">Open journey</Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BadgeDollarSign className="size-4 text-[color:var(--color-brand-success)]" />
                Revenue control tower
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active client MRR</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(activeMrr)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">At-risk MRR</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-[color:var(--color-brand-warning)]">{formatMoney(atRiskMrr)}</p>
                </div>
              </div>
              {revenueKpis.length > 0 ? (
                <ul className="space-y-1.5">
                  {revenueKpis.map((kpi) => (
                    <li key={kpi.id} className="flex justify-between gap-3 text-xs">
                      <span className="truncate text-muted-foreground">{kpi.name}</span>
                      <span className="font-medium tabular-nums">{kpi.value}{kpi.unit ? ` ${kpi.unit}` : ""}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Add revenue or pipeline KPIs in the Level 10 Scorecard to expand this panel.</p>
              )}
              <Link href="/level-10?tab=scorecard" className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-brand-electric)] hover:underline">
                View scorecard <ArrowRight className="size-3" />
              </Link>
              <p className="text-[10px] text-muted-foreground">MRR from active client records · KPI sync {formatTimestamp(latestSync)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {highPriorityIssues.some((issue) => !issue.owner_id) && (
        <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-brand-warning)]/40 bg-[color:var(--color-brand-warning)]/10 px-3 py-2 text-xs text-[color:var(--color-brand-warning)]">
          <AlertTriangle className="size-3.5 shrink-0" />
          {highPriorityIssues.filter((issue) => !issue.owner_id).length} high-priority issue{highPriorityIssues.filter((issue) => !issue.owner_id).length === 1 ? "" : "s"} still need an accountable owner.
          <Link href="/level-10?tab=ids" className="ml-auto whitespace-nowrap font-medium hover:underline">Assign owners</Link>
        </div>
      )}
    </section>
  );
}
