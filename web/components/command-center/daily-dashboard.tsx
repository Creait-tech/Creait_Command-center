"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckSquare, Mountain, MessageSquareWarning, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { cn } from "@/lib/utils";
import type { Todo, Rock, IdsItem, RockStatusUpdate } from "@/lib/supabase/types";

interface State {
  overdueTodos: Todo[];
  openTodos: Todo[];
  offTrackRocks: Rock[];
  topIds: IdsItem[];
  redRockIds: Set<string>;
}

export function DailyDashboard() {
  const orgId = useActiveOrgId();
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const today = new Date().toISOString().slice(0, 10);

      const [todosRes, rocksRes, statusRes, idsRes] = await Promise.all([
        supabase
          .from("cc_todos")
          .select("*")
          .eq("org_id", orgId)
          .eq("done", false)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(20),
        supabase
          .from("cc_rocks")
          .select("*")
          .eq("org_id", orgId)
          .not("status", "in", "(complete,dropped)")
          .order("sort_order"),
        supabase
          .from("cc_rock_status_updates")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("ids_items")
          .select("*")
          .eq("org_id", orgId)
          .in("status", ["open", "discussing"])
          .order("priority", { ascending: false })
          .limit(5),
      ]);

      const allOpen = (todosRes.data as Todo[] | null) ?? [];
      const overdueTodos = allOpen.filter((t) => t.due_date && t.due_date < today);
      const openTodos = allOpen.filter((t) => !t.due_date || t.due_date >= today).slice(0, 5);

      // Build map of rock_id -> latest status
      const status = (statusRes.data as RockStatusUpdate[] | null) ?? [];
      const latestStatus = new Map<string, RockStatusUpdate>();
      for (const s of status) {
        if (!latestStatus.has(s.rock_id)) latestStatus.set(s.rock_id, s);
      }
      const redRockIds = new Set<string>();
      for (const [rockId, s] of latestStatus.entries()) {
        if (s.status === "red" || s.status === "yellow") redRockIds.add(rockId);
      }

      const allRocks = (rocksRes.data as Rock[] | null) ?? [];
      const offTrackRocks = allRocks.filter(
        (r) => r.status === "off_track" || redRockIds.has(r.id),
      );

      const topIds = (idsRes.data as IdsItem[] | null) ?? [];

      setState({
        overdueTodos: overdueTodos.slice(0, 5),
        openTodos,
        offTrackRocks: offTrackRocks.slice(0, 5),
        topIds,
        redRockIds,
      });
    }

    void load();

    const ch = supabase
      .channel("daily-dashboard-refresh")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cc_todos" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cc_rocks" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cc_rock_status_updates" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ids_items" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [orgId]);

  if (!state) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6 h-32" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* To-Dos */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <Link href="/todos" className="flex items-center justify-between group">
            <div className="flex items-center gap-2">
              <CheckSquare className="size-4 text-[color:var(--color-brand-electric)]" />
              <h3 className="text-sm font-semibold">To-Dos</h3>
            </div>
            <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-[color:var(--color-brand-electric)] transition-colors" />
          </Link>
          {state.overdueTodos.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-brand-danger)] mb-1.5">
                Overdue · {state.overdueTodos.length}
              </p>
              <ul className="space-y-1">
                {state.overdueTodos.map((t) => (
                  <li key={t.id} className="text-xs flex items-start gap-2">
                    <span className="size-1.5 mt-1.5 rounded-full bg-[color:var(--color-brand-danger)] shrink-0" />
                    <span className="truncate">{t.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {state.openTodos.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Open · {state.openTodos.length}
              </p>
              <ul className="space-y-1">
                {state.openTodos.map((t) => (
                  <li key={t.id} className="text-xs flex items-start gap-2 text-[color:var(--color-brand-mist)]">
                    <span className="size-1.5 mt-1.5 rounded-full bg-[color:var(--color-brand-mist)] shrink-0" />
                    <span className="truncate">{t.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {state.overdueTodos.length === 0 && state.openTodos.length === 0 && (
            <p className="text-xs text-muted-foreground italic">All clear — no open To-Dos.</p>
          )}
        </CardContent>
      </Card>

      {/* Rocks */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <Link href="/rocks" className="flex items-center justify-between group">
            <div className="flex items-center gap-2">
              <Mountain className="size-4 text-[color:var(--color-brand-aqua)]" />
              <h3 className="text-sm font-semibold">Rocks Off Track</h3>
            </div>
            <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-[color:var(--color-brand-aqua)] transition-colors" />
          </Link>
          {state.offTrackRocks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">All Rocks green. Keep marching.</p>
          ) : (
            <ul className="space-y-2">
              {state.offTrackRocks.map((r) => (
                <li key={r.id} className="text-xs flex items-start gap-2">
                  <span className={cn(
                    "size-2 mt-1.5 rounded-full shrink-0",
                    state.redRockIds.has(r.id)
                      ? "bg-[color:var(--color-brand-danger)]"
                      : "bg-[color:var(--color-brand-warning)]",
                  )} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground">{r.quarter}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* IDS */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <Link href="/level-10?tab=ids" className="flex items-center justify-between group">
            <div className="flex items-center gap-2">
              <MessageSquareWarning className="size-4 text-[color:var(--color-brand-warning)]" />
              <h3 className="text-sm font-semibold">Top Issues (IDS)</h3>
            </div>
            <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-[color:var(--color-brand-warning)] transition-colors" />
          </Link>
          {state.topIds.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No open issues.</p>
          ) : (
            <ul className="space-y-2">
              {state.topIds.map((i) => (
                <li key={i.id} className="text-xs flex items-start gap-2">
                  <span className={cn(
                    "shrink-0 size-5 rounded text-[10px] font-bold flex items-center justify-center",
                    i.priority >= 8
                      ? "bg-[color:var(--color-brand-danger)]/20 text-[color:var(--color-brand-danger)]"
                      : i.priority >= 5
                      ? "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)]"
                      : "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)]",
                  )}>
                    {i.priority}
                  </span>
                  <span className="truncate">{i.title}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
