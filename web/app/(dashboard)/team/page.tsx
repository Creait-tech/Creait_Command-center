import { createClient } from "@/lib/supabase/server";
import { TeamView } from "@/components/team/team-view";
import type { TeamMember, MemberKpi } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = await createClient();

  const membersResult = await supabase
    .from("team_members")
    .select("*")
    .eq("org_id", "creait")
    .eq("status", "active")
    .order("full_name", { ascending: true });

  const members: TeamMember[] =
    (membersResult.data as TeamMember[] | null) ?? [];

  const memberIds = members.map((m) => m.id);
  let kpis: MemberKpi[] = [];
  if (memberIds.length > 0) {
    const kpisResult = await supabase
      .from("member_kpis")
      .select("*")
      .in("member_id", memberIds)
      .order("sort_order", { ascending: true });
    kpis = (kpisResult.data as MemberKpi[] | null) ?? [];
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Roster of active members and the live org chart.
        </p>
      </div>

      <TeamView members={members} kpis={kpis} />
    </div>
  );
}
