import type { Skill, RunHistory } from "@/lib/supabase/types";

export interface SkillRunStats {
  lastRunAt: string | null;
  runCount: number;
}

export function buildSkillNameMap(skills: Skill[]): Record<string, string> {
  return Object.fromEntries(skills.map((s) => [s.id, s.name]));
}

export function buildRunStatsMap(runs: RunHistory[]): Record<string, SkillRunStats> {
  const stats: Record<string, SkillRunStats> = {};
  for (const run of runs) {
    if (!run.skill_id) continue;
    const entry = stats[run.skill_id];
    if (entry === undefined) {
      stats[run.skill_id] = { lastRunAt: run.created_at, runCount: 1 };
    } else {
      entry.runCount += 1;
      if (!entry.lastRunAt || run.created_at > entry.lastRunAt) {
        entry.lastRunAt = run.created_at;
      }
    }
  }
  return stats;
}
