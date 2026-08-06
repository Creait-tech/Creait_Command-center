"use client";

import { useEffect, useState } from "react";
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
import { useActiveOrgId } from "@/lib/use-active-org";
import type { InitiativeStatus } from "@/lib/supabase/types";
import type { InitiativeMember } from "./initiatives-view";

const UNASSIGNED = "__unassigned__";

interface AddInitiativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDepartment: string;
  departmentOptions: { key: string; label: string }[];
  members: InitiativeMember[];
}

interface FormState {
  title: string;
  description: string;
  department: string;
  status: InitiativeStatus;
  quarter: string;
  due_date: string;
  owner_id: string;
}

const STATUS_OPTIONS: { value: InitiativeStatus; label: string }[] = [
  { value: "on_track", label: "On Track" },
  { value: "at_risk", label: "At Risk" },
  { value: "off_track", label: "Off Track" },
];

function emptyForm(department: string): FormState {
  return {
    title: "",
    description: "",
    department,
    status: "on_track",
    quarter: "",
    due_date: "",
    owner_id: UNASSIGNED,
  };
}

export function AddInitiativeDialog({
  open,
  onOpenChange,
  defaultDepartment,
  departmentOptions,
  members,
}: AddInitiativeDialogProps) {
  const orgId = useActiveOrgId();
  const [form, setForm] = useState<FormState>(emptyForm(defaultDepartment));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when reopened with a new default department.
  useEffect(() => {
    if (open) {
      setForm(emptyForm(defaultDepartment));
      setError(null);
    }
  }, [open, defaultDepartment]);

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
    const { error: dbError } = await supabase.from("initiatives").insert({
      org_id: orgId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      department: form.department,
      status: form.status,
      progress: 0,
      quarter: form.quarter.trim() || null,
      due_date: form.due_date || null,
      owner_id: form.owner_id === UNASSIGNED ? null : form.owner_id,
    });

    setSubmitting(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Initiative</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="initiative-title"
            >
              Title{" "}
              <span className="text-[color:var(--color-brand-danger)]">*</span>
            </label>
            <Input
              id="initiative-title"
              placeholder="Initiative title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="initiative-desc"
            >
              Description
            </label>
            <Textarea
              id="initiative-desc"
              placeholder="Optional"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className="min-h-16"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Department
              </label>
              <Select
                value={form.department}
                onValueChange={(v) => update("department", String(v ?? ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {departmentOptions.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Status
              </label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  update("status", (v ?? "on_track") as InitiativeStatus)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Owner
            </label>
            <Select
              value={form.owner_id}
              onValueChange={(v) => update("owner_id", String(v ?? UNASSIGNED))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              One owner, always. EOS rule: one throat to choke.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="initiative-quarter"
              >
                Quarter
              </label>
              <Input
                id="initiative-quarter"
                placeholder="e.g. Q3 2026"
                value={form.quarter}
                onChange={(e) => update("quarter", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="initiative-due"
              >
                Due Date
              </label>
              <Input
                id="initiative-due"
                type="date"
                value={form.due_date}
                onChange={(e) => update("due_date", e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-[color:var(--color-brand-danger)]">
              {error}
            </p>
          )}

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
              {submitting ? "Saving…" : "Add Initiative"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
