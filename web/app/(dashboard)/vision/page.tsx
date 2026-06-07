import { createClient } from "@/lib/supabase/server";
import { VisionTabs } from "@/components/vision/vision-tabs";
import type { Strategy, Rock, IdsItem } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

function currentQuarter(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

export default async function VisionPage() {
  const supabase = await createClient();
  const quarter = currentQuarter();

  const [strategyRes, rocksRes, issuesRes] = await Promise.all([
    supabase.from("strategy").select("*").eq("org_id", "creait").maybeSingle(),
    supabase
      .from("cc_rocks")
      .select("*")
      .eq("org_id", "creait")
      .eq("quarter", quarter)
      .order("sort_order"),
    supabase
      .from("ids_items")
      .select("*")
      .eq("org_id", "creait")
      .eq("is_long_term", true)
      .neq("status", "solved")
      .neq("status", "dropped")
      .order("priority", { ascending: false })
      .limit(50),
  ]);

  const strategy = (strategyRes.data as Strategy | null) ?? null;
  const rocks = (rocksRes.data as Rock[] | null) ?? [];
  const issues = (issuesRes.data as IdsItem[] | null) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <VisionTabs strategy={strategy} rocks={rocks} issues={issues} quarter={quarter} />
    </div>
  );
}
