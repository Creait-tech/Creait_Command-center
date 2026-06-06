"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Skill } from "@/lib/supabase/types";

const MODELS = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-opus-4-7", label: "Claude Opus 4.7" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { value: "gpt-5", label: "GPT-5" },
  { value: "gemini-3-pro", label: "Gemini 3 Pro" },
];

interface Props {
  skill: Skill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updated: Skill) => void;
}

export function EditSkillDialog({ skill, open, onOpenChange, onSuccess }: Props) {
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(skill.system_prompt ?? "");
  const [model, setModel] = useState(skill.preferred_model);
  const [enabled, setEnabled] = useState(skill.enabled);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(skill.name);
      setDescription(skill.description ?? "");
      setSystemPrompt(skill.system_prompt ?? "");
      setModel(skill.preferred_model);
      setEnabled(skill.enabled);
      setErr(null);
    }
  }, [open, skill]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Name required");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          system_prompt: systemPrompt.trim() || null,
          preferred_model: model,
          enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErr(data.error ?? `Failed: ${res.status}`);
      } else {
        toast.success("Skill updated");
        onSuccess(data as Skill);
        onOpenChange(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit: {skill.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-14" disabled={submitting} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">System Prompt</label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-36 font-mono text-xs"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Model</label>
            <Select value={model} onValueChange={(v) => typeof v === "string" && setModel(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Enabled</label>
            <Switch checked={enabled} onCheckedChange={(c) => setEnabled(c === true)} disabled={submitting} />
          </div>
          {err && <p className="text-xs text-[color:var(--color-brand-danger)]">{err}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
