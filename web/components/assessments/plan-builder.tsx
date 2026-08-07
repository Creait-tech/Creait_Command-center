"use client";

/**
 * The 90-day plan.
 *
 * Every mutation is a single named operation against the stored array —
 * append, remove, reorder — never a whole-array write from a client snapshot.
 * That was a real bug: two items typed in quick succession raced, and the second
 * write, built from pre-first-write state, silently dropped the first. The queue
 * below serialises them; the server reads the current array and applies one
 * change.
 */

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PlanBuilder({
  items,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
  onMove,
}: {
  items: string[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (item: string, index: number) => void;
  onMove: (item: string, index: number, direction: "up" | "down") => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No priorities yet. The Results Session hands them five and lets the
          owner choose three — write all five here, in the order you&apos;d
          defend.
        </p>
      ) : (
        <ol className="divide-y divide-border/50">
          {items.map((item, i) => (
            <li
              key={`${i}-${item}`}
              className="group flex items-start gap-3 py-2.5"
            >
              <span className="mt-px w-4 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground/70">
                {i + 1}
              </span>
              <p className="min-w-0 flex-1 text-sm leading-snug">{item}</p>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Move "${item}" up`}
                  disabled={i === 0}
                  onClick={() => onMove(item, i, "up")}
                >
                  <ArrowUp className="size-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Move "${item}" down`}
                  disabled={i === items.length - 1}
                  onClick={() => onMove(item, i, "down")}
                >
                  <ArrowDown className="size-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Remove "${item}"`}
                  className="text-muted-foreground hover:text-[color:var(--color-brand-danger)]"
                  onClick={() => onRemove(item, i)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex gap-2 border-t border-border/60 pt-3">
        <Input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder="Add a priority — owner, first action, deadline, KPI"
        />
        <Button variant="outline" onClick={onAdd} disabled={!draft.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </div>
  );
}
