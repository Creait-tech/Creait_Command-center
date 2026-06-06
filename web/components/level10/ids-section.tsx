"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, MessageCircleQuestion } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
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
import { Card, CardContent } from "@/components/ui/card";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { IdsItem, IdsStatus } from "@/lib/supabase/types";

interface IdsSectionProps {
  initialItems: IdsItem[];
  meetingId: string | null;
}

type Column = Exclude<IdsStatus, "dropped">;

const COLUMNS: { key: Column; label: string; accent: string }[] = [
  {
    key: "open",
    label: "Identified",
    accent: "text-[color:var(--color-brand-warning)]",
  },
  {
    key: "discussing",
    label: "In Discussion",
    accent: "text-[color:var(--color-brand-electric)]",
  },
  {
    key: "solved",
    label: "Solved",
    accent: "text-[color:var(--color-brand-success)]",
  },
];

function sortItems(items: IdsItem[]): IdsItem[] {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.created_at.localeCompare(a.created_at);
  });
}

function priorityBadgeClass(priority: number): string {
  if (priority >= 8) {
    return "bg-[color:var(--color-brand-danger)]/15 text-[color:var(--color-brand-danger)]";
  }
  if (priority >= 5) {
    return "bg-[color:var(--color-brand-warning)]/15 text-[color:var(--color-brand-warning)]";
  }
  return "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]";
}

interface IdsCardProps {
  item: IdsItem;
  dragging?: boolean;
}

function IdsCard({ item, dragging }: IdsCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({ id: item.id });

  const showAsDragging = isDragging || dragging;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none cursor-grab active:cursor-grabbing",
        showAsDragging && "opacity-40"
      )}
    >
      <IdsCardBody item={item} />
    </div>
  );
}

function IdsCardBody({ item }: { item: IdsItem }) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm leading-snug">{item.title}</p>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              priorityBadgeClass(item.priority)
            )}
          >
            P{item.priority}
          </span>
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {item.description}
          </p>
        )}
        {item.status === "solved" && item.resolution && (
          <p className="text-xs text-[color:var(--color-brand-success)] line-clamp-3 italic">
            “{item.resolution}”
          </p>
        )}
        {item.owner_id && (
          <p className="text-xs text-muted-foreground">
            Owner: {item.owner_id}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface ColumnProps {
  column: Column;
  label: string;
  accent: string;
  items: IdsItem[];
}

function IdsColumn({ column, label, accent, items }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column}` });

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="flex items-center gap-2">
        <h3 className={cn("text-sm font-semibold", accent)}>{label}</h3>
        <span className="bg-[color:var(--color-brand-slate)] text-muted-foreground text-xs rounded-full px-2 py-0.5">
          {items.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 min-h-32 rounded-xl border border-dashed border-transparent p-2 transition-colors",
          isOver &&
            "border-[color:var(--color-brand-electric)] bg-[color:var(--color-brand-electric)]/5"
        )}
      >
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
            Drop here
          </div>
        ) : (
          items.map((item) => <IdsCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}

export function IdsSection({ initialItems, meetingId }: IdsSectionProps) {
  const [items, setItems] = useState<IdsItem[]>(sortItems(initialItems));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Add-issue form state.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    const supabase = createClient();

    async function refetch() {
      const { data } = await supabase
        .from("ids_items")
        .select("*")
        .eq("org_id", "creait")
        .in("status", ["open", "discussing", "solved"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setItems(sortItems(data as IdsItem[]));
    }

    const channel = supabase
      .channel("ids-items-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ids_items",
          filter: "org_id=eq.creait",
        },
        refetch
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const itemsByColumn = useMemo(() => {
    const grouped: Record<Column, IdsItem[]> = {
      open: [],
      discussing: [],
      solved: [],
    };
    for (const item of items) {
      if (item.status === "open") grouped.open.push(item);
      else if (item.status === "discussing") grouped.discussing.push(item);
      else if (item.status === "solved") grouped.solved.push(item);
    }
    return grouped;
  }, [items]);

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    if (!overId.startsWith("column:")) return;
    const newStatus = overId.slice("column:".length) as Column;

    const movedId = String(active.id);
    const moved = items.find((i) => i.id === movedId);
    if (!moved || moved.status === newStatus) return;

    const previous = items;
    setItems((prev) =>
      sortItems(
        prev.map((i) => (i.id === movedId ? { ...i, status: newStatus } : i))
      )
    );

    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("ids_items")
      .update({ status: newStatus })
      .eq("id", movedId);

    if (dbError) {
      setItems(previous);
      toast.error(`Failed to move: ${dbError.message}`);
      return;
    }
    toast.success(`Moved to ${newStatus}`);
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: dbError } = await supabase.from("ids_items").insert({
      org_id: "creait",
      meeting_id: meetingId,
      title: title.trim(),
      description: description.trim() || null,
      status: "open",
      priority,
    });

    setSubmitting(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    setTitle("");
    setDescription("");
    setPriority(5);
    setDialogOpen(false);
    toast.success("Issue added");
  }

  const hasAny = items.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {hasAny ? `${items.length} item${items.length !== 1 ? "s" : ""}` : "No issues yet"}
        </p>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="size-4" />
          Add Issue
        </Button>
      </div>

      {!hasAny && (
        <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex flex-col items-center justify-center py-10 text-center">
          <MessageCircleQuestion className="size-8 text-[color:var(--color-brand-mist)] mb-2" />
          <p className="text-sm font-medium">No issues to discuss</p>
          <p className="text-xs text-muted-foreground mt-1">
            Capture blockers, decisions, or risks here.
          </p>
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map(({ key, label, accent }) => (
            <IdsColumn
              key={key}
              column={key}
              label={label}
              accent={accent}
              items={itemsByColumn[key]}
            />
          ))}
        </div>
        <DragOverlay>
          {activeItem ? <IdsCardBody item={activeItem} /> : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add IDS Issue</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4 pt-1">
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="ids-title"
              >
                Title{" "}
                <span className="text-[color:var(--color-brand-danger)]">
                  *
                </span>
              </label>
              <Input
                id="ids-title"
                placeholder="What's the issue?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="ids-desc"
              >
                Description
              </label>
              <Textarea
                id="ids-desc"
                placeholder="Context, who's affected, what's at stake"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-20"
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="ids-priority"
              >
                Priority (1-10)
              </label>
              <Input
                id="ids-priority"
                type="number"
                min={1}
                max={10}
                value={priority}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isNaN(n)) return;
                  setPriority(Math.max(1, Math.min(10, n)));
                }}
              />
            </div>
            {error && (
              <p className="text-xs text-[color:var(--color-brand-danger)]">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !title.trim()}>
                {submitting ? "Adding…" : "Add Issue"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
