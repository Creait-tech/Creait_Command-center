import { createClient } from "@/lib/supabase/server";
import { StrategyPage } from "@/components/strategy/strategy-page";
import type {
  Strategy,
  MediaPlatform,
  AdvisorInsight,
  StrategicBet,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();

  const [strategyRes, platformsRes, insightsRes, betsRes] = await Promise.all([
    supabase
      .from("strategy")
      .select("*")
      .eq("org_id", "creait")
      .maybeSingle(),
    supabase
      .from("media_platforms")
      .select("*")
      .eq("org_id", "creait")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("advisor_insights")
      .select("*")
      .eq("org_id", "creait")
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("strategic_bets")
      .select("*")
      .eq("org_id", "creait")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  const strategy: Strategy | null = (strategyRes.data as Strategy | null) ?? null;
  const platforms: MediaPlatform[] =
    (platformsRes.data as MediaPlatform[] | null) ?? [];
  const insights: AdvisorInsight[] =
    (insightsRes.data as AdvisorInsight[] | null) ?? [];
  const bets: StrategicBet[] = (betsRes.data as StrategicBet[] | null) ?? [];

  return (
    <StrategyPage
      strategy={strategy}
      platforms={platforms}
      insights={insights}
      bets={bets}
    />
  );
}
