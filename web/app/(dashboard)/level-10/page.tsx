import { createClient } from "@/lib/supabase/server";
import { Level10Tabs } from "@/components/level10/level10-tabs";
import type {
  Meeting,
  Win,
  Kpi,
  IdsItem,
  Initiative,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function Level10Page() {
  const supabase = await createClient();

  // Step 1: Get the most recent meeting (we need its id for wins-by-meeting).
  const meetingResult = await supabase
    .from("meetings")
    .select("*")
    .eq("org_id", "creait")
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1);

  const meetings = (meetingResult.data as Meeting[] | null) ?? [];
  const latestMeeting: Meeting | null = meetings[0] ?? null;

  // Step 2: Parallel-fetch everything else.
  const winsQuery = latestMeeting
    ? supabase
        .from("wins")
        .select("*")
        .eq("org_id", "creait")
        .eq("meeting_id", latestMeeting.id)
        .order("created_at", { ascending: false })
    : supabase
        .from("wins")
        .select("*")
        .eq("org_id", "creait")
        .order("created_at", { ascending: false })
        .limit(20);

  const [winsResult, kpisResult, idsResult, initiativesResult] =
    await Promise.all([
      winsQuery,
      supabase
        .from("kpis")
        .select("*")
        .eq("org_id", "creait")
        .order("sort_order", { ascending: true }),
      supabase
        .from("ids_items")
        .select("*")
        .eq("org_id", "creait")
        .in("status", ["open", "discussing", "solved"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("initiatives")
        .select("*")
        .eq("org_id", "creait")
        .not("status", "in", "(dropped,complete)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const wins: Win[] = (winsResult.data as Win[] | null) ?? [];
  const kpis: Kpi[] = (kpisResult.data as Kpi[] | null) ?? [];
  const idsItems: IdsItem[] = (idsResult.data as IdsItem[] | null) ?? [];
  const initiatives: Initiative[] =
    (initiativesResult.data as Initiative[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Level 10 Meeting</h1>
        <p className="text-sm text-muted-foreground mt-1">
          EOS-style weekly leadership rhythm. Wins, scoreboard, initiatives,
          and IDS.
        </p>
      </div>

      <Level10Tabs
        meetingId={latestMeeting?.id ?? null}
        wins={wins}
        kpis={kpis}
        idsItems={idsItems}
        initiatives={initiatives}
      />
    </div>
  );
}
