"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MODELS } from "@/components/dashboard/model-selector";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type { WorkspaceProject } from "@/lib/supabase/types";

interface Props {
  project: WorkspaceProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (project: WorkspaceProject) => void;
}

const EMOJI_OPTIONS = ["💬", "🎯", "📊", "🚀", "💡", "🏠", "🛠️", "📞", "💰", "📈", "🎨", "🧠", "🤖", "🏆"];

export function ProjectSettingsDialog({ project, open, onOpenChange, onUpdated }: Props) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(project.system_prompt ?? "");
  const [model, setModel] = useState(project.preferred_model);
  const [emoji, setEmoji] = useState(project.emoji ?? "💬");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? "");
      setSystemPrompt(project.system_prompt ?? "");
      setModel(project.preferred_model);
      setEmoji(project.emoji ?? "💬");
    }
  }, [open, project]);

  async function save() {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cc_workspace_projects")
      .update({
        name: name.trim(),
        description: description.trim() || null,
        system_prompt: systemPrompt.trim() || null,
        preferred_model: model,
        emoji,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id)
      .select()
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      toast.success("Project updated");
      onUpdated(data as WorkspaceProject);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Emoji</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`size-8 rounded text-lg flex items-center justify-center border transition-colors ${
                    emoji === e ? "border-[color:var(--color-brand-electric)] bg-[color:var(--color-brand-electric)]/15" : "border-border hover:border-[color:var(--color-brand-electric)]/40"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One-line summary of what this project is for"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">System prompt (per-project context)</label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="min-h-32 font-mono text-xs"
              placeholder={"e.g. 'You're helping Maurice draft cold outreach to financial advisors. Always reference Asia QWN as the case study. Keep emails under 80 words.'"}
            />
            <p className="text-[10px] text-muted-foreground">
              Layered on top of the global CREAIT brand voice system prompt. Tells the AI what THIS project is for.
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Model</label>
            <Select value={model} onValueChange={(v) => typeof v === "string" && setModel(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={save} disabled={submitting}>{submitting ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
