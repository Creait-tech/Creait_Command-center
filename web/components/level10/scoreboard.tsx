"use client";

import { useState, useEffect, useRef } from "react";
import { Check, X, Info } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type { Kpi } from "@/lib/supabase/types";

interface ScoreboardProps {
  initialKpis: Kpi[];
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

function sortKpis(kpis: Kpi[]): Kpi[] {
  return [...kpis].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
}

interface KpiCardProps {
  kpi: Kpi;
  onSave: (id: string, newValue: number) => Promise<void>;
}

function KpiCard({ kpi, onSave }: KpiCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(kpi.value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

export function Scoreboard({ initialKpis }: ScoreboardProps) {
  const [kpis, setKpis] = useState<Kpi[]>(sortKpis(initialKpis));

  useEffect(() => {
    const supabase = createClient();

    async function refetch() {
      const { data } = await supabase
        .from("kpis")
        .select("*")
        .eq("org_id", "creait")
        .order("sort_order", { ascending: true });
      if (data) setKpis(sortKpis(data as Kpi[]));
    }

    const channel = supabase
      .channel("kpis-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kpis",
          filter: "org_id=eq.creait",
        },
        refetch
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

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
        <KpiCard key={kpi.id} kpi={kpi} onSave={handleSave} />
      ))}
    </div>
  );
}
