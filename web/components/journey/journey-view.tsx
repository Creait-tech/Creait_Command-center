"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Timeline } from "./timeline";
import { ClientSelector } from "./client-selector";
import { createBrowserClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { toast } from "sonner";
import type {
  JourneyMilestone,
  JourneyDeliverable,
  CcClient,
  CcClientJourney,
} from "@/lib/supabase/types";

interface JourneyViewProps {
  milestones: JourneyMilestone[];
  deliverables: JourneyDeliverable[];
  clients: CcClient[];
}

const VALID_VIEWS = ["template", "client"] as const;
type ValidView = (typeof VALID_VIEWS)[number];

/** Map keyed by deliverable_id → that client's progress row. */
export type ClientProgressMap = Record<string, CcClientJourney>;

function JourneyViewInner({
  milestones,
  deliverables,
  clients,
}: JourneyViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = useActiveOrgId();
  const rawView = searchParams.get("view");
  const activeView: ValidView = (VALID_VIEWS as readonly string[]).includes(
    rawView ?? "",
  )
    ? (rawView as ValidView)
    : "template";

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ClientProgressMap>({});
  const [loadingProgress, setLoadingProgress] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  function setView(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.replace(`/journey?${params.toString()}`, { scroll: false });
  }

  // Load this client's journey rows whenever the selection changes.
  const loadProgress = useCallback(async (clientId: string) => {
    setLoadingProgress(true);
    const supabase = createBrowserClient();
    const { data, error } = await supabase
      .from("cc_client_journey")
      .select("*")
      .eq("client_id", clientId);
    setLoadingProgress(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const rows = (data as CcClientJourney[] | null) ?? [];
    const map: ClientProgressMap = {};
    for (const row of rows) {
      map[row.deliverable_id] = row;
    }
    setProgress(map);
  }, []);

  useEffect(() => {
    if (activeView !== "client" || !selectedClientId) {
      setProgress({});
      return;
    }
    void loadProgress(selectedClientId);
  }, [activeView, selectedClientId, loadProgress]);

  // Realtime: keep this client's progress fresh across tabs/sessions.
  useEffect(() => {
    if (activeView !== "client" || !selectedClientId) return;
    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`cc_client_journey:${selectedClientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cc_client_journey",
          filter: `client_id=eq.${selectedClientId}`,
        },
        () => {
          void loadProgress(selectedClientId);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeView, selectedClientId, loadProgress]);

  // Toggle a deliverable's done state for the selected client via manual upsert.
  const toggleDeliverable = useCallback(
    async (deliverable: JourneyDeliverable, nextDone: boolean) => {
      if (!selectedClientId) return;
      const existing = progress[deliverable.id];
      const completedAt = nextDone ? new Date().toISOString() : null;

      // Optimistic update.
      setProgress((prev) => {
        const base: CcClientJourney =
          prev[deliverable.id] ??
          ({
            id: `optimistic-${deliverable.id}`,
            org_id: orgId,
            client_id: selectedClientId,
            deliverable_id: deliverable.id,
            milestone_id: deliverable.milestone_id,
            done: nextDone,
            completed_at: completedAt,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as CcClientJourney);
        return {
          ...prev,
          [deliverable.id]: {
            ...base,
            done: nextDone,
            completed_at: completedAt,
          },
        };
      });

      const supabase = createBrowserClient();
      if (existing && !existing.id.startsWith("optimistic-")) {
        const { error } = await supabase
          .from("cc_client_journey")
          .update({
            done: nextDone,
            completed_at: completedAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) {
          toast.error(error.message);
          void loadProgress(selectedClientId);
        }
      } else {
        const { error } = await supabase.from("cc_client_journey").insert({
          org_id: orgId,
          client_id: selectedClientId,
          deliverable_id: deliverable.id,
          milestone_id: deliverable.milestone_id,
          done: nextDone,
          completed_at: completedAt,
        });
        if (error) {
          toast.error(error.message);
        }
        void loadProgress(selectedClientId);
      }
    },
    [selectedClientId, progress, orgId, loadProgress],
  );

  // Overall journey completion % for the selected client.
  const overallPct = useMemo(() => {
    if (deliverables.length === 0) return 0;
    const done = deliverables.filter((d) => progress[d.id]?.done).length;
    return Math.round((done / deliverables.length) * 100);
  }, [deliverables, progress]);

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
              journey. Checking a deliverable saves to that client's record.
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
