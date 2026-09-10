"use client";

import { useState } from "react";
import { GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Goal, Subtask, GoalStatus } from "@/lib/supabase/types";

interface GoalCardProps {
  goal: Goal;
  subtasks: Subtask[];
  onSubtaskToggle: (subtaskId: string, done: boolean, goalId: string) => void;
}

const STATUS_STYLES: Record<GoalStatus, string> = {
  active: "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]",
  complete: "bg-[color:var(--color-brand-aqua)]/20 text-[color:var(--color-brand-aqua)]",
  dropped: "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]",
};

const STATUS_LABELS: Record<GoalStatus, string> = {
  active: "Active",
  complete: "Complete",
  dropped: "Dropped",
};

function getInitialsFromId(ownerId: string | null): string {
  if (!ownerId) return "?";
  // Phase 1: owner_id is a free-text field. Show first two chars uppercase.
  return ownerId.slice(0, 2).toUpperCase();
}

export function GoalCard({ goal, subtasks, onSubtaskToggle }: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: goal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <Card className={cn("relative", isDragging && "ring-2 ring-[color:var(--color-brand-electric)]")}>
        <CardContent className="pt-4">
          <button
            {...attributes}
            {...listeners}
            className="absolute left-1.5 top-4 cursor-grab active:cursor-grabbing text-[color:var(--color-brand-mist)] hover:text-foreground transition-colors"
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>

          <div className="pl-5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm leading-snug">{goal.title}</p>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  STATUS_STYLES[goal.status]
                )}
              >
                {STATUS_LABELS[goal.status]}
              </span>
            </div>

            {goal.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{goal.description}</p>
            )}

            <div className="flex items-center gap-3">
              {goal.owner_id && (
                <div className="flex items-center gap-1.5">
                  <div className="size-6 rounded-full bg-[color:var(--color-brand-slate)] flex items-center justify-center text-xs font-medium ring-1 ring-[color:var(--color-brand-fog)]">
                    {getInitialsFromId(goal.owner_id)}
                  </div>
                  <span className="text-xs text-muted-foreground">{goal.owner_id}</span>
                </div>
              )}
              {goal.due_date && (
                <span className="text-xs text-muted-foreground ml-auto">
                  Due{" "}
                  {new Date(goal.due_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <Progress value={goal.progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground text-right">{goal.progress}%</p>
            </div>

            {subtasks.length > 0 && (
              <div>
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {expanded ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )}
                  {subtasks.length} subtask{subtasks.length !== 1 ? "s" : ""}
                </button>

                {expanded && (
                  <ul className="mt-2 space-y-1.5">
                    {subtasks
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((st) => (
                        <li key={st.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={st.done}
                            onCheckedChange={(checked) => {
                              onSubtaskToggle(st.id, checked === true, goal.id);
                            }}
                          />
                          <span
                            className={cn(
                              "text-xs",
                              st.done ? "line-through text-muted-foreground" : ""
                            )}
                          >
                            {st.title}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
