"use client";

import { useState, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { ModelSelector, useSelectedModel } from "@/components/dashboard/model-selector";
import type { ResearchBriefing } from "@/lib/supabase/types";

interface Props {
  archive: ResearchBriefing[];
}

export function DeepResearchTab({ archive }: Props) {
  const orgId = useActiveOrgId();
  const [topic, setTopic] = useState("");
  const [model] = useSelectedModel();
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [skillId, setSkillId] = useState<string | null>(null);
  const [recent, setRecent] = useState<ResearchBriefing[]>(archive);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("skills")
      .select("id")
      .or("name.eq.Deep Research,name.eq.Research Topic")
      .eq("org_id", orgId)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setSkillId((data[0] as { id: string }).id);
      });
  }, [orgId]);

  async function handleRun() {
    if (!topic.trim() || !skillId) return;
    setRunning(true);
    setOutput(null);
    try {
      const res = await fetch("/api/skills/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId, input: { topic: topic.trim(), model } }),
      });
      const json = (await res.json()) as { output?: string; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Failed");
      setOutput(json.output ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setRunning(false);
    }
  }

  async function handleSave() {
    if (!output) return;
    const supabase = createClient();
    const title = topic.slice(0, 60) || output.split("\n")[0]?.slice(0, 60) || "Untitled research";
    const { data, error } = await supabase
      .from("research_briefings")
      .insert({
        org_id: orgId,
        title,
        briefing_type: "deep_research",
        content: output,
        generated_by: "manual",
        briefing_date: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) setRecent((prev) => [data as ResearchBriefing, ...prev].slice(0, 5));
    toast.success("Saved to Archive");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Textarea
            placeholder="What do you want to research? e.g. &quot;What are the latest changes in GoHighLevel for AI agencies?&quot;"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="min-h-24"
            disabled={running}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Model:</span>
              <ModelSelector />
            </div>
            <Button onClick={handleRun} disabled={!topic.trim() || running || !skillId}>
              <Sparkles className="size-4" />
              {running ? "Researching…" : "Run Deep Research"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {output && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Findings</h3>
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="size-3.5" />
                Save to Archive
              </Button>
            </div>
            <div className="prose prose-sm prose-invert max-w-none">
              <Markdown remarkPlugins={[remarkGfm]}>{output}</Markdown>
            </div>
          </CardContent>
        </Card>
      )}

      {recent.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Deep Research</h3>
          <div className="space-y-2">
            {recent.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-4">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
