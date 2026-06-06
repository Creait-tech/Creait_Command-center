"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { SkillsGrid } from "./skills-grid";
import { RunHistoryTable } from "./run-history-table";
import { ActiveAgentsTab } from "./active-agents-tab";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type { Agent, Skill, RunHistory } from "@/lib/supabase/types";
import type { SkillRunStats } from "./skill-utils";

const VALID = ["skills", "agents", "scheduled", "history"] as const;
type Valid = (typeof VALID)[number];

const SCHEDULED_PHASE_NOTE =
  "Ships next — the Inngest scheduled-task dashboard showing every cron-triggered run, upcoming dispatches, and a one-click backfill UI.";

interface Props {
  initialSkills: Skill[];
  /**
   * Phase 3 added long-running background agents. The page server-component
   * may not pass these yet — we fetch them client-side on mount as a
   * fallback so this prop stays optional and the page need not change.
   */
  initialAgents?: Agent[];
  initialRunHistory: RunHistory[];
  initialRunStatsMap: Record<string, SkillRunStats>;
}

function AgentsTabsInner({
  initialSkills,
  initialAgents,
  initialRunHistory,
  initialRunStatsMap,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const active: Valid = (VALID as readonly string[]).includes(raw ?? "") ? (raw as Valid) : "skills";

  // Client-side agents fallback: if the server didn't pass them, hydrate
  // ourselves once. Avoids touching app/(dashboard)/agents/page.tsx.
  const [agents, setAgents] = useState<Agent[]>(initialAgents ?? []);
  useEffect(() => {
    if (initialAgents && initialAgents.length > 0) return;
    let cancelled = false;
    const supabase = createClient();
    void supabase
      .from("agents")
      .select("*")
      .eq("org_id", "creait")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setAgents(data as Agent[]);
      });
    return () => {
      cancelled = true;
    };
  }, [initialAgents]);

  function setTab(v: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", v);
    router.replace(`/agents?${p.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={active} onValueChange={(v) => typeof v === "string" && setTab(v)} className="w-full">
      <TabsList>
        <TabsTrigger value="skills">Skills</TabsTrigger>
        <TabsTrigger value="agents">Active Agents</TabsTrigger>
        <TabsTrigger value="scheduled">Scheduled Tasks</TabsTrigger>
        <TabsTrigger value="history">Run History</TabsTrigger>
      </TabsList>
      <TabsContent value="skills" className="mt-4">
        <SkillsGrid skills={initialSkills} runStatsMap={initialRunStatsMap} />
      </TabsContent>
      <TabsContent value="agents" className="mt-4">
        <ActiveAgentsTab initialAgents={agents} initialRunHistory={initialRunHistory} />
      </TabsContent>
      <TabsContent value="scheduled" className="mt-4">
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{SCHEDULED_PHASE_NOTE}</CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="history" className="mt-4">
        <RunHistoryTable initialRuns={initialRunHistory} skills={initialSkills} />
      </TabsContent>
    </Tabs>
  );
}

export function AgentsTabs(props: Props) {
  return (
    <Suspense fallback={null}>
      <AgentsTabsInner {...props} />
    </Suspense>
  );
}
