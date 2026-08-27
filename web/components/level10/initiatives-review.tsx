"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Target } from "lucide-react";
import { toast } from "sonner";
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
import { Progress } from "@/components/ui/progress";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { cn } from "@/lib/utils";
import { createIdsItem } from "@/lib/eos-actions";
import type { Initiative, InitiativeStatus } from "@/lib/supabase/types";

interface InitiativesReviewProps {
  initialInitiatives: Initiative[];
}

const STATUS_STYLES: Record<InitiativeStatus, string> = {
  on_track:
    "bg-[color:var(--color-brand-success)]/15 text-[color:var(--color-brand-success)]",
  at_risk:
    "bg-[color:var(--color-brand-warning)]/15 text-[color:var(--color-brand-warning)]",
  off_track:
    "bg-[color:var(--color-brand-danger)]/15 text-[color:var(--color-brand-danger)]",
  complete:
    "bg-[color:var(--color-brand-aqua)]/15 text-[color:var(--color-brand-aqua)]",
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

function sortInitiatives(items: Initiative[]): Initiative[] {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function InitiativesReview({
  initialInitiatives,
}: InitiativesReviewProps) {
  const orgId = useActiveOrgId();
  const [initiatives, setInitiatives] = useState<Initiative[]>(
    sortInitiatives(initialInitiatives)
  );
  const [escalateTarget, setEscalateTarget] = useState<Initiative | null>(null);
  const [escalateTitle, setEscalateTitle] = useState("");
  const [escalateDescription, setEscalateDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function refetch() {
      const { data } = await supabase
        .from("initiatives")
        .select("*")
        .eq("org_id", orgId)
        .not("status", "in", "(dropped,complete)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setInitiatives(sortInitiatives(data as Initiative[]));
    }

    const channel = supabase
      .channel("initiatives-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "initiatives",
          filter: `org_id=eq.${orgId}`,
        },
        refetch
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId]);

  function openEscalate(initiative: Initiative) {
    setEscalateTarget(initiative);
    setEscalateTitle(`${initiative.title} — needs IDS`);
    setEscalateDescription(initiative.description ?? "");
    setError(null);
  }

  function closeEscalate() {
    setEscalateTarget(null);
    setEscalateTitle("");
    setEscalateDescription("");
    setError(null);
  }

  async function handleEscalate(e: React.FormEvent) {
    e.preventDefault();
    if (!escalateTarget) return;
    if (!escalateTitle.trim()) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    // Server action so the escalated issue records who escalated it — the
    // same stamp every other IDS creation path writes.
    const result = await createIdsItem({
      title: escalateTitle,
      description: escalateDescription,
      priority: 10,
      ownerId: escalateTarget.owner_id,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success("Escalated to IDS");
    closeEscalate();
  }

  return (
    <div className="space-y-3">
      {initiatives.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex flex-col items-center justify-center py-12 text-center">
          <Target className="size-8 text-[color:var(--color-brand-mist)] mb-2" />
          <p className="text-sm font-medium">No active initiatives</p>
          <p className="text-xs text-muted-foreground mt-1">
            Quarterly rocks and projects show up here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {initiatives.map((initiative) => (
            <Card key={initiative.id}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm leading-snug">
                        {initiative.title}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_STYLES[initiative.status]
                        )}
                      >
                        {STATUS_LABELS[initiative.status]}
                      </span>
                      {initiative.quarter && (
                        <span className="text-xs text-muted-foreground">
                          {initiative.quarter}
                        </span>
                      )}
                    </div>
                    {initiative.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {initiative.description}
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEscalate(initiative)}
                  >
                    <AlertTriangle className="size-3.5" />
                    Escalate to IDS
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <Progress
                    value={initiative.progress}
                    className="h-1.5 flex-1"
                  />
                  <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                    {initiative.progress}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {initiative.owner_id
                      ? `Owner: ${initiative.owner_id}`
                      : "Unassigned"}
                  </span>
                  {initiative.due_date && (
                    <span>
                      Due{" "}
                      {new Date(initiative.due_date).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" }
                      )}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!escalateTarget}
        onOpenChange={(open) => {
          if (!open) closeEscalate();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escalate to IDS</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEscalate} className="space-y-4 pt-1">
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="escalate-title"
              >
                Title{" "}
                <span className="text-[color:var(--color-brand-danger)]">
                  *
                </span>
              </label>
              <Input
                id="escalate-title"
                value={escalateTitle}
                onChange={(e) => setEscalateTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="escalate-desc"
              >
                Description
              </label>
              <Textarea
                id="escalate-desc"
                value={escalateDescription}
                onChange={(e) => setEscalateDescription(e.target.value)}
                className="min-h-20"
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
                onClick={closeEscalate}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Escalating…" : "Create IDS Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
