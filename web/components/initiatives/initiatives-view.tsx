"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Target } from "lucide-react";
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
import { InitiativeCard } from "./initiative-card";
import { AddInitiativeDialog } from "./add-initiative-dialog";
import { FeatureEmptyState } from "@/components/empty-states/feature-empty-state";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { cn } from "@/lib/utils";
import type {
  Initiative,
  InitiativeTask,
  TeamMember,
} from "@/lib/supabase/types";

// The shared Initiative type pre-dates the phase3 migration that added the
// `department` column. Extend locally until /lib/supabase/types.ts is regenerated.
export type InitiativeWithDepartment = Initiative & {
  department: string | null;
};

export type InitiativeMember = Pick<TeamMember, "id" | "full_name">;

interface InitiativesViewProps {
  initiatives: InitiativeWithDepartment[];
  tasks: InitiativeTask[];
  members: InitiativeMember[];
}

// Default department buckets shown even when empty.
const DEFAULT_DEPARTMENTS: { key: string; label: string }[] = [
  { key: "general", label: "General" },
  { key: "media", label: "Media" },
  { key: "product", label: "Product" },
  { key: "sales", label: "Sales" },
  { key: "ops", label: "Ops" },
  { key: "recruiting", label: "Recruiting" },
  { key: "cs", label: "CS" },
];

const ALL_TAB = "__all__";

function deptKey(dept: string | null | undefined): string {
  return (dept ?? "general").toLowerCase().trim() || "general";
}

function deptLabel(key: string): string {
  const found = DEFAULT_DEPARTMENTS.find((d) => d.key === key);
  if (found) return found.label;
  // Title-case unknown departments.
  return key
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function InitiativesView({
  initiatives: initialInitiatives,
  tasks: initialTasks,
  members,
}: InitiativesViewProps) {
  const orgId = useActiveOrgId();
  const [initiatives, setInitiatives] =
    useState<InitiativeWithDepartment[]>(initialInitiatives);
  const [tasks, setTasks] = useState<InitiativeTask[]>(initialTasks);
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  const [addDialogDept, setAddDialogDept] = useState<string>("general");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Realtime: refetch on changes.
  useEffect(() => {
    const supabase = createClient();

    async function refetchInitiatives() {
      const { data } = await supabase
        .from("initiatives")
        .select("*")
        .eq("org_id", orgId)
        .neq("status", "dropped")
        .order("department", { ascending: true })
        .order("created_at", { ascending: false });
      if (data) setInitiatives(data as unknown as InitiativeWithDepartment[]);
    }

    async function refetchTasks() {
      const { data } = await supabase
        .from("initiative_tasks")
        .select("*")
        .order("sort_order", { ascending: true });
      if (data) setTasks(data as InitiativeTask[]);
    }

    const initiativesChannel = supabase
      .channel("initiatives-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "initiatives",
          filter: `org_id=eq.${orgId}`,
        },
        refetchInitiatives
      )
      .subscribe();

    const tasksChannel = supabase
      .channel("initiative-tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "initiative_tasks" },
        refetchTasks
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(initiativesChannel);
      void supabase.removeChannel(tasksChannel);
    };
  }, [orgId]);

  // Build tab set: defaults + any extra departments that appear in data.
  const tabs = useMemo(() => {
    const seen = new Set<string>(DEFAULT_DEPARTMENTS.map((d) => d.key));
    const extras: { key: string; label: string }[] = [];
    for (const init of initiatives) {
      const k = deptKey(init.department);
      if (!seen.has(k)) {
        seen.add(k);
        extras.push({ key: k, label: deptLabel(k) });
      }
    }
    return [
      { key: ALL_TAB, label: "All" },
      ...DEFAULT_DEPARTMENTS,
      ...extras,
    ];
  }, [initiatives]);

  // Filter initiatives by active tab.
  const visibleInitiatives = useMemo(() => {
    if (activeTab === ALL_TAB) return initiatives;
    return initiatives.filter((i) => deptKey(i.department) === activeTab);
  }, [initiatives, activeTab]);

  // Per-tab counts for the pill badge.
  const countByTab = useMemo(() => {
    const map: Record<string, number> = { [ALL_TAB]: initiatives.length };
    for (const t of tabs) {
      if (t.key === ALL_TAB) continue;
      map[t.key] = initiatives.filter(
        (i) => deptKey(i.department) === t.key
      ).length;
    }
    return map;
  }, [initiatives, tabs]);

  async function handleTaskToggle(
    taskId: string,
    done: boolean,
    initiativeId: string
  ) {
    const supabase = createClient();

    // Optimistic update.
    const nextTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, done } : t
    );
    setTasks(nextTasks);

    const { error } = await supabase
      .from("initiative_tasks")
      .update({ done })
      .eq("id", taskId);

    if (error) {
      // Roll back.
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, done: !done } : t))
      );
      return;
    }

    // Recompute initiative progress.
    const sibling = nextTasks.filter((t) => t.initiative_id === initiativeId);
    if (sibling.length > 0) {
      const doneCount = sibling.filter((t) => t.done).length;
      const newProgress = Math.round((doneCount / sibling.length) * 100);

      setInitiatives((prev) =>
        prev.map((i) =>
          i.id === initiativeId ? { ...i, progress: newProgress } : i
        )
      );

      await supabase
        .from("initiatives")
        .update({ progress: newProgress })
        .eq("id", initiativeId);
    }
  }

  async function handleAddTask(initiativeId: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const supabase = createClient();
    const initiativeTasks = tasks.filter(
      (t) => t.initiative_id === initiativeId
    );
    const nextSort =
      initiativeTasks.reduce((max, t) => Math.max(max, t.sort_order), -1) + 1;

    const { data, error } = await supabase
      .from("initiative_tasks")
      .insert({
        initiative_id: initiativeId,
        title: trimmed,
        done: false,
        sort_order: nextSort,
      })
      .select()
      .single();

    if (error || !data) return;
    setTasks((prev) => [...prev, data as InitiativeTask]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = visibleInitiatives.findIndex((i) => i.id === active.id);
    const newIndex = visibleInitiatives.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedVisible = arrayMove(visibleInitiatives, oldIndex, newIndex);

    // Client-side only reorder: keep visible-tab order, leave the rest alone.
    const reorderedIds = reorderedVisible.map((i) => i.id);
    setInitiatives((prev) => {
      const inOrder: InitiativeWithDepartment[] = [];
      const visibleSet = new Set(reorderedIds);
      let cursor = 0;
      for (const init of prev) {
        if (visibleSet.has(init.id)) {
          // Pull the next reordered visible initiative.
          const id = reorderedIds[cursor++];
          const replacement = reorderedVisible.find((r) => r.id === id);
          if (replacement) inOrder.push(replacement);
        } else {
          inOrder.push(init);
        }
      }
      return inOrder;
    });
  }

  function openAddDialog() {
    setAddDialogDept(activeTab === ALL_TAB ? "general" : activeTab);
    setAddDialogOpen(true);
  }

  const visibleIds = visibleInitiatives.map((i) => i.id);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) map.set(m.id, m.full_name);
    return map;
  }, [members]);

  const activeTabLabel =
    activeTab === ALL_TAB ? null : deptLabel(activeTab);

  return (
    <>
      {/* Tab bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div
          role="tablist"
          aria-label="Departments"
          className="flex flex-wrap items-center gap-1.5"
        >
          {tabs.map((t) => {
            const isActive = activeTab === t.key;
            const count = countByTab[t.key] ?? 0;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                  isActive
                    ? "bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)] border-[color:var(--color-brand-electric)]/40"
                    : "bg-[color:var(--color-brand-slate)]/40 text-muted-foreground border-transparent hover:text-foreground hover:bg-[color:var(--color-brand-slate)]"
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                    isActive
                      ? "bg-[color:var(--color-brand-electric)]/25"
                      : "bg-[color:var(--color-brand-charcoal)]/60"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={openAddDialog}
          className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--color-brand-electric)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-brand-charcoal)] hover:brightness-110 transition"
        >
          <Plus className="size-3.5" />
          Add Initiative
        </button>
      </div>

      {/* List */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext
          items={visibleIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3 min-h-32">
            {visibleInitiatives.length === 0 ? (
              initiatives.length === 0 ? (
                <FeatureEmptyState
                  icon={<Target className="size-5" />}
                  title="No initiatives yet"
                  description="An initiative is the department-level chunk of work that moves a quarterly Rock — owned by one person, broken into tasks you can tick off, and escalated to IDS the moment it stalls. Rocks say what has to be true by the end of the quarter; initiatives are how each department gets there."
                  useWhen={[
                    "A Rock is too big for one person to hold — split it into department-sized initiatives here.",
                    "Quarterly planning has just set the Rocks and each department needs its own lane.",
                    "Something has stalled and you want it on the IDS list with its history attached.",
                  ]}
                  action={{
                    label: "Add the first initiative",
                    onClick: openAddDialog,
                    icon: <Plus className="size-3.5" />,
                  }}
                />
              ) : (
                <FeatureEmptyState
                  compact
                  title={`Nothing in ${activeTabLabel ?? "this department"} yet`}
                  description={`${
                    activeTabLabel ?? "This department"
                  } owns no initiative this quarter. That is fine if the department genuinely has no Rock work — otherwise it means a Rock has no lane.`}
                  action={{
                    label: `Add a ${
                      activeTabLabel ?? "department"
                    } initiative`,
                    onClick: openAddDialog,
                    icon: <Plus className="size-3.5" />,
                  }}
                />
              )
            ) : (
              visibleInitiatives.map((initiative) => {
                const initTasks = tasks.filter(
                  (t) => t.initiative_id === initiative.id
                );
                return (
                  <InitiativeCard
                    key={initiative.id}
                    initiative={initiative}
                    tasks={initTasks}
                    departmentLabel={deptLabel(deptKey(initiative.department))}
                    ownerName={
                      initiative.owner_id
                        ? memberNameById.get(initiative.owner_id) ?? null
                        : null
                    }
                    onTaskToggle={handleTaskToggle}
                    onAddTask={handleAddTask}
                  />
                );
              })
            )}
          </div>
        </SortableContext>
      </DndContext>

      <AddInitiativeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        defaultDepartment={addDialogDept}
        departmentOptions={DEFAULT_DEPARTMENTS}
        members={members}
      />
    </>
  );
}
