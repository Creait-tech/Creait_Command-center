import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { currentMemberId, loadMeetingWorkspace } from "@/lib/meeting-workspace";
import { MeetingRoom } from "@/components/level10/meeting-room";
import { MeetingRecord } from "@/components/level10/meeting-record";
import { asAuthoredRows, type Person } from "@/lib/authorship";
import type { Headline, IdsItem, Meeting, MeetingRating, Todo, Win } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * One page per meeting. While the meeting is in progress this is the room;
 * once it is concluded it is the record. Same URL, so a link shared during
 * the meeting keeps working afterwards.
 */
export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const { data } = await supabase.from("meetings").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
  const meeting = data as Meeting | null;
  if (!meeting) notFound();

  if (meeting.status === "in_progress") {
    const { userId } = await auth();
    const [workspace, memberId] = await Promise.all([
      loadMeetingWorkspace(supabase, orgId),
      currentMemberId(supabase, orgId, userId),
    ]);
    return <MeetingRoom meeting={meeting} workspace={workspace} currentMemberId={memberId} />;
  }

  const [peopleRes, ratingsRes, headlinesRes, issuesRes, todosRes, winsRes] = await Promise.all([
    supabase.from("team_members").select("*").eq("org_id", orgId).order("full_name"),
    supabase.from("cc_meeting_ratings").select("*").eq("meeting_id", id).order("created_at"),
    supabase.from("cc_headlines").select("*").eq("org_id", orgId).eq("meeting_id", id).order("created_at"),
    supabase.from("ids_items").select("*").eq("org_id", orgId).eq("meeting_id", id).order("created_at"),
    supabase.from("cc_todos").select("*").eq("org_id", orgId).eq("meeting_id", id).order("created_at"),
    supabase.from("wins").select("*").eq("org_id", orgId).eq("meeting_id", id).order("created_at"),
  ]);

  return (
    <MeetingRecord
      meeting={meeting}
      people={asAuthoredRows<Person>(peopleRes.data)}
      ratings={(ratingsRes.data as MeetingRating[] | null) ?? []}
      headlines={(headlinesRes.data as Headline[] | null) ?? []}
      issues={(issuesRes.data as IdsItem[] | null) ?? []}
      todos={(todosRes.data as Todo[] | null) ?? []}
      wins={(winsRes.data as Win[] | null) ?? []}
    />
  );
}
