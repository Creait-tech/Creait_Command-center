import Link from "next/link";
import { Brain, ExternalLink, FileText, Search, Video } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import type { Meeting } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * The War Room — the company brain.
 *
 * One searchable timeline over every meeting the org has held: Zoom
 * backfill, Read.ai deliveries, and Level 10s. Search hits look inside
 * full transcripts and show the matching line in context. `?open=<id>`
 * renders one meeting's complete transcript inline (server-rendered, no
 * client JS) so nothing heavy loads until asked for.
 *
 * Calendar, Drive, and Gmail layers land here next — same timeline,
 * more sources.
 */

const TYPE_FILTERS = [
  { key: "all", label: "Everything" },
  { key: "client", label: "Client calls" },
  { key: "internal", label: "Internal" },
  { key: "level_10", label: "Level 10s" },
  { key: "other", label: "Events & classes" },
] as const;

const LIST_COLUMNS =
  "id, title, meeting_type, scheduled_at, duration_minutes, attendees, source, recording_url, summary";

type SearchHit = Meeting & { snippet?: string };

function snippetAround(text: string, q: string, radius = 130): string | undefined {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return undefined;
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "undated";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthKey(iso: string | null): string {
  if (!iso) return "Undated";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function WarRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; open?: string }>;
}) {
  const { q = "", type = "all", open } = await searchParams;
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  let query = supabase
    .from("meetings")
    .select(q ? `${LIST_COLUMNS}, transcript` : LIST_COLUMNS)
    .eq("org_id", orgId)
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .limit(q ? 40 : 200);

  if (type !== "all") {
    query = query.eq("meeting_type", type as NonNullable<Meeting["meeting_type"]>);
  }
  if (q) {
    const term = q.replace(/[%_,()]/g, " ").trim();
    query = query.or(
      `title.ilike.%${term}%,summary.ilike.%${term}%,transcript.ilike.%${term}%`,
    );
  }

  const { data } = await query;
  const meetings: SearchHit[] = ((data as unknown as Meeting[] | null) ?? []).map((m) => ({
    ...m,
    snippet:
      q && m.transcript ? snippetAround(m.transcript, q) : undefined,
  }));

  // Full transcript for at most one meeting, only when asked.
  let opened: Meeting | null = null;
  if (open) {
    const { data: row } = await supabase
      .from("meetings")
      .select("*")
      .eq("org_id", orgId)
      .eq("id", open)
      .single();
    opened = (row as Meeting | null) ?? null;
  }

  const withTranscript = meetings.filter((m) => q === "" || m.snippet || m.transcript !== undefined).length;
  const grouped = new Map<string, SearchHit[]>();
  for (const m of meetings) {
    const key = monthKey(m.scheduled_at);
    grouped.set(key, [...(grouped.get(key) ?? []), m]);
  }

  const params = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = { q, type, ...overrides };
    if (merged.q) p.set("q", merged.q);
    if (merged.type && merged.type !== "all") p.set("type", merged.type);
    if (merged.open) p.set("open", merged.open);
    const s = p.toString();
    return s ? `/war-room?${s}` : "/war-room";
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="size-6 text-primary" /> War Room
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          The company brain. Every meeting, searchable down to the word that
          was said. Calendar, Drive, and email land here next.
        </p>
      </div>

      <form action="/war-room" method="get" className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder='Search everything — try "Franklin", "snapshot", "diagnostic"…'
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {type !== "all" && <input type="hidden" name="type" value={type} />}
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={params({ type: f.key, open: undefined })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              type === f.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
        <span className="ml-auto self-center text-xs text-muted-foreground tabular-nums">
          {meetings.length} {q ? "matches" : "meetings"}
        </span>
      </div>

      {opened && (
        <div className="rounded-lg border border-primary/40 bg-card">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-4">
            <div>
              <h2 className="font-semibold">{opened.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fmtDate(opened.scheduled_at)}
                {opened.duration_minutes ? ` · ${opened.duration_minutes} min` : ""}
                {Array.isArray(opened.attendees) && opened.attendees.length > 0
                  ? ` · ${(opened.attendees as string[]).join(", ")}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {opened.recording_url && (
                <a
                  href={opened.recording_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Video className="size-3.5" /> Recording
                </a>
              )}
              <Link href={params({ open: undefined })} className="text-muted-foreground hover:text-foreground">
                Close
              </Link>
            </div>
          </div>
          {opened.summary && (
            <div className="border-b border-border p-4 text-sm whitespace-pre-wrap">{opened.summary}</div>
          )}
          {opened.transcript ? (
            <div className="max-h-[32rem] overflow-y-auto p-4 text-[13px] leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">
              {opened.transcript}
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              No transcript stored for this meeting yet.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {meetings.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {q ? `Nothing in the brain matches “${q}” yet.` : "No meetings yet."}
          </p>
        )}
        {[...grouped.entries()].map(([month, rows]) => (
          <section key={month}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {month}
            </h3>
            <div className="overflow-hidden rounded-lg border border-border divide-y divide-border">
              {rows.map((m) => (
                <div key={m.id} className="flex flex-col gap-1 bg-card p-3.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link
                      href={params({ open: m.id })}
                      className="font-medium text-sm hover:text-primary"
                    >
                      {m.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">{fmtDate(m.scheduled_at)}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {m.meeting_type?.replace(/_/g, " ")}
                    </span>
                    <span className="ml-auto flex items-center gap-2 text-muted-foreground">
                      {(m.snippet !== undefined || q === "") && m.source === "zoom" && (
                        <FileText className="size-3.5" aria-label="Transcript-capable" />
                      )}
                      {m.recording_url && (
                        <a
                          href={m.recording_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label="Open recording"
                          className="hover:text-primary"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </span>
                  </div>
                  {m.snippet && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      <span className="font-mono">{m.snippet}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
