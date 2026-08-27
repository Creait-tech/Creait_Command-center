"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WinsFeed } from "./wins-feed";
import { Scorecard } from "./scorecard";
import { InitiativesReview } from "./initiatives-review";
import { IdsSection } from "./ids-section";
import type { KpiRow } from "./kpi-meta";
import type { CcKpiWeekly } from "./weekly-types";
import type { AuthoredIdsItem, AuthoredWin, Person } from "@/lib/authorship";
import type { KpiHistory, Initiative } from "@/lib/supabase/types";

interface Level10TabsProps {
  meetingId: string | null;
  wins: AuthoredWin[];
  kpis: KpiRow[];
  kpiWeekly: CcKpiWeekly[];
  kpiHistory: KpiHistory[];
  /** Week starts for the scorecard columns, newest first. Computed server-side
   *  so the server render and the hydrated client agree on "this week". */
  weekStarts: string[];
  people: Person[];
  idsItems: AuthoredIdsItem[];
  initiatives: Initiative[];
}

const VALID_TABS = ["wins", "scoreboard", "initiatives", "ids"] as const;
type ValidTab = (typeof VALID_TABS)[number];

function Level10TabsInner({
  meetingId,
  wins,
  kpis,
  kpiWeekly,
  kpiHistory,
  weekStarts,
  people,
  idsItems,
  initiatives,
}: Level10TabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: ValidTab = (VALID_TABS as readonly string[]).includes(
    rawTab ?? ""
  )
    ? (rawTab as ValidTab)
    : "wins";

  function setTab(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", v);
    router.replace(`/level-10?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => typeof v === "string" && setTab(v)}
      className="w-full"
    >
      <TabsList>
        <TabsTrigger value="wins">Wins</TabsTrigger>
        {/* The URL value stays "scoreboard" so existing links keep working;
            the label is the EOS term the team uses out loud. */}
        <TabsTrigger value="scoreboard">Scorecard</TabsTrigger>
        <TabsTrigger value="initiatives">Initiatives Review</TabsTrigger>
        <TabsTrigger value="ids">IDS</TabsTrigger>
      </TabsList>
      <TabsContent value="wins" className="mt-4">
        <WinsFeed initialWins={wins} meetingId={meetingId} />
      </TabsContent>
      <TabsContent value="scoreboard" className="mt-4">
        <Scorecard
          initialKpis={kpis}
          initialWeekly={kpiWeekly}
          initialHistory={kpiHistory}
          people={people}
          weekStarts={weekStarts}
        />
      </TabsContent>
      <TabsContent value="initiatives" className="mt-4">
        <InitiativesReview initialInitiatives={initiatives} />
      </TabsContent>
      <TabsContent value="ids" className="mt-4">
        <IdsSection initialItems={idsItems} meetingId={meetingId} />
      </TabsContent>
    </Tabs>
  );
}

export function Level10Tabs(props: Level10TabsProps) {
  return (
    <Suspense fallback={null}>
      <Level10TabsInner {...props} />
    </Suspense>
  );
}
