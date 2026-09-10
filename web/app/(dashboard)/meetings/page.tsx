import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { MeetingsList } from "@/components/meetings/meetings-list";
import type { Meeting, MeetingRating, MeetingType } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  // Team Meetings is the EOS operating rhythm only. Zoom/Read.ai transcripts
  // and all client, sales, or ad-hoc calls belong in the War Room.
  const TEAM_MEETING_TYPES: readonly MeetingType[] = [
    "level_10",
    "huddle",
    "quarterly",
    "annual",
    "quarterly_conversation",
    "same_page",
    "financial",
    "state_of_company",
  ];
  const [meetingsRes, ratingsRes] = await Promise.all([
    supabase
      .from("meetings")
      .select("*")
      .eq("org_id", orgId)
      .in("meeting_type", TEAM_MEETING_TYPES)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("cc_meeting_ratings")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const meetings = (meetingsRes.data as Meeting[] | null) ?? [];
  const ratings = (ratingsRes.data as MeetingRating[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Team Meetings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every EOS meeting the team has run — Level 10s, huddles, planning sessions and conversations. Recorded Zoom calls live in the War Room.
        </p>
      </div>
      <MeetingsList initialMeetings={meetings} ratings={ratings} />
    </div>
  );
}
