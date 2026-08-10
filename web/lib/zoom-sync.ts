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
// AI Tuesday attendance — automatic, from Zoom
// ---------------------------------------------------------------------------

/**
 * Attendance for the weekly class is taken from Zoom, not from a person with a
 * clipboard. The manual check-off on /tuesday-class stays, demoted to the
 * override for whoever Zoom could not identify.
 *
 * Where the evidence comes from, in order of trustworthiness:
 *
 *  1. Zoom's past-meeting participant report — names AND emails. The class
 *     requires Zoom registration, so most joins carry an email, and an email
 *     match is the only kind worth trusting outright.
 *  2. `meetings.attendees` — display names only, delivered by Read.ai. Used as
 *     a second pass and as the fallback when the participant scope is missing.
 *
 * Name matching is a fallback for a reason: the real list contains "marielle
 * cooper", first-name-only joins and device names like "iPhone". Normalizing
 * case, spacing, punctuation and accents catches the common cases and nothing
 * more; anything left over is surfaced for a human instead of guessed at.
 */

type ZoomParticipant = { name: string; email: string | null };

/**
 * Never counted as attendees: the host account, the founder who runs the
 * class from the host seat, and the notetaker bots that join every meeting.
 * Matched on the normalized name.
 */
const NON_ATTENDEE_NAMES = new Set([
  "creait team",
  "maurice grant",
  "read.ai meeting notes",
]);

const BOT_NAME_FRAGMENTS = [
  "read.ai",
  "otter.ai",
  "fireflies",
  "notetaker",
  "meeting notes",
  "recording bot",
];

/** Title patterns that identify the class among a day's other meetings. */
const CLASS_TITLE_PATTERNS = [
  "creait live",
  "creait  live",
  "ai tuesday",
  "systems behind a smoother business",
];

/**
 * Lowercase, strip accents and punctuation, collapse whitespace. "Marielle
 * Cooper", "marielle cooper" and "Marielle  Cooper " all land on one key.
 */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNonAttendee(name: string): boolean {
  const n = normalizeName(name);
  if (!n) return true;
  if (NON_ATTENDEE_NAMES.has(n)) return true;
  const raw = name.toLowerCase();
  return BOT_NAME_FRAGMENTS.some((f) => raw.includes(f));
}

/** A canonical 8-4-4-4-12 GUID, which is what the Read.ai row uses. */
function isGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isClassTitle(title: string): boolean {
  const t = normalizeName(title);
  return CLASS_TITLE_PATTERNS.some((p) => t.includes(normalizeName(p)));
}

/**
 * Zoom meeting UUIDs are base64 and can contain `/`. When one starts with `/`
 * or contains `//`, the path segment must be double URL-encoded or Zoom routes
 * the request elsewhere and answers 404. Anything else is encoded once.
 */
function encodeMeetingUuid(uuid: string): string {
  const once = encodeURIComponent(uuid);
  return uuid.startsWith("/") || uuid.includes("//")
    ? encodeURIComponent(once)
    : once;
}

/**
 * Participants for a finished meeting.
 *
 * Tries the report endpoint first (richest, needs `report:read:admin`) and
 * falls back to past_meetings (needs the past-participants scope). Both
 * failing is reported to the caller, which then refuses to tag anyone.
 */
async function fetchParticipants(
  token: string,
  uuid: string,
): Promise<{ participants: ZoomParticipant[]; errors: string[] }> {
  const errors: string[] = [];
  const encoded = encodeMeetingUuid(uuid);

  for (const path of [
    `/report/meetings/${encoded}/participants`,
    `/past_meetings/${encoded}/participants`,
  ]) {
    const out: ZoomParticipant[] = [];
    let nextPageToken = "";
    let failed = false;

    do {
      const url = new URL(`${ZOOM_API}${path}`);
      url.searchParams.set("page_size", "300");
      if (nextPageToken) url.searchParams.set("next_page_token", nextPageToken);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        errors.push(
          `${path} → ${res.status} ${(await res.text()).slice(0, 180)}`,
        );
        failed = true;
        break;
      }
      const json = (await res.json()) as {
        participants?: { name?: string; user_email?: string }[];
        next_page_token?: string;
      };
      for (const p of json.participants ?? []) {
        const name = (p.name ?? "").trim();
        const email = (p.user_email ?? "").trim().toLowerCase();
        if (!name && !email) continue;
        out.push({ name, email: email || null });
      }
      nextPageToken = json.next_page_token ?? "";
    } while (nextPageToken);

    if (!failed && out.length > 0) return { participants: out, errors };
  }

  return { participants: [], errors };
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
  /** Set when the run refused to tag anyone. Surfaced on the dashboard. */
  error: string | null;
  meetingUuid: string | null;
  participants: number;
  attended: number;
  noShow: number;
  tagged: number;
  /** Already decided — a manual mark or an earlier run. Left untouched. */
  skipped: number;
  unmatched: string[];
  notes: string[];
};

function emptyZoomAttendance(
  sessionDate: string,
  error: string | null,
  notes: string[] = [],
  meetingUuid: string | null = null,
): ZoomAttendanceResult {
  return {
    sessionDate,
    error,
    meetingUuid,
    participants: 0,
    attended: 0,
    noShow: 0,
    tagged: 0,
    skipped: 0,
    unmatched: [],
    notes,
  };
}

/**
 * Take attendance for one class from Zoom and push the outcome tags.
 *
 * Safety rails, in the order they bind:
 *
 *  a. No participants, or every Zoom call failed → tag NOBODY, record the
 *     reason on the session, return. The job tags every registrant one way or
 *     the other, so an API hiccup must never mass-tag a full room as no-shows.
 *  b. A registrant who already has a row for this session is skipped whole —
 *     manual marks win, and that is also what makes a second run a no-op.
 *  c. Only rows this run actually wrote get tagged, so re-running never
 *     double-tags.
 *  d. Only people who were registered when the class ran are considered; a
 *     Thursday signup is not a no-show for Tuesday.
 */
export async function syncZoomAttendance(
  sessionDate: string = currentClassDate(),
): Promise<ZoomAttendanceResult> {
  const notes: string[] = [];
  const supabase = createServiceClient();

  // ── Find the class meeting for that date ────────────────────────────────
  // `meetings` holds two rows per Zoom meeting: one written by zoomSync
  // (source_id = the Zoom UUID, attendees empty) and one from Read.ai
  // (source_id = a GUID, attendees populated). Both are wanted — the first
  // for the UUID the participant API needs, the second for its names.
  // Pre-existing duplication, deliberately read around rather than fixed here.
  const dayStart = new Date(`${sessionDate}T00:00:00Z`);
  const { data: meetingRows } = await supabase
    .from("meetings")
    .select("title, source, source_id, scheduled_at, attendees")
    .eq("org_id", CREAIT_ORG_ID)
    .gte("scheduled_at", new Date(dayStart.getTime() - 86_400_000).toISOString())
    .lte("scheduled_at", new Date(dayStart.getTime() + 2 * 86_400_000).toISOString());

  const classRows = ((meetingRows as
    | {
        title: string | null;
        source: string | null;
        source_id: string | null;
        scheduled_at: string | null;
        attendees: unknown;
      }[]
    | null) ?? []).filter(
    (m) =>
      m.scheduled_at &&
      easternDay(m.scheduled_at) === sessionDate &&
      isClassTitle(m.title ?? ""),
  );

  if (classRows.length === 0) {
    const error = `No AI Tuesday meeting found in the meeting record for ${sessionDate}. Nobody was tagged.`;
    // Only record the refusal once the class has actually happened. Running on
    // a Tuesday morning legitimately finds nothing yet, and writing an error
    // then would put a red banner on the page every week before class.
    if (Date.parse(`${sessionDate}T23:59:59Z`) < Date.now()) {
      await writeSessionSyncState(supabase, sessionDate, {
        zoom_participant_count: 0,
        zoom_participants: [],
        zoom_unmatched: [],
        zoom_error: error,
      });
    }
    return emptyZoomAttendance(sessionDate, error);
  }

  // Both rows carry source='zoom', so "the one from zoomSync" is not a field
  // you can filter on — you have to read the id itself. A real Zoom meeting
  // UUID is base64 (`G9+XdEn7TJyT9JlhQ38jyQ==`); the Read.ai row's id is a
  // canonical GUID, which the participant API answers 404 for. Try the
  // base64-looking ones first, then anything else, so a schema surprise
  // degrades to the name fallback instead of silently skipping the emails.
  const candidateUuids = classRows
    .map((m) => m.source_id)
    .filter((id): id is string => Boolean(id))
    .sort((a, b) => Number(isGuid(a)) - Number(isGuid(b)));

  // ── Gather participants ─────────────────────────────────────────────────
  const byKey = new Map<string, ZoomParticipant>();
  let meetingUuid: string | null = candidateUuids[0] ?? null;

  if (candidateUuids.length > 0) {
    try {
      const token = await zoomToken();
      for (const uuid of candidateUuids) {
        const { participants, errors } = await fetchParticipants(token, uuid);
        notes.push(...errors);
        if (participants.length === 0) continue;
        meetingUuid = uuid;
        for (const p of participants) {
          const key = p.email ?? normalizeName(p.name);
          if (key) byKey.set(key, p);
        }
        break;
      }
    } catch (err) {
      notes.push(err instanceof Error ? err.message : String(err));
    }
  } else {
    notes.push("No Zoom meeting id on record — falling back to stored names.");
  }

  const emailCount = [...byKey.values()].filter((p) => p.email).length;

  // Second pass: display names already stored on the meeting rows.
  for (const row of classRows) {
    const names = Array.isArray(row.attendees) ? row.attendees : [];
    for (const raw of names) {
      if (typeof raw !== "string") continue;
      const key = normalizeName(raw);
      if (key && !byKey.has(key)) byKey.set(key, { name: raw, email: null });
    }
  }

  const participants = [...byKey.values()].filter((p) => !isNonAttendee(p.name));

  if (participants.length === 0) {
    const error =
      notes.length > 0
        ? `Zoom returned no usable participant list. Nobody was tagged. ${notes[0]}`
        : "Zoom reported no participants for this class. Nobody was tagged.";
    await writeSessionSyncState(supabase, sessionDate, {
      zoom_meeting_uuid: meetingUuid,
      zoom_participant_count: 0,
      zoom_participants: [],
      zoom_unmatched: [],
      zoom_error: error,
    });
    return emptyZoomAttendance(sessionDate, error, notes, meetingUuid);
  }

  if (emailCount === 0) {
    notes.push(
      "Zoom supplied no email addresses — matching fell back to display names only. Check the Zoom app's participant-report scope.",
    );
  }

  // ── Match against the registration list ─────────────────────────────────
  const sessionId = await ensureSessionRow(supabase, sessionDate);
  if (!sessionId) {
    return emptyZoomAttendance(
      sessionDate,
      "Could not create the session row; nobody was tagged.",
      notes,
      meetingUuid,
    );
  }

  const cutoff = new Date(dayStart.getTime() + 86_400_000).toISOString();
  const [{ data: regRows }, { data: markRows }] = await Promise.all([
    supabase
      .from("cc_class_registrations")
      .select("id, first_name, last_name, email, ghl_contact_id, created_at")
      .eq("org_id", CREAIT_ORG_ID)
      .lt("created_at", cutoff),
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
  const decided = new Set(
    ((markRows as Pick<CcClassAttendance, "registration_id">[] | null) ?? [])
      .map((m) => m.registration_id)
      .filter((id): id is string => Boolean(id)),
  );

  const participantEmails = new Set(
    participants.map((p) => p.email).filter((e): e is string => Boolean(e)),
  );
  const participantNames = new Map(
    participants.map((p) => [normalizeName(p.name), p.name]),
  );
  const claimedNames = new Set<string>();

  const pending = registrations.filter((r) => !decided.has(r.id));
  const rows: {
    registration: (typeof registrations)[number];
    attended: boolean;
  }[] = pending.map((r) => {
    const email = r.email.trim().toLowerCase();
    if (participantEmails.has(email)) {
      // Consume the name too, so an email match doesn't leave the same person
      // sitting in the "couldn't match these" queue.
      claimedNames.add(normalizeName(`${r.first_name} ${r.last_name}`));
      return { registration: r, attended: true };
    }
    const fullName = normalizeName(`${r.first_name} ${r.last_name}`);
    if (fullName && participantNames.has(fullName)) {
      claimedNames.add(fullName);
      return { registration: r, attended: true };
    }
    return { registration: r, attended: false };
  });

  let inserted = 0;
  if (rows.length > 0) {
    const { error } = await supabase.from("cc_class_attendance").insert(
      rows.map((r) => ({
        session_id: sessionId,
        registration_id: r.registration.id,
        email: r.registration.email,
        attended: r.attended,
        source: "zoom" as const,
      })),
    );
    if (error) {
      const message = `Attendance write failed: ${error.message}. Nobody was tagged.`;
      await writeSessionSyncState(supabase, sessionDate, {
        zoom_meeting_uuid: meetingUuid,
        zoom_participant_count: participants.length,
        zoom_participants: participants,
        zoom_unmatched: [],
        zoom_error: message,
      });
      return emptyZoomAttendance(sessionDate, message, notes, meetingUuid);
    }
    inserted = rows.length;
  }

  // ── Tag, for the rows this run wrote ────────────────────────────────────
  let tagged = 0;
  for (const row of rows) {
    const person = row.registration;
    const tag = row.attended ? CLASS_TAGS.attended : CLASS_TAGS.missed;
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
    const res = await addContactTags(contactId, [tag]);
    if (res.ok) tagged += 1;
    else notes.push(`GHL tag failed for ${person.email}: ${res.error}`);
  }

  const unmatched = [...participantNames.entries()]
    .filter(([key]) => !claimedNames.has(key))
    .map(([, display]) => display)
    .sort((a, b) => a.localeCompare(b));

  await writeSessionSyncState(supabase, sessionDate, {
    zoom_meeting_uuid: meetingUuid,
    zoom_participant_count: participants.length,
    zoom_participants: participants,
    zoom_unmatched: unmatched,
    zoom_error: null,
  });

  return {
    sessionDate,
    error: null,
    meetingUuid,
    participants: participants.length,
    attended: rows.filter((r) => r.attended).length,
    noShow: rows.filter((r) => !r.attended).length,
    tagged,
    skipped: registrations.length - inserted,
    unmatched,
    notes,
  };
}

async function ensureSessionRow(
  supabase: ReturnType<typeof createServiceClient>,
  sessionDate: string,
): Promise<string | null> {
  const { data: found } = await supabase
    .from("cc_class_sessions")
    .select("id")
    .eq("org_id", CREAIT_ORG_ID)
    .eq("session_date", sessionDate)
    .maybeSingle();
  if (found) return (found as { id: string }).id;

  const { data } = await supabase
    .from("cc_class_sessions")
    .insert({ org_id: CREAIT_ORG_ID, session_date: sessionDate })
    .select("id")
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

async function writeSessionSyncState(
  supabase: ReturnType<typeof createServiceClient>,
  sessionDate: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await ensureSessionRow(supabase, sessionDate);
  await supabase
    .from("cc_class_sessions")
    .update({ ...patch, zoom_synced_at: new Date().toISOString() })
    .eq("org_id", CREAIT_ORG_ID)
    .eq("session_date", sessionDate);
}
