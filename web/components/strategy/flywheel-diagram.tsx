"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type { Strategy } from "@/lib/supabase/types";

interface FlywheelDiagramProps {
  strategy: Strategy | null;
  onUpdated: (next: Strategy) => void;
}

const DEFAULT_NODES = ["Attract", "Engage", "Convert", "Delight"];

function parseNodes(raw: string | null | undefined): string[] {
  if (!raw) return DEFAULT_NODES;
  // Field is TEXT in Postgres — try JSON first, fall back to default.
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { nodes?: unknown }).nodes)
    ) {
      const nodes = (parsed as { nodes: unknown[] }).nodes
        .filter((n): n is string => typeof n === "string")
        .slice(0, 4);
      if (nodes.length === 4) return nodes;
    }
  } catch {
    // Not JSON — treat as freeform text and keep defaults.
  }
  return DEFAULT_NODES;
}

// Place 4 nodes around a centered circle. SVG coords:
//   width=520, height=420, cx=260, cy=210, radius=150.
// Nodes at top, right, bottom, left.
const NODE_POSITIONS = [
  { x: 260, y: 50 }, // top
  { x: 470, y: 210 }, // right
  { x: 260, y: 370 }, // bottom
  { x: 50, y: 210 }, // left
];

export function FlywheelDiagram({
  strategy,
  onUpdated,
}: FlywheelDiagramProps) {
  const nodes = useMemo(() => parseNodes(strategy?.flywheel), [strategy]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(nodes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit() {
    setDraft(nodes);
    setError(null);
    setDialogOpen(true);
  }

  async function save() {
    if (!strategy) {
      setError("Strategy row not found. Cannot save.");
      return;
    }
    const cleaned = draft.map((n) => n.trim() || "Untitled");
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const nextFlywheel = JSON.stringify({ nodes: cleaned });
    const { data, error: updateError } = await supabase
      .from("strategy")
      .update({
        flywheel: nextFlywheel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", strategy.id)
      .select()
      .single();

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (data) onUpdated(data as Strategy);
    setDialogOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={openEdit}
          aria-label="Edit flywheel nodes"
        >
          <Pencil className="size-3.5" />
          Edit Nodes
        </Button>
      </div>

      <div className="flex justify-center">
        <svg
          role="img"
          aria-label="Flywheel diagram"
          viewBox="0 0 520 420"
          className="w-full max-w-2xl h-auto"
        >
          <defs>
            <marker
              id="flywheel-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path
                d="M0,0 L10,5 L0,10 z"
                fill="var(--color-brand-electric)"
              />
            </marker>
          </defs>

          {/* Curved arrows between consecutive nodes (clockwise loop) */}
          {NODE_POSITIONS.map((pos, i) => {
            const next = NODE_POSITIONS[(i + 1) % NODE_POSITIONS.length];
            // Curve outward from the circle center so the arc reads as a wheel.
            const mx = (pos.x + next.x) / 2;
            const my = (pos.y + next.y) / 2;
            const dx = mx - 260;
            const dy = my - 210;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const offset = 60;
            const cx = mx + (dx / len) * offset;
            const cy = my + (dy / len) * offset;
            // Start/end at node edge (node is r=58, leave a bit of breathing room).
            const startAngle = Math.atan2(cy - pos.y, cx - pos.x);
            const endAngle = Math.atan2(cy - next.y, cx - next.x);
            const r = 62;
            const sx = pos.x + Math.cos(startAngle) * r;
            const sy = pos.y + Math.sin(startAngle) * r;
            const ex = next.x + Math.cos(endAngle) * r;
            const ey = next.y + Math.sin(endAngle) * r;
            return (
              <path
                key={i}
                d={`M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`}
                fill="none"
                stroke="var(--color-brand-electric)"
                strokeWidth="2"
                strokeLinecap="round"
                markerEnd="url(#flywheel-arrow)"
                opacity="0.85"
              />
            );
          })}

          {/* Nodes */}
          {NODE_POSITIONS.map((pos, i) => (
            <g key={i}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r="58"
                fill="var(--color-brand-slate)"
                stroke="var(--color-brand-electric)"
                strokeWidth="2"
              />
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--color-brand-paper)"
                fontSize="14"
                fontWeight="600"
              >
                {nodes[i]}
              </text>
            </g>
          ))}

          {/* Center label */}
          <text
            x="260"
            y="205"
            textAnchor="middle"
            fill="var(--color-brand-mist)"
            fontSize="11"
            letterSpacing="2"
          >
            FLYWHEEL
          </text>
          <text
            x="260"
            y="222"
            textAnchor="middle"
            fill="var(--color-brand-mist)"
            fontSize="10"
            opacity="0.7"
          >
            (clockwise loop)
          </text>
        </svg>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {nodes.join(" → ")} → {nodes[0]}
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Flywheel Nodes</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {draft.map((value, idx) => (
              <div key={idx} className="space-y-1.5">
                <Label htmlFor={`flywheel-node-${idx}`}>Node {idx + 1}</Label>
                <Input
                  id={`flywheel-node-${idx}`}
                  value={value}
                  onChange={(e) => {
                    const next = [...draft];
                    next[idx] = e.target.value;
                    setDraft(next);
                  }}
                  placeholder={DEFAULT_NODES[idx]}
                />
              </div>
            ))}
            {error && (
              <p className="text-xs text-[color:var(--color-brand-danger)]">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
