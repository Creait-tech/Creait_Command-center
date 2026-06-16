"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Check, X, Info, TrendingUp, ChevronDown } from "lucide-react";
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
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import type { Kpi, KpiHistory } from "@/lib/supabase/types";

interface ScoreboardProps {
  initialKpis: Kpi[];
  initialHistory: KpiHistory[];
}

// A single charted point. `value` is the KPI value; `recorded_at` is the ISO
// timestamp; `t` is the epoch ms used for ordering.
interface TrendPoint {
  t: number;
  recorded_at: string;
  value: number;
}

function formatKpiValue(value: number, unit: string | null): string {
  if (unit === "USD" || unit === "$") {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  if (unit === "%") {
    return `${value.toLocaleString("en-US")}%`;
  }
  if (unit) {
    return `${value.toLocaleString("en-US")} ${unit}`;
  }
  return value.toLocaleString("en-US");
}

function formatTarget(target: number | null, unit: string | null): string {
  if (target == null) return "";
  return formatKpiValue(target, unit);
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

function formatAxisDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sortKpis(kpis: Kpi[]): Kpi[] {
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

interface KpiCardProps {
  kpi: Kpi;
  points: TrendPoint[];
  onSave: (id: string, newValue: number) => Promise<void>;
}

function KpiCard({ kpi, points, onSave }: KpiCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(kpi.value));
  const [saving, setSaving] = useState(false);
  const [showTrend, setShowTrend] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasTrend = points.length >= 2;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function startEdit() {
    setDraft(String(kpi.value));
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(String(kpi.value));
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

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {kpi.name}
          </p>
          {kpi.description && (
            <span
              title={kpi.description}
              aria-label={kpi.description}
              className="text-[color:var(--color-brand-mist)] cursor-help"
            >
              <Info className="size-3.5" />
            </span>
          )}
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
              className="text-3xl font-bold leading-none hover:text-[color:var(--color-brand-electric)] transition-colors cursor-text text-left"
              aria-label={`Edit value for ${kpi.name}`}
            >
              {formatKpiValue(kpi.value, kpi.unit)}
            </button>
          )}
          {kpi.target != null && !editing && (
            <span className="text-xs text-muted-foreground pb-1">
              / {formatTarget(kpi.target, kpi.unit)}
            </span>
          )}
        </div>

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

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="capitalize">{kpi.source}</span>
          <span title="Auto-syncs hourly">
            {formatRelative(kpi.last_synced_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function Scoreboard({ initialKpis, initialHistory }: ScoreboardProps) {
  const orgId = useActiveOrgId();
  const [kpis, setKpis] = useState<Kpi[]>(sortKpis(initialKpis));
  const [history, setHistory] = useState<KpiHistory[]>(initialHistory);

  const historyByKpi = useMemo(() => groupHistory(history), [history]);

  useEffect(() => {
    const supabase = createClient();

    async function refetchKpis() {
      const { data } = await supabase
        .from("kpis")
        .select("*")
        .eq("org_id", orgId)
        .order("sort_order", { ascending: true });
      if (data) setKpis(sortKpis(data as Kpi[]));
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

    // Optimistic update.
    setKpis((prev) =>
      prev.map((k) => (k.id === id ? { ...k, value: newValue } : k))
    );

    const { error } = await supabase
      .from("kpis")
      .update({
        value: newValue,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setKpis(previous);
      toast.error(`Failed to update: ${error.message}`);
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

    toast.success("KPI updated");
  }

  if (kpis.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex items-center justify-center py-12 text-sm text-muted-foreground">
        No KPIs configured yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.id}
          kpi={kpi}
          points={historyByKpi.get(kpi.id) ?? []}
          onSave={handleSave}
        />
      ))}
    </div>
  );
}
