"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, MessageCircleQuestion, ArchiveRestore, Clock, MoreVertical } from "lucide-react";
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
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { cn } from "@/lib/utils";
import type { IdsItem, IdsStatus } from "@/lib/supabase/types";

interface IdsSectionProps {
  initialItems: IdsItem[];
  meetingId: string | null;
}

type Column = Exclude<IdsStatus, "dropped">;
type Bucket = "short" | "long";

const COLUMNS: { key: Column; label: string; accent: string }[] = [
  { key: "open", label: "Identified", accent: "text-[color:var(--color-brand-warning)]" },
  { key: "discussing", label: "In Discussion", accent: "text-[color:var(--color-brand-electric)]" },
  { key: "solved", label: "Solved", accent: "text-[color:var(--color-brand-success)]" },
];

function sortItems(items: IdsItem[]): IdsItem[] {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.created_at.localeCompare(a.created_at);
  });
}

function priorityBadgeClass(priority: number): string {
  if (priority >= 8) return "bg-[color:var(--color-brand-danger)]/15 text-[color:var(--color-brand-danger)]";
  if (priority >= 5) return "bg-[color:var(--color-brand-warning)]/15 text-[color:var(--color-brand-warning)]";
  return "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]";
}

interface IdsCardProps {
  item: IdsItem;
  onToggleLongTerm: (item: IdsItem) => void;
  onDelete: (item: IdsItem) => void;
}

function IdsCard({ item, onToggleLongTerm, onDelete }: IdsCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      className={cn("touch-none", isDragging && "opacity-40")}
    >
      <IdsCardBody item={item} dragHandle={{ ...attributes, ...listeners }} onToggleLongTerm={onToggleLongTerm} onDelete={onDelete} />
    </div>
  );
}

function IdsCardBody({
  item,
  dragHandle,
  onToggleLongTerm,
  onDelete,
}: {
  item: IdsItem;
  dragHandle?: Record<string, unknown>;
  onToggleLongTerm?: (item: IdsItem) => void;
  onDelete?: (item: IdsItem) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 relative">
        <div className="flex items-start justify-between gap-2">
          <div {...(dragHandle ?? {})} className={cn("flex-1 cursor-grab active:cursor-grabbing", dragHandle && "pr-1")}>
            <p className="font-semibold text-sm leading-snug">{item.title}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", priorityBadgeClass(item.priority))}>
              P{item.priority}
            </span>
            {(onToggleLongTerm || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="ghost" size="icon" aria-label="Actions">
                    <MoreVertical className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onToggleLongTerm && (
                    <DropdownMenuItem onClick={() => onToggleLongTerm(item)}>
                      {item.is_long_term ? (
                        <><ArchiveRestore className="size-3.5" /> Move to Short-term</>
                      ) : (
                        <><Clock className="size-3.5" /> Park as Long-term</>
                      )}
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem onClick={() => onDelete(item)} className="text-[color:var(--color-brand-danger)]">
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        )}
        {item.status === "solved" && item.resolution && (
          <p className="text-xs text-[color:var(--color-brand-success)] line-clamp-3 italic">"{item.resolution}"</p>
        )}
        {item.owner_id && <p className="text-xs text-muted-foreground">Owner: {item.owner_id}</p>}
      </CardContent>
    </Card>
  );
}

interface ColumnProps {
  column: Column;
  label: string;
  accent: string;
  items: IdsItem[];
  onToggleLongTerm: (item: IdsItem) => void;
  onDelete: (item: IdsItem) => void;
}

function IdsColumn({ column, label, accent, items, onToggleLongTerm, onDelete }: ColumnProps) {
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
          isOver && "border-[color:var(--color-brand-electric)] bg-[color:var(--color-brand-electric)]/5",
        )}
      >
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">Drop here</div>
        ) : (
          items.map((item) => <IdsCard key={item.id} item={item} onToggleLongTerm={onToggleLongTerm} onDelete={onDelete} />)
        )}
      </div>
    </div>
  );
}

export function IdsSection({ initialItems, meetingId }: IdsSectionProps) {
  const orgId = useActiveOrgId();
  const [items, setItems] = useState<IdsItem[]>(sortItems(initialItems));
  const [bucket, setBucket] = useState<Bucket>("short");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(5);
  const [isLongTermNew, setIsLongTermNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    const supabase = createClient();
    async function refetch() {
      const { data } = await supabase
        .from("ids_items")
        .select("*")
        .eq("org_id", orgId)
        .neq("status", "dropped")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setItems(sortItems(data as IdsItem[]));
    }
    const channel = supabase
      .channel("ids-items-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ids_items", filter: `org_id=eq.${orgId}` }, refetch)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId]);

  const shortItems = items.filter((i) => !i.is_long_term);
  const longItems = items.filter((i) => i.is_long_term);

  const itemsByColumn = useMemo(() => {
    const grouped: Record<Column, IdsItem[]> = { open: [], discussing: [], solved: [] };
    for (const item of shortItems) {
      if (item.status === "open") grouped.open.push(item);
      else if (item.status === "discussing") grouped.discussing.push(item);
      else if (item.status === "solved") grouped.solved.push(item);
    }
    return grouped;
  }, [shortItems]);

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
    setItems((prev) => sortItems(prev.map((i) => (i.id === movedId ? { ...i, status: newStatus } : i))));
    const supabase = createClient();
    const { error: dbError } = await supabase.from("ids_items").update({ status: newStatus }).eq("id", movedId);
    if (dbError) {
      setItems(previous);
      toast.error(`Failed to move: ${dbError.message}`);
      return;
    }
    toast.success(`Moved to ${newStatus}`);
  }

  async function toggleLongTerm(item: IdsItem) {
    const next = !item.is_long_term;
    const supabase = createClient();
    setItems((p) => p.map((x) => (x.id === item.id ? { ...x, is_long_term: next } : x)));
    const { error: e } = await supabase.from("ids_items").update({ is_long_term: next }).eq("id", item.id);
    if (e) {
      setItems((p) => p.map((x) => (x.id === item.id ? { ...x, is_long_term: !next } : x)));
      toast.error(e.message);
    } else {
      toast.success(next ? "Parked as long-term" : "Moved to short-term");
    }
  }

  async function deleteItem(item: IdsItem) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    const supabase = createClient();
    const { error: e } = await supabase.from("ids_items").delete().eq("id", item.id);
    if (e) toast.error(e.message);
    else toast.success("Deleted");
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
      org_id: orgId,
      meeting_id: meetingId,
      title: title.trim(),
      description: description.trim() || null,
      status: "open",
      priority,
      is_long_term: isLongTermNew,
    });
    setSubmitting(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setTitle("");
    setDescription("");
    setPriority(5);
    setIsLongTermNew(false);
    setDialogOpen(false);
    toast.success("Issue added");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {(["short", "long"] as Bucket[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                bucket === b
                  ? "bg-[color:var(--color-brand-electric)] text-white border-transparent"
                  : "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)] border-border hover:border-[color:var(--color-brand-electric)]",
              )}
            >
              {b === "short" ? "Short-term" : "Long-term"} ·{" "}
              <span className="opacity-70">{b === "short" ? shortItems.length : longItems.length}</span>
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            {bucket === "short" ? "Solve this week" : "Park for Quarterly Planning"}
          </span>
        </div>
        <Button onClick={() => { setIsLongTermNew(bucket === "long"); setDialogOpen(true); }} size="sm">
          <Plus className="size-4" />
          Add Issue
        </Button>
      </div>

      {bucket === "short" ? (
        <>
          {shortItems.length === 0 && (
            <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex flex-col items-center justify-center py-10 text-center">
              <MessageCircleQuestion className="size-8 text-[color:var(--color-brand-mist)] mb-2" />
              <p className="text-sm font-medium">No short-term issues</p>
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
                  onToggleLongTerm={toggleLongTerm}
                  onDelete={deleteItem}
                />
              ))}
            </div>
            <DragOverlay>
              {activeItem ? <IdsCardBody item={activeItem} /> : null}
            </DragOverlay>
          </DndContext>
        </>
      ) : (
        <div className="space-y-2">
          {longItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex flex-col items-center justify-center py-10 text-center">
              <Clock className="size-8 text-[color:var(--color-brand-mist)] mb-2" />
              <p className="text-sm font-medium">No long-term issues parked</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Long-term issues are bigger problems / opportunities the team isn't ready to solve this week — park them here for your Quarterly Planning meeting.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {longItems.map((item) => (
                <IdsCardBody key={item.id} item={item} onToggleLongTerm={toggleLongTerm} onDelete={deleteItem} />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {isLongTermNew ? "Long-term" : "Short-term"} Issue</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ids-title">
                Title <span className="text-[color:var(--color-brand-danger)]">*</span>
              </label>
              <Input id="ids-title" placeholder="What's the issue?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="ids-desc">Description</label>
              <Textarea id="ids-desc" placeholder="Context, who's affected, what's at stake" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="ids-priority">Priority (1-10)</label>
                <Input id="ids-priority" type="number" min={1} max={10} value={priority}
                  onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setPriority(Math.max(1, Math.min(10, n))); }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Bucket</label>
                <div className="flex items-center gap-1 mt-1">
                  {(["short", "long"] as const).map((b) => (
                    <button key={b} type="button" onClick={() => setIsLongTermNew(b === "long")}
                      className={cn(
                        "text-xs px-2 py-1 rounded border flex-1",
                        (b === "long") === isLongTermNew
                          ? "bg-[color:var(--color-brand-electric)] text-white border-transparent"
                          : "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)] border-border",
                      )}
                    >{b === "short" ? "Short-term" : "Long-term"}</button>
                  ))}
                </div>
              </div>
            </div>
            {error && <p className="text-xs text-[color:var(--color-brand-danger)]">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
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
