"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Timeline } from "./timeline";
import { ClientSelector } from "./client-selector";
import { fetchClientJourney, setDeliverableDone } from "@/app/(dashboard)/journey/actions";
import { toast } from "sonner";
import type {
  JourneyMilestone,
  JourneyDeliverable,
  CcClient,
} from "@/lib/supabase/types";

interface JourneyViewProps {
  milestones: JourneyMilestone[];
  deliverables: JourneyDeliverable[];
  clients: CcClient[];
}

const VALID_VIEWS = ["template", "client"] as const;
type ValidView = (typeof VALID_VIEWS)[number];

/** The only progress facts the timeline actually renders. */
export interface DeliverableProgress {
  done: boolean;
  completedAt: string | null;
}

/** Map keyed by deliverable_id → that client's progress. */
export type ClientProgressMap = Record<string, DeliverableProgress>;

function JourneyViewInner({
  milestones,
  deliverables,
  clients,
}: JourneyViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawView = searchParams.get("view");
  const activeView: ValidView = (VALID_VIEWS as readonly string[]).includes(
    rawView ?? "",
  )
    ? (rawView as ValidView)
    : "template";

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ClientProgressMap>({});
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // Guards against a slow response for a previously-selected client landing
  // after the operator has already switched to a different one.
  const requestSeq = useRef(0);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  function setView(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.replace(`/journey?${params.toString()}`, { scroll: false });
  }

  const loadProgress = useCallback(async (clientId: string) => {
    const seq = ++requestSeq.current;
    setLoadingProgress(true);
    const result = await fetchClientJourney(clientId);
    if (seq !== requestSeq.current) return; // superseded
    setLoadingProgress(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const map: ClientProgressMap = {};
    for (const row of result.data) {
      map[row.deliverable_id] = {
        done: row.done,
        completedAt: row.completed_at,
      };
    }
    setProgress(map);
  }, []);

  // Load this client's journey rows whenever the selection changes. Progress is
  // cleared first so one client's ticks never flash on another's timeline.
  useEffect(() => {
    requestSeq.current++;
    setProgress({});
    setPendingIds(new Set());
    if (activeView !== "client" || !selectedClientId) return;
    void loadProgress(selectedClientId);
  }, [activeView, selectedClientId, loadProgress]);

  const toggleDeliverable = useCallback(
    async (deliverable: JourneyDeliverable, nextDone: boolean) => {
      if (!selectedClientId) return;

      const previous = progress[deliverable.id];
      const completedAt = nextDone ? new Date().toISOString() : null;

      // Optimistic update.
      setProgress((prev) => ({
        ...prev,
        [deliverable.id]: { done: nextDone, completedAt },
      }));
      setPendingIds((prev) => new Set(prev).add(deliverable.id));

      const result = await setDeliverableDone({
        clientId: selectedClientId,
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
        [deliverable.id]: {
          done: result.data.done,
          completedAt: result.data.completed_at,
        },
      }));
    },
    [selectedClientId, progress],
  );

  // Overall journey completion % for the selected client.
  const overallPct = useMemo(() => {
    if (deliverables.length === 0) return 0;
    const done = deliverables.filter((d) => progress[d.id]?.done).length;
    return Math.round((done / deliverables.length) * 100);
  }, [deliverables, progress]);

  const doneCount = useMemo(
    () => deliverables.filter((d) => progress[d.id]?.done).length,
    [deliverables, progress],
  );

  const requiredOutstanding = useMemo(
    () =>
      deliverables.filter((d) => d.required && !progress[d.id]?.done).length,
    [deliverables, progress],
  );

  return (
    <Tabs
      value={activeView}
      onValueChange={(v) => typeof v === "string" && setView(v)}
      className="w-full"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <TabsList>
          <TabsTrigger value="template">Template View</TabsTrigger>
          <TabsTrigger value="client">By Client</TabsTrigger>
        </TabsList>
        {activeView === "client" && (
          <ClientSelector
            clients={clients}
            value={selectedClientId}
            onChange={setSelectedClientId}
          />
        )}
      </div>

      <TabsContent value="template" className="mt-6">
        <Timeline
          milestones={milestones}
          deliverables={deliverables}
          mode="template"
        />
      </TabsContent>
      <TabsContent value="client" className="mt-6">
        {selectedClient ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-card/60 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">
                    {selectedClient.name}
                  </h2>
                  {selectedClient.company &&
                    selectedClient.company !== selectedClient.name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {selectedClient.company}
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

            <Timeline
              milestones={milestones}
              deliverables={deliverables}
              mode="client"
              clientName={selectedClient.name}
              progress={progress}
              loadingProgress={loadingProgress}
              pendingIds={pendingIds}
              onToggleDeliverable={toggleDeliverable}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <p className="text-sm font-medium">
              Select a client to view progress
            </p>
            <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
              Pick a client to track their progress through the customer
              journey. Checking a deliverable saves to that client&apos;s record.
            </p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

export function JourneyView(props: JourneyViewProps) {
  return (
    <Suspense fallback={null}>
      <JourneyViewInner {...props} />
    </Suspense>
  );
}
