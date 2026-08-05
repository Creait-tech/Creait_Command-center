"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Brain,
  Mountain,
  CheckSquare,
  MessageCircleQuestion,
  Newspaper,
  Trophy,
  CalendarCheck,
  LayoutDashboard,
  Users,
  UserPlus,
  Compass,
  Eye,
  Search,
  MessageSquare,
  Bot,
  Route,
  Target,
  Settings,
  History,
  type LucideIcon,
} from "lucide-react";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";

type ResultKind = "rock" | "todo" | "issue" | "headline" | "win" | "contact";

interface SearchResult {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

const PAGES: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Command Center", href: "/command-center", icon: LayoutDashboard },
  { label: "Level 10 Meeting", href: "/level-10", icon: CalendarCheck },
  { label: "Meeting History", href: "/meetings", icon: History },
  { label: "War Room", href: "/war-room", icon: Brain },
  { label: "Rocks (Quarterly)", href: "/rocks", icon: Mountain },
  { label: "Quarterly Planning", href: "/quarterly", icon: CalendarCheck },
  { label: "To-Dos", href: "/todos", icon: CheckSquare },
  { label: "Initiatives", href: "/initiatives", icon: Target },
  { label: "Team Scorecard", href: "/team", icon: Users },
  { label: "Recruiting", href: "/recruiting", icon: UserPlus },
  { label: "Client Journey", href: "/journey", icon: Route },
  { label: "Strategy", href: "/strategy", icon: Compass },
  { label: "Vision / V/TO", href: "/vision", icon: Eye },
  { label: "Research", href: "/research", icon: Search },
  { label: "Comms Hub", href: "/comms", icon: MessageSquare },
  { label: "Agent Center", href: "/agents", icon: Bot },
  { label: "Settings", href: "/settings", icon: Settings },
];

const KIND_META: Record<ResultKind, { label: string; icon: LucideIcon; color: string }> = {
  rock: { label: "Rock", icon: Mountain, color: "text-[color:var(--color-brand-aqua)]" },
  todo: { label: "To-Do", icon: CheckSquare, color: "text-[color:var(--color-brand-electric)]" },
  issue: { label: "Issue", icon: MessageCircleQuestion, color: "text-[color:var(--color-brand-warning)]" },
  headline: { label: "Headline", icon: Newspaper, color: "text-[color:var(--color-brand-violet)]" },
  win: { label: "Win", icon: Trophy, color: "text-[color:var(--color-brand-success)]" },
  contact: { label: "Contact", icon: Users, color: "text-[color:var(--color-brand-mist)]" },
};

export function CommandPalette() {
  const router = useRouter();
  const orgId = useActiveOrgId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const q = query.trim().toLowerCase();
    setLoading(true);
    const t = setTimeout(() => {
      runSearch(q).then((res) => {
        setResults(res);
        setLoading(false);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query, orgId]);

  async function runSearch(q: string): Promise<SearchResult[]> {
    const supabase = createClient();
    const like = `%${q}%`;
    const limit = 6;
    const [rocks, todos, issues, headlines, wins] = await Promise.all([
      supabase.from("cc_rocks").select("id,title,quarter,status").eq("org_id", orgId).ilike("title", like).limit(limit),
      supabase.from("cc_todos").select("id,title,done,due_date").eq("org_id", orgId).ilike("title", like).limit(limit),
      supabase.from("ids_items").select("id,title,priority,status").eq("org_id", orgId).ilike("title", like).limit(limit),
      supabase.from("cc_headlines").select("id,text,category,created_at").eq("org_id", orgId).ilike("text", like).limit(limit),
      supabase.from("wins").select("id,title,win_date").eq("org_id", orgId).ilike("title", like).limit(limit),
    ]);

    const out: SearchResult[] = [];
    for (const r of (rocks.data ?? []) as { id: string; title: string; quarter: string; status: string }[]) {
      out.push({ kind: "rock", id: r.id, title: r.title, subtitle: `${r.quarter} · ${r.status}`, href: "/rocks" });
    }
    for (const t of (todos.data ?? []) as { id: string; title: string; done: boolean; due_date: string | null }[]) {
      out.push({ kind: "todo", id: t.id, title: t.title, subtitle: t.done ? "done" : t.due_date ? `due ${t.due_date}` : "open", href: "/todos" });
    }
    for (const i of (issues.data ?? []) as { id: string; title: string; priority: number; status: string }[]) {
      out.push({ kind: "issue", id: i.id, title: i.title, subtitle: `P${i.priority} · ${i.status}`, href: "/level-10" });
    }
    for (const h of (headlines.data ?? []) as { id: string; text: string; category: string }[]) {
      out.push({ kind: "headline", id: h.id, title: h.text.slice(0, 80), subtitle: h.category, href: "/level-10" });
    }
    for (const w of (wins.data ?? []) as { id: string; title: string; win_date: string }[]) {
      out.push({ kind: "win", id: w.id, title: w.title, subtitle: w.win_date, href: "/level-10" });
    }
    return out;
  }

  const go = useCallback((href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  }, [router]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Search Rocks, To-Dos, Issues — or jump to any page">
      <CommandInput
        placeholder="Search anything or jump to a page…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? "Searching…" : query.trim() ? "No matches." : "Type to search or pick a page below."}
        </CommandEmpty>

        {results.length > 0 && (
          <CommandGroup heading="Results">
            {results.map((r) => {
              const meta = KIND_META[r.kind];
              const Icon = meta.icon;
              return (
                <CommandItem key={`${r.kind}-${r.id}`} value={`${r.title} ${r.subtitle ?? ""}`} onSelect={() => go(r.href)}>
                  <Icon className={`size-3.5 ${meta.color}`} />
                  <span className="flex-1 truncate">{r.title}</span>
                  <span className="text-[10px] text-muted-foreground">{meta.label}</span>
                  {r.subtitle && <span className="text-[10px] text-muted-foreground ml-2 truncate max-w-32">{r.subtitle}</span>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandGroup heading="Jump to">
          {PAGES.map((p) => {
            const Icon = p.icon;
            return (
              <CommandItem key={p.href} value={`jump ${p.label}`} onSelect={() => go(p.href)}>
                <Icon className="size-3.5 text-muted-foreground" />
                <span>{p.label}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{p.href}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
