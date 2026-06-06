"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Timeline } from "./timeline";
import { ClientSelector } from "./client-selector";
import type {
  JourneyMilestone,
  JourneyDeliverable,
} from "@/lib/supabase/types";

interface JourneyViewProps {
  milestones: JourneyMilestone[];
  deliverables: JourneyDeliverable[];
}

const VALID_VIEWS = ["template", "client"] as const;
type ValidView = (typeof VALID_VIEWS)[number];

function JourneyViewInner({ milestones, deliverables }: JourneyViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawView = searchParams.get("view");
  const activeView: ValidView = (VALID_VIEWS as readonly string[]).includes(
    rawView ?? "",
  )
    ? (rawView as ValidView)
    : "template";

  const [selectedClient, setSelectedClient] = useState<string | null>(null);

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
            value={selectedClient}
            onChange={setSelectedClient}
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
          <Timeline
            milestones={milestones}
            deliverables={deliverables}
            mode="client"
            clientName={selectedClient}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <p className="text-sm font-medium">Select a client to view progress</p>
            <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto">
              Per-client progress tracking connects to GHL opportunities in
              Phase 4. For now, pick a client to preview the layout.
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
