"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VisionDocument } from "./vision-document";
import { VtoBuilder } from "./vto-builder";
import type { Strategy, Rock, IdsItem } from "@/lib/supabase/types";

const VALID = ["document", "vto"] as const;
type Valid = (typeof VALID)[number];

interface Props {
  strategy: Strategy | null;
  rocks: Rock[];
  issues: IdsItem[];
  quarter: string;
}

function VisionTabsInner({ strategy, rocks, issues, quarter }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("view");
  const active: Valid = (VALID as readonly string[]).includes(raw ?? "")
    ? (raw as Valid)
    : "vto";

  function setTab(v: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", v);
    router.replace(`/vision?${p.toString()}`, { scroll: false });
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Vision</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The EOS Vision/Traction Organizer — and the longer-form vision document.
        </p>
      </div>
      <Tabs value={active} onValueChange={(v) => typeof v === "string" && setTab(v)}>
        <TabsList>
          <TabsTrigger value="vto">V/TO Builder (EOS)</TabsTrigger>
          <TabsTrigger value="document">Vision Document</TabsTrigger>
        </TabsList>
        <TabsContent value="vto" className="mt-4">
          <VtoBuilder strategy={strategy} rocks={rocks} issues={issues} quarter={quarter} />
        </TabsContent>
        <TabsContent value="document" className="mt-4">
          <VisionDocument strategy={strategy} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function VisionTabs(props: Props) {
  return (
    <Suspense fallback={null}>
      <VisionTabsInner {...props} />
    </Suspense>
  );
}
