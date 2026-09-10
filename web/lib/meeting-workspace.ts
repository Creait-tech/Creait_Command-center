import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  asAuthoredRows,
  type AuthoredIdsItem,
  type AuthoredRock,
  type AuthoredTodo,
  type Person,
} from "@/lib/authorship";
import { asKpiRows, type KpiRow } from "@/components/level10/kpi-meta";
import { asWeeklyRows, type CcKpiWeekly } from "@/components/level10/weekly-types";
import {
  currentWeekStart,
  recentWeekStarts,
  WEEK_COLUMN_COUNT,
} from "@/components/level10/weeks";
import type { KpiHistory, RockMilestone, RockStatusUpdate } from "@/lib/supabase/types";

/**
 * Everything the meeting room needs to run the live sections: the scorecard,
 * the rocks, the issues list, open to-dos and the people in the org. Loaded
 * by the Level 10 page (for the Start dialog and the tabs) and by the room
 * page itself, so both see the same data the same way.
 */
export interface MeetingWorkspaceData {
  kpis: KpiRow[];
  kpiWeekly: CcKpiWeekly[];
  kpiHistory: KpiHistory[];
  weekStarts: string[];
  people: Person[];
  rocks: AuthoredRock[];
  rockMilestones: RockMilestone[];
  rockStatusUpdates: RockStatusUpdate[];
  idsItems: AuthoredIdsItem[];
  /** Open (not done) to-dos, for the To-Do Review section. */
  todos: AuthoredTodo[];
  /** Titles of the team's meetings, keyed by id, for "from L10 — Sep 10" stamps. */
  meetingTitles: Record<string, string>;
  currentQuarter: string;
}

/**
 * Titles for every meeting the team has run, so a to-do, issue, headline or
 * win can say which meeting it came from without a join per row. A few
 * hundred rows a year at most.
 */
export async function loadMeetingTitles(
  supabase: AnyClient,
  orgId: string,
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("meetings")
    .select("id, title")
    .eq("org_id", orgId)
    .eq("source", "manual")
    .order("created_at", { ascending: false })
    .limit(500);
  const map: Record<string, string> = {};
  for (const row of (data as Array<{ id: string; title: string }> | null) ?? []) map[row.id] = row.title;
  return map;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export function currentQuarter(): string {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export async function loadMeetingWorkspace(
  supabase: AnyClient,
  orgId: string,
): Promise<MeetingWorkspaceData> {
  const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // The week columns are derived once, here, in America/New_York. Deriving
  // them again in the browser would let a laptop on a different timezone
  // disagree with the server about which Monday "this week" is.
  const weekStarts = recentWeekStarts(WEEK_COLUMN_COUNT, currentWeekStart());

  const [
    kpisResult,
    idsResult,
    kpiHistoryResult,
    kpiWeeklyResult,
    peopleResult,
    rocksResult,
    rockMilestonesResult,
    rockStatusResult,
    todosResult,
    meetingTitles,
  ] = await Promise.all([
    supabase.from("kpis").select("*").eq("org_id", orgId).order("sort_order", { ascending: true }),
    supabase
      .from("ids_items")
      .select("*")
      .eq("org_id", orgId)
      .in("status", ["open", "discussing", "solved"])
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("cc_kpi_history")
      .select("*")
      .eq("org_id", orgId)
      .gte("recorded_at", thirtyDaysAgoIso)
      .order("recorded_at", { ascending: true }),
    // Every recorded week, not just the thirteen on screen: the period tabs
    // report how much trustworthy history exists in total.
    supabase.from("cc_kpi_weekly").select("*").eq("org_id", orgId).order("week_start", { ascending: false }),
    supabase
      .from("team_members")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "active")
      .order("full_name", { ascending: true }),
    supabase
      .from("cc_rocks")
      .select("*")
      .eq("org_id", orgId)
      .order("quarter", { ascending: false })
      .order("sort_order", { ascending: true }),
    supabase.from("cc_rock_milestones").select("*").order("sort_order", { ascending: true }),
    supabase.from("cc_rock_status_updates").select("*").order("created_at", { ascending: false }),
    supabase
      .from("cc_todos")
      .select("*")
      .eq("org_id", orgId)
      .eq("done", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    loadMeetingTitles(supabase, orgId),
  ]);

  // `select("*")` returns the authorship and profile columns from
  // `phase15_authorship_everywhere`; the generated types don't declare them yet.
  return {
    kpis: asKpiRows(kpisResult.data),
    kpiWeekly: asWeeklyRows(kpiWeeklyResult.data),
    kpiHistory: (kpiHistoryResult.data as KpiHistory[] | null) ?? [],
    weekStarts,
    people: asAuthoredRows<Person>(peopleResult.data),
    rocks: asAuthoredRows<AuthoredRock>(rocksResult.data),
    rockMilestones: (rockMilestonesResult.data as RockMilestone[] | null) ?? [],
    rockStatusUpdates: (rockStatusResult.data as RockStatusUpdate[] | null) ?? [],
    idsItems: asAuthoredRows<AuthoredIdsItem>(idsResult.data),
    todos: asAuthoredRows<AuthoredTodo>(todosResult.data),
    meetingTitles,
    currentQuarter: currentQuarter(),
  };
}

/** The `team_members.id` of the signed-in person, or null if not on the roster. */
export async function currentMemberId(
  supabase: AnyClient,
  orgId: string,
  clerkUserId: string | null,
): Promise<string | null> {
  if (!clerkUserId) return null;
  const { data } = await supabase
    .from("team_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
