"use client";

import { useMemo, useState } from "react";
import {
  GripVertical,
  ChevronDown,
  ChevronUp,
  Plus,
  MoreVertical,
  Loader2,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { createIdsItem } from "@/lib/eos-actions";
import type {
  InitiativeStatus,
  InitiativeTask,
} from "@/lib/supabase/types";
import type { InitiativeWithDepartment } from "./initiatives-view";

interface InitiativeCardProps {
  initiative: InitiativeWithDepartment;
  tasks: InitiativeTask[];
  departmentLabel: string;
  /** Resolved from team_members; null when unowned or the member is gone. */
  ownerName: string | null;
  onTaskToggle: (taskId: string, done: boolean, initiativeId: string) => void;
  onAddTask: (initiativeId: string, title: string) => Promise<void> | void;
}

const STATUS_STYLES: Record<InitiativeStatus, string> = {
  on_track:
    "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]",
  at_risk:
    "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)]",
  off_track:
    "bg-[color:var(--color-brand-danger)]/20 text-[color:var(--color-brand-danger)]",
  complete:
    "bg-[color:var(--color-brand-aqua)]/20 text-[color:var(--color-brand-aqua)]",
  dropped:
    "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]",
};

const STATUS_LABELS: Record<InitiativeStatus, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  off_track: "Off Track",
  complete: "Complete",
  dropped: "Dropped",
};

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function InitiativeCard({
  initiative,
  tasks,
  departmentLabel,
  ownerName,
  onTaskToggle,
  onAddTask,
}: InitiativeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateNote, setEscalateNote] = useState("");
  const [escalating, setEscalating] = useState(false);

  const sortable = useSortable({ id: initiative.id });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Prefer computed progress from tasks when there are tasks; else stored value.
  const progress = useMemo(() => {
    if (tasks.length === 0) return initiative.progress;
    const doneCount = tasks.filter((t) => t.done).length;
    return Math.round((doneCount / tasks.length) * 100);
  }, [tasks, initiative.progress]);

  const due = formatDate(initiative.due_date);

  async function submitAddTask() {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    setAddingTask(true);
    try {
      await onAddTask(initiative.id, trimmed);
      setNewTaskTitle("");
      setAddTaskOpen(false);
    } finally {
      setAddingTask(false);
    }
  }

  async function markComplete() {
    const supabase = createClient();
    const { error } = await supabase
      .from("initiatives")
      .update({ status: "complete", progress: 100 })
      .eq("id", initiative.id);
    if (error) {
      toast.error("Failed to mark complete");
      return;
    }
    toast.success("Initiative marked complete");
  }

  async function dropInitiative() {
    const supabase = createClient();
    const { error } = await supabase
      .from("initiatives")
      .update({ status: "dropped" })
      .eq("id", initiative.id);
    if (error) {
      toast.error("Failed to drop initiative");
      return;
    }
    toast.success("Initiative dropped");
  }

  async function submitEscalate() {
    setEscalating(true);
    const description = [
      initiative.description?.trim() || "",
      escalateNote.trim() ? `\n\n${escalateNote.trim()}` : "",
    ]
      .join("")
      .trim();

    // The same server action every other IDS creation path uses, so an issue
    // escalated from an initiative carries the same "added by" stamp as one
    // raised on /level-10. Attribution that only holds on some paths is worse
    // than none, because it can't be trusted anywhere.
    const result = await createIdsItem({
      title: `ESCALATED: ${initiative.title}`,
      description: description || null,
      priority: 8,
      ownerId: initiative.owner_id,
    });

    setEscalating(false);

    if (!result.ok) {
      toast.error(`Failed to escalate to IDS — ${result.error}`);
      return;
    }
    toast.success("Escalated to IDS");
    setEscalateOpen(false);
    setEscalateNote("");
  }

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <Card
        className={cn(
          "relative transition-shadow hover:ring-1 hover:ring-[color:var(--color-brand-electric)]/50",
          isDragging && "ring-2 ring-[color:var(--color-brand-electric)]"
        )}
      >
        <CardContent className="pt-4 pb-4">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="absolute left-1.5 top-4 cursor-grab active:cursor-grabbing text-[color:var(--color-brand-mist)] hover:text-[color:var(--color-brand-paper)] transition-colors"
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>

          <div className="pl-5 space-y-3">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm leading-snug">
                    {initiative.title}
                  </p>
                  <span className="shrink-0 rounded-full bg-[color:var(--color-brand-slate)] text-muted-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {departmentLabel}
                  </span>
                </div>
                {initiative.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {initiative.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    STATUS_STYLES[initiative.status]
                  )}
                >
                  {STATUS_LABELS[initiative.status]}
                </span>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-[color:var(--color-brand-slate)] transition-colors"
                    aria-label="Initiative actions"
                  >
                    <MoreVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEscalateOpen(true)}>
                      Escalate to IDS
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={markComplete}>
                      Mark Complete
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={dropInitiative}
                    >
                      Drop
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 flex-wrap">
              {ownerName ? (
                <div className="flex items-center gap-1.5">
                  <div className="size-6 rounded-full bg-[color:var(--color-brand-slate)] flex items-center justify-center text-xs font-medium ring-1 ring-[color:var(--color-brand-fog)]">
                    {getInitials(ownerName)}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {ownerName}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-[color:var(--color-brand-warning)]">
                  Unassigned
                </span>
              )}
              {initiative.quarter && (
                <span className="text-xs text-muted-foreground rounded-full bg-[color:var(--color-brand-slate)]/40 px-2 py-0.5">
                  {initiative.quarter}
                </span>
              )}
              {due && (
                <span className="text-xs text-muted-foreground ml-auto">
                  Due {due}
                </span>
              )}
            </div>

            {/* Progress */}
            <div className="space-y-1">
              <Progress value={progress} className="h-1.5" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {tasks.filter((t) => t.done).length} / {tasks.length} tasks
                </span>
                <span>{progress}%</span>
              </div>
            </div>

            {/* Expand toggle */}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={expanded}
              aria-controls={`initiative-${initiative.id}-tasks`}
            >
              {expanded ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
              {tasks.length} task{tasks.length === 1 ? "" : "s"}
            </button>

            {expanded && (
              <div
                id={`initiative-${initiative.id}-tasks`}
                className="space-y-2 border-t border-[color:var(--color-brand-fog)]/40 pt-3"
              >
                {tasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No tasks yet.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {tasks
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((t) => (
                        <li key={t.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={t.done}
                            onCheckedChange={(checked) =>
                              onTaskToggle(
                                t.id,
                                checked === true,
                                initiative.id
                              )
                            }
                          />
                          <span
                            className={cn(
                              "text-xs",
                              t.done
                                ? "line-through text-muted-foreground"
                                : ""
                            )}
                          >
                            {t.title}
                          </span>
                          {t.due_date && (
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {formatDate(t.due_date)}
                            </span>
                          )}
                        </li>
                      ))}
                  </ul>
                )}

                {addTaskOpen ? (
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      autoFocus
                      placeholder="Task title"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void submitAddTask();
                        }
                        if (e.key === "Escape") {
                          setAddTaskOpen(false);
                          setNewTaskTitle("");
                        }
                      }}
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={submitAddTask}
                      disabled={addingTask || !newTaskTitle.trim()}
                    >
                      {addingTask ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        "Add"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAddTaskOpen(false);
                        setNewTaskTitle("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddTaskOpen(true)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[color:var(--color-brand-electric)] transition-colors"
                  >
                    <Plus className="size-3" />
                    Add Task
                  </button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Escalate dialog */}
      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escalate to IDS</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Creates a high-priority IDS item linked to{" "}
              <span className="font-medium text-foreground">
                {initiative.title}
              </span>
              .
            </p>
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor={`escalate-note-${initiative.id}`}
              >
                Note (optional)
              </label>
              <Textarea
                id={`escalate-note-${initiative.id}`}
                placeholder="What's blocked? What's the ask?"
                value={escalateNote}
                onChange={(e) => setEscalateNote(e.target.value)}
                className="min-h-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEscalateOpen(false)}
              disabled={escalating}
            >
              Cancel
            </Button>
            <Button onClick={submitEscalate} disabled={escalating}>
              {escalating ? "Escalating…" : "Escalate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
