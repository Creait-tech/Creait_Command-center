import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { CompanyPrioritiesBar } from "@/components/command-center/company-priorities-bar";
import { TimeHorizonColumns } from "@/components/command-center/time-horizon-columns";
import { DailyDashboard } from "@/components/command-center/daily-dashboard";
import { ExecutiveActionCockpit } from "@/components/command-center/executive-action-cockpit";
import { ClientProgressRollup } from "@/components/command-center/client-progress-rollup";
import { ProposalsInbox } from "@/components/proposals/proposals-inbox";
import { loadClientProgress } from "./client-progress-data";
import type {
  CompanyPriority,
  Goal,
  IdsItem,
  Kpi,
  Subtask,
  TeamMember,
  Todo,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const [
    prioritiesResult,
    goalsResult,
    clientProgress,
    todosResult,
    issuesResult,
    kpisResult,
    membersResult,
  ] = await Promise.all([
    supabase
      .from("company_priorities")
      .select("*")
      .eq("org_id", orgId)
      .neq("status", "dropped")
      .order("sort_order", { ascending: true }),
    supabase
      .from("goals")
      .select("*")
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true }),
    // Client roll-up + Hermes inbox share one server fetch; see
    // ./client-progress-data.ts for why the ids are resolved up here.
    loadClientProgress(),
    supabase
      .from("cc_todos")
      .select("*")
      .eq("org_id", orgId)
      .eq("done", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(50),
    supabase
      .from("ids_items")
      .select("*")
      .eq("org_id", orgId)
      .in("status", ["open", "discussing"])
      .order("priority", { ascending: false })
      .limit(20),
    supabase
      .from("kpis")
      .select("*")
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("team_members")
      .select("id, full_name, display_name")
      .eq("org_id", orgId)
      .eq("status", "active"),
  ]);

  const priorities: CompanyPriority[] = (prioritiesResult.data as CompanyPriority[] | null) ?? [];
  const goals: Goal[] = (goalsResult.data as Goal[] | null) ?? [];
  const todos: Todo[] = (todosResult.data as Todo[] | null) ?? [];
  const issues: IdsItem[] = (issuesResult.data as IdsItem[] | null) ?? [];
  const kpis: Kpi[] = (kpisResult.data as Kpi[] | null) ?? [];
  const members: Pick<TeamMember, "id" | "full_name" | "display_name">[] =
    (membersResult.data as Pick<TeamMember, "id" | "full_name" | "display_name">[] | null) ?? [];

  const goalIds = goals.map((g) => g.id);
  let subtasks: Subtask[] = [];
  if (goalIds.length > 0) {
    const subtasksResult = await supabase
      .from("subtasks")
      .select("*")
      .in("goal_id", goalIds);
    subtasks = (subtasksResult.data as Subtask[] | null) ?? [];
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Command Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track goals and company priorities in real time.
        </p>
      </div>

      <CompanyPrioritiesBar priorities={priorities} />
      <ExecutiveActionCockpit
        todos={todos}
        issues={issues}
        clients={clientProgress.clients}
        kpis={kpis}
        members={members}
      />
      <DailyDashboard />

      <ClientProgressRollup
        clients={clientProgress.clients}
        activity={clientProgress.activity}
        pendingProposals={clientProgress.pending.length}
        errors={clientProgress.errors}
      />

      <ProposalsInbox
        pending={clientProgress.pending}
        recentlyDecided={clientProgress.recentlyDecided}
        errors={clientProgress.proposalErrors}
      />

      <TimeHorizonColumns goals={goals} subtasks={subtasks} />
    </div>
  );
}
