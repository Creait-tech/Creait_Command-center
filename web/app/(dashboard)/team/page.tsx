import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { TeamView } from "@/components/team/team-view";
import { asAuthoredRows, type Person } from "@/lib/authorship";
import type {
  MemberKpi,
  TeamSeat,
  SeatAssignment,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const [membersResult, seatsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("team_members")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("full_name", { ascending: true }),
    supabase
      .from("cc_team_seats")
      .select("*")
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("cc_seat_assignments")
      .select("*"),
  ]);

  // `select("*")` returns `display_name` / `pronouns` from
  // `phase15_authorship_everywhere`; the generated types don't declare them yet.
  const members: Person[] = asAuthoredRows<Person>(membersResult.data);
  const seats: TeamSeat[] = (seatsResult.data as TeamSeat[] | null) ?? [];
  const assignments: SeatAssignment[] = (assignmentsResult.data as SeatAssignment[] | null) ?? [];

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
          Roster, org chart, and the EOS Accountability Chart with GWC.
        </p>
      </div>

      <TeamView
        members={members}
        kpis={kpis}
        seats={seats}
        assignments={assignments}
        orgId={orgId}
      />
    </div>
  );
}
