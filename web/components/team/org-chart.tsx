"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ArrowUpFromLine, GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getInitials } from "./roster-grid";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { personName, personNameOr, type Person } from "@/lib/authorship";

interface OrgChartProps {
  members: Person[];
  onMembersChange: (next: Person[]) => void;
}

interface TreeNode {
  member: Person;
  children: TreeNode[];
}

function buildTree(members: Person[]): {
  roots: TreeNode[];
  byId: Map<string, TreeNode>;
} {
  const byId = new Map<string, TreeNode>();
  for (const m of members) {
    byId.set(m.id, { member: m, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.member.reports_to;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Stable order
  function sortRec(list: TreeNode[]) {
    list.sort((a, b) => personName(a.member).localeCompare(personName(b.member)));
    for (const n of list) sortRec(n.children);
  }
  sortRec(roots);
  return { roots, byId };
}

/**
 * Returns the set of member ids that are descendants of `rootId` (NOT including
 * rootId itself). Used to prevent cycles in drag-and-drop.
 */
function getDescendantIds(
  rootId: string,
  byId: Map<string, TreeNode>
): Set<string> {
  const out = new Set<string>();
  const start = byId.get(rootId);
  if (!start) return out;
  const stack: TreeNode[] = [...start.children];
  while (stack.length > 0) {
    const node = stack.pop()!;
    out.add(node.member.id);
    for (const c of node.children) stack.push(c);
  }
  return out;
}

interface MemberCardProps {
  member: Person;
  isDragging?: boolean;
  isOver?: boolean;
  isInvalidDropTarget?: boolean;
  onSetRoot?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

function MemberCardInner({
  member,
  isDragging,
  isOver,
  isInvalidDropTarget,
  onSetRoot,
  dragHandleProps,
}: MemberCardProps) {
  return (
    <Card
      className={cn(
        "w-48 transition-shadow",
        isDragging && "opacity-40",
        isOver &&
          !isInvalidDropTarget &&
          "ring-2 ring-[color:var(--color-brand-electric)] shadow-md",
        isOver &&
          isInvalidDropTarget &&
          "ring-2 ring-[color:var(--color-brand-danger)]"
      )}
    >
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-start gap-2">
          <button
            type="button"
            {...dragHandleProps}
            className="mt-0.5 cursor-grab active:cursor-grabbing text-[color:var(--color-brand-mist)] hover:text-[color:var(--color-brand-paper)] transition-colors touch-none"
            aria-label={`Drag ${personName(member)}`}
          >
            <GripVertical className="size-4" />
          </button>
          <div className="size-9 rounded-full bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-paper)] flex items-center justify-center text-xs font-semibold ring-1 ring-[color:var(--color-brand-fog)] shrink-0">
            {member.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.avatar_url}
                alt={personName(member)}
                className="size-full rounded-full object-cover"
              />
            ) : (
              getInitials(personName(member))
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-snug truncate">
              {personName(member)}
            </p>
            {member.title && (
              <p className="text-[11px] text-muted-foreground truncate">
                {member.title}
              </p>
            )}
          </div>
        </div>

        {onSetRoot && member.reports_to !== null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 self-start px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={onSetRoot}
          >
            <ArrowUpFromLine className="size-3" />
            Set as Root
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface DraggableMemberCardProps {
  member: Person;
  invalidDropIds: Set<string>;
  draggingId: string | null;
  onSetRoot: () => void;
}

function DraggableMemberCard({
  member,
  invalidDropIds,
  draggingId,
  onSetRoot,
}: DraggableMemberCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: member.id });

  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: member.id,
  });

  const isInvalid =
    draggingId !== null &&
    draggingId !== member.id &&
    invalidDropIds.has(member.id);

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      className="touch-none"
    >
      <MemberCardInner
        member={member}
        isDragging={isDragging}
        isOver={isOver && draggingId !== null && draggingId !== member.id}
        isInvalidDropTarget={isInvalid}
        onSetRoot={onSetRoot}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

interface TreeRowProps {
  nodes: TreeNode[];
  invalidDropIds: Set<string>;
  draggingId: string | null;
  onSetRoot: (memberId: string) => void;
}

function TreeRow({
  nodes,
  invalidDropIds,
  draggingId,
  onSetRoot,
}: TreeRowProps) {
  if (nodes.length === 0) return null;
  return (
    <div className="flex items-start justify-center gap-6">
      {nodes.map((node) => (
        <div key={node.member.id} className="flex flex-col items-center gap-3">
          <DraggableMemberCard
            member={node.member}
            invalidDropIds={invalidDropIds}
            draggingId={draggingId}
            onSetRoot={() => onSetRoot(node.member.id)}
          />
          {node.children.length > 0 && (
            <>
              <div
                aria-hidden
                className="h-4 w-px bg-[color:var(--color-brand-fog)]"
              />
              <TreeRow
                nodes={node.children}
                invalidDropIds={invalidDropIds}
                draggingId={draggingId}
                onSetRoot={onSetRoot}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function OrgChart({ members, onMembersChange }: OrgChartProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const { roots, byId } = useMemo(() => buildTree(members), [members]);

  // Descendants of the currently dragged member (cycle protection).
  const invalidDropIds = useMemo(() => {
    if (!draggingId) return new Set<string>();
    const desc = getDescendantIds(draggingId, byId);
    desc.add(draggingId); // can't drop onto self
    return desc;
  }, [draggingId, byId]);

  const draggingMember = draggingId
    ? (members.find((m) => m.id === draggingId) ?? null)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
    setErrorMsg(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDraggingId(null);

    if (!over) return;
    const draggedId = String(active.id);
    const targetId = String(over.id);
    if (draggedId === targetId) return;

    // Cycle check: target must not be a descendant of the dragged member.
    const descendants = getDescendantIds(draggedId, byId);
    if (descendants.has(targetId)) {
      const draggedName =
        personNameOr(members.find((m) => m.id === draggedId), "Member");
      const targetName =
        personNameOr(members.find((m) => m.id === targetId), "target");
      setErrorMsg(
        `Cannot make ${draggedName} report to ${targetName} — that would create a cycle.`
      );
      return;
    }

    const dragged = members.find((m) => m.id === draggedId);
    if (!dragged) return;
    if (dragged.reports_to === targetId) return; // no change

    // Optimistic update
    const updated: Person = { ...dragged, reports_to: targetId };
    onMembersChange(members.map((m) => (m.id === dragged.id ? updated : m)));

    const supabase = createClient();
    const { error } = await supabase
      .from("team_members")
      .update({ reports_to: targetId })
      .eq("id", dragged.id);

    if (error) {
      // Revert
      onMembersChange(members.map((m) => (m.id === dragged.id ? dragged : m)));
      setErrorMsg(`Failed to update reporting line: ${error.message}`);
    }
  }

  async function handleSetRoot(memberId: string) {
    const member = members.find((m) => m.id === memberId);
    if (!member || member.reports_to === null) return;
    const updated: Person = { ...member, reports_to: null };
    onMembersChange(members.map((m) => (m.id === member.id ? updated : m)));

    const supabase = createClient();
    const { error } = await supabase
      .from("team_members")
      .update({ reports_to: null })
      .eq("id", member.id);

    if (error) {
      onMembersChange(members.map((m) => (m.id === member.id ? member : m)));
      setErrorMsg(`Failed to set as root: ${error.message}`);
    }
  }

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex items-center justify-center h-48 text-sm text-muted-foreground">
        No active team members yet. Add members in the Roster tab.
      </div>
    );
  }

  const allAreRoots = members.every((m) => m.reports_to === null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Drag any card onto another card to make it report to that person.
          Click <span className="font-medium">Set as Root</span> to remove
          someone&apos;s manager.
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-md border border-[color:var(--color-brand-danger)]/30 bg-[color:var(--color-brand-danger)]/10 px-3 py-2 text-xs text-[color:var(--color-brand-danger)]"
        >
          {errorMsg}
        </div>
      )}

      {allAreRoots && (
        <div className="rounded-md border border-dashed border-[color:var(--color-brand-fog)] px-3 py-2 text-xs text-muted-foreground">
          No hierarchy yet — every member is a root. Drag any card onto another
          to build the org tree.
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div className="overflow-x-auto pb-6">
          <div className="min-w-fit px-4 pt-2">
            <TreeRow
              nodes={roots}
              invalidDropIds={invalidDropIds}
              draggingId={draggingId}
              onSetRoot={handleSetRoot}
            />
          </div>
        </div>

        <DragOverlay>
          {draggingMember ? <MemberCardInner member={draggingMember} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
