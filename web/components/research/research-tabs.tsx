"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TodaysBriefingTab } from "./todays-briefing-tab";
import { DeepResearchTab } from "./deep-research-tab";
import { TechWatchTab } from "./tech-watch-tab";
import { ArchiveTab } from "./archive-tab";
import type { ResearchBriefing, Competitor, TechWatchItem } from "@/lib/supabase/types";

interface ResearchTabsProps {
  todayBriefing: ResearchBriefing | null;
  archive: ResearchBriefing[];
  competitors: Competitor[];
  watchItems: TechWatchItem[];
}

const VALID_TABS = ["briefing", "deep", "tech", "archive"] as const;
type ValidTab = (typeof VALID_TABS)[number];

function ResearchTabsInner(props: ResearchTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: ValidTab = (VALID_TABS as readonly string[]).includes(rawTab ?? "")
    ? (rawTab as ValidTab)
    : "briefing";

  function setTab(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", v);
    router.replace(`/research?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => typeof v === "string" && setTab(v)} className="w-full">
      <TabsList>
        <TabsTrigger value="briefing">Today's Briefing</TabsTrigger>
        <TabsTrigger value="deep">Deep Research</TabsTrigger>
        <TabsTrigger value="tech">Tech Watch</TabsTrigger>
        <TabsTrigger value="archive">Archive</TabsTrigger>
      </TabsList>
      <TabsContent value="briefing" className="mt-4">
        <TodaysBriefingTab initialBriefing={props.todayBriefing} />
      </TabsContent>
      <TabsContent value="deep" className="mt-4">
        <DeepResearchTab archive={props.archive.filter((b) => b.briefing_type === "deep_research").slice(0, 5)} />
      </TabsContent>
      <TabsContent value="tech" className="mt-4">
        <TechWatchTab initialCompetitors={props.competitors} initialItems={props.watchItems} />
      </TabsContent>
      <TabsContent value="archive" className="mt-4">
        <ArchiveTab initialArchive={props.archive} />
      </TabsContent>
    </Tabs>
  );
}

export function ResearchTabs(props: ResearchTabsProps) {
  return (
    <Suspense fallback={null}>
      <ResearchTabsInner {...props} />
    </Suspense>
  );
}
