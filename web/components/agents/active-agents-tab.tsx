"use client";

import { useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  Play,
  ScrollText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Agent, AgentStatus, RunHistory } from "@/lib/supabase/types";

/**
 * Active Agents tab — shows the 4 long-running background agents seeded in
 * Phase 3 (YouTube Research, Recruiting Monitor, Client Health, Tech Watch
 * Crawler). Each card surfaces status, last/next run, a manual "Run Now"
 * trigger, an inline run-log panel, and a status toggle.
 *
 * Run Now POSTs to /api/agents/[id]/start which dispatches the matching
 * `cron/*` Inngest event under Clerk auth. The actual work happens inside
 * the Inngest function — this tab just gives Maurice a one-click trigger
 * and an at-a-glance view of when each agent last ran.
 */

const STATUS_STYLES: Record<AgentStatus, { dot: string; label: string }> = {
  active: {
    dot: "bg-[color:var(--color-brand-success)] animate-pulse",
    label: "text-[color:var(--color-brand-success)]",
  },
  inactive: {
    dot: "bg-[color:var(--color-brand-fog)]",
    label: "text-muted-foreground",
  },
  paused: {
    dot: "bg-[color:var(--color-brand-warning)]",
    label: "text-[color:var(--color-brand-warning)]",
  },
  error: {
    dot: "bg-[color:var(--color-brand-danger)]",
    label: "text-[color:var(--color-brand-danger)]",
  },
};

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) {
    return absoluteTime(iso);
  }
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function absoluteTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function describeCron(cron: string | null): string {
  if (!cron) return "Event-triggered";
  // Friendly hints for the seeded schedules
  const map: Record<string, string> = {
    "0 8 * * *": "Daily · 8:00 ET",
    "0 13 * * *": "Daily · 1:00 PM ET",
    "0 14 * * *": "Daily · 2:00 PM ET",
    "0 15 * * *": "Daily · 3:00 PM ET",
  };
  return map[cron] ?? cron;
}

interface Props {
  initialAgents: Agent[];
  initialRunHistory: RunHistory[];
  orgId: string;
}

export function ActiveAgentsTab({ initialAgents, initialRunHistory, orgId }: Props) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [runs, setRuns] = useState<RunHistory[]>(initialRunHistory);
  const [openLogs, setOpenLogs] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // Realtime: pick up bumpAgentRun updates + new run_history rows.
  useEffect(() => {
    const supabase = createClient();
    const agentsChannel = supabase
      .channel("active-agents-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agents",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const next = payload.new as Agent;
          setAgents((prev) => prev.map((a) => (a.id === next.id ? next : a)));
        },
      )
      .subscribe();
    const runsChannel = supabase
      .channel("active-agents-runs")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "run_history",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => setRuns((prev) => [payload.new as RunHistory, ...prev]),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(agentsChannel);
      void supabase.removeChannel(runsChannel);
    };
  }, [orgId]);

  if (agents.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          No background agents seeded yet.
        </CardContent>
      </Card>
    );
  }

  async function handleToggle(agent: Agent, next: boolean) {
    const nextStatus: AgentStatus = next ? "active" : "inactive";
    setAgents((prev) =>
      prev.map((a) => (a.id === agent.id ? { ...a, status: nextStatus } : a)),
    );
    const supabase = createClient();
    const { error } = await supabase
      .from("agents")
      .update({ status: nextStatus })
      .eq("id", agent.id);
    if (error) {
      toast.error(`Failed to update ${agent.name}`);
      // revert
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id ? { ...a, status: agent.status } : a,
        ),
      );
    }
  }

  async function handleRunNow(agent: Agent) {
    setBusy((prev) => ({ ...prev, [agent.id]: true }));
    try {
      const res = await fetch(`/api/agents/${agent.id}/start`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        event?: string;
      } | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error ?? `Run failed (${res.status})`);
      }
      toast.success(`${agent.name} dispatched (${body.event ?? "queued"})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed");
    } finally {
      setBusy((prev) => ({ ...prev, [agent.id]: false }));
    }
  }

  function toggleLogs(id: string) {
    setOpenLogs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        {agents.length} long-running background agent
        {agents.length === 1 ? "" : "s"}. Run Now dispatches an Inngest event;
        the agent does its work in the background and you&apos;ll see fresh
        rows under &ldquo;View Logs&rdquo; within ~30s.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {agents.map((agent) => {
          const statusStyle =
            STATUS_STYLES[agent.status] ?? STATUS_STYLES.inactive;
          const isOpen = openLogs[agent.id] ?? false;
          return (
            <Card key={agent.id}>
              <CardContent className="pt-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <Bot className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-snug">
                        {agent.name}
                      </p>
                      {agent.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                          {agent.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={cn("size-2 rounded-full", statusStyle.dot)}
                    />
                    <span
                      className={cn("text-xs font-medium", statusStyle.label)}
                    >
                      {agent.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {describeCron(agent.schedule_cron)}
                  </span>
                  <span className="flex items-center gap-1">
                    Last: {relativeTime(agent.last_run_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    Next: {relativeTime(agent.next_run_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    {absoluteTime(agent.last_run_at)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    onClick={() => handleRunNow(agent)}
                    disabled={busy[agent.id]}
                    className="flex-1"
                  >
                    <Play className="size-3" />
                    {busy[agent.id] ? "Dispatching…" : "Run Now"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleLogs(agent.id)}
                  >
                    {isOpen ? (
                      <ChevronDown className="size-3" />
                    ) : (
                      <ChevronRight className="size-3" />
                    )}
                    <ScrollText className="size-3" />
                    Logs
                  </Button>
                  <div className="ml-auto">
                    <Switch
                      checked={agent.status === "active"}
                      onCheckedChange={(c) => handleToggle(agent, c === true)}
                    />
                  </div>
                </div>

                {isOpen && (
                  <AgentLogsPanel agent={agent} runs={runs} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Inline logs panel — shows the last 10 run_history rows we believe belong to
 * this agent. Phase 3 doesn't yet stamp `agent_id` onto run_history rows, so
 * we match by the closest available signal:
 *   - explicit `agent_id` match (future-proof), OR
 *   - trigger='agent' with model=null run rows (recruiting-monitor today), OR
 *   - run rows whose input.agent JSON field matches the agent slug.
 *
 * If nothing matches, show a friendly placeholder.
 */
function AgentLogsPanel({
  agent,
  runs,
}: {
  agent: Agent;
  runs: RunHistory[];
}) {
  const matches = useMemo(() => {
    const slug = agent.name
      .toLowerCase()
      .replace(/agent/g, "")
      .replace(/\s+/g, "-")
      .replace(/(^-|-$)/g, "");
    return runs
      .filter((r) => {
        if (r.agent_id && r.agent_id === agent.id) return true;
        const input =
          r.input && typeof r.input === "object" && !Array.isArray(r.input)
            ? (r.input as Record<string, unknown>)
            : null;
        const inputAgent =
          input && typeof input.agent === "string"
            ? (input.agent as string)
            : null;
        if (inputAgent && slug.includes(inputAgent.replace(/-/g, ""))) {
          return true;
        }
        return false;
      })
      .slice(0, 10);
  }, [agent, runs]);

  if (matches.length === 0) {
    return (
      <div className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">
        No run history yet for this agent. Click <strong>Run Now</strong> to
        kick off a manual dispatch — new rows appear here within ~30s once the
        Inngest function completes.
      </div>
    );
  }

  return (
    <ScrollArea className="max-h-72 rounded border border-border bg-muted/20">
      <div className="divide-y divide-border">
        {matches.map((run) => {
          const out =
            run.output && typeof run.output === "object"
              ? ((run.output as Record<string, unknown>).text as
                  | string
                  | undefined) ?? JSON.stringify(run.output)
              : typeof run.output === "string"
                ? run.output
                : "";
          return (
            <div key={run.id} className="p-3 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{absoluteTime(run.created_at)}</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                    run.status === "succeeded" &&
                      "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]",
                    run.status === "failed" &&
                      "bg-[color:var(--color-brand-danger)]/20 text-[color:var(--color-brand-danger)]",
                    run.status === "running" &&
                      "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)]",
                  )}
                >
                  {run.status}
                </span>
                {run.duration_ms !== null && (
                  <span>
                    {run.duration_ms < 1000
                      ? `${run.duration_ms}ms`
                      : `${(run.duration_ms / 1000).toFixed(1)}s`}
                  </span>
                )}
              </div>
              {run.error ? (
                <pre className="text-xs text-[color:var(--color-brand-danger)] whitespace-pre-wrap">
                  {run.error}
                </pre>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none text-xs line-clamp-4">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {out.slice(0, 800)}
                  </Markdown>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
