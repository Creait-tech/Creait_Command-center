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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import type { TeamMember, TeamRole, TeamStatus } from "@/lib/supabase/types";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (member: TeamMember) => void;
}

interface FormState {
  full_name: string;
  email: string;
  role: TeamRole;
  title: string;
  department: string;
  status: TeamStatus;
}

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const STATUS_OPTIONS: { value: TeamStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "offboarded", label: "Offboarded" },
];

const EMPTY: FormState = {
  full_name: "",
  email: "",
  role: "member",
  title: "",
  department: "",
  status: "active",
};

export function AddMemberDialog({
  open,
  onOpenChange,
  onCreated,
}: AddMemberDialogProps) {
  const orgId = useActiveOrgId();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError("Full name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("team_members")
      .insert({
        org_id: orgId,
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        role: form.role,
        title: form.title.trim() || null,
        department: form.department.trim() || null,
        status: form.status,
      })
      .select("*")
      .single();

    setSubmitting(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    if (data) {
      onCreated(data as TeamMember);
    }
    setForm(EMPTY);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="member-name"
            >
              Full name{" "}
              <span className="text-[color:var(--color-brand-danger)]">*</span>
            </label>
            <Input
              id="member-name"
              placeholder="e.g. John Doe"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="member-email"
            >
              Email
            </label>
            <Input
              id="member-email"
              type="email"
              placeholder="name@example.com"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Role
            </label>
            <Select
              value={form.role}
              onValueChange={(v) =>
                typeof v === "string" && update("role", v as TeamRole)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="member-title"
            >
              Title
            </label>
            <Input
              id="member-title"
              placeholder="e.g. Head of Operations"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="member-dept"
            >
              Department
            </label>
            <Input
              id="member-dept"
              placeholder="e.g. Engineering"
              value={form.department}
              onChange={(e) => update("department", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <Select
              value={form.status}
              onValueChange={(v) =>
                typeof v === "string" && update("status", v as TeamStatus)
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
              {submitting ? "Saving…" : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
