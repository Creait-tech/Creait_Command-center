import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { AttendanceBoard } from "@/components/tuesday/attendance-board";
import { ClassScoreboard } from "@/components/tuesday/class-scoreboard";
import {
  CLASS_FACTS,
  computeWeekStats,
  currentClassDate,
  formatClassDate,
  recentClassDates,
} from "@/lib/tuesday-class";
import type {
  CcClassAttendance,
  CcClassRegistration,
  CcClassSession,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const WEEKS = 8;

/** The sync columns are jsonb, so narrow before handing them to the client. */
function toStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

/**
 * AI Tuesday — the internal side.
 *
 * Two jobs on one page, in the order they get done: mark this week's
 * attendance (a 30-second phone job right after class), then look at whether
 * the number is going the right way.
 */
export default async function TuesdayClassPage() {
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const thisWeek = currentClassDate();
  const weeks = recentClassDates(WEEKS);

  const [registrationsRes, sessionsRes] = await Promise.all([
    supabase
      .from("cc_class_registrations")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("cc_class_sessions")
      .select("*")
      .eq("org_id", orgId)
      .in("session_date", weeks),
  ]);

  const registrations =
    (registrationsRes.data as CcClassRegistration[] | null) ?? [];
  const sessions = (sessionsRes.data as CcClassSession[] | null) ?? [];

  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const sessionIds = sessions.map((s) => s.id);

  const attendanceRes = sessionIds.length
    ? await supabase
        .from("cc_class_attendance")
        .select("*")
        .in("session_id", sessionIds)
    : { data: [] as CcClassAttendance[] };

  const attendance = (attendanceRes.data as CcClassAttendance[] | null) ?? [];

  const stats = computeWeekStats(
    weeks,
    registrations,
    attendance.map((a) => ({
      sessionDate: sessionById.get(a.session_id)?.session_date ?? "",
      attended: a.attended,
    })),
  );

  const thisWeekSession = sessions.find((s) => s.session_date === thisWeek);
  const thisWeekMarks = attendance.filter(
    (a) => a.session_id === thisWeekSession?.id,
  );

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">AI Tuesday</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {CLASS_FACTS.day}, {CLASS_FACTS.startTime} ·{" "}
          {CLASS_FACTS.durationMinutes} minutes · on {CLASS_FACTS.platform}.
          Registration lives at{" "}
          <a
            className="text-primary underline underline-offset-4"
            href="/tuesday"
            target="_blank"
            rel="noreferrer"
          >
            /tuesday
          </a>
          .
        </p>
      </div>

      <AttendanceBoard
        sessionDate={thisWeek}
        sessionLabel={formatClassDate(thisWeek)}
        topic={thisWeekSession?.topic ?? null}
        registrations={registrations}
        initialMarks={thisWeekMarks.map((m) => ({
          registrationId: m.registration_id,
          attended: m.attended,
          source: m.source,
        }))}
        sync={{
          syncedAt: thisWeekSession?.zoom_synced_at ?? null,
          participantCount: thisWeekSession?.zoom_participant_count ?? null,
          unmatched: toStringList(thisWeekSession?.zoom_unmatched),
          error: thisWeekSession?.zoom_error ?? null,
        }}
      />

      <ClassScoreboard stats={stats} totalRegistered={registrations.length} />
    </div>
  );
}
