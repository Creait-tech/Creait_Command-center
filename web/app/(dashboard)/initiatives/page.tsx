import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import {
  InitiativesView,
  type InitiativeWithDepartment,
} from "@/components/initiatives/initiatives-view";
import type { InitiativeTask } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function InitiativesPage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const { data: initiativesData } = await supabase
    .from("initiatives")
    .select("*")
    .eq("org_id", orgId)
    .neq("status", "dropped")
    .order("department", { ascending: true })
    .order("created_at", { ascending: false });

  const initiatives: InitiativeWithDepartment[] =
    (initiativesData as InitiativeWithDepartment[] | null) ?? [];

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
          Quarterly initiatives by department. Expand to manage tasks, escalate
          blockers to IDS.
        </p>
      </div>

      <InitiativesView initiatives={initiatives} tasks={tasks} />
    </div>
  );
}
