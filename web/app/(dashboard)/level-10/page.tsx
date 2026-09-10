import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { Level10Tabs } from "@/components/level10/level10-tabs";
import { StartMeetingButton } from "@/components/level10/start-meeting-button";
import { InProgressBanner } from "@/components/level10/in-progress-banner";
import { MeetingTitlesProvider } from "@/components/level10/meeting-titles";
import { RatingTrend, type RatedMeeting } from "@/components/level10/rating-trend";
import { currentMemberId, loadMeetingWorkspace } from "@/lib/meeting-workspace";
import { asAuthoredRows, type AuthoredHeadline, type AuthoredWin } from "@/lib/authorship";
import type { Meeting, Initiative } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function Level10Page() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();
  const { userId } = await auth();

  // The most recent concluded meeting anchors the Wins tab; a meeting still in
  // progress gets a Resume banner instead of a second Start.
  const [latestRes, inProgressRes] = await Promise.all([
    supabase
      .from("meetings")
      .select("*")
      .eq("org_id", orgId)
      .neq("status", "in_progress")
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("meetings")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(1),
  ]);

  const latestMeeting: Meeting | null = ((latestRes.data as Meeting[] | null) ?? [])[0] ?? null;
  const inProgress: Meeting | null = ((inProgressRes.data as Meeting[] | null) ?? [])[0] ?? null;

  // Wins and headlines are the running lists across every meeting, not one
  // meeting's slice: anything captured in the room is visible here without
  // opening the meeting.
  const [workspace, memberId, winsResult, headlinesResult, initiativesResult, ratedResult] = await Promise.all([
    loadMeetingWorkspace(supabase, orgId),
    currentMemberId(supabase, orgId, userId),
    supabase.from("wins").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(50),
    supabase.from("cc_headlines").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(50),
    supabase
      .from("initiatives")
      .select("*")
      .eq("org_id", orgId)
      .not("status", "in", "(dropped,complete)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("meetings")
      .select("id, title, rating, ended_at")
      .eq("org_id", orgId)
      .eq("status", "concluded")
      .eq("meeting_type", "level_10")
      .not("rating", "is", null)
      .order("ended_at", { ascending: false, nullsFirst: false })
      .limit(13),
  ]);

  const wins: AuthoredWin[] = asAuthoredRows<AuthoredWin>(winsResult.data);
  const headlines: AuthoredHeadline[] = asAuthoredRows<AuthoredHeadline>(headlinesResult.data);
  const initiatives: Initiative[] = (initiativesResult.data as Initiative[] | null) ?? [];
  const rated: RatedMeeting[] = (ratedResult.data as RatedMeeting[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Level 10 Meeting</h1>
          <p className="text-sm text-muted-foreground mt-1">
            EOS weekly leadership rhythm. Same day, same time, same agenda. 90 minutes.
          </p>
        </div>
        <StartMeetingButton people={workspace.people} currentMemberId={memberId} />
      </div>

      {inProgress && <InProgressBanner meeting={inProgress} />}
      <RatingTrend meetings={rated} />

      <MeetingTitlesProvider titles={workspace.meetingTitles}>
        <Level10Tabs
          meetingId={latestMeeting?.id ?? null}
          wins={wins}
          headlines={headlines}
          kpis={workspace.kpis}
          kpiWeekly={workspace.kpiWeekly}
          kpiHistory={workspace.kpiHistory}
          weekStarts={workspace.weekStarts}
          people={workspace.people}
          idsItems={workspace.idsItems}
          initiatives={initiatives}
        />
      </MeetingTitlesProvider>
    </div>
  );
}
