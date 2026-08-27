"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Plus, Table2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type Person } from "@/lib/authorship";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type { KpiHistory } from "@/lib/supabase/types";
import { useActiveOrgId } from "@/lib/use-active-org";
import { cn } from "@/lib/utils";
import { saveWeeklyKpiValue } from "@/app/(dashboard)/level-10/actions";

import { KpiFormDialog } from "./kpi-form-dialog";
import { asKpiRows, formatKpiValue, type KpiRow } from "./kpi-meta";
import { PeriodUnavailable, type UnavailablePeriod } from "./period-unavailable";
import { Scoreboard } from "./scoreboard";
import { TrailingView } from "./trailing-view";
import { WeeklyGrid } from "./weekly-grid";
import { isCappedWeek } from "./weeks";
import {
  asWeeklyRows,
  indexWeekly,
  weeklyKey,
  type CcKpiWeekly,
} from "./weekly-types";

/**
 * The Level 10 scorecard.
 *
 * Modelled on Ninety.io's Data page because that is the shape the team already
 * recognises: one row per measurable, a status bar on the row's left edge, the
 * owner and the goal pinned on the left, and the weeks running right-to-left
 * with the most recent first. Two of Ninety's five period tabs are real here;
 * the other three say what they are missing instead of rendering a roll-up
 * nobody should act on. See `period-unavailable.tsx`.
 */

const PERIOD_TABS = [
  "weekly",
  "trailing",
  "monthly",
  "quarterly",
  "annual",
] as const;
type PeriodTab = (typeof PERIOD_TABS)[number];

const UNAVAILABLE: Partial<Record<PeriodTab, UnavailablePeriod>> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

function sortKpis(kpis: KpiRow[]): KpiRow[] {
  return [...kpis].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
}

interface ScorecardProps {
  initialKpis: KpiRow[];
  initialWeekly: CcKpiWeekly[];
  initialHistory: KpiHistory[];
  people: Person[];
  /** Newest first. Computed on the server so both renders agree on the weeks. */
  weekStarts: string[];
}

export function Scorecard({
  initialKpis,
  initialWeekly,
  initialHistory,
  people,
  weekStarts,
}: ScorecardProps) {
  const orgId = useActiveOrgId();
  const [kpis, setKpis] = useState<KpiRow[]>(() => sortKpis(initialKpis));
  const [weekly, setWeekly] = useState<CcKpiWeekly[]>(initialWeekly);
  const [period, setPeriod] = useState<PeriodTab>("weekly");
  const [view, setView] = useState<"grid" | "cards">("grid");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KpiRow | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<KpiRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const entries = useMemo(() => indexWeekly(weekly), [weekly]);
  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );

  const nextSortOrder = useMemo(
    () => (kpis.length === 0 ? 0 : Math.max(...kpis.map((k) => k.sort_order)) + 1),
    [kpis],
  );

  // Coverage across *everything* on record, not just the weeks in view — the
  // Monthly/Quarterly/Annual panels report progress toward being buildable.
  const coverage = useMemo(() => {
    const recorded = new Set<string>();
    const usable = new Set<string>();
    for (const row of weekly) {
      if (row.value == null) continue;
      recorded.add(row.week_start);
      if (!isCappedWeek(row.week_start) || row.source === "manual") {
        usable.add(row.week_start);
      }
    }
    return { recordedWeeks: recorded.size, usableWeeks: usable.size };
  }, [weekly]);

  useEffect(() => {
    const supabase = createClient();

    async function refetchKpis() {
      const { data } = await supabase
        .from("kpis")
        .select("*")
        .eq("org_id", orgId)
        .order("sort_order", { ascending: true });
      if (data) setKpis(sortKpis(asKpiRows(data)));
    }

    async function refetchWeekly() {
      const { data } = await supabase
        .from("cc_kpi_weekly")
        .select("*")
        .eq("org_id", orgId)
        .order("week_start", { ascending: false });
      if (data) setWeekly(asWeeklyRows(data));
    }

    const channel = supabase
      .channel("level10-scorecard")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kpis",
          filter: `org_id=eq.${orgId}`,
        },
        refetchKpis,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cc_kpi_weekly",
          filter: `org_id=eq.${orgId}`,
        },
        refetchWeekly,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId]);

  /**
   * Write one week's number.
   *
   * Optimistic so entry during a live meeting feels immediate, but the stored
   * row replaces the guess as soon as it comes back — including the correction
   * log, which is written server-side and can't be predicted here. A failed
   * write rolls the cell back: the one thing this must never do is leave a
   * number on screen that isn't in the database.
   */
  async function handleSaveCell(
    kpiId: string,
    weekStart: string,
    value: number | null,
  ): Promise<boolean> {
    const kpi = kpis.find((k) => k.id === kpiId);
    const existing = entries.get(weeklyKey(kpiId, weekStart));
    const previous = weekly;

    setWeekly((rows) => {
      const optimistic: CcKpiWeekly = existing
        ? { ...existing, value, source: "manual" }
        : {
            id: `pending-${kpiId}-${weekStart}`,
            org_id: orgId,
            kpi_id: kpiId,
            week_start: weekStart,
            value,
            source: "manual",
            entered_by: null,
            entered_by_name: null,
            corrections: [],
            created_at: "",
            updated_at: "",
          };
      const rest = rows.filter(
        (r) => !(r.kpi_id === kpiId && r.week_start === weekStart),
      );
      return [...rest, optimistic];
    });

    const result = await saveWeeklyKpiValue({ kpiId, weekStart, value });

    if (!result.ok) {
      setWeekly(previous);
      toast.error(result.error);
      return false;
    }

    const saved = result.data;
    setWeekly((rows) => [
      ...rows.filter((r) => !(r.kpi_id === kpiId && r.week_start === weekStart)),
      saved,
    ]);

    // A retroactive change is worth saying out loud once — quietly rewriting a
    // number the team already discussed is the thing to avoid.
    if (existing?.value != null && existing.value !== value) {
      const unit = kpi?.unit ?? null;
      toast.success(
        `Corrected ${formatKpiValue(existing.value, unit)} → ${
          value == null ? "blank" : formatKpiValue(value, unit)
        }`,
        { description: "The previous value is kept on the cell's history." },
      );
    }

    return true;
  }

  function openCreate() {
    setEditingKpi(null);
    setSessionKey((n) => n + 1);
    setDialogOpen(true);
  }

  function openEdit(kpi: KpiRow) {
    setEditingKpi(kpi);
    setSessionKey((n) => n + 1);
    setDialogOpen(true);
  }

  function handleSaved(saved: KpiRow, mode: "create" | "edit") {
    setKpis((prev) =>
      mode === "create"
        ? sortKpis([...prev, saved])
        : sortKpis(prev.map((k) => (k.id === saved.id ? saved : k))),
    );
  }

  async function confirmDelete() {
    const kpi = pendingDelete;
    if (!kpi) return;
    setDeleting(true);
    const supabase = createClient();

    // `cc_kpi_weekly.kpi_id` and `cc_kpi_history.kpi_id` are both
    // `ON DELETE CASCADE`, so Postgres takes the weeks and the trend with the
    // KPI. `.select()` is what makes a refusal visible: an RLS-blocked DELETE
    // matches zero rows and returns success.
    const { data, error } = await supabase
      .from("kpis")
      .delete()
      .eq("id", kpi.id)
      .eq("org_id", orgId)
      .select("id");

    setDeleting(false);

    if (error || !data || data.length === 0) {
      toast.error(
        error?.message ??
          "Couldn't delete that KPI — it no longer exists, or your session doesn't have permission for it.",
      );
      return;
    }

    setKpis((prev) => prev.filter((k) => k.id !== kpi.id));
    setWeekly((prev) => prev.filter((r) => r.kpi_id !== kpi.id));
    setPendingDelete(null);
    toast.success(`"${kpi.name}" deleted`);
  }

  const deleteWeekCount = pendingDelete
    ? weekly.filter((r) => r.kpi_id === pendingDelete.id && r.value != null).length
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          One row per measurable, one column per week, most recent first. Click
          any cell — including a past week — to enter or correct that week&apos;s
          number.
        </p>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Scorecard layout"
            className="flex items-center rounded-lg border border-[color:var(--color-brand-fog)] p-0.5"
          >
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              title="Weekly grid"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                view === "grid"
                  ? "bg-[color:var(--color-brand-slate)] text-foreground"
                  : "text-[color:var(--color-brand-mist)] hover:text-foreground",
              )}
            >
              <Table2 className="size-3.5" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setView("cards")}
              aria-pressed={view === "cards"}
              title="Cards — current value, sync freshness and 30-day trend"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
                view === "cards"
                  ? "bg-[color:var(--color-brand-slate)] text-foreground"
                  : "text-[color:var(--color-brand-mist)] hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-3.5" />
              Cards
            </button>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Add KPI
          </Button>
        </div>
      </div>

      {kpis.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--color-brand-fog)] py-12 text-center">
          <p className="text-sm font-medium">No KPIs on the scorecard</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Add the handful of numbers this team measures every week — 5 to 15 is
            the EOS rule of thumb, each with an owner, a target and a direction.
          </p>
          <Button size="sm" onClick={openCreate} className="mt-3">
            <Plus className="size-4" />
            Add your first KPI
          </Button>
        </div>
      ) : view === "cards" ? (
        <Scoreboard
          initialKpis={kpis}
          initialHistory={initialHistory}
          people={people}
          showHeader={false}
        />
      ) : (
        <Tabs
          value={period}
          onValueChange={(v) =>
            typeof v === "string" && setPeriod(v as PeriodTab)
          }
        >
          <TabsList>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="trailing">T4W &amp; T13W</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
            <TabsTrigger value="annual">Annual</TabsTrigger>
          </TabsList>

          <TabsContent value="weekly" className="mt-4">
            <WeeklyGrid
              kpis={kpis}
              weekStarts={weekStarts}
              entries={entries}
              peopleById={peopleById}
              onSaveCell={handleSaveCell}
              onEditKpi={openEdit}
              onDeleteKpi={setPendingDelete}
            />
          </TabsContent>

          <TabsContent value="trailing" className="mt-4">
            <TrailingView
              kpis={kpis}
              weekStarts={weekStarts}
              entries={entries}
              peopleById={peopleById}
            />
          </TabsContent>

          {PERIOD_TABS.filter((t) => UNAVAILABLE[t]).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <PeriodUnavailable
                period={UNAVAILABLE[tab]!}
                recordedWeeks={coverage.recordedWeeks}
                usableWeeks={coverage.usableWeeks}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      <KpiFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        kpi={editingKpi}
        people={people}
        nextSortOrder={nextSortOrder}
        sessionKey={sessionKey}
        onSaved={handleSaved}
      />

      <Dialog
        open={pendingDelete != null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.name}?</DialogTitle>
            <DialogDescription>
              Its recorded weeks and trend history go with it
              {deleteWeekCount > 0 && (
                <>
                  {" "}
                  — including{" "}
                  <span className="font-data tabular-nums">
                    {deleteWeekCount}
                  </span>{" "}
                  recorded {deleteWeekCount === 1 ? "week" : "weeks"}
                </>
              )}
              . This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete KPI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
