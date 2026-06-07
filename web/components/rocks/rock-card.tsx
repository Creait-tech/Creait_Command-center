"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Circle, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type {
  Rock,
  RockMilestone,
  RockStatusUpdate,
  RockStatusColor,
  TeamMember,
} from "@/lib/supabase/types";

const STATUS_BTN: Record<RockStatusColor, string> = {
  green: "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)] hover:bg-[color:var(--color-brand-success)]/30",
  yellow: "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)] hover:bg-[color:var(--color-brand-warning)]/30",
  red: "bg-[color:var(--color-brand-danger)]/20 text-[color:var(--color-brand-danger)] hover:bg-[color:var(--color-brand-danger)]/30",
};

const ROCK_STATUS_LABEL: Record<Rock["status"], string> = {
  on_track: "On Track",
  off_track: "Off Track",
  complete: "Complete",
  incomplete: "Incomplete",
  dropped: "Dropped",
};

const ROCK_STATUS_COLOR: Record<Rock["status"], string> = {
  on_track: "text-[color:var(--color-brand-success)]",
  off_track: "text-[color:var(--color-brand-warning)]",
  complete: "text-[color:var(--color-brand-aqua)]",
  incomplete: "text-[color:var(--color-brand-danger)]",
  dropped: "text-[color:var(--color-brand-mist)]",
};

interface Props {
  rock: Rock;
  milestones: RockMilestone[];
  latestStatus: RockStatusUpdate | null;
  members: TeamMember[];
  onUpdated: (rock: Rock) => void;
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

export function RockCard({ rock, milestones, latestStatus, members, onUpdated }: Props) {
  const [expanded, setExpanded] = useState(false);
  const owner = members.find((m) => m.id === rock.owner_id);

  const completedMilestones = milestones.filter((m) => m.done).length;
  const progress = milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 0;
  const daysLeft = daysUntil(rock.due_date);

  async function setStatusColor(color: RockStatusColor) {
    const supabase = createClient();
    const { error } = await supabase.from("cc_rock_status_updates").insert({
      rock_id: rock.id,
      status: color,
      note: null,
    });
    if (error) toast.error(error.message);
    else toast.success(`Marked ${color}`);
  }

  async function toggleMilestone(id: string, done: boolean) {
    const supabase = createClient();
    await supabase.from("cc_rock_milestones").update({ done }).eq("id", id);
  }

  async function setRockStatus(status: Rock["status"]) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cc_rocks")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", rock.id)
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      onUpdated(data as Rock);
      toast.success(`Marked ${ROCK_STATUS_LABEL[status]}`);
    }
  }

  return (
    <Card className={cn(rock.status === "complete" && "opacity-70")}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-snug">{rock.title}</h3>
            {rock.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rock.description}</p>
            )}
          </div>
          <span className={cn("text-xs font-medium whitespace-nowrap", ROCK_STATUS_COLOR[rock.status])}>
            {ROCK_STATUS_LABEL[rock.status]}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {owner && (
            <span className="flex items-center gap-1.5">
              <span className="size-5 rounded-full bg-[color:var(--color-brand-slate)] flex items-center justify-center text-[10px] font-medium">
                {owner.full_name.slice(0, 2).toUpperCase()}
              </span>
              {owner.full_name}
            </span>
          )}
          <span>
            Due {new Date(rock.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          <span className={cn(
            daysLeft < 0 ? "text-[color:var(--color-brand-danger)]" :
            daysLeft < 14 ? "text-[color:var(--color-brand-warning)]" :
            "text-muted-foreground"
          )}>
            {daysLeft < 0 ? `${-daysLeft}d overdue` : `${daysLeft}d left`}
          </span>
        </div>

        {milestones.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Milestones: {completedMilestones}/{milestones.length}</span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {/* Weekly status row */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <span className="text-xs text-muted-foreground mr-1">Weekly status:</span>
          {(["green", "yellow", "red"] as RockStatusColor[]).map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setStatusColor(color)}
              className={cn(
                "size-7 rounded-full transition-all",
                STATUS_BTN[color],
                latestStatus?.status === color && "ring-2 ring-offset-2 ring-offset-background",
              )}
              aria-label={`Mark ${color}`}
              title={color === "green" ? "On track" : color === "yellow" ? "At risk" : "Off track"}
            />
          ))}
          {latestStatus && (
            <span className="text-xs text-muted-foreground ml-2">
              {new Date(latestStatus.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
        >
          {expanded ? (
            <><ChevronUp className="size-3" /> Hide details</>
          ) : (
            <><ChevronDown className="size-3" /> Show milestones, SMART, status</>
          )}
        </button>

        {expanded && (
          <div className="space-y-3 pt-2 border-t border-border">
            {milestones.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Milestones</p>
                <ul className="space-y-1.5">
                  {milestones.map((m) => (
                    <li key={m.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={m.done}
                        onCheckedChange={(c) => toggleMilestone(m.id, c === true)}
                      />
                      <span className={cn("text-xs flex-1", m.done && "line-through text-muted-foreground")}>
                        {m.title}
                      </span>
                      {m.due_date && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(m.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(rock.smart_specific || rock.smart_measurable || rock.smart_relevant) && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">SMART</p>
                <dl className="text-xs space-y-1">
                  {rock.smart_specific && (
                    <div><dt className="text-[color:var(--color-brand-mist)] inline">Specific:</dt> <dd className="inline">{rock.smart_specific}</dd></div>
                  )}
                  {rock.smart_measurable && (
                    <div><dt className="text-[color:var(--color-brand-mist)] inline">Measurable:</dt> <dd className="inline">{rock.smart_measurable}</dd></div>
                  )}
                  {rock.smart_relevant && (
                    <div><dt className="text-[color:var(--color-brand-mist)] inline">Relevant:</dt> <dd className="inline">{rock.smart_relevant}</dd></div>
                  )}
                </dl>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Mark:</span>
              {(["on_track","off_track","complete","incomplete","dropped"] as Rock["status"][]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRockStatus(s)}
                  disabled={rock.status === s}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded border border-border hover:border-[color:var(--color-brand-electric)] transition-colors",
                    rock.status === s && "opacity-40 cursor-not-allowed",
                  )}
                >
                  {ROCK_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
