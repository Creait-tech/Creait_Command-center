import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import {
  InitiativesView,
  type InitiativeWithDepartment,
} from "@/components/initiatives/initiatives-view";
import type { InitiativeTask, TeamMember } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function InitiativesPage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const [initiativesRes, membersRes] = await Promise.all([
    supabase
      .from("initiatives")
      .select("*")
      .eq("org_id", orgId)
      .neq("status", "dropped")
      .order("department", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("id, full_name")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("full_name", { ascending: true }),
  ]);

  const initiatives: InitiativeWithDepartment[] =
    (initiativesRes.data as InitiativeWithDepartment[] | null) ?? [];
  const members = (membersRes.data as Pick<
    TeamMember,
    "id" | "full_name"
  >[] | null) ?? [];

  const initiativeIds = initiatives.map((i) => i.id);
  let tasks: InitiativeTask[] = [];
  if (initiativeIds.length > 0) {
    const { data: tasksData } = await supabase
      .from("initiative_tasks")
      .select("*")
      .in("initiative_id", initiativeIds)
      .order("sort_order", { ascending: true });
    tasks = (tasksData as InitiativeTask[] | null) ?? [];
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Initiatives</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The department-level work that carries this quarter&rsquo;s Rocks.
          Expand a card to tick off tasks; escalate anything blocked straight to
          the IDS list.
        </p>
      </div>

      <InitiativesView
        initiatives={initiatives}
        tasks={tasks}
        members={members}
      />
    </div>
  );
}
