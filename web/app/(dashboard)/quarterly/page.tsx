import { createClient } from "@/lib/supabase/server";
import { QuarterlyWalker } from "@/components/quarterly/quarterly-walker";
import type { Rock, IdsItem, Strategy } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

function currentQuarter(): string {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

function previousQuarter(): string {
  const d = new Date();
  const month = d.getMonth();
  const year = d.getFullYear();
  let prevQ = Math.floor(month / 3);
  let prevY = year;
  if (prevQ === 0) {
    prevQ = 4;
    prevY -= 1;
  }
  return `${prevY}-Q${prevQ}`;
}

export default async function QuarterlyPage() {
  const supabase = await createClient();
  const thisQ = currentQuarter();
  const prevQ = previousQuarter();

  const [thisRocksRes, prevRocksRes, longIssuesRes, strategyRes] = await Promise.all([
    supabase.from("cc_rocks").select("*").eq("org_id", "creait").eq("quarter", thisQ).order("sort_order"),
    supabase.from("cc_rocks").select("*").eq("org_id", "creait").eq("quarter", prevQ).order("sort_order"),
    supabase.from("ids_items").select("*").eq("org_id", "creait").eq("is_long_term", true).neq("status", "solved").neq("status", "dropped").order("priority", { ascending: false }),
    supabase.from("strategy").select("*").eq("org_id", "creait").maybeSingle(),
  ]);

  const thisRocks = (thisRocksRes.data as Rock[] | null) ?? [];
  const prevRocks = (prevRocksRes.data as Rock[] | null) ?? [];
  const longIssues = (longIssuesRes.data as IdsItem[] | null) ?? [];
  const strategy = (strategyRes.data as Strategy | null) ?? null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Quarterly Planning</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The 8-hour EOS quarterly session. Review last quarter, refresh the V/TO, set 3-7 new Rocks.
        </p>
      </div>
      <QuarterlyWalker
        thisQuarter={thisQ}
        previousQuarter={prevQ}
        thisRocks={thisRocks}
        previousRocks={prevRocks}
        longIssues={longIssues}
        strategy={strategy}
      />
    </div>
  );
}
