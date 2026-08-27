"use client";

import { useState, useEffect, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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

/** Matches the `system_prompt` cap enforced by PATCH /api/skills/[id]. */
const PROMPT_MAX_CHARS = 50_000;

/**
 * Shape returned by `PATCH /api/skills/[id]`. The route wraps the row in a
 * `skill` key — reading `data` directly (as this dialog used to) handed the
 * grid `{ skill: {...} }` instead of a Skill, so every card blanked out after
 * a successful save.
 */
interface PatchResponse {
  skill?: Skill;
  error?: string;
}

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

  const dirty = useMemo(
    () =>
      name !== skill.name ||
      description !== (skill.description ?? "") ||
      systemPrompt !== (skill.system_prompt ?? "") ||
      model !== skill.preferred_model ||
      enabled !== skill.enabled,
    [name, description, systemPrompt, model, enabled, skill],
  );

  const promptEmpty = systemPrompt.trim().length === 0;
  const promptTooLong = systemPrompt.length > PROMPT_MAX_CHARS;

  /**
   * A system prompt is real work — Esc, a backdrop click, or Cancel would
   * otherwise discard it silently.
   */
  function handleOpenChange(next: boolean) {
    if (!next && dirty && !submitting) {
      const discard = window.confirm("Discard unsaved changes to this skill?");
      if (!discard) return;
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Name required");
      return;
    }
    if (promptTooLong) {
      setErr(`System prompt is ${systemPrompt.length.toLocaleString()} characters — the limit is ${PROMPT_MAX_CHARS.toLocaleString()}.`);
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
      const data = (await res.json().catch(() => null)) as PatchResponse | null;
      if (!res.ok || !data || data.error || !data.skill) {
        setErr(data?.error ?? `Failed: ${res.status}`);
        return;
      }
      toast.success("Skill updated");
      onSuccess(data.skill);
      onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit: {skill.name}</DialogTitle>
          <DialogDescription>
            The system prompt is sent ahead of the page context and the run input on every
            execution — scheduled or manual.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1">
            <label htmlFor="skill-name" className="text-xs font-medium text-muted-foreground">Name</label>
            <Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1">
            <label htmlFor="skill-description" className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              id="skill-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-14"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="skill-system-prompt" className="text-xs font-medium text-muted-foreground">
                System prompt
              </label>
              <span
                className={
                  promptTooLong
                    ? "text-xs tabular-nums text-[color:var(--color-brand-danger)]"
                    : "text-xs tabular-nums text-muted-foreground"
                }
              >
                {systemPrompt.length.toLocaleString()} / {PROMPT_MAX_CHARS.toLocaleString()}
              </span>
            </div>
            <Textarea
              id="skill-system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Who the skill is, who reads the output, what a good result looks like, and what it must never do."
              spellCheck={false}
              className="h-[46vh] min-h-64 resize-y overflow-y-auto font-mono text-xs leading-relaxed [field-sizing:fixed]"
              disabled={submitting}
            />
            {promptEmpty && (
              <p className="flex items-start gap-1.5 text-xs text-[color:var(--color-brand-warning)]">
                <AlertTriangle className="size-3.5 shrink-0 mt-px" />
                <span>
                  Empty — this skill runs on the engine&apos;s one-line fallback
                  (&ldquo;You are the &quot;{skill.name}&quot; skill.&rdquo;), not on real instructions.
                </span>
              </p>
            )}
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
            <p className="text-xs text-muted-foreground">
              Every run loads the full MCP tool set — per-skill tool selection isn&apos;t wired up,
              so there is nothing to choose here yet.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Enabled</label>
            <Switch checked={enabled} onCheckedChange={(c) => setEnabled(c === true)} disabled={submitting} />
          </div>
          {err && <p className="text-xs text-[color:var(--color-brand-danger)]">{err}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting || !dirty}>{submitting ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
