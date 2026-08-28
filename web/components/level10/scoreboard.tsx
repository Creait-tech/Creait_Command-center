"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Check,
  X,
  Info,
  TrendingUp,
  ChevronDown,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { cn } from "@/lib/utils";
import type { KpiHistory } from "@/lib/supabase/types";
import { KpiFormDialog } from "./kpi-form-dialog";
import {
  asKpiRows,
  formatKpiValue,
  formatTarget,
  kpiWriteMode,
  writeModeCopy,
  type KpiRow,
  type KpiWriteMode,
} from "./kpi-meta";
import type { Person } from "@/lib/authorship";

interface ScoreboardProps {
  initialKpis: KpiRow[];
  initialHistory: KpiHistory[];
  /** Roster for the KPI dialog's owner picker. */
  people?: Person[];
  /**
   * The weekly grid in `scorecard.tsx` owns the "Add KPI" control and the
   * explanatory line when this view is nested inside it; showing a second set
   * would read as two different scoreboards on one screen.
   */
  showHeader?: boolean;
}

// A single charted point. `value` is the KPI value; `recorded_at` is the ISO
// timestamp; `t` is the epoch ms used for ordering.
interface TrendPoint {
  t: number;
  recorded_at: string;
  value: number;
}

function formatRelative(value: string | null): string {
  if (!value) return "Never synced";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "Never synced";
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

/**
 * Auto-synced KPIs are supposed to refresh hourly. When a sync is skipped —
 * the GHL pull failing, or the sync declining to write a value it can't
 * trust — the previous number stays on the card. Rendered in the same muted
 * grey as a fresh one, a two-day-old figure reads as current, which is how a
 * scoreboard quietly starts lying. Colour the timestamp by age instead.
 *
 * Keyed on write mode rather than raw `source`: an age alarm only means
 * something for a KPI a job actually writes. A row marked `ghl` that no job
 * touches (its name isn't in the sync's list) would otherwise show a
 * permanent red "Never synced" that reads as an outage, when the real story
 * is "nothing feeds this" — which the badge beside it now states outright.
 */
function freshnessClass(kpi: KpiRow, mode: KpiWriteMode): string {
  if (mode !== "synced" && mode !== "shadowed") return "text-muted-foreground";
  if (!kpi.last_synced_at)
    return "text-[color:var(--color-brand-danger)] font-medium";
  const then = new Date(kpi.last_synced_at).getTime();
  if (Number.isNaN(then)) return "text-[color:var(--color-brand-danger)] font-medium";
  const hours = (Date.now() - then) / 3_600_000;
  if (hours >= 24) return "text-[color:var(--color-brand-danger)] font-medium";
  if (hours >= 6) return "text-[color:var(--color-brand-warning)]";
  return "text-muted-foreground";
}

function freshnessTitle(kpi: KpiRow, mode: KpiWriteMode): string {
  if (mode === "manual") return "Entered manually";
  if (mode === "declared")
    return "No background job writes a KPI with this name, so this stamp will not advance.";
  if (!kpi.last_synced_at)
    return "This KPI has never synced — no data source is feeding it yet.";
  const hours = (Date.now() - new Date(kpi.last_synced_at).getTime()) / 3_600_000;
  if (hours >= 6)
    return "Auto-syncs hourly — this value is stale, so treat it as a last-known figure rather than a current one.";
  return "Auto-syncs hourly";
}

function formatAxisDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sortKpis(kpis: KpiRow[]): KpiRow[] {
  return [...kpis].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
}

// Group raw history rows by kpi_id, sorted ascending by time, into chartable
// points. Built once per history change so cards can look up by id cheaply.
function groupHistory(history: KpiHistory[]): Map<string, TrendPoint[]> {
  const byKpi = new Map<string, TrendPoint[]>();
  for (const row of history) {
    const t = new Date(row.recorded_at).getTime();
    if (Number.isNaN(t)) continue;
    const value = Number(row.value);
    if (Number.isNaN(value)) continue;
    const point: TrendPoint = { t, recorded_at: row.recorded_at, value };
    const existing = byKpi.get(row.kpi_id);
    if (existing) {
      existing.push(point);
    } else {
      byKpi.set(row.kpi_id, [point]);
    }
  }
  for (const points of byKpi.values()) {
    points.sort((a, b) => a.t - b.t);
  }
  return byKpi;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TrendPoint }>;
  unit: string | null;
}

function TrendTooltip({ active, payload, unit }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-[color:var(--color-brand-fog)] bg-[#0a0e1a] px-2.5 py-1.5 text-xs shadow-lg">
      <p className="font-semibold text-foreground">
        {formatKpiValue(point.value, unit)}
      </p>
      <p className="text-[color:var(--color-brand-mist)]">
        {new Date(point.recorded_at).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

interface SparklineProps {
  points: TrendPoint[];
}

function Sparkline({ points }: SparklineProps) {
  // Stable gradient id per render set so multiple sparklines don't collide.
  const gradientId = useRef(
    `spark-${Math.random().toString(36).slice(2, 9)}`
  ).current;

  return (
    <div className="h-[60px] w-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 4, right: 2, bottom: 0, left: 2 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--color-brand-electric)"
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor="var(--color-brand-electric)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-brand-electric)"
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TrendChartProps {
  points: TrendPoint[];
  unit: string | null;
}

function TrendChart({ points, unit }: TrendChartProps) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-brand-fog)"
            vertical={false}
          />
          <XAxis
            dataKey="recorded_at"
            tickFormatter={formatAxisDate}
            tick={{ fill: "var(--color-brand-mist)", fontSize: 11 }}
            stroke="var(--color-brand-fog)"
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: "var(--color-brand-mist)", fontSize: 11 }}
            stroke="var(--color-brand-fog)"
            width={48}
            tickFormatter={(v: number) =>
              v.toLocaleString("en-US", { maximumFractionDigits: 0 })
            }
          />
          <Tooltip
            content={<TrendTooltip unit={unit} />}
            cursor={{ stroke: "var(--color-brand-fog)", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-brand-electric)"
            strokeWidth={2}
            dot={{ r: 2, fill: "var(--color-brand-electric)" }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const BADGE_TONE: Record<"neutral" | "auto" | "warn", string> = {
  neutral:
    "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]",
  auto: "bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)]",
  warn: "bg-[color:var(--color-brand-warning)]/15 text-[color:var(--color-brand-warning)]",
};

interface KpiCardProps {
  kpi: KpiRow;
  points: TrendPoint[];
  onSave: (id: string, newValue: number) => Promise<void>;
  onEdit: (kpi: KpiRow) => void;
  onDelete: (kpi: KpiRow) => Promise<void>;
}

/**
 * A null reading is "nobody measured this", so the editor opens empty rather
 * than pre-filled with the string "null" for someone to delete first.
 */
function draftFor(value: number | null): string {
  return value === null ? "" : String(value);
}

function KpiCard({ kpi, points, onSave, onEdit, onDelete }: KpiCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(draftFor(kpi.value));
  const [saving, setSaving] = useState(false);
  const [showTrend, setShowTrend] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasTrend = points.length >= 2;
  const mode = kpiWriteMode(kpi);
  const copy = writeModeCopy(mode, kpi.source);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function startEdit() {
    setDraft(draftFor(kpi.value));
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(draftFor(kpi.value));
    setEditing(false);
  }

  async function commitEdit() {
    const parsed = Number(draft);
    if (Number.isNaN(parsed)) {
      toast.error("Value must be a number");
      return;
    }
    if (parsed === kpi.value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(kpi.id, parsed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await onDelete(kpi);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {kpi.name}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {kpi.description && (
              <span
                title={kpi.description}
                aria-label={kpi.description}
                className="text-[color:var(--color-brand-mist)] cursor-help"
              >
                <Info className="size-3.5" />
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Actions for ${kpi.name}`}
                >
                  <MoreVertical className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(kpi)}>
                  <Pencil className="size-3.5" /> Edit KPI
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 className="size-3.5" /> Delete KPI
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-end gap-2">
          {editing ? (
            <div className="flex items-center gap-1.5 flex-1">
              <Input
                ref={inputRef}
                type="number"
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                className="h-9 text-2xl font-bold"
                disabled={saving}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => void commitEdit()}
                disabled={saving}
                aria-label="Save"
              >
                <Check className="size-4 text-[color:var(--color-brand-success)]" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={cancelEdit}
                disabled={saving}
                aria-label="Cancel"
              >
                <X className="size-4 text-[color:var(--color-brand-mist)]" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="text-3xl font-bold leading-none font-data hover:text-[color:var(--color-brand-electric)] hover:glow-electric-text transition-colors cursor-text text-left"
              aria-label={`Edit value for ${kpi.name}`}
            >
              {kpi.value === null ? "–" : formatKpiValue(kpi.value, kpi.unit)}
            </button>
          )}
          {kpi.target != null && !editing && (
            <span className="text-xs text-muted-foreground pb-1">
              / {formatTarget(kpi.target, kpi.unit)}
            </span>
          )}
        </div>

        {/* Typing a number into a machine-written KPI is the one edit that
            silently undoes itself. Say so at the moment of typing, not after. */}
        {editing && copy.editWarning && (
          <div className="flex gap-1.5 rounded-md border border-[color:var(--color-brand-warning)]/40 bg-[color:var(--color-brand-warning)]/10 px-2 py-1.5 text-[11px] leading-relaxed text-[color:var(--color-brand-warning)]">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
            <span>{copy.editWarning}</span>
          </div>
        )}

        {/* Sparkline / empty trend state */}
        {hasTrend ? (
          <Sparkline points={points} />
        ) : (
          <div className="h-[60px] w-full flex items-center justify-center rounded-md border border-dashed border-[color:var(--color-brand-fog)]">
            <span className="text-[11px] text-[color:var(--color-brand-mist)]">
              No trend yet
            </span>
          </div>
        )}

        {/* Trend expand toggle */}
        <button
          type="button"
          onClick={() => setShowTrend((v) => !v)}
          disabled={!hasTrend}
          aria-expanded={showTrend}
          className="flex items-center gap-1 text-[11px] font-medium text-[color:var(--color-brand-mist)] enabled:hover:text-[color:var(--color-brand-electric)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <TrendingUp className="size-3" />
          Trend
          <ChevronDown
            className={`size-3 transition-transform ${
              showTrend ? "rotate-180" : ""
            }`}
          />
        </button>

        {showTrend && hasTrend && (
          <div className="pt-1">
            <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-brand-mist)] mb-1">
              Last 30 days
            </p>
            <TrendChart points={points} unit={kpi.unit} />
          </div>
        )}

        {confirmingDelete ? (
          <div className="space-y-2 rounded-lg border border-[color:var(--color-brand-danger)]/40 bg-[color:var(--color-brand-danger)]/10 p-2.5">
            <p className="text-[11px] leading-relaxed text-[color:var(--color-brand-danger)]">
              Delete <span className="font-semibold">{kpi.name}</span>? Its
              recorded history goes with it
              {points.length > 0 && (
                <>
                  {" "}
                  — including the{" "}
                  <span className="font-data tabular-nums">{points.length}</span>{" "}
                  {points.length === 1 ? "point" : "points"} behind this trend
                </>
              )}
              . This can&apos;t be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                size="xs"
                variant="outline"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                variant="destructive"
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete KPI"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span
              title={copy.detail}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium cursor-help",
                BADGE_TONE[copy.tone]
              )}
            >
              {copy.tone === "warn" ? (
                <AlertTriangle className="size-3" />
              ) : copy.tone === "auto" ? (
                <RefreshCw className="size-3" />
              ) : (
                <Pencil className="size-3" />
              )}
              {copy.badge}
            </span>
            <span
              className={freshnessClass(kpi, mode)}
              title={freshnessTitle(kpi, mode)}
            >
              {formatRelative(kpi.last_synced_at)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Scoreboard({
  initialKpis,
  initialHistory,
  people = [],
  showHeader = true,
}: ScoreboardProps) {
  const orgId = useActiveOrgId();
  const [kpis, setKpis] = useState<KpiRow[]>(sortKpis(initialKpis));
  const [history, setHistory] = useState<KpiHistory[]>(initialHistory);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KpiRow | null>(null);
  // Bumped only when a session *starts*, so the form remounts fresh on open
  // but is left alone while the dialog plays its close animation.
  const [sessionKey, setSessionKey] = useState(0);

  const historyByKpi = useMemo(() => groupHistory(history), [history]);

  // New KPIs append to the end of the board unless the operator overrides it.
  const nextSortOrder = useMemo(
    () =>
      kpis.length === 0
        ? 0
        : Math.max(...kpis.map((k) => k.sort_order)) + 1,
    [kpis]
  );

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

    async function refetchHistory() {
      const thirtyDaysAgoIso = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      const { data } = await supabase
        .from("cc_kpi_history")
        .select("*")
        .eq("org_id", orgId)
        .gte("recorded_at", thirtyDaysAgoIso)
        .order("recorded_at", { ascending: true });
      if (data) setHistory(data as KpiHistory[]);
    }

    const channel = supabase
      .channel("scoreboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kpis",
          filter: `org_id=eq.${orgId}`,
        },
        refetchKpis
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "cc_kpi_history",
          filter: `org_id=eq.${orgId}`,
        },
        refetchHistory
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId]);

  async function handleSave(id: string, newValue: number) {
    const supabase = createClient();
    const previous = kpis;
    const target = kpis.find((k) => k.id === id);

    // Optimistic update.
    setKpis((prev) =>
      prev.map((k) => (k.id === id ? { ...k, value: newValue } : k))
    );

    // `.select("id")` guards the same RLS trap as the delete below: a refused
    // UPDATE matches zero rows and returns no error, so an unchecked write
    // would leave the optimistic number on screen and nothing in the database.
    const { data, error } = await supabase
      .from("kpis")
      .update({
        value: newValue,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("org_id", orgId)
      .select("id");

    if (error || !data || data.length === 0) {
      setKpis(previous);
      toast.error(
        error
          ? `Failed to update: ${error.message}`
          : "Couldn't save that value — the KPI no longer exists, or your session doesn't have permission for it. Try reloading the page.",
      );
      return;
    }

    // Record a manual history point so the trend chart reflects the edit
    // immediately rather than waiting for the next hourly snapshot. Best-effort:
    // a history failure must not surface as a value-save failure.
    const { error: historyError } = await supabase
      .from("cc_kpi_history")
      .insert({ kpi_id: id, org_id: orgId, value: newValue });
    if (historyError) {
      console.error("KPI history insert failed:", historyError.message);
    }

    // A value typed into a KPI the sync owns will not survive the hour. The
    // save genuinely succeeded, so this is a warning, not an error.
    const mode = target ? kpiWriteMode(target) : "manual";
    if (mode === "synced" || mode === "shadowed") {
      toast.warning("Saved — but the hourly GHL sync will overwrite this value");
      return;
    }
    toast.success("KPI updated");
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
        : sortKpis(prev.map((k) => (k.id === saved.id ? saved : k)))
    );
  }

  async function handleDelete(kpi: KpiRow) {
    const supabase = createClient();
    const previousKpis = kpis;
    const previousHistory = history;

    setKpis((prev) => prev.filter((k) => k.id !== kpi.id));
    setHistory((prev) => prev.filter((h) => h.kpi_id !== kpi.id));

    // `cc_kpi_history.kpi_id` is FK'd to `kpis(id) ON DELETE CASCADE`
    // (constraint `cc_kpi_history_kpi_id_fkey`, verified against the live
    // schema), so Postgres removes the trend rows with the KPI — no orphans,
    // and no second round-trip. Deleting history first would be worse: if the
    // KPI delete then failed we'd have destroyed the trend of a row that
    // still exists. Cascades run as the referencing table's owner and are not
    // filtered by RLS, so this works from the browser client.
    //
    // `.select("id")` is not decoration: a DELETE that RLS refuses matches zero
    // rows and comes back with no error at all, so without reading the affected
    // rows back this would report a deletion that never happened — and the row
    // would reappear on the next refetch.
    const { data, error } = await supabase
      .from("kpis")
      .delete()
      .eq("id", kpi.id)
      .eq("org_id", orgId)
      .select("id");

    if (error || !data || data.length === 0) {
      setKpis(previousKpis);
      setHistory(previousHistory);
      toast.error(
        error
          ? `Failed to delete: ${error.message}`
          : "Couldn't delete that KPI — it no longer exists, or your session doesn't have permission for it. Try reloading the page.",
      );
      return;
    }

    toast.success(`"${kpi.name}" deleted`);
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            The numbers you review every week. Click a value to enter this
            week&apos;s figure.
          </p>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Add KPI
          </Button>
        </div>
      )}

      {kpis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-medium">No KPIs on the scoreboard</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Add the handful of numbers this team measures every week — 5 to 15 is
            the EOS rule of thumb, each with an owner and a target.
          </p>
          <Button size="sm" onClick={openCreate} className="mt-3">
            <Plus className="size-4" />
            Add your first KPI
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.id}
              kpi={kpi}
              points={historyByKpi.get(kpi.id) ?? []}
              onSave={handleSave}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
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
    </div>
  );
}
