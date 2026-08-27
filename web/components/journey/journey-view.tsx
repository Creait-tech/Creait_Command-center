"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Timeline } from "./timeline";
import { ClientSelector } from "./client-selector";
import { ClientJourneyPanel } from "./client-journey-panel";
import type { Actor } from "@/app/(dashboard)/journey/actions";
import type {
  CcClient,
  JourneyDeliverable,
  JourneyMilestone,
} from "@/lib/supabase/types";

interface JourneyViewProps {
  milestones: JourneyMilestone[];
  deliverables: JourneyDeliverable[];
  clients: CcClient[];
  /** Who this browser is acting as — resolved server-side, see page.tsx. */
  currentActor: Actor;
}

const VALID_VIEWS = ["template", "client"] as const;
type ValidView = (typeof VALID_VIEWS)[number];

function JourneyViewInner({
  milestones,
  deliverables,
  clients,
  currentActor,
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

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  function setView(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.replace(`/journey?${params.toString()}`, { scroll: false });
  }

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
          // Keyed by client: switching resets progress, activity and any open
          // note by unmounting, so one client's state can't bleed into another.
          <ClientJourneyPanel
            key={selectedClient.id}
            client={selectedClient}
            milestones={milestones}
            deliverables={deliverables}
            currentActor={currentActor}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <p className="text-sm font-medium">
              Select a client to view progress
            </p>
            <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
              Pick a client to track their progress through the customer
              journey. Ticks, notes and activity are shared with the whole team
              in real time.
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
