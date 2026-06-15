"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { GoalCard } from "./goal-card";
import { AddGoalDialog } from "./add-goal-dialog";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import type { Goal, Subtask, Timeframe } from "@/lib/supabase/types";

interface TimeHorizonColumnsProps {
  goals: Goal[];
  subtasks: Subtask[];
}

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
];

function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    return a.created_at.localeCompare(b.created_at);
  });
}

export function TimeHorizonColumns({
  goals: initialGoals,
  subtasks: initialSubtasks,
}: TimeHorizonColumnsProps) {
  const orgId = useActiveOrgId();
  const [goals, setGoals] = useState<Goal[]>(sortGoals(initialGoals));
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks);
  const [addDialogTimeframe, setAddDialogTimeframe] = useState<Timeframe>("week");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const supabase = createClient();

    async function refetchGoals() {
      const { data } = await supabase
        .from("goals")
        .select("*")
        .eq("org_id", orgId)
        .order("sort_order", { ascending: true });
      if (data) setGoals(sortGoals(data as Goal[]));
    }

    async function refetchSubtasks() {
      const { data } = await supabase
        .from("subtasks")
        .select("*")
        .order("sort_order", { ascending: true });
      if (data) setSubtasks(data as Subtask[]);
    }

    const goalsChannel = supabase
      .channel("goals-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goals", filter: `org_id=eq.${orgId}` },
        refetchGoals
      )
      .subscribe();

    const subtasksChannel = supabase
      .channel("subtasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subtasks" },
        refetchSubtasks
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(goalsChannel);
      void supabase.removeChannel(subtasksChannel);
    };
  }, [orgId]);

  async function handleSubtaskToggle(subtaskId: string, done: boolean, goalId: string) {
    const supabase = createClient();

    setSubtasks((prev) =>
      prev.map((st) => (st.id === subtaskId ? { ...st, done } : st))
    );

    const { error } = await supabase
      .from("subtasks")
      .update({ done })
      .eq("id", subtaskId);

    if (error) {
      setSubtasks((prev) =>
        prev.map((st) => (st.id === subtaskId ? { ...st, done: !done } : st))
      );
      return;
    }

    // Recompute goal progress
    const goalSubtasks = subtasks
      .map((st) => (st.id === subtaskId ? { ...st, done } : st))
      .filter((st) => st.goal_id === goalId);

    if (goalSubtasks.length > 0) {
      const completedCount = goalSubtasks.filter((st) => st.done).length;
      const newProgress = Math.round((completedCount / goalSubtasks.length) * 100);

      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, progress: newProgress } : g))
      );

      await supabase.from("goals").update({ progress: newProgress }).eq("id", goalId);
    }
  }

  async function handleDragEnd(event: DragEndEvent, timeframe: Timeframe) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const columnGoals = goals.filter((g) => g.timeframe === timeframe);
    const oldIndex = columnGoals.findIndex((g) => g.id === active.id);
    const newIndex = columnGoals.findIndex((g) => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(columnGoals, oldIndex, newIndex);

    const updatedGoals = goals.map((g) => {
      if (g.timeframe !== timeframe) return g;
      const idx = reordered.findIndex((r) => r.id === g.id);
      return idx === -1 ? g : { ...g, sort_order: idx };
    });

    setGoals(sortGoals(updatedGoals));

    const supabase = createClient();
    await Promise.all(
      reordered.map((g, idx) =>
        supabase.from("goals").update({ sort_order: idx }).eq("id", g.id)
      )
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {TIMEFRAMES.map(({ key, label }) => {
          const columnGoals = goals.filter((g) => g.timeframe === key);
          const columnIds = columnGoals.map((g) => g.id);

          return (
            <div key={key} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{label}</h2>
                  <span className="bg-[color:var(--color-brand-slate)] text-muted-foreground text-xs rounded-full px-2 py-0.5">
                    {columnGoals.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setAddDialogTimeframe(key);
                    setAddDialogOpen(true);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[color:var(--color-brand-electric)] transition-colors"
                  aria-label={`Add goal to ${label}`}
                >
                  <Plus className="size-3.5" />
                  Add Goal
                </button>
              </div>

              <DndContext
                sensors={sensors}
                onDragEnd={(event) => handleDragEnd(event, key)}
              >
                <SortableContext items={columnIds} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2 min-h-24">
                    {columnGoals.length === 0 && (
                      <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex items-center justify-center h-24 text-sm text-muted-foreground">
                        No goals yet
                      </div>
                    )}
                    {columnGoals.map((goal) => {
                      const goalSubtasks = subtasks.filter((st) => st.goal_id === goal.id);
                      return (
                        <GoalCard
                          key={goal.id}
                          goal={goal}
                          subtasks={goalSubtasks}
                          onSubtaskToggle={handleSubtaskToggle}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          );
        })}
      </div>

      <AddGoalDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        defaultTimeframe={addDialogTimeframe}
        onSuccess={() => {}}
      />
    </>
  );
}
