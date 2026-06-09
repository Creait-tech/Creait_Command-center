"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Clock, Mountain, MessageCircleQuestion, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Todo, IdsItem, RockStatusUpdate, Rock } from "@/lib/supabase/types";

interface Bundle {
  overdueTodos: Todo[];
  redRocks: { rock: Rock; status: RockStatusUpdate }[];
  topIssues: IdsItem[];
}

function isOverdue(t: Todo): boolean {
  if (t.done || !t.due_date) return false;
  return new Date(t.due_date) < new Date(new Date().toDateString());
}

export function NotificationsBell() {
  const [bundle, setBundle] = useState<Bundle>({ overdueTodos: [], redRocks: [], topIssues: [] });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function refetch() {
      const [todosRes, rocksRes, statusesRes, issuesRes] = await Promise.all([
        supabase.from("cc_todos").select("*").eq("org_id", "creait").eq("done", false).order("due_date", { nullsFirst: false }),
        supabase.from("cc_rocks").select("*").eq("org_id", "creait").in("status", ["on_track", "off_track"]).order("sort_order"),
        supabase.from("cc_rock_status_updates").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("ids_items").select("*").eq("org_id", "creait").eq("is_long_term", false).neq("status", "solved").neq("status", "dropped").gte("priority", 7).order("priority", { ascending: false }).limit(5),
      ]);
      if (!mounted) return;
      const todos = (todosRes.data as Todo[] | null) ?? [];
      const rocks = (rocksRes.data as Rock[] | null) ?? [];
      const statuses = (statusesRes.data as RockStatusUpdate[] | null) ?? [];
      const issues = (issuesRes.data as IdsItem[] | null) ?? [];
      const latestByRock = new Map<string, RockStatusUpdate>();
      for (const s of statuses) if (!latestByRock.has(s.rock_id)) latestByRock.set(s.rock_id, s);
      const redRocks = rocks
        .map((r) => ({ rock: r, status: latestByRock.get(r.id) }))
        .filter((x): x is { rock: Rock; status: RockStatusUpdate } => !!x.status && (x.status.status === "red" || x.status.status === "yellow"));
      setBundle({
        overdueTodos: todos.filter(isOverdue),
        redRocks,
        topIssues: issues,
      });
    }

    void refetch();
    const channel = supabase
      .channel("notifications-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "cc_todos", filter: "org_id=eq.creait" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "cc_rocks", filter: "org_id=eq.creait" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "cc_rock_status_updates" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "ids_items", filter: "org_id=eq.creait" }, refetch)
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const totalCount = bundle.overdueTodos.length + bundle.redRocks.length + bundle.topIssues.length;
  const hasAny = totalCount > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="size-4" />
          {hasAny && (
            <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-[color:var(--color-brand-danger)] text-[9px] font-bold text-white flex items-center justify-center">
              {totalCount > 9 ? "9+" : totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b border-border">
          <p className="text-sm font-semibold">Needs your attention</p>
          <p className="text-[11px] text-muted-foreground">
            {hasAny ? `${totalCount} item${totalCount === 1 ? "" : "s"}` : "All clear"}
          </p>
        </div>
        <ScrollArea className="max-h-96">
          {!hasAny ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Nothing urgent. Nice.</div>
          ) : (
            <div className="divide-y divide-border">
              {bundle.overdueTodos.length > 0 && (
                <Section
                  title="Overdue To-Dos"
                  count={bundle.overdueTodos.length}
                  icon={Clock}
                  color="text-[color:var(--color-brand-danger)]"
                  href="/todos?filter=overdue"
                  onNavigate={() => setOpen(false)}
                >
                  {bundle.overdueTodos.slice(0, 5).map((t) => (
                    <Link key={t.id} href="/todos" onClick={() => setOpen(false)} className="block px-3 py-1.5 hover:bg-[color:var(--color-brand-slate)]/40">
                      <p className="text-xs truncate">{t.title}</p>
                      <p className="text-[10px] text-muted-foreground">Due {t.due_date}</p>
                    </Link>
                  ))}
                </Section>
              )}
              {bundle.redRocks.length > 0 && (
                <Section
                  title="Off-track Rocks"
                  count={bundle.redRocks.length}
                  icon={Mountain}
                  color="text-[color:var(--color-brand-warning)]"
                  href="/rocks"
                  onNavigate={() => setOpen(false)}
                >
                  {bundle.redRocks.slice(0, 5).map(({ rock, status }) => (
                    <Link key={rock.id} href="/rocks" onClick={() => setOpen(false)} className="block px-3 py-1.5 hover:bg-[color:var(--color-brand-slate)]/40">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "size-2 rounded-full",
                          status.status === "red" && "bg-[color:var(--color-brand-danger)]",
                          status.status === "yellow" && "bg-[color:var(--color-brand-warning)]",
                        )} />
                        <p className="text-xs truncate flex-1">{rock.title}</p>
                      </div>
                    </Link>
                  ))}
                </Section>
              )}
              {bundle.topIssues.length > 0 && (
                <Section
                  title="High-priority Issues"
                  count={bundle.topIssues.length}
                  icon={MessageCircleQuestion}
                  color="text-[color:var(--color-brand-warning)]"
                  href="/level-10"
                  onNavigate={() => setOpen(false)}
                >
                  {bundle.topIssues.map((i) => (
                    <Link key={i.id} href="/level-10" onClick={() => setOpen(false)} className="block px-3 py-1.5 hover:bg-[color:var(--color-brand-slate)]/40">
                      <p className="text-xs truncate">P{i.priority} · {i.title}</p>
                    </Link>
                  ))}
                </Section>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function Section({
  title, count, icon: Icon, color, href, onNavigate, children,
}: {
  title: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-3 py-1.5 flex items-center gap-2 bg-[color:var(--color-brand-slate)]/30">
        <Icon className={`size-3.5 ${color}`} />
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex-1">
          {title} <span className="opacity-70">· {count}</span>
        </p>
        <Link href={href} onClick={onNavigate} className="text-[10px] text-[color:var(--color-brand-electric)] hover:underline flex items-center gap-0.5">
          View all <ArrowRight className="size-2.5" />
        </Link>
      </div>
      {children}
    </div>
  );
}
