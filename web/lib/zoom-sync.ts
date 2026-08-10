import { createServiceClient } from "@/lib/supabase/server";
import { CREAIT_ORG_ID } from "@/lib/active-org";
import { CLASS_TAGS, addContactTags, findContactByEmail } from "@/lib/ghl";
import { CLASS_TIMEZONE, currentClassDate } from "@/lib/tuesday-class";
import type {
  CcClassAttendance,
  CcClassRegistration,
} from "@/lib/supabase/types";

/**
 * Zoom → War Room sync.
 *
 * Pulls cloud recordings (with transcripts) via a Server-to-Server OAuth
 * app and upserts them into `meetings` keyed on (source='zoom',
 * source_id=meeting uuid). Safe to run repeatedly: existing rows only
 * gain a transcript/recording when they lack one.
 *
 * Required env (all three, else sync is a graceful no-op):
 *   ZOOM_ACCOUNT_ID, ZOOM_S2S_CLIENT_ID, ZOOM_S2S_CLIENT_SECRET
 * Zoom app scopes: cloud recording read (account-level).
 */

const ZOOM_API = "https://api.zoom.us/v2";

type ZoomRecordingFile = {
  file_type?: string;
  download_url?: string;
  play_url?: string;
  recording_type?: string;
};

type ZoomRecordingMeeting = {
  uuid: string;
  topic?: string;
  start_time?: string;
  duration?: number;
  share_url?: string;
  recording_files?: ZoomRecordingFile[];
};

export function zoomConfigured(): boolean {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID &&
      process.env.ZOOM_S2S_CLIENT_ID &&
      process.env.ZOOM_S2S_CLIENT_SECRET,
  );
}

async function zoomToken(): Promise<string> {
  const basic = Buffer.from(
    `${process.env.ZOOM_S2S_CLIENT_ID}:${process.env.ZOOM_S2S_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    { method: "POST", headers: { Authorization: `Basic ${basic}` } },
  );
  if (!res.ok) {
    throw new Error(`Zoom token failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Zoom token response missing access_token");
  return json.access_token;
}

/** Zoom transcript VTT → "Speaker: words" plain text. */
export function vttToText(vtt: string): string {
  const lines: string[] = [];
  for (const raw of vtt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line === "WEBVTT") continue;
    if (/^\d+$/.test(line)) continue; // cue number
    if (line.includes("-->")) continue; // timestamps
    lines.push(line);
  }
  return lines.join("\n");
}

async function listRecordings(token: string, fromISO: string): Promise<ZoomRecordingMeeting[]> {
  const meetings: ZoomRecordingMeeting[] = [];
  let nextPageToken = "";
  const from = fromISO.slice(0, 10);
  do {
    const url = new URL(`${ZOOM_API}/users/me/recordings`);
    url.searchParams.set("from", from);
    url.searchParams.set("page_size", "300");
    if (nextPageToken) url.searchParams.set("next_page_token", nextPageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      throw new Error(`Zoom recordings list failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as {
      meetings?: ZoomRecordingMeeting[];
      next_page_token?: string;
    };
    meetings.push(...(json.meetings ?? []));
    nextPageToken = json.next_page_token ?? "";
  } while (nextPageToken);
  return meetings;
}

async function fetchTranscript(token: string, file: ZoomRecordingFile): Promise<string | null> {
  if (!file.download_url) return null;
  const sep = file.download_url.includes("?") ? "&" : "?";
  const res = await fetch(`${file.download_url}${sep}access_token=${token}`);
  if (!res.ok) return null;
  const vtt = await res.text();
  const text = vttToText(vtt);
  return text.length > 40 ? text : null;
}

export async function syncZoomRecordings(daysBack = 7): Promise<{
  scanned: number;
  inserted: number;
  transcriptsAdded: number;
}> {
  const token = await zoomToken();
  const fromISO = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const recordings = await listRecordings(token, fromISO);

  const supabase = createServiceClient();
  const { data: existingRows } = await supabase
    .from("meetings")
    .select("source_id, transcript, recording_url")
    .eq("org_id", CREAIT_ORG_ID)
    .eq("source", "zoom")
    .gte("scheduled_at", fromISO);
  const existing = new Map(
    (existingRows ?? []).map((r) => [r.source_id as string, r]),
  );

  let inserted = 0;
  let transcriptsAdded = 0;

  for (const rec of recordings) {
    const transcriptFile = (rec.recording_files ?? []).find(
      (f) => f.file_type === "TRANSCRIPT",
    );
    const playUrl =
      rec.share_url ??
      (rec.recording_files ?? []).find((f) => f.play_url)?.play_url ??
      null;
    const row = existing.get(rec.uuid);

    if (!row) {
      const transcript = transcriptFile
        ? await fetchTranscript(token, transcriptFile)
        : null;
      const { error } = await supabase.from("meetings").insert({
        org_id: CREAIT_ORG_ID,
        title: rec.topic || "Zoom meeting",
        meeting_type: "other",
        scheduled_at: rec.start_time ?? null,
        duration_minutes: rec.duration ?? null,
        source: "zoom",
        source_id: rec.uuid,
        recording_url: playUrl,
        transcript,
      });
      if (!error) {
        inserted += 1;
        if (transcript) transcriptsAdded += 1;
      }
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (!row.transcript && transcriptFile) {
      const transcript = await fetchTranscript(token, transcriptFile);
      if (transcript) {
        patch.transcript = transcript;
        transcriptsAdded += 1;
      }
    }
    if (!row.recording_url && playUrl) patch.recording_url = playUrl;
    if (Object.keys(patch).length > 0) {
      await supabase
        .from("meetings")
        .update(patch)
        .eq("org_id", CREAIT_ORG_ID)
        .eq("source", "zoom")
        .eq("source_id", rec.uuid);
    }
  }

  return { scanned: recordings.length, inserted, transcriptsAdded };
}

// ---------------------------------------------------------------------------
// AI Tuesday attendance from Zoom participants
// ---------------------------------------------------------------------------

type ZoomParticipant = {
  name?: string;
  user_email?: string;
};

/**
 * Zoom meeting UUIDs are base64 and can contain `/`. When one starts with `/`
 * or contains `//`, the path segment must be double URL-encoded or Zoom routes
 * the request somewhere else entirely and answers 404. Anything else is
 * encoded once, as normal.
 */
function encodeMeetingUuid(uuid: string): string {
  const once = encodeURIComponent(uuid);
  return uuid.startsWith("/") || uuid.includes("//")
    ? encodeURIComponent(once)
    : once;
}

async function fetchParticipants(
  token: string,
  uuid: string,
): Promise<ZoomParticipant[]> {
  const out: ZoomParticipant[] = [];
  let nextPageToken = "";
  do {
    const url = new URL(
      `${ZOOM_API}/past_meetings/${encodeMeetingUuid(uuid)}/participants`,
    );
    url.searchParams.set("page_size", "300");
    if (nextPageToken) url.searchParams.set("next_page_token", nextPageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      // A missing participant scope is the likely cause and it is not fatal —
      // the manual check-off is the system of record either way.
      throw new Error(
        `Zoom participants failed: ${res.status} ${(await res.text()).slice(0, 200)}`,
      );
    }
    const json = (await res.json()) as {
      participants?: ZoomParticipant[];
      next_page_token?: string;
    };
    out.push(...(json.participants ?? []));
    nextPageToken = json.next_page_token ?? "";
  } while (nextPageToken);
  return out;
}

/** The Eastern calendar date of an instant — the class lives on ET Tuesdays. */
function easternDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLASS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export type ZoomAttendanceResult = {
  sessionDate: string;
  meetings: number;
  participants: number;
  matched: number;
  inserted: number;
  tagged: number;
  skippedManual: number;
  notes: string[];
};

/**
 * Fill in attendance for one class from Zoom's participant list.
 *
 * Deliberate limits, all of them about not asserting more than Zoom knows:
 *
 *  - A manual mark ALWAYS wins. Any registrant who already has a row for this
 *    session is skipped, whichever way John marked them.
 *  - Only presence is inferred. Absence from a Zoom participant list is not
 *    evidence of a no-show — guests who join without signing in have no email
 *    attached at all — so this never writes `attended = false` and never
 *    sends `missed-tuesday`. Deciding somebody missed the class stays a human
 *    act.
 *  - Matching is by exact email. A name-based fuzzy match would eventually tag
 *    the wrong person's CRM record, which is worse than a gap.
 */
export async function syncZoomAttendance(
  sessionDate: string = currentClassDate(),
): Promise<ZoomAttendanceResult> {
  const notes: string[] = [];
  const token = await zoomToken();

  // Look back far enough to catch a recording that finished processing late.
  const recordings = await listRecordings(
    token,
    new Date(`${sessionDate}T00:00:00Z`).toISOString(),
  );
  const dayMeetings = recordings.filter(
    (r) => r.start_time && easternDay(r.start_time) === sessionDate,
  );

  if (dayMeetings.length === 0) {
    return {
      sessionDate,
      meetings: 0,
      participants: 0,
      matched: 0,
      inserted: 0,
      tagged: 0,
      skippedManual: 0,
      notes: [`No Zoom meeting found on ${sessionDate}.`],
    };
  }

  const emails = new Set<string>();
  let participantCount = 0;
  for (const meeting of dayMeetings) {
    try {
      const people = await fetchParticipants(token, meeting.uuid);
      participantCount += people.length;
      for (const p of people) {
        const email = p.user_email?.trim().toLowerCase();
        if (email) emails.add(email);
      }
    } catch (err) {
      notes.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (participantCount > 0 && emails.size === 0) {
    notes.push(
      `Zoom reported ${participantCount} participants but no email addresses — attendees joined without signing in. Mark this week by hand.`,
    );
  }

  const supabase = createServiceClient();

  const { data: sessionRow } = await supabase
    .from("cc_class_sessions")
    .select("id")
    .eq("org_id", CREAIT_ORG_ID)
    .eq("session_date", sessionDate)
    .maybeSingle();

  let sessionId = (sessionRow as { id: string } | null)?.id ?? null;
  if (!sessionId) {
    const { data, error } = await supabase
      .from("cc_class_sessions")
      .insert({ org_id: CREAIT_ORG_ID, session_date: sessionDate })
      .select("id")
      .single();
    if (error || !data) {
      notes.push(`Could not create the session row: ${error?.message}`);
      return {
        sessionDate,
        meetings: dayMeetings.length,
        participants: participantCount,
        matched: 0,
        inserted: 0,
        tagged: 0,
        skippedManual: 0,
        notes,
      };
    }
    sessionId = (data as { id: string }).id;
  }

  const [{ data: regRows }, { data: markRows }] = await Promise.all([
    supabase
      .from("cc_class_registrations")
      .select("id, first_name, last_name, email, ghl_contact_id")
      .eq("org_id", CREAIT_ORG_ID),
    supabase
      .from("cc_class_attendance")
      .select("registration_id")
      .eq("session_id", sessionId),
  ]);

  const registrations =
    (regRows as Pick<
      CcClassRegistration,
      "id" | "first_name" | "last_name" | "email" | "ghl_contact_id"
    >[] | null) ?? [];
  const alreadyMarked = new Set(
    ((markRows as Pick<CcClassAttendance, "registration_id">[] | null) ?? [])
      .map((m) => m.registration_id)
      .filter((id): id is string => Boolean(id)),
  );

  const present = registrations.filter((r) =>
    emails.has(r.email.trim().toLowerCase()),
  );
  const toInsert = present.filter((r) => !alreadyMarked.has(r.id));
  const skippedManual = present.length - toInsert.length;

  let inserted = 0;
  if (toInsert.length > 0) {
    const { error } = await supabase.from("cc_class_attendance").insert(
      toInsert.map((r) => ({
        session_id: sessionId,
        registration_id: r.id,
        email: r.email,
        attended: true,
        source: "zoom" as const,
      })),
    );
    if (error) notes.push(`Attendance insert failed: ${error.message}`);
    else inserted = toInsert.length;
  }

  // Tag only what was newly written, so a re-run never re-tags.
  let tagged = 0;
  if (inserted > 0) {
    for (const person of toInsert) {
      let contactId = person.ghl_contact_id;
      if (!contactId) {
        const found = await findContactByEmail(person.email);
        if (!found.ok || !found.data) {
          notes.push(`No GHL contact for ${person.email} — tag not sent.`);
          continue;
        }
        contactId = found.data.id;
        await supabase
          .from("cc_class_registrations")
          .update({ ghl_contact_id: contactId })
          .eq("id", person.id);
      }
      const res = await addContactTags(contactId, [CLASS_TAGS.attended]);
      if (res.ok) tagged += 1;
      else notes.push(`GHL tag failed for ${person.email}: ${res.error}`);
    }
  }

  return {
    sessionDate,
    meetings: dayMeetings.length,
    participants: participantCount,
    matched: present.length,
    inserted,
    tagged,
    skippedManual,
    notes,
  };
}
