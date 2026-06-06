"use client";

import { useState, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type { ResearchBriefing } from "@/lib/supabase/types";

const FAKE_STEPS = [
  "Searching AI news…",
  "Checking competitor moves…",
  "Scanning Reddit + LinkedIn…",
  "Trending YouTube videos…",
  "Market signals + funding…",
];

interface Props {
  initialBriefing: ResearchBriefing | null;
}

export function TodaysBriefingTab({ initialBriefing }: Props) {
  const [briefing, setBriefing] = useState<ResearchBriefing | null>(initialBriefing);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [skillId, setSkillId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("skills")
      .select("id")
      .or("name.eq.Daily Intelligence Briefing,name.eq.Daily Briefing")
      .eq("org_id", "creait")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setSkillId((data[0] as { id: string }).id);
      });
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setStep((s) => (s + 1) % FAKE_STEPS.length), 2500);
    return () => clearInterval(id);
  }, [running]);

  async function handleGenerate() {
    if (!skillId) {
      toast.error("Daily Briefing skill not found");
      return;
    }
    setRunning(true);
    setStep(0);
    try {
      const res = await fetch("/api/skills/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId, input: { date: new Date().toISOString().slice(0, 10) } }),
      });
      const json = (await res.json()) as { output?: string; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Skill run failed");
      // Refetch today's briefing
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("research_briefings")
        .select("*")
        .eq("org_id", "creait")
        .eq("briefing_type", "daily")
        .eq("briefing_date", today)
        .order("created_at", { ascending: false })
        .limit(1);
      const fresh = ((data as ResearchBriefing[] | null) ?? [])[0];
      if (fresh) {
        setBriefing(fresh);
        toast.success("Briefing generated");
      } else {
        // Skill ran but didn't persist a briefing row — show raw output as ephemeral display
        setBriefing({
          id: "ephemeral",
          org_id: "creait",
          title: "Today's Briefing",
          briefing_type: "daily",
          content: json.output ?? "",
          sources: [],
          generated_by: "manual",
          briefing_date: today,
          created_at: new Date().toISOString(),
        });
        toast.info("Generated (display-only — persist hook ships Phase 3)");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setRunning(false);
    }
  }

  if (running) {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col items-center gap-3">
          <div className="size-12 rounded-full bg-[color:var(--color-brand-electric)]/20 flex items-center justify-center">
            <Sparkles className="size-6 text-[color:var(--color-brand-electric)] animate-pulse" />
          </div>
          <p className="text-sm font-medium">Researching the world today…</p>
          <p className="text-xs text-muted-foreground">{FAKE_STEPS[step]}</p>
        </CardContent>
      </Card>
    );
  }

  if (!briefing) {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
          <p className="text-sm font-medium">No briefing for today yet</p>
          <p className="text-xs text-muted-foreground max-w-md">
            Generate AI + industry news, competitor moves, community discussions, YouTube trends, and market signals.
          </p>
          <Button onClick={handleGenerate} disabled={!skillId}>
            <Sparkles className="size-4" />
            Generate Today's Briefing
          </Button>
          {!skillId && (
            <p className="text-xs text-muted-foreground italic">Loading skill…</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{briefing.title}</h2>
            <p className="text-xs text-muted-foreground">
              {new Date(briefing.created_at).toLocaleString()}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleGenerate}>
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
        </div>
        <div className="prose prose-sm prose-invert max-w-none">
          <Markdown remarkPlugins={[remarkGfm]}>{briefing.content}</Markdown>
        </div>
      </CardContent>
    </Card>
  );
}
