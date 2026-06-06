"use client";

import { useState } from "react";
import { Star } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type { CandidateStage } from "@/lib/supabase/types";

interface AddCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface FormState {
  full_name: string;
  email: string;
  phone: string;
  role_applying_for: string;
  source: string;
  stage: CandidateStage;
  notes: string;
  rating: number;
}

const STAGE_OPTIONS: { value: CandidateStage; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrew", label: "Withdrew" },
];

const EMPTY_FORM: FormState = {
  full_name: "",
  email: "",
  phone: "",
  role_applying_for: "",
  source: "",
  stage: "applied",
  notes: "",
  rating: 0,
};

export function AddCandidateDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddCandidateDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
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
    const { error: dbError } = await supabase.from("candidates").insert({
      org_id: "creait",
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      role_applying_for: form.role_applying_for.trim() || null,
      source: form.source.trim() || null,
      stage: form.stage,
      notes: form.notes.trim() || null,
      rating: form.rating > 0 ? form.rating : null,
      sort_order: 0,
    });

    setSubmitting(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    setForm(EMPTY_FORM);
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Candidate</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="cand-name"
            >
              Full Name{" "}
              <span className="text-[color:var(--color-brand-danger)]">*</span>
            </label>
            <Input
              id="cand-name"
              placeholder="Jane Doe"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="cand-email"
              >
                Email
              </label>
              <Input
                id="cand-email"
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="cand-phone"
              >
                Phone
              </label>
              <Input
                id="cand-phone"
                placeholder="+1 555 0100"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="cand-role"
            >
              Role Applying For
            </label>
            <Input
              id="cand-role"
              placeholder="e.g. Lead GHL Engineer"
              value={form.role_applying_for}
              onChange={(e) => update("role_applying_for", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="cand-source"
              >
                Source
              </label>
              <Input
                id="cand-source"
                placeholder="LinkedIn, Referral…"
                value={form.source}
                onChange={(e) => update("source", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Stage
              </label>
              <Select
                value={form.stage}
                onValueChange={(v) => update("stage", v as CandidateStage)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((opt) => (
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
              Rating
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Rate ${n}`}
                  onClick={() => update("rating", n === form.rating ? 0 : n)}
                  className="p-0.5"
                >
                  <Star
                    className={cn(
                      "size-5 transition-colors",
                      n <= form.rating
                        ? "fill-[color:var(--color-brand-gold)] text-[color:var(--color-brand-gold)]"
                        : "text-[color:var(--color-brand-fog)] hover:text-[color:var(--color-brand-mist)]"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="cand-notes"
            >
              Notes
            </label>
            <Textarea
              id="cand-notes"
              placeholder="Optional"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              className="min-h-20"
            />
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
              {submitting ? "Saving…" : "Add Candidate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
