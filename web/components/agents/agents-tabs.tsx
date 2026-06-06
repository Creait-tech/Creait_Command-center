"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { SkillsGrid } from "./skills-grid";
import { RunHistoryTable } from "./run-history-table";
import type { Skill, RunHistory } from "@/lib/supabase/types";
import type { SkillRunStats } from "./skill-utils";

const VALID = ["skills", "agents", "scheduled", "history"] as const;
type Valid = (typeof VALID)[number];

const PHASE3 =
  "Ships in Phase 3 — long-running agents (YouTube Research, Recruiting Monitor, Client Health, Market Intelligence) and the Inngest scheduled-task dashboard.";

interface Props {
  initialSkills: Skill[];
  initialRunHistory: RunHistory[];
  initialRunStatsMap: Record<string, SkillRunStats>;
}

function AgentsTabsInner({ initialSkills, initialRunHistory, initialRunStatsMap }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("tab");
  const active: Valid = (VALID as readonly string[]).includes(raw ?? "") ? (raw as Valid) : "skills";

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
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{PHASE3}</CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="scheduled" className="mt-4">
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{PHASE3}</CardContent>
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
