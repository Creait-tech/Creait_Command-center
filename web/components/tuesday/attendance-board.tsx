"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  RefreshCw,
  Search,
  TriangleAlert,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveAttendance, type AttendanceMark } from "@/lib/class-actions";
import type { CcClassRegistration } from "@/lib/supabase/types";

type InitialMark = {
  registrationId: string | null;
  attended: boolean;
  source: string;
};

export type SyncState = {
  syncedAt: string | null;
  participantCount: number | null;
  unmatched: string[];
  error: string | null;
};

type Props = {
  sessionDate: string;
  sessionLabel: string;
  topic: string | null;
  registrations: CcClassRegistration[];
  initialMarks: InitialMark[];
  sync: SyncState;
};

/** `undefined` is "not yet decided" and is the state that never tags anyone. */
type Decision = boolean | undefined;

/**
 * The attendance override.
 *
 * Zoom takes attendance automatically the morning after class; this list is
 * where a human corrects it. So the sync's own report leads — when it ran,
 * how many people Zoom saw, and which Zoom names matched nobody — and the
 * rows below it are the fix-by-hand queue.
 *
 * Nothing reaches GHL until Save, and anyone left undecided is left alone:
 * the tag they would otherwise get says "we missed you" to somebody who was
 * there.
 */
export function AttendanceBoard({
  sessionDate,
  sessionLabel,
  topic,
  registrations,
  initialMarks,
  sync,
}: Props) {
  const initial = useMemo(() => {
    const map: Record<string, Decision> = {};
    for (const m of initialMarks) {
      if (m.registrationId) map[m.registrationId] = m.attended;
    }
    return map;
  }, [initialMarks]);

  const [decisions, setDecisions] = useState<Record<string, Decision>>(initial);
  const [query, setQuery] = useState("");
  const [failures, setFailures] = useState<
    { name: string; email: string; reason: string }[]
  >([]);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registrations;
    return registrations.filter((r) =>
      [r.first_name, r.last_name, r.email, r.business_name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [registrations, query]);

  const attended = registrations.filter((r) => decisions[r.id] === true).length;
  const noShow = registrations.filter((r) => decisions[r.id] === false).length;
  const unmarked = registrations.length - attended - noShow;
  const dirty = useMemo(
    () =>
      registrations.some((r) => (decisions[r.id] ?? null) !== (initial[r.id] ?? null)),
    [registrations, decisions, initial],
  );

  function set(id: string, value: boolean) {
    setDecisions((prev) => ({
      ...prev,
      // Tapping the active choice clears it back to undecided — the only way
      // to un-say something you got wrong.
      [id]: prev[id] === value ? undefined : value,
    }));
  }

  function markRestAsNoShow() {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const r of registrations) {
        if (next[r.id] === undefined) next[r.id] = false;
      }
      return next;
    });
  }

  function save() {
    const marks: AttendanceMark[] = registrations
      .filter((r) => (decisions[r.id] ?? null) !== (initial[r.id] ?? null))
      .map((r) => ({
        registrationId: r.id,
        attended: decisions[r.id] === undefined ? null : decisions[r.id]!,
      }));

    if (marks.length === 0) {
      toast.info("Nothing changed since the last save.");
      return;
    }

    startTransition(async () => {
      const res = await saveAttendance(sessionDate, marks);
      if (!res.ok) {
        setFailures([]);
        toast.error(res.error);
        return;
      }
      const data = res.data!;
      setFailures(data.failures);
      if (data.failures.length > 0) {
        toast.warning(
          `Attendance saved. ${data.failures.length} contact${
            data.failures.length === 1 ? "" : "s"
          } didn't reach GHL — details below.`,
        );
      } else {
        toast.success(
          `Saved. ${data.tagged} tag${data.tagged === 1 ? "" : "s"} pushed to GHL.`,
        );
      }
    });
  }

  if (registrations.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium">Nobody has registered yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The check-off list fills itself from{" "}
            <a className="text-primary underline underline-offset-4" href="/tuesday">
              /tuesday
            </a>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <SyncReport sync={sync} />

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{sessionLabel}</h2>
            <p className="text-sm text-muted-foreground">
              {topic ? topic : "This week's class"} · {registrations.length} on the
              list
            </p>
          </div>
          <p className="text-sm tabular-nums text-muted-foreground">
            <span className="font-semibold text-brand-success">{attended} here</span>
            {" · "}
            <span className="font-semibold text-brand-warning">{noShow} no-show</span>
            {" · "}
            <span className="font-semibold text-foreground">{unmarked} unmarked</span>
          </p>
        </div>

        {registrations.length > 8 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find someone"
              className="pl-9"
              aria-label="Find someone on the list"
            />
          </div>
        )}

        <ul className="divide-y divide-border rounded-md border border-border">
          {filtered.map((r) => {
            const decision = decisions[r.id];
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {r.first_name} {r.last_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.business_name ? `${r.business_name} · ` : ""}
                    {r.email}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="lg"
                    variant={decision === true ? "default" : "outline"}
                    aria-pressed={decision === true}
                    onClick={() => set(r.id, true)}
                    className={cn(
                      "min-w-24",
                      decision === true &&
                        "bg-brand-success text-brand-ink hover:bg-brand-success/85",
                    )}
                  >
                    <Check /> Here
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant={decision === false ? "default" : "outline"}
                    aria-pressed={decision === false}
                    onClick={() => set(r.id, false)}
                    className={cn(
                      "min-w-24",
                      decision === false &&
                        "bg-brand-warning text-brand-ink hover:bg-brand-warning/85",
                    )}
                  >
                    <UserX /> No-show
                  </Button>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">
              Nobody matches “{query}”.
            </li>
          )}
        </ul>

        {failures.length > 0 && (
          <div className="rounded-md border border-brand-warning/50 bg-brand-warning/10 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <TriangleAlert className="size-4 text-brand-warning" />
              Attendance is saved — these tags didn&apos;t reach GHL
            </p>
            <ul className="mt-2 flex flex-col gap-1.5 text-xs text-muted-foreground">
              {failures.map((f) => (
                <li key={f.email}>
                  <span className="font-medium text-foreground">{f.name}</span> (
                  {f.email}) — {f.reason}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Their follow-up sequence won&apos;t fire. Tag them by hand in GHL, or
              fix the contact and press Save again.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button size="lg" onClick={save} disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save attendance"}
          </Button>
          {unmarked > 0 && (
            <Button size="lg" variant="outline" onClick={markRestAsNoShow}>
              Mark the other {unmarked} as no-show
            </Button>
          )}
          <p className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">
            Saving adds <code className="font-data">attended-tuesday</code> or{" "}
            <code className="font-data">missed-tuesday</code> in GHL. Anyone left
            unmarked is left alone. A mark you make here outranks the Zoom sync
            and is never overwritten by it.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * What the automatic sync did, in the three states that matter to a founder:
 * it hasn't run, it refused to run, or it ran and here is what it saw.
 *
 * The refusal state is deliberately loud. When Zoom returns nothing the job
 * tags nobody, which means a full room silently stays untagged — the only way
 * that gets noticed is if the page says so.
 */
function SyncReport({ sync }: { sync: SyncState }) {
  if (sync.error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <TriangleAlert className="size-4 text-destructive" />
          Automatic attendance did not run — nobody was tagged
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">{sync.error}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Mark the list below by hand, or fix the cause and re-run{" "}
          <code className="font-data">/api/cron/zoom-attendance</code>.
        </p>
      </div>
    );
  }

  if (!sync.syncedAt) {
    return (
      <div className="rounded-md border border-border bg-secondary/40 p-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <RefreshCw className="size-4 text-muted-foreground" />
          Waiting on the Zoom sync
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Attendance is taken automatically on Wednesday morning, after the
          recording lands. Marking anyone below before then still works and
          still wins.
        </p>
      </div>
    );
  }

  const when = new Date(sync.syncedAt).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="rounded-md border border-border bg-secondary/40 p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Check className="size-4 text-brand-success" />
        Attendance taken from Zoom · {when} ET
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Zoom reported {sync.participantCount ?? 0} participant
        {sync.participantCount === 1 ? "" : "s"} (hosts and notetaker bots
        excluded). Everyone on the list was tagged either way.
      </p>
      {sync.unmatched.length > 0 && (
        <div className="mt-2.5 border-t border-border pt-2.5">
          <p className="text-xs font-medium">
            {sync.unmatched.length} Zoom name
            {sync.unmatched.length === 1 ? "" : "s"} matched nobody on the list
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sync.unmatched.join(" · ")}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            They joined under a name we can&apos;t tie to a registration — mark
            them Here below if you recognise them.
          </p>
        </div>
      )}
    </div>
  );
}
