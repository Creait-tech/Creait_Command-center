import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { Level10Tabs } from "@/components/level10/level10-tabs";
import { StartMeetingButton } from "@/components/level10/start-meeting-button";
import {
  asAuthoredRows,
  type AuthoredIdsItem,
  type AuthoredWin,
  type Person,
} from "@/lib/authorship";
import { asKpiRows, type KpiRow } from "@/components/level10/kpi-meta";
import {
  asWeeklyRows,
  type CcKpiWeekly,
} from "@/components/level10/weekly-types";
import {
  currentWeekStart,
  recentWeekStarts,
  WEEK_COLUMN_COUNT,
} from "@/components/level10/weeks";
import type { Meeting, KpiHistory, Initiative } from "@/lib/supabase/types";

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

  // The week columns are derived once, here, in America/New_York. Deriving
  // them again in the browser would let a laptop on a different timezone
  // disagree with the server about which Monday "this week" is — which shows
  // up as a full re-render on hydration and, worse, as a number typed into the
  // wrong column.
  const weekStarts = recentWeekStarts(WEEK_COLUMN_COUNT, currentWeekStart());

  const [
    winsResult,
    kpisResult,
    idsResult,
    initiativesResult,
    kpiHistoryResult,
    kpiWeeklyResult,
    peopleResult,
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
    // Every recorded week, not just the thirteen on screen: the period tabs
    // report how much trustworthy history exists in total. Six KPIs times one
    // row a week is a few hundred rows a year.
    supabase
      .from("cc_kpi_weekly")
      .select("*")
      .eq("org_id", orgId)
      .order("week_start", { ascending: false }),
    supabase
      .from("team_members")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("full_name", { ascending: true }),
  ]);

  // `select("*")` returns the authorship columns from
  // `phase15_authorship_everywhere`; the generated types don't declare them yet.
  const wins: AuthoredWin[] = asAuthoredRows<AuthoredWin>(winsResult.data);
  const kpis: KpiRow[] = asKpiRows(kpisResult.data);
  const idsItems: AuthoredIdsItem[] = asAuthoredRows<AuthoredIdsItem>(
    idsResult.data,
  );
  const initiatives: Initiative[] =
    (initiativesResult.data as Initiative[] | null) ?? [];
  const kpiHistory: KpiHistory[] =
    (kpiHistoryResult.data as KpiHistory[] | null) ?? [];
  const kpiWeekly: CcKpiWeekly[] = asWeeklyRows(kpiWeeklyResult.data);
  // `select("*")` returns `display_name`/`pronouns` from the profile migration;
  // the generated types don't declare them yet (see `lib/authorship.ts`).
  const people: Person[] = asAuthoredRows<Person>(peopleResult.data);

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
        kpiWeekly={kpiWeekly}
        kpiHistory={kpiHistory}
        weekStarts={weekStarts}
        people={people}
        idsItems={idsItems}
        initiatives={initiatives}
      />
    </div>
  );
}
