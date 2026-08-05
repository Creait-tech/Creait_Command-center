import { createServiceClient } from "@/lib/supabase/server";
import { CREAIT_ORG_ID } from "@/lib/active-org";

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
