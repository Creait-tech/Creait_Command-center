"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trophy } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CandidateCard } from "./candidate-card";
import { AddCandidateDialog } from "./add-candidate-dialog";
import { CandidateDetailModal } from "./candidate-detail-modal";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Candidate, CandidateStage } from "@/lib/supabase/types";

interface RecruitingBoardProps {
  initialCandidates: Candidate[];
  orgId: string;
}

interface StageDef {
  key: CandidateStage;
  label: string;
  accent: string; // CSS variable name (without var() wrapper)
}

const STAGES: StageDef[] = [
  { key: "applied", label: "Applied", accent: "--color-brand-mist" },
  { key: "screening", label: "Screening", accent: "--color-brand-electric" },
  { key: "interview", label: "Interview", accent: "--color-brand-warning" },
  { key: "offer", label: "Offer", accent: "--color-brand-violet" },
  { key: "hired", label: "Hired", accent: "--color-brand-success" },
  { key: "rejected", label: "Rejected", accent: "--color-brand-danger" },
  { key: "withdrew", label: "Withdrew", accent: "--color-brand-mist" },
];

interface ColumnProps {
  stage: StageDef;
  candidates: Candidate[];
  onCardClick: (c: Candidate) => void;
}

function Column({ stage, candidates, onCardClick }: ColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.key });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-[color:var(--color-brand-charcoal)]/40 transition-colors",
        isOver
          ? "border-[color:var(--color-brand-electric)]"
          : "border-[color:var(--color-brand-fog)]"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--color-brand-fog)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: `var(${stage.accent})` }}
            aria-hidden
          />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-brand-paper)]">
            {stage.label}
          </h2>
        </div>
        <span className="rounded-full bg-[color:var(--color-brand-fog)]/60 px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-brand-mist)]">
          {candidates.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2 min-h-32">
        {candidates.length === 0 ? (
          <div className="rounded-md border border-dashed border-[color:var(--color-brand-fog)] py-6 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
            empty
          </div>
        ) : (
          candidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              onClick={() => onCardClick(c)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface LeaderboardEntry {
  source: string;
  total: number;
  hired: number;
}

function Leaderboard({ candidates }: { candidates: Candidate[] }) {
  const entries = useMemo<LeaderboardEntry[]>(() => {
    const map = new Map<string, LeaderboardEntry>();
    for (const c of candidates) {
      const key = (c.source ?? "Unknown").trim() || "Unknown";
      const cur = map.get(key) ?? { source: key, total: 0, hired: 0 };
      cur.total += 1;
      if (c.stage === "hired") cur.hired += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.hired !== a.hired) return b.hired - a.hired;
      return b.total - a.total;
    });
  }, [candidates]);

  return (
    <aside className="hidden w-64 shrink-0 lg:flex lg:flex-col">
      <div className="sticky top-6 rounded-lg border border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-charcoal)]/40">
        <div className="flex items-center gap-2 border-b border-[color:var(--color-brand-fog)] px-3 py-2">
          <Trophy className="size-3.5 text-[color:var(--color-brand-gold)]" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-brand-paper)]">
            Source Leaderboard
          </h2>
        </div>
        <div className="p-2">
          {entries.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No sources yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {entries.map((e) => (
                <li
                  key={e.source}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-[color:var(--color-brand-slate)]/60"
                >
                  <span className="truncate text-[color:var(--color-brand-paper)]">
                    {e.source}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span
                      className="rounded bg-[color:var(--color-brand-success)]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--color-brand-success)]"
                      title="Hired"
                    >
                      {e.hired}
                    </span>
                    <span className="text-muted-foreground">/ {e.total}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

export function RecruitingBoard({ initialCandidates, orgId }: RecruitingBoardProps) {
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const sensors = useSensors(
    // Distance threshold lets plain clicks fall through to onClick on the card.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Realtime subscription on candidates.
  useEffect(() => {
    const supabase = createClient();

    async function refetch() {
      const { data } = await supabase
        .from("candidates")
        .select("*")
        .eq("org_id", orgId)
        .order("stage", { ascending: true })
        .order("sort_order", { ascending: true });
      if (data) setCandidates(data as Candidate[]);
    }

    const channel = supabase
      .channel("candidates-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "candidates",
          filter: `org_id=eq.${orgId}`,
        },
        refetch
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId]);

  // Group candidates by stage, preserving sort_order then created_at.
  const byStage = useMemo(() => {
    const buckets: Record<CandidateStage, Candidate[]> = {
      applied: [],
      screening: [],
      interview: [],
      offer: [],
      hired: [],
      rejected: [],
      withdrew: [],
    };
    for (const c of candidates) {
      buckets[c.stage]?.push(c);
    }
    for (const key of Object.keys(buckets) as CandidateStage[]) {
      buckets[key].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.created_at.localeCompare(b.created_at);
      });
    }
    return buckets;
  }, [candidates]);

  const detailCandidate = useMemo(
    () => candidates.find((c) => c.id === detailId) ?? null,
    [candidates, detailId]
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const candidateId = String(active.id);
    const targetStage = String(over.id) as CandidateStage;

    const moved = candidates.find((c) => c.id === candidateId);
    if (!moved) return;
    if (moved.stage === targetStage) return;
    if (!STAGES.some((s) => s.key === targetStage)) return;

    const nowIso = new Date().toISOString();

    // Optimistic update: move to top of new column, bump others.
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id === candidateId) {
          return {
            ...c,
            stage: targetStage,
            sort_order: 0,
            updated_at: nowIso,
          };
        }
        if (c.stage === targetStage) {
          return { ...c, sort_order: c.sort_order + 1 };
        }
        return c;
      })
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("candidates")
      .update({
        stage: targetStage,
        sort_order: 0,
        updated_at: nowIso,
      })
      .eq("id", candidateId);

    if (error) {
      // Rollback on failure.
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? { ...c, stage: moved.stage, sort_order: moved.sort_order }
            : c
        )
      );
    }
  }

  function handleDetailChange(updated: Candidate) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  }

  return (
    <>
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          {candidates.length}{" "}
          {candidates.length === 1 ? "candidate" : "candidates"} in pipeline
        </p>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--color-brand-electric)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-brand-charcoal)] hover:brightness-110 transition"
        >
          <Plus className="size-3.5" />
          Add Candidate
        </button>
      </div>

      <div className="flex gap-6">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex-1 min-w-0">
            {candidates.length === 0 && (
              <div className="mb-4 rounded-lg border border-dashed border-[color:var(--color-brand-fog)] p-4 text-center text-sm text-muted-foreground">
                No candidates yet — add your first prospect.
              </div>
            )}

            <div className="flex gap-3 overflow-x-auto pb-2 lg:gap-4">
              {STAGES.map((stage) => (
                <Column
                  key={stage.key}
                  stage={stage}
                  candidates={byStage[stage.key]}
                  onCardClick={(c) => setDetailId(c.id)}
                />
              ))}
            </div>
          </div>

          <Leaderboard candidates={candidates} />
        </DndContext>
      </div>

      <AddCandidateDialog open={addOpen} onOpenChange={setAddOpen} />

      <CandidateDetailModal
        candidate={detailCandidate}
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        onChanged={handleDetailChange}
      />
    </>
  );
}
