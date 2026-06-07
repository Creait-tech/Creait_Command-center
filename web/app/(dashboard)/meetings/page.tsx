import { createClient } from "@/lib/supabase/server";
import { MeetingsList } from "@/components/meetings/meetings-list";
import type { Meeting, MeetingRating } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const supabase = await createClient();

  const [meetingsRes, ratingsRes] = await Promise.all([
    supabase
      .from("meetings")
      .select("*")
      .eq("org_id", "creait")
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
        <h1 className="text-2xl font-bold">Meeting History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Past Level 10s and Read.ai meetings — with ratings, agenda timing, and what came out of them.
        </p>
      </div>
      <MeetingsList initialMeetings={meetings} ratings={ratings} />
    </div>
  );
}
