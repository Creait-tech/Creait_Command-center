import { createClient } from "@/lib/supabase/server";
import { ResearchTabs } from "@/components/research/research-tabs";
import type { ResearchBriefing, Competitor, TechWatchItem } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const archiveCutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [todayResult, archiveResult, competitorsResult, watchItemsResult] = await Promise.all([
    supabase
      .from("research_briefings")
      .select("*")
      .eq("org_id", "creait")
      .eq("briefing_type", "daily")
      .eq("briefing_date", today)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("research_briefings")
      .select("*")
      .eq("org_id", "creait")
      .gte("created_at", archiveCutoff)
      .order("briefing_date", { ascending: false })
      .limit(50),
    supabase
      .from("competitors")
      .select("*")
      .eq("org_id", "creait")
      .eq("watch_type", "tech_watch")
      .order("name", { ascending: true }),
    supabase
      .from("tech_watch_items")
      .select("*")
      .eq("org_id", "creait")
      .gte("created_at", cutoff)
      .order("published_at", { ascending: false })
      .limit(200),
  ]);

  const todayBriefing = ((todayResult.data as ResearchBriefing[] | null) ?? [])[0] ?? null;
  const archive = (archiveResult.data as ResearchBriefing[] | null) ?? [];
  const competitors = (competitorsResult.data as Competitor[] | null) ?? [];
  const watchItems = (watchItemsResult.data as TechWatchItem[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Research</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Daily intelligence briefing, deep research, and the Tech Watch feed.
        </p>
      </div>
      <ResearchTabs
        todayBriefing={todayBriefing}
        archive={archive}
        competitors={competitors}
        watchItems={watchItems}
      />
    </div>
  );
}
