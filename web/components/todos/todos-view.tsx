"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash } from "lucide-react";
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
import { AuthorStamp } from "@/components/authorship/author-stamp";
import { MeetingStamp } from "@/components/level10/meeting-titles";
import { asAuthoredRows, personName, type AuthoredTodo, type Person } from "@/lib/authorship";
import { createTodo, updateTodo } from "@/lib/eos-actions";

type Filter = "all" | "open" | "done" | "overdue";

interface Props {
  initialTodos: AuthoredTodo[];
  members: Person[];
  orgId: string;
}

function isOverdue(t: AuthoredTodo): boolean {
  if (t.done || !t.due_date) return false;
  return new Date(t.due_date) < new Date(new Date().toDateString());
}

function defaultDueDate(): string {
  return new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
}

export function TodosView({ initialTodos, members, orgId }: Props) {
  const [todos, setTodos] = useState<AuthoredTodo[]>(initialTodos);
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
        { event: "*", schema: "public", table: "cc_todos", filter: `org_id=eq.${orgId}` },
        async () => {
          const { data } = await supabase
            .from("cc_todos")
            .select("*")
            .eq("org_id", orgId)
            .order("done")
            .order("due_date", { nullsFirst: false });
          if (data) setTodos(asAuthoredRows<AuthoredTodo>(data));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [orgId]);

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

  // Writes go through server actions rather than the browser client: the
  // author recorded on the row has to be resolved from the Clerk session on
  // the server, and a name the browser could choose is not an audit trail.
  async function addTodo() {
    if (!newTitle.trim()) return;
    const result = await createTodo({
      title: newTitle,
      ownerId: newOwnerId || null,
      dueDate: newDue || null,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setTodos((p) => [result.data, ...p.filter((x) => x.id !== result.data.id)]);
    setNewTitle("");
    setNewOwnerId("");
    setNewDue(defaultDueDate());
    toast.success("To-Do added");
  }

  async function toggle(t: AuthoredTodo) {
    setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)));
    const result = await updateTodo(t.id, { done: !t.done });
    if (!result.ok) {
      // revert
      setTodos((p) => p.map((x) => (x.id === t.id ? { ...x, done: t.done } : x)));
      toast.error(result.error);
      return;
    }
    setTodos((p) => p.map((x) => (x.id === t.id ? result.data : x)));
  }

  async function updateField(
    id: string,
    field: { ownerId?: string | null; dueDate?: string | null },
  ) {
    const result = await updateTodo(id, field);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setTodos((p) => p.map((x) => (x.id === id ? result.data : x)));
  }

  async function remove(id: string) {
    if (!confirm("Delete this To-Do?")) return;
    const supabase = createClient();
    // `.select()` makes the outcome observable. A delete the row-level
    // security policy rejects does not raise — it matches zero rows and
    // returns success, so without this the row silently stays on screen and
    // the button looks broken. Reporting "deleted" for a delete that did not
    // happen is worse than reporting the failure.
    const { data, error } = await supabase
      .from("cc_todos")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error(
        "Couldn't delete — your session doesn't have permission for this To-Do. Try reloading the page."
      );
      return;
    }
    setTodos((p) => p.filter((x) => x.id !== id));
    toast.success("Deleted");
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
                  <SelectItem key={m.id} value={m.id}>{personName(m)}</SelectItem>
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
          <p className="text-[10px] text-muted-foreground">EOS default: due in 7 days. Captured To-Dos roll into next L10&apos;s To-Do Review.</p>
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
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground">
                        {owner && (
                          <span className="flex items-center gap-1">
                            <span className="size-4 rounded-full bg-[color:var(--color-brand-slate)] flex items-center justify-center text-[9px] font-medium">
                              {personName(owner).slice(0, 1).toUpperCase()}
                            </span>
                            {personName(owner)}
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
                        <MeetingStamp meetingId={t.meeting_id} />
                        <AuthorStamp
                          name={t.created_by_name}
                          actorId={t.created_by}
                          at={t.created_at}
                        />
                        {t.updated_by_name &&
                          t.updated_by_name !== t.created_by_name && (
                            <AuthorStamp
                              label="last edited by"
                              name={t.updated_by_name}
                              actorId={t.updated_by}
                              at={t.updated_at}
                            />
                          )}
                      </div>
                    </div>
                    <Select
                      value={t.owner_id ?? ""}
                      onValueChange={(v) => typeof v === "string" && updateField(t.id, { ownerId: v || null })}
                    >
                      <SelectTrigger className="w-32 h-7 text-xs"><SelectValue placeholder="Owner" /></SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{personName(m)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="w-32 h-7 text-xs"
                      type="date"
                      value={t.due_date ?? ""}
                      onChange={(e) => updateField(t.id, { dueDate: e.target.value || null })}
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
