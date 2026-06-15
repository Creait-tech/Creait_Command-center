import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { AgentsTabs } from "@/components/agents/agents-tabs";
import { buildRunStatsMap } from "@/components/agents/skill-utils";
import type { Skill, RunHistory } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();
  const [skillsResult, historyResult] = await Promise.all([
    supabase
      .from("skills")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("run_history")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const skills: Skill[] = (skillsResult.data as Skill[] | null) ?? [];
  const runHistory: RunHistory[] = (historyResult.data as RunHistory[] | null) ?? [];
  const runStatsMap = buildRunStatsMap(runHistory);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Agent Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Run skills manually, review run history, manage agentic workflows.
        </p>
      </div>
      <AgentsTabs initialSkills={skills} initialRunHistory={runHistory} initialRunStatsMap={runStatsMap} orgId={orgId} />
    </div>
  );
}
