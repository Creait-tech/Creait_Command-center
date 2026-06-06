"use client";

import { useState } from "react";
import { Play, Pencil, Clock, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { RunSkillDialog } from "./run-skill-dialog";
import { EditSkillDialog } from "./edit-skill-dialog";
import type { Skill } from "@/lib/supabase/types";
import type { SkillRunStats } from "./skill-utils";

const MODEL_BADGE: Record<string, { label: string; className: string }> = {
  "claude-opus-4-7": {
    label: "Opus",
    className: "bg-[color:var(--color-brand-violet)]/20 text-[color:var(--color-brand-violet)]",
  },
  "claude-sonnet-4-6": {
    label: "Sonnet",
    className: "bg-[color:var(--color-brand-electric)]/20 text-[color:var(--color-brand-electric)]",
  },
  "claude-haiku-4-5": {
    label: "Haiku",
    className: "bg-[color:var(--color-brand-aqua)]/20 text-[color:var(--color-brand-aqua)]",
  },
  "gpt-5": { label: "GPT-5", className: "bg-emerald-500/20 text-emerald-400" },
  "gemini-3-pro": { label: "Gemini", className: "bg-blue-500/20 text-blue-400" },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function sortSkills(skills: Skill[], stats: Record<string, SkillRunStats>): Skill[] {
  return [...skills].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    const aLast = stats[a.id]?.lastRunAt ?? "";
    const bLast = stats[b.id]?.lastRunAt ?? "";
    if (aLast !== bLast) return bLast.localeCompare(aLast);
    return a.name.localeCompare(b.name);
  });
}

interface CardProps {
  skill: Skill;
  stats?: SkillRunStats;
  onToggle: (id: string, enabled: boolean) => void;
  onUpdated: (s: Skill) => void;
}

function SkillCard({ skill, stats, onToggle, onUpdated }: CardProps) {
  const [runOpen, setRunOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const badge = MODEL_BADGE[skill.preferred_model] ?? { label: skill.preferred_model, className: "bg-muted text-muted-foreground" };

  return (
    <>
      <Card className={cn(!skill.enabled && "opacity-60")}>
        <CardContent className="pt-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm leading-snug truncate flex-1">{skill.name}</p>
            <span className={cn("shrink-0 text-xs font-medium px-1.5 py-0.5 rounded", badge.className)}>
              {badge.label}
            </span>
          </div>
          {skill.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="size-3" /> {timeAgo(stats?.lastRunAt ?? null)}</span>
            <span className="flex items-center gap-1"><Zap className="size-3" /> {stats?.runCount ?? 0}</span>
          </div>
          <div className="flex items-center gap-1.5 pt-1 border-t border-border">
            <Button size="sm" className="flex-1" onClick={() => setRunOpen(true)} disabled={!skill.enabled}>
              <Play className="size-3" />
              Run Now
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3" />
              Edit
            </Button>
            <div className="ml-auto">
              <Switch checked={skill.enabled} onCheckedChange={(c) => onToggle(skill.id, c === true)} />
            </div>
          </div>
        </CardContent>
      </Card>
      <RunSkillDialog skill={skill} open={runOpen} onOpenChange={setRunOpen} />
      <EditSkillDialog skill={skill} open={editOpen} onOpenChange={setEditOpen} onSuccess={onUpdated} />
    </>
  );
}

interface Props {
  skills: Skill[];
  runStatsMap: Record<string, SkillRunStats>;
}

export function SkillsGrid({ skills, runStatsMap }: Props) {
  const [localSkills, setLocalSkills] = useState<Skill[]>(() => sortSkills(skills, runStatsMap));

  async function handleToggle(id: string, enabled: boolean) {
    setLocalSkills((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
    const supabase = createClient();
    await supabase.from("skills").update({ enabled }).eq("id", id);
  }

  function handleUpdated(updated: Skill) {
    setLocalSkills((prev) => sortSkills(prev.map((s) => (s.id === updated.id ? updated : s)), runStatsMap));
  }

  if (localSkills.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-16">No skills found.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {localSkills.map((s) => (
        <SkillCard
          key={s.id}
          skill={s}
          stats={runStatsMap[s.id]}
          onToggle={handleToggle}
          onUpdated={handleUpdated}
        />
      ))}
    </div>
  );
}
