"use client";

import { useState } from "react";
import {
  Plus,
  Mountain,
  CheckSquare,
  MessageCircleQuestion,
  Newspaper,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBrowserClient as createClient } from "@/lib/supabase/client";

type QuickKind = "todo" | "issue" | "headline" | "win" | "rock";

function currentQuarter(): string {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

function quarterEnd(quarter: string): string {
  const [y, q] = quarter.split("-Q").map(Number);
  const monthEnd = q * 3;
  const last = new Date(y, monthEnd, 0).getDate();
  return `${y}-${String(monthEnd).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function defaultDue(): string {
  return new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
}

export function QuickAddButton() {
  const [openKind, setOpenKind] = useState<QuickKind | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(5);
  const [headlineCategory, setHeadlineCategory] = useState<"customer" | "employee" | "market" | "general">("general");
  const [dueDate, setDueDate] = useState(defaultDue());
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setPriority(5);
    setHeadlineCategory("general");
    setDueDate(defaultDue());
  }

  async function submit() {
    if (!title.trim() || !openKind) return;
    setSubmitting(true);
    const supabase = createClient();
    let error: { message: string } | null = null;
    switch (openKind) {
      case "todo": {
        const res = await supabase.from("cc_todos").insert({
          org_id: "creait", title: title.trim(), description: description.trim() || null, due_date: dueDate || null,
        });
        error = res.error;
        break;
      }
      case "issue": {
        const res = await supabase.from("ids_items").insert({
          org_id: "creait", title: title.trim(), description: description.trim() || null, status: "open", priority,
        });
        error = res.error;
        break;
      }
      case "headline": {
        const res = await supabase.from("cc_headlines").insert({
          org_id: "creait", text: title.trim(), category: headlineCategory,
        });
        error = res.error;
        break;
      }
      case "win": {
        const res = await supabase.from("wins").insert({
          org_id: "creait", title: title.trim(), description: description.trim() || null,
        });
        error = res.error;
        break;
      }
      case "rock": {
        const q = currentQuarter();
        const res = await supabase.from("cc_rocks").insert({
          org_id: "creait", title: title.trim(), description: description.trim() || null,
          rock_type: "company", quarter: q, status: "on_track", due_date: quarterEnd(q), sort_order: 0,
        });
        error = res.error;
        break;
      }
    }
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${LABEL[openKind]} added`);
    reset();
    setOpenKind(null);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="outline" size="sm" aria-label="Quick add">
            <Plus className="size-4" />
            Add
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpenKind("todo")}>
            <CheckSquare className="size-3.5 text-[color:var(--color-brand-electric)]" />
            To-Do
            <span className="ml-auto text-[10px] text-muted-foreground">7-day</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenKind("issue")}>
            <MessageCircleQuestion className="size-3.5 text-[color:var(--color-brand-warning)]" />
            IDS Issue
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenKind("rock")}>
            <Mountain className="size-3.5 text-[color:var(--color-brand-aqua)]" />
            Rock (this quarter)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenKind("win")}>
            <Trophy className="size-3.5 text-[color:var(--color-brand-success)]" />
            Win
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenKind("headline")}>
            <Newspaper className="size-3.5 text-[color:var(--color-brand-violet)]" />
            Headline
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openKind !== null} onOpenChange={(o) => { if (!o) { setOpenKind(null); reset(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {openKind ? LABEL[openKind] : ""}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3 pt-1">
            <Input
              placeholder={openKind ? PLACEHOLDER[openKind] : ""}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            {openKind === "todo" && (
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            )}
            {openKind === "issue" && (
              <Input type="number" min={1} max={10} value={priority}
                onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setPriority(Math.max(1, Math.min(10, n))); }}
              />
            )}
            {openKind === "headline" && (
              <Select value={headlineCategory} onValueChange={(v) => typeof v === "string" && setHeadlineCategory(v as typeof headlineCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="market">Market</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            )}
            {(openKind === "issue" || openKind === "win" || openKind === "rock" || openKind === "todo") && (
              <Textarea
                placeholder="Optional description / context"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-14"
              />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpenKind(null); reset(); }} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting || !title.trim()}>
                {submitting ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

const LABEL: Record<QuickKind, string> = {
  todo: "To-Do",
  issue: "IDS Issue",
  headline: "Headline",
  win: "Win",
  rock: "Rock",
};

const PLACEHOLDER: Record<QuickKind, string> = {
  todo: "What needs to happen this week?",
  issue: "What's the issue?",
  headline: "One-sentence headline…",
  win: "What went well?",
  rock: "What's the 90-day priority?",
};
