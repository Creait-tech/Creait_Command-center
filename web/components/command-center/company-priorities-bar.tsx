"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type { CompanyPriority } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface CompanyPrioritiesBarProps {
  priorities: CompanyPriority[];
}

export function CompanyPrioritiesBar({
  priorities: initialPriorities,
}: CompanyPrioritiesBarProps) {
  const [priorities, setPriorities] = useState<CompanyPriority[]>(initialPriorities);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("company-priorities-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "company_priorities",
          filter: "org_id=eq.creait",
        },
        async () => {
          const { data } = await supabase
            .from("company_priorities")
            .select("*")
            .eq("org_id", "creait")
            .neq("status", "dropped")
            .order("sort_order", { ascending: true });
          if (data) setPriorities(data as CompanyPriority[]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const nextOrder =
      priorities.length > 0
        ? Math.max(...priorities.map((p) => p.sort_order)) + 1
        : 0;

    const { error: dbError } = await supabase.from("company_priorities").insert({
      org_id: "creait",
      title: title.trim(),
      sort_order: nextOrder,
      status: "active",
    });

    setSubmitting(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    setTitle("");
    setDialogOpen(false);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Priorities
        </span>
        {priorities.map((p) => (
          <span
            key={p.id}
            className="bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-paper)] rounded-full px-3 py-1 text-sm"
          >
            {p.title}
          </span>
        ))}
        <button
          onClick={() => setDialogOpen(true)}
          className={cn(
            "flex items-center gap-1 rounded-full border border-[color:var(--color-brand-fog)] px-3 py-1 text-sm text-muted-foreground",
            "hover:border-[color:var(--color-brand-electric)] hover:text-[color:var(--color-brand-electric)] transition-colors"
          )}
          aria-label="Add priority"
        >
          <Plus className="size-3.5" />
          Add Priority
        </button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Company Priority</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="priority-title">
                Priority <span className="text-[color:var(--color-brand-danger)]">*</span>
              </label>
              <Input
                id="priority-title"
                placeholder="e.g. Hit $6K MRR"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-[color:var(--color-brand-danger)]">{error}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !title.trim()}>
                {submitting ? "Saving…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
