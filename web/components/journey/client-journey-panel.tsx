"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Timeline } from "./timeline";
import { ActivityFeed } from "./activity-feed";
import { NoteDialog } from "./note-dialog";
import { useClientJourneyRealtime } from "./use-client-journey-realtime";
import { rowToProgress, type ClientProgressMap } from "./progress-map";
import {
  fetchClientActivity,
  fetchClientJourney,
  setDeliverableDone,
  type Actor,
} from "@/app/(dashboard)/journey/actions";
import { useActiveOrgId } from "@/lib/use-active-org";
import type {
  CcClient,
  CcClientActivity,
  JourneyDeliverable,
  JourneyMilestone,
} from "@/lib/supabase/types";

interface Props {
  client: CcClient;
  milestones: JourneyMilestone[];
  deliverables: JourneyDeliverable[];
  currentActor: Actor;
}

const ACTIVITY_LIMIT = 25;

/**
 * Everything that belongs to one selected client: progress, the shared
 * activity log, notes, and the realtime subscription that keeps all three in
 * step with the rest of the team.
 *
 * The parent mounts this with `key={client.id}`, so switching clients throws
 * the whole component away rather than clearing six pieces of state by hand —
 * one client's ticks can never flash on another's timeline.
 */
export function ClientJourneyPanel({
  client,
  milestones,
  deliverables,
  currentActor,
}: Props) {
  const orgId = useActiveOrgId();

  const [progress, setProgress] = useState<ClientProgressMap>({});
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [activity, setActivity] = useState<CcClientActivity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  /** `undefined` = closed. `null` = a note about the client as a whole. */
  const [noteTarget, setNoteTarget] = useState<
    JourneyDeliverable | null | undefined
  >(undefined);

  // Guards against a slow response landing after a newer one has already been
  // applied — realtime can fire several refetches in quick succession.
  const progressSeq = useRef(0);
  const activitySeq = useRef(0);

  // Realtime refetches can land mid-toggle. Merging reads the live pending set
  // through a ref so an in-flight optimistic tick is never overwritten by a
  // read that was issued before the write committed.
  const pendingIdsRef = useRef(pendingIds);
  useEffect(() => {
    pendingIdsRef.current = pendingIds;
  }, [pendingIds]);

  const clientId = client.id;

  const deliverableTitles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of deliverables) map[d.id] = d.title;
    return map;
  }, [deliverables]);

  // Deliberately does not flip a loading flag on the way in: realtime fires
  // these on every teammate's write, and flashing the whole timeline back to
  // "loading" each time would make a shared board unusable. Only the first
  // load shows a pending state, via the initial `true`.
  const loadProgress = useCallback(async () => {
    const seq = ++progressSeq.current;
    const result = await fetchClientJourney(clientId);
    if (seq !== progressSeq.current) return; // superseded
    setLoadingProgress(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const fresh: ClientProgressMap = {};
    for (const row of result.data) {
      fresh[row.deliverable_id] = rowToProgress(row);
    }
    setProgress((prev) => {
      const pending = pendingIdsRef.current;
      if (pending.size === 0) return fresh;
      const merged = { ...fresh };
      for (const id of pending) {
        const optimistic = prev[id];
        if (optimistic) merged[id] = optimistic;
        else delete merged[id];
      }
      return merged;
    });
  }, [clientId]);

  const loadActivity = useCallback(async () => {
    const seq = ++activitySeq.current;
    const result = await fetchClientActivity(clientId, ACTIVITY_LIMIT);
    if (seq !== activitySeq.current) return; // superseded
    setLoadingActivity(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setActivity((prev) => {
      // A refetch triggered by our own write can be issued before that write
      // is visible. Anything already in hand that is strictly newer than the
      // newest row the server returned is one of those — keep it rather than
      // letting the entry blink out and back in. Bounded by the comparison,
      // so entries that have genuinely scrolled off the window still leave.
      const newest = result.data[0]?.created_at ?? "";
      const seen = new Set(result.data.map((a) => a.id));
      const ahead = prev.filter(
        (a) => !seen.has(a.id) && a.created_at > newest,
      );
      return ahead.length === 0
        ? result.data
        : [...ahead, ...result.data].slice(0, ACTIVITY_LIMIT);
    });
  }, [clientId]);

  useEffect(() => {
    void loadProgress();
    void loadActivity();
  }, [loadProgress, loadActivity]);

  // Multiplayer: another founder's tick, or a Hermes write, arrives here.
  useClientJourneyRealtime({
    clientId,
    orgId,
    onJourneyChange: () => void loadProgress(),
    onActivityChange: () => void loadActivity(),
  });

  const toggleDeliverable = useCallback(
    async (deliverable: JourneyDeliverable, nextDone: boolean) => {
      const previous = progress[deliverable.id];
      const now = new Date().toISOString();

      // Optimistic update — attributed to whoever is driving this browser, so
      // the stamp doesn't briefly credit the last person who touched the row.
      setProgress((prev) => ({
        ...prev,
        [deliverable.id]: {
          done: nextDone,
          completedAt: nextDone ? now : null,
          notes: previous?.notes ?? null,
          updatedBy: currentActor.id,
          updatedByName: currentActor.name,
          updatedByType: currentActor.type,
          updatedAt: now,
        },
      }));
      setPendingIds((prev) => new Set(prev).add(deliverable.id));

      const result = await setDeliverableDone({
        clientId,
        deliverableId: deliverable.id,
        done: nextDone,
      });

      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(deliverable.id);
        return next;
      });

      if (!result.ok) {
        toast.error(result.error);
        // Roll back to exactly what we had, including "no row at all".
        setProgress((prev) => {
          const next = { ...prev };
          if (previous) next[deliverable.id] = previous;
          else delete next[deliverable.id];
          return next;
        });
        return;
      }

      setProgress((prev) => ({
        ...prev,
        [deliverable.id]: rowToProgress(result.data.journey),
      }));

      // The tick itself landed; only the audit entry didn't. Say so rather
      // than reverting a checkbox the database has already accepted.
      if (result.data.activityError) {
        toast.error(
          `Saved, but the activity log entry failed: ${result.data.activityError}`,
        );
      }

      const entry = result.data.activity;
      if (entry) {
        setActivity((prev) =>
          prev.some((a) => a.id === entry.id)
            ? prev
            : [entry, ...prev].slice(0, ACTIVITY_LIMIT),
        );
      }
    },
    [clientId, progress, currentActor],
  );

  const refreshAfterNote = useCallback(() => {
    void loadProgress();
    void loadActivity();
  }, [loadProgress, loadActivity]);

  // Overall journey completion % for the selected client.
  const doneCount = useMemo(
    () => deliverables.filter((d) => progress[d.id]?.done).length,
    [deliverables, progress],
  );

  const overallPct =
    deliverables.length === 0
      ? 0
      : Math.round((doneCount / deliverables.length) * 100);

  const requiredOutstanding = useMemo(
    () =>
      deliverables.filter((d) => d.required && !progress[d.id]?.done).length,
    [deliverables, progress],
  );

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card/60 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">{client.name}</h2>
            {client.company && client.company !== client.name && (
              <p className="text-xs text-muted-foreground truncate">
                {client.company}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              {doneCount} of {deliverables.length} deliverables done
              {requiredOutstanding > 0 && (
                <> · {requiredOutstanding} required outstanding</>
              )}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold tabular-nums text-[color:var(--color-brand-electric)]">
              {overallPct}%
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              journey complete
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-brand-slate)]/40">
          <div
            className="h-full rounded-full bg-[color:var(--color-brand-electric)] transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <Timeline
            milestones={milestones}
            deliverables={deliverables}
            mode="client"
            clientName={client.name}
            progress={progress}
            loadingProgress={loadingProgress}
            pendingIds={pendingIds}
            onToggleDeliverable={toggleDeliverable}
            onOpenNote={setNoteTarget}
          />
        </div>
        <ActivityFeed
          activity={activity}
          deliverableTitles={deliverableTitles}
          loading={loadingActivity}
          onAddNote={() => setNoteTarget(null)}
        />
      </div>

      {/* Mounted only while open, and keyed by target, so the textarea always
          starts from the note that's actually being edited. */}
      {noteTarget !== undefined && (
        <NoteDialog
          key={noteTarget?.id ?? "client-scoped"}
          clientId={clientId}
          clientName={client.name}
          deliverable={noteTarget}
          initialBody={
            noteTarget ? (progress[noteTarget.id]?.notes ?? "") : ""
          }
          onClose={() => setNoteTarget(undefined)}
          onSaved={refreshAfterNote}
        />
      )}
    </div>
  );
}
