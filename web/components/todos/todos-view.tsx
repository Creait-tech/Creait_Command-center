"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Check, Trash } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Todo, TeamMember } from "@/lib/supabase/types";

type Filter = "all" | "open" | "done" | "overdue";

interface Props {
  initialTodos: Todo[];
  members: TeamMember[];
}

function isOverdue(t: Todo): boolean {
  if (t.done || !t.due_date) return false;
  return new Date(t.due_date) < new Date(new Date().toDateString());
}

function defaultDueDate(): string {
  return new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
}

export function TodosView({ initialTodos, members }: Props) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [filter, setFilter] = useState<Filter>("open");
  const [newTitle, setNewTitle] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [newDue, setNewDue] = useState(defaultDueDate());

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("cc-todos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cc_todos", filter: "org_id=eq.creait" },
        async () => {
          const { data } = await supabase
            .from("cc_todos")
            .select("*")
            .eq("org_id", "creait")
            .order("done")
            .order("due_date", { nullsFirst: false });
          if (data) setTodos(data as Todo[]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    switch (filter) {
      case "open":
        return todos.filter((t) => !t.done);
      case "done":
        return todos.filter((t) => t.done);
      case "overdue":
        return todos.filter((t) => isOverdue(t));
      default:
        return todos;
    }
  }, [todos, filter]);

  const counts = {
    all: todos.length,
    open: todos.filter((t) => !t.done).length,
    done: todos.filter((t) => t.done).length,
    overdue: todos.filter((t) => isOverdue(t)).length,
  };

  async function addTodo() {
    if (!newTitle.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from("cc_todos").insert({
      org_id: "creait",
      title: newTitle.trim(),
      owner_id: newOwnerId || null,
      due_date: newDue || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewTitle("");
    setNewOwnerId("");
    setNewDue(defaultDueDate());
    toast.success("To-Do added");
  }

  async function toggle(t: Todo) {
    const supabase = createClient();
    setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)));
    const { error } = await supabase
      .from("cc_todos")
      .update({ done: !t.done, updated_at: new Date().toISOString() })
      .eq("id", t.id);
    if (error) {
      // revert
      setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, done: t.done } : x)));
      toast.error(error.message);
    }
  }

  async function updateField(id: string, field: Partial<Todo>) {
    const supabase = createClient();
    const { error } = await supabase
      .from("cc_todos")
      .update({ ...field, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
  }

  async function remove(id: string) {
    if (!confirm("Delete this To-Do?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("cc_todos").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Deleted");
  }

  return (
    <>
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <Input
              className="md:col-span-6"
              placeholder="Quick add To-Do…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTodo(); } }}
            />
            <Select value={newOwnerId} onValueChange={(v) => typeof v === "string" && setNewOwnerId(v)}>
              <SelectTrigger className="md:col-span-3"><SelectValue placeholder="Owner (optional)" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="md:col-span-2"
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
            />
            <Button className="md:col-span-1" onClick={addTodo} disabled={!newTitle.trim()}>
              <Plus className="size-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">EOS default: due in 7 days. Captured To-Dos roll into next L10's To-Do Review.</p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-1.5 flex-wrap">
        {(["open", "overdue", "done", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors capitalize",
              filter === f
                ? "bg-[color:var(--color-brand-electric)] text-white border-transparent"
                : "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)] border-border hover:border-[color:var(--color-brand-electric)]",
            )}
          >
            {f} <span className="opacity-70 ml-1">{counts[f]}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {filter === "overdue" ? "Nothing overdue. Nice." :
               filter === "done" ? "Nothing completed yet." :
               filter === "open" ? "All clear — no open To-Dos." :
               "No To-Dos yet."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((t) => {
                const owner = members.find((m) => m.id === t.owner_id);
                const overdue = isOverdue(t);
                return (
                  <li key={t.id} className={cn("py-3 flex items-start gap-3", t.done && "opacity-50")}>
                    <Checkbox
                      className="mt-0.5"
                      checked={t.done}
                      onCheckedChange={() => toggle(t)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm", t.done && "line-through")}>{t.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        {owner && (
                          <span className="flex items-center gap-1">
                            <span className="size-4 rounded-full bg-[color:var(--color-brand-slate)] flex items-center justify-center text-[9px] font-medium">
                              {owner.full_name.slice(0, 1).toUpperCase()}
                            </span>
                            {owner.full_name}
                          </span>
                        )}
                        {t.due_date && (
                          <span className={cn(overdue && "text-[color:var(--color-brand-danger)] font-medium")}>
                            Due {new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {overdue && " · OVERDUE"}
                          </span>
                        )}
                        {t.carried_forward_count > 0 && (
                          <span className="text-[color:var(--color-brand-warning)]">
                            Carried {t.carried_forward_count}×
                          </span>
                        )}
                      </div>
                    </div>
                    <Select
                      value={t.owner_id ?? ""}
                      onValueChange={(v) => typeof v === "string" && updateField(t.id, { owner_id: v || null })}
                    >
                      <SelectTrigger className="w-32 h-7 text-xs"><SelectValue placeholder="Owner" /></SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="w-32 h-7 text-xs"
                      type="date"
                      value={t.due_date ?? ""}
                      onChange={(e) => updateField(t.id, { due_date: e.target.value || null })}
                    />
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(t.id)}>
                      <Trash className="size-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
