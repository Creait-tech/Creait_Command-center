import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { RocksView } from "@/components/rocks/rocks-view";
import { asAuthoredRows, type AuthoredRock, type Person } from "@/lib/authorship";
import type { RockMilestone, RockStatusUpdate } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

function currentQuarter(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

export default async function RocksPage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();
  const quarter = currentQuarter();

  const [rocksRes, milestonesRes, statusRes, membersRes] = await Promise.all([
    supabase
      .from("cc_rocks")
      .select("*")
      .eq("org_id", orgId)
      .order("quarter", { ascending: false })
      .order("sort_order", { ascending: true }),
    supabase
      .from("cc_rock_milestones")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("cc_rock_status_updates")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("full_name"),
  ]);

  // `select("*")` returns the authorship and profile columns from
  // `phase15_authorship_everywhere`; the generated types don't declare them yet.
  const rocks = asAuthoredRows<AuthoredRock>(rocksRes.data);
  const milestones = (milestonesRes.data as RockMilestone[] | null) ?? [];
  const status = (statusRes.data as RockStatusUpdate[] | null) ?? [];
  const members = asAuthoredRows<Person>(membersRes.data);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Rocks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quarterly priorities (EOS). 3-7 per quarter, one owner each, SMART, with weekly Green/Yellow/Red status.
        </p>
      </div>
      <RocksView
        initialRocks={rocks}
        milestones={milestones}
        statusUpdates={status}
        members={members}
        currentQuarter={quarter}
      />
    </div>
  );
}
