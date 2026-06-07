import { createClient } from "@/lib/supabase/server";
import { RocksView } from "@/components/rocks/rocks-view";
import type {
  Rock,
  RockMilestone,
  RockStatusUpdate,
  TeamMember,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

function currentQuarter(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

export default async function RocksPage() {
  const supabase = await createClient();
  const quarter = currentQuarter();

  const [rocksRes, milestonesRes, statusRes, membersRes] = await Promise.all([
    supabase
      .from("cc_rocks")
      .select("*")
      .eq("org_id", "creait")
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
      .eq("org_id", "creait")
      .eq("status", "active")
      .order("full_name"),
  ]);

  const rocks = (rocksRes.data as Rock[] | null) ?? [];
  const milestones = (milestonesRes.data as RockMilestone[] | null) ?? [];
  const status = (statusRes.data as RockStatusUpdate[] | null) ?? [];
  const members = (membersRes.data as TeamMember[] | null) ?? [];

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
