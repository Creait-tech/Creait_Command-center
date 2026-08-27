import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { Level10Tabs } from "@/components/level10/level10-tabs";
import { StartMeetingButton } from "@/components/level10/start-meeting-button";
import { asAuthoredRows, type AuthoredIdsItem, type AuthoredWin } from "@/lib/authorship";
import type {
  Meeting,
  Kpi,
  KpiHistory,
  Initiative,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function Level10Page() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  // Step 1: Get the most recent meeting (we need its id for wins-by-meeting).
  const meetingResult = await supabase
    .from("meetings")
    .select("*")
    .eq("org_id", orgId)
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
        .eq("org_id", orgId)
        .eq("meeting_id", latestMeeting.id)
        .order("created_at", { ascending: false })
    : supabase
        .from("wins")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20);

  const thirtyDaysAgoIso = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [
    winsResult,
    kpisResult,
    idsResult,
    initiativesResult,
    kpiHistoryResult,
  ] = await Promise.all([
    winsQuery,
    supabase
      .from("kpis")
      .select("*")
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("ids_items")
      .select("*")
      .eq("org_id", orgId)
      .in("status", ["open", "discussing", "solved"])
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("initiatives")
      .select("*")
      .eq("org_id", orgId)
      .not("status", "in", "(dropped,complete)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("cc_kpi_history")
      .select("*")
      .eq("org_id", orgId)
      .gte("recorded_at", thirtyDaysAgoIso)
      .order("recorded_at", { ascending: true }),
  ]);

  // `select("*")` returns the authorship columns from
  // `phase15_authorship_everywhere`; the generated types don't declare them yet.
  const wins: AuthoredWin[] = asAuthoredRows<AuthoredWin>(winsResult.data);
  const kpis: Kpi[] = (kpisResult.data as Kpi[] | null) ?? [];
  const idsItems: AuthoredIdsItem[] = asAuthoredRows<AuthoredIdsItem>(
    idsResult.data,
  );
  const initiatives: Initiative[] =
    (initiativesResult.data as Initiative[] | null) ?? [];
  const kpiHistory: KpiHistory[] =
    (kpiHistoryResult.data as KpiHistory[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Level 10 Meeting</h1>
          <p className="text-sm text-muted-foreground mt-1">
            EOS weekly leadership rhythm. Same day, same time, same agenda. 90 minutes.
          </p>
        </div>
        <StartMeetingButton />
      </div>

      <Level10Tabs
        meetingId={latestMeeting?.id ?? null}
        wins={wins}
        kpis={kpis}
        kpiHistory={kpiHistory}
        idsItems={idsItems}
        initiatives={initiatives}
      />
    </div>
  );
}
