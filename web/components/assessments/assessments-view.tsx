"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck, FlaskConical, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createAssessment } from "@/lib/assessment-actions";
import type { AssessmentStatus, CcAssessment } from "@/lib/supabase/types";

export const STATUS_LABELS: Record<AssessmentStatus, string> = {
  practice: "Practice",
  intake: "Intake",
  scoring: "Scoring",
  review: "Review",
  delivered: "Delivered",
};

export const STATUS_STYLES: Record<AssessmentStatus, string> = {
  practice: "bg-[color:var(--color-brand-violet)]/15 text-[color:var(--color-brand-violet)]",
  intake: "bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)]",
  scoring: "bg-[color:var(--color-brand-aqua)]/15 text-[color:var(--color-brand-aqua)]",
  review: "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)]",
  delivered: "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]",
};

export function PracticeBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[color:var(--color-brand-violet)]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--color-brand-violet)]",
        className
      )}
    >
      <FlaskConical className="size-3" /> Practice
    </span>
  );
}

/**
 * Which follow-through reviews exist on an engagement (migration 0013). A
 * review counts as recorded once it carries a date — an empty draft written by
 * a mis-click should not put a tick on the list.
 */
function outcomeMarks(value: unknown): Array<"30d" | "90d"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const outcomes = value as Record<string, unknown>;
  const has = (key: string) => {
    const review = outcomes[key];
    return (
      !!review &&
      typeof review === "object" &&
      !Array.isArray(review) &&
      typeof (review as { reviewed_on?: unknown }).reviewed_on === "string" &&
      ((review as { reviewed_on: string }).reviewed_on ?? "").trim().length > 0
    );
  };
  const marks: Array<"30d" | "90d"> = [];
  if (has("day30")) marks.push("30d");
  if (has("day90")) marks.push("90d");
  return marks;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const date = new Date(`${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
function NewAssessmentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [isPractice, setIsPractice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) {
      toast.error("Client name required");
      return;
    }
    setSubmitting(true);
    const res = await createAssessment({
      client_name: clientName,
      company,
      industry,
      is_practice: isPractice,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onOpenChange(false);
    toast.success(isPractice ? "Practice engagement created" : "Assessment created");
    router.push(`/assessments/${res.data!.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Assessment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Client name *
            </label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Dana Brooks"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Company
            </label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Summit Exterior Services"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Industry
            </label>
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. Property services"
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-brand-fog)]/60 bg-[color:var(--color-brand-slate)]/30 px-3 py-2.5 cursor-pointer">
            <span className="flex flex-col">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <FlaskConical className="size-3.5 text-[color:var(--color-brand-violet)]" />
                Practice mode
              </span>
              <span className="text-xs text-muted-foreground">
                Rehearsal engagement — watermarked, excluded from counts.
              </span>
            </span>
            <Switch
              checked={isPractice}
              onCheckedChange={(c) => setIsPractice(c === true)}
            />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !clientName.trim()}>
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
export function AssessmentsView({
  initialAssessments,
}: {
  initialAssessments: CcAssessment[];
}) {
  const [newOpen, setNewOpen] = useState(false);

  // Practice engagements are excluded from every count.
  const real = useMemo(
    () => initialAssessments.filter((a) => !a.is_practice),
    [initialAssessments]
  );
  const practice = useMemo(
    () => initialAssessments.filter((a) => a.is_practice),
    [initialAssessments]
  );
  const inFlight = real.filter((a) => a.status !== "delivered").length;
  const delivered = real.filter((a) => a.status === "delivered").length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
          <span>
            <span className="tabular-nums font-semibold text-foreground">
              {inFlight}
            </span>{" "}
            in flight
          </span>
          <span className="border-l border-border pl-3">
            <span className="tabular-nums font-semibold text-[color:var(--color-brand-success)]">
              {delivered}
            </span>{" "}
            delivered
          </span>
          {practice.length > 0 && (
            <span className="border-l border-border pl-3 text-xs">
              {practice.length} practice (not counted)
            </span>
          )}
        </div>
        <Button onClick={() => setNewOpen(true)} size="sm">
          <Plus className="size-4" /> New assessment
        </Button>
      </div>

      {initialAssessments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex flex-col items-center justify-center gap-2 h-40 text-sm text-muted-foreground">
          <ClipboardCheck className="size-6" />
          No engagements yet — create a practice run to rehearse the flow.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialAssessments.map((a) => (
            <Link
              key={a.id}
              href={`/assessments/${a.id}`}
              className="rounded-xl"
              aria-label={`Open assessment for ${a.client_name}`}
            >
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col gap-3 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-snug truncate">
                        {a.client_name}
                      </p>
                      {a.company && (
                        <p className="text-xs text-muted-foreground truncate">
                          {a.company}
                        </p>
                      )}
                    </div>
                    {a.is_practice && <PracticeBadge />}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_STYLES[a.status]
                        )}
                      >
                        {STATUS_LABELS[a.status]}
                      </span>
                      {a.converted_to && (
                        <span
                          title={`Became ${a.converted_to === "build" ? "a Build" : "an Advisory retainer"}${a.converted_on ? ` on ${formatDate(a.converted_on)}` : ""} — Diagnostic fee credited`}
                          className="rounded-full bg-[color:var(--color-brand-electric)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--color-brand-electric)]"
                        >
                          → {a.converted_to === "build" ? "Build" : "Advisory"}
                        </span>
                      )}
                      {outcomeMarks(a.outcomes).map((mark) => (
                        <span
                          key={mark}
                          title={`${mark === "30d" ? "Day 30" : "Day 90"} follow-through recorded`}
                          className="rounded-full bg-[color:var(--color-brand-success)]/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[color:var(--color-brand-success)]"
                        >
                          {mark} ✓
                        </span>
                      ))}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.status === "delivered"
                        ? `Delivered ${formatDate(a.delivered_at)}`
                        : `Started ${formatDate(a.started_at)}`}
                    </span>
                  </div>
                  {a.primary_constraint && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {a.primary_constraint}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <NewAssessmentDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}
