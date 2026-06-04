"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import type { Timeframe } from "@/lib/supabase/types";

interface AddGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTimeframe: Timeframe;
  onSuccess: () => void;
}

interface FormState {
  title: string;
  description: string;
  timeframe: Timeframe;
  owner_id: string;
  due_date: string;
}

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
];

export function AddGoalDialog({
  open,
  onOpenChange,
  defaultTimeframe,
  onSuccess,
}: AddGoalDialogProps) {
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    timeframe: defaultTimeframe,
    owner_id: "",
    due_date: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: dbError } = await supabase.from("goals").insert({
      org_id: "creait",
      title: form.title.trim(),
      description: form.description.trim() || null,
      timeframe: form.timeframe,
      owner_id: form.owner_id.trim() || null,
      due_date: form.due_date || null,
      status: "active",
      progress: 0,
      sort_order: 0,
    });

    setSubmitting(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    setForm({
      title: "",
      description: "",
      timeframe: defaultTimeframe,
      owner_id: "",
      due_date: "",
    });
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Goal</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="goal-title">
              Title <span className="text-[color:var(--color-brand-danger)]">*</span>
            </label>
            <Input
              id="goal-title"
              placeholder="Goal title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="goal-desc">
              Description
            </label>
            <Textarea
              id="goal-desc"
              placeholder="Optional"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className="min-h-16"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Timeframe</label>
            <Select
              value={form.timeframe}
              onValueChange={(v) => update("timeframe", v as Timeframe)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAME_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="goal-owner">
              Owner
            </label>
            <Input
              id="goal-owner"
              placeholder="e.g. Maurice"
              value={form.owner_id}
              onChange={(e) => update("owner_id", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="goal-due">
              Due Date
            </label>
            <Input
              id="goal-due"
              type="date"
              value={form.due_date}
              onChange={(e) => update("due_date", e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-[color:var(--color-brand-danger)]">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Add Goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
