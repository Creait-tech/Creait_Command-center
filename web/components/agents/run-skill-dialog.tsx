"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Skill, Json } from "@/lib/supabase/types";

interface Props {
  skill: Skill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isFlatSchema(v: Json): v is Record<string, string> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && Object.values(v).every((x) => typeof x === "string");
}

export function RunSkillDialog({ skill, open, onOpenChange }: Props) {
  const hasSchema = isFlatSchema(skill.input_schema) && Object.keys(skill.input_schema as Record<string, string>).length > 0;
  const schemaFields = hasSchema ? (skill.input_schema as Record<string, string>) : {};

  const [fields, setFields] = useState<Record<string, string>>(
    Object.fromEntries(Object.keys(schemaFields).map((k) => [k, ""])),
  );
  const [freeText, setFreeText] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFields(Object.fromEntries(Object.keys(schemaFields).map((k) => [k, ""])));
    setFreeText("");
    setOutput(null);
    setError(null);
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  async function handleRun() {
    setRunning(true);
    setError(null);
    setOutput(null);
    const input: Record<string, string> = hasSchema ? fields : freeText.trim() ? { context: freeText.trim() } : {};
    try {
      const res = await fetch("/api/skills/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: skill.id, input }),
      });
      const data = (await res.json()) as { output?: string; error?: string };
      if (!res.ok || data.error) setError(data.error ?? `Failed: ${res.status}`);
      else setOutput(data.output ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Run: {skill.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {hasSchema ? (
            Object.keys(schemaFields).map((key) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground capitalize" htmlFor={`f-${key}`}>
                  {key.replace(/_/g, " ")}
                </label>
                <Input
                  id={`f-${key}`}
                  value={fields[key] ?? ""}
                  onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
                  disabled={running}
                />
              </div>
            ))
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Context (optional)</label>
              <Textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Additional context for this run…"
                className="min-h-20"
                disabled={running}
              />
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-[color:var(--color-brand-danger)]/40 bg-[color:var(--color-brand-danger)]/10 px-3 py-2 text-xs text-[color:var(--color-brand-danger)]">
              {error}
            </div>
          )}
          {output && (
            <ScrollArea className="max-h-96 rounded-lg border border-border bg-muted/30 p-3">
              <div className="prose prose-sm prose-invert max-w-none text-xs">
                <Markdown remarkPlugins={[remarkGfm]}>{output}</Markdown>
              </div>
            </ScrollArea>
          )}
        </div>
        <DialogFooter>
          {output ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Close</Button>
              <Button onClick={handleRun} disabled={running}>{running ? "Running…" : "Run Again"}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={running}>Cancel</Button>
              <Button onClick={handleRun} disabled={running}>{running ? "Running…" : "Run"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
