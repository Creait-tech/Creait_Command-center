"use client";

import { useState, useEffect, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { buildSkillNameMap } from "./skill-utils";
import type { Skill, RunHistory, RunTrigger, RunStatus } from "@/lib/supabase/types";

const PAGE = 25;

const TRIGGERS: { value: "all" | RunTrigger; label: string }[] = [
  { value: "all", label: "All triggers" },
  { value: "manual", label: "Manual" },
  { value: "cron", label: "Cron" },
  { value: "webhook", label: "Webhook" },
  { value: "agent", label: "Agent" },
  { value: "chat", label: "Chat" },
];

const STATUSES: { value: "all" | RunStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "succeeded", label: "Succeeded" },
  { value: "running", label: "Running" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const DATES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

const STATUS_BADGE: Record<RunStatus, string> = {
  succeeded: "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]",
  running: "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)] animate-pulse",
  failed: "bg-[color:var(--color-brand-danger)]/20 text-[color:var(--color-brand-danger)]",
  cancelled: "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]",
};

function fmtDuration(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function fmtCost(usd: number | null): string {
  if (usd === null) return "—";
  return `$${usd.toFixed(4)}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cutoffDate(days: string): Date | null {
  if (days === "all") return null;
  return new Date(Date.now() - parseInt(days, 10) * 86_400_000);
}

interface Props {
  initialRuns: RunHistory[];
  skills: Skill[];
  orgId: string;
}

export function RunHistoryTable({ initialRuns, skills, orgId }: Props) {
  const [runs, setRuns] = useState<RunHistory[]>(initialRuns);
  const [trigger, setTrigger] = useState<"all" | RunTrigger>("all");
  const [status, setStatus] = useState<"all" | RunStatus>("all");
  const [dateRange, setDateRange] = useState("7");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const skillNameMap = useMemo(() => buildSkillNameMap(skills), [skills]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("run-history-inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "run_history", filter: `org_id=eq.${orgId}` },
        (payload) => setRuns((prev) => [payload.new as RunHistory, ...prev]),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId]);

  const filtered = useMemo(() => {
    const cutoff = cutoffDate(dateRange);
    return runs.filter((r) => {
      if (trigger !== "all" && r.trigger !== trigger) return false;
      if (status !== "all" && r.status !== status) return false;
      if (cutoff && new Date(r.created_at) < cutoff) return false;
      return true;
    });
  }, [runs, trigger, status, dateRange]);

  const paginated = filtered.slice(0, (page + 1) * PAGE);
  const hasMore = filtered.length > paginated.length;

  const cost7d = runs
    .filter((r) => r.cost_usd !== null && new Date(r.created_at) > new Date(Date.now() - 7 * 86_400_000))
    .reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const cost30d = runs
    .filter((r) => r.cost_usd !== null && new Date(r.created_at) > new Date(Date.now() - 30 * 86_400_000))
    .reduce((s, r) => s + (r.cost_usd ?? 0), 0);

  function toggle(id: string) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        <span>
          Last 7d: <span className="font-medium text-foreground">${cost7d.toFixed(4)}</span>
        </span>
        <span>
          Last 30d: <span className="font-medium text-foreground">${cost30d.toFixed(4)}</span>
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={trigger} onValueChange={(v) => typeof v === "string" && (setTrigger(v as "all" | RunTrigger), setPage(0))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGERS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => typeof v === "string" && (setStatus(v as "all" | RunStatus), setPage(0))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={(v) => typeof v === "string" && (setDateRange(v), setPage(0))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} runs</span>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No runs match the filters.</Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Time</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Skill</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Trigger</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Model</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Duration</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Cost</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => {
                  const isOpen = expanded[r.id] ?? false;
                  const out = runOutputText(r.output);
                  return (
                    <Row key={r.id}>
                      <tr className="border-b border-border cursor-pointer hover:bg-muted/30" onClick={() => toggle(r.id)}>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtTime(r.created_at)}</td>
                        <td className="px-3 py-2 text-xs max-w-[180px] truncate">{r.skill_id ? skillNameMap[r.skill_id] ?? "Unknown" : "—"}</td>
                        <td className="px-3 py-2"><span className="text-xs px-1.5 py-0.5 rounded border border-border text-muted-foreground">{r.trigger}</span></td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{r.model ?? "—"}</td>
                        <td className="px-3 py-2"><span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", STATUS_BADGE[r.status])}>{r.status}</span></td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDuration(r.duration_ms)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtCost(r.cost_usd)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/20 border-b border-border">
                          <td colSpan={8} className="px-4 py-3 space-y-3">
                            {r.error && (
                              <div>
                                <p className="text-xs font-medium text-[color:var(--color-brand-danger)] mb-1">Error</p>
                                <pre className="text-xs bg-[color:var(--color-brand-danger)]/10 rounded p-2 text-[color:var(--color-brand-danger)] whitespace-pre-wrap">{r.error}</pre>
                              </div>
                            )}
                            {out && !r.error && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Output</p>
                                <ScrollArea className="max-h-64 rounded border border-border bg-muted/30 p-3">
                                  <div className="prose prose-sm prose-invert max-w-none text-xs">
                                    <Markdown remarkPlugins={[remarkGfm]}>{out}</Markdown>
                                  </div>
                                </ScrollArea>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Row>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="border-t border-border p-3 flex justify-center">
              <Button variant="ghost" size="sm" onClick={() => setPage((p) => p + 1)}>
                Load more ({filtered.length - paginated.length} remaining)
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/**
 * The skills engine writes `output` as `{ text, model, model_routing }`, so
 * stringifying the whole column buried the actual answer under routing
 * telemetry. Show the text a human is meant to read; fall back to the raw
 * JSON for rows written in any other shape.
 */
function runOutputText(output: RunHistory["output"]): string {
  if (typeof output === "string") return output;
  if (output && typeof output === "object" && !Array.isArray(output)) {
    const text = (output as Record<string, unknown>).text;
    if (typeof text === "string") return text;
  }
  if (output === null || output === undefined) return "";
  return JSON.stringify(output, null, 2);
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
