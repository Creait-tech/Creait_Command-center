"use client";

/**
 * Follow-through — the day-30 and day-90 reviews.
 *
 * This is the only part of the module that runs AFTER the client has the
 * document, and it is the only thing that tells us whether the instrument was
 * right. One row per 90-day plan item, planned against actual, in the client's
 * own KPI where there is one.
 *
 * It writes `outcomes` and nothing else. Migration 0012's delivered lock
 * deliberately does not cover that column — a review of a delivered
 * engagement cannot change a word of what was delivered, and a lock that
 * refused it would leave the instrument unable to learn from itself.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveOutcomes, type OutcomeDay } from "@/lib/assessment-actions";
/** The same business date the server actions stamp — see lib/business-date.ts. */
import { todayInET } from "@/lib/business-date";
import type {
  AssessmentOutcomeReview,
  AssessmentOutcomes,
  CcAssessment,
} from "@/lib/supabase/types";

type ItemStatus = AssessmentOutcomeReview["items"][number]["status"];

const STATUS_LABELS: Record<ItemStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  dropped: "Dropped",
};

const STATUS_ORDER: ItemStatus[] = ["not_started", "in_progress", "done", "dropped"];

const DAYS: Array<{ id: OutcomeDay; label: string; when: string }> = [
  { id: "day30", label: "Day 30", when: "one month after the results session" },
  { id: "day90", label: "Day 90", when: "at the end of the plan" },
];

interface ItemDraft {
  status: ItemStatus;
  kpi: string;
  baseline: string;
  actual: string;
  note: string;
}

interface ReviewDraft {
  reviewed_on: string;
  reviewer: string;
  summary: string;
  items: ItemDraft[];
}

function parseOutcomes(value: unknown): AssessmentOutcomes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AssessmentOutcomes;
}

function draftFor(
  stored: AssessmentOutcomeReview | undefined,
  planItems: string[],
  reviewer: string
): ReviewDraft {
  const byItem = new Map<string, AssessmentOutcomeReview["items"][number]>();
  for (const item of stored?.items ?? []) byItem.set(item.plan_item, item);
  return {
    reviewed_on: stored?.reviewed_on ?? todayInET(),
    reviewer: stored?.reviewer ?? reviewer,
    summary: stored?.summary ?? "",
    items: planItems.map((plan) => {
      const row = byItem.get(plan);
      return {
        status: row?.status ?? "not_started",
        kpi: row?.kpi ?? "",
        baseline: row?.baseline ?? "",
        actual: row?.actual ?? "",
        note: row?.note ?? "",
      };
    }),
  };
}

export function OutcomesStep({
  assessment,
  planItems,
  currentUserName,
  onAssessment,
}: {
  assessment: CcAssessment;
  planItems: string[];
  currentUserName: string;
  onAssessment: (next: CcAssessment) => void;
}) {
  const stored = useMemo(() => parseOutcomes(assessment.outcomes), [assessment.outcomes]);
  const [drafts, setDrafts] = useState<Record<OutcomeDay, ReviewDraft>>(() => ({
    day30: draftFor(stored.day30, planItems, currentUserName),
    day90: draftFor(stored.day90, planItems, currentUserName),
  }));
  const [saving, setSaving] = useState<OutcomeDay | null>(null);

  function patchDraft(day: OutcomeDay, patch: Partial<ReviewDraft>) {
    setDrafts((p) => ({ ...p, [day]: { ...p[day], ...patch } }));
  }

  function patchItem(day: OutcomeDay, index: number, patch: Partial<ItemDraft>) {
    setDrafts((p) => {
      const items = [...p[day].items];
      items[index] = { ...items[index], ...patch };
      return { ...p, [day]: { ...p[day], items } };
    });
  }

  async function save(day: OutcomeDay) {
    const draft = drafts[day];
    setSaving(day);
    const res = await saveOutcomes(assessment.id, day, {
      reviewed_on: draft.reviewed_on,
      reviewer: draft.reviewer,
      summary: draft.summary,
      items: draft.items.map((item, i) => ({
        plan_item: planItems[i],
        status: item.status,
        kpi: item.kpi,
        baseline: item.baseline,
        actual: item.actual,
        note: item.note,
      })),
    });
    setSaving(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onAssessment(res.data!.assessment);
    toast.success(`${day === "day30" ? "Day 30" : "Day 90"} review saved.`);
  }

  return (
    <div className="flex flex-col gap-6 border-t border-border/60 pt-4">
      <div>
        <h3 className="text-[13px] font-semibold">Follow-through</h3>
        <p className="mt-1 max-w-[74ch] text-[12px] leading-relaxed text-muted-foreground">
          Planned against actual, one row per plan item. Recorded after
          delivery, and the only record of whether the diagnostic was right —
          it changes nothing in the document the client is holding.
        </p>
      </div>

      {planItems.length === 0 && (
        <p className="text-[12.5px] text-muted-foreground">
          There is no 90-day plan on this engagement, so there is nothing to
          review against. Add the priorities on the plan step first.
        </p>
      )}

      {DAYS.map(({ id, label, when }) => {
        const draft = drafts[id];
        const savedOn = stored[id]?.reviewed_on ?? null;
        return (
          <section key={id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h4 className="text-[13px] font-semibold">
                {label}
                <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                  {when}
                </span>
              </h4>
              <span className="text-[11.5px] text-muted-foreground">
                {savedOn ? `Recorded ${savedOn}` : "Not recorded yet"}
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Reviewed on
                </span>
                <Input
                  type="date"
                  className="h-8 w-40 text-xs"
                  value={draft.reviewed_on}
                  onChange={(e) =>
                    patchDraft(id, { reviewed_on: e.target.value })
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Reviewer
                </span>
                <Input
                  className="h-8 w-56 text-xs"
                  value={draft.reviewer}
                  onChange={(e) => patchDraft(id, { reviewer: e.target.value })}
                  placeholder="Maurice Grant"
                />
              </label>
            </div>

            {planItems.length > 0 && (
              <ul className="flex flex-col divide-y divide-border/50">
                {planItems.map((plan, index) => {
                  const item = draft.items[index] ?? {
                    status: "not_started" as ItemStatus,
                    kpi: "",
                    baseline: "",
                    actual: "",
                    note: "",
                  };
                  return (
                    <li key={`${id}-${index}`} className="flex flex-col gap-2 py-3">
                      <p className="text-[13px] leading-snug">
                        <span className="mr-2 tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        {plan}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={item.status}
                          onValueChange={(v) =>
                            typeof v === "string" &&
                            patchItem(id, index, { status: v as ItemStatus })
                          }
                        >
                          <SelectTrigger
                            className="h-8 w-36 text-xs"
                            aria-label={`Status of priority ${index + 1}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_ORDER.map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="h-8 w-52 text-xs"
                          value={item.kpi}
                          onChange={(e) =>
                            patchItem(id, index, { kpi: e.target.value })
                          }
                          placeholder="KPI"
                          aria-label={`KPI for priority ${index + 1}`}
                        />
                        <Input
                          className="h-8 w-28 text-xs tabular-nums"
                          value={item.baseline}
                          onChange={(e) =>
                            patchItem(id, index, { baseline: e.target.value })
                          }
                          placeholder="Baseline"
                          aria-label={`Baseline for priority ${index + 1}`}
                        />
                        <Input
                          className="h-8 w-28 text-xs tabular-nums"
                          value={item.actual}
                          onChange={(e) =>
                            patchItem(id, index, { actual: e.target.value })
                          }
                          placeholder="Actual"
                          aria-label={`Actual for priority ${index + 1}`}
                        />
                        <Input
                          className="h-8 min-w-48 flex-1 text-xs"
                          value={item.note}
                          onChange={(e) =>
                            patchItem(id, index, { note: e.target.value })
                          }
                          placeholder="What actually happened"
                          aria-label={`Note for priority ${index + 1}`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                Summary
                <span className="ml-1.5 font-normal text-muted-foreground/70">
                  what moved, what didn&apos;t, and what you&apos;d change
                </span>
              </span>
              <Textarea
                className="min-h-20"
                value={draft.summary}
                onChange={(e) => patchDraft(id, { summary: e.target.value })}
              />
            </label>

            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void save(id)}
                disabled={saving !== null}
              >
                {saving === id ? "Saving…" : `Save ${label} review`}
              </Button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
