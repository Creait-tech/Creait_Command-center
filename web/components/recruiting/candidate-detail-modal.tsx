"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, Link as LinkIcon, Star, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type { Candidate, CandidateStage } from "@/lib/supabase/types";

interface CandidateDetailModalProps {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: (updated: Candidate) => void;
}

const STAGE_BUTTONS: { value: CandidateStage; label: string; color: string }[] = [
  {
    value: "applied",
    label: "Applied",
    color: "var(--color-brand-mist)",
  },
  {
    value: "screening",
    label: "Screening",
    color: "var(--color-brand-electric)",
  },
  {
    value: "interview",
    label: "Interview",
    color: "var(--color-brand-warning)",
  },
  {
    value: "offer",
    label: "Offer",
    color: "var(--color-brand-violet)",
  },
  {
    value: "hired",
    label: "Hired",
    color: "var(--color-brand-success)",
  },
  {
    value: "withdrew",
    label: "Withdrew",
    color: "var(--color-brand-mist)",
  },
];

// Notes are stored as a single text column. We render existing notes
// as a read-only block above the input. New entries are appended with a
// timestamp separator so the column stays an append-only log.
function appendNote(existing: string | null, fresh: string): string {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const entry = `[${stamp}] ${fresh.trim()}`;
  if (!existing || !existing.trim()) return entry;
  return `${existing.trimEnd()}\n\n${entry}`;
}

// Convert an ISO timestamp to the value format expected by
// <input type="datetime-local"> (YYYY-MM-DDTHH:mm).
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function CandidateDetailModal({
  candidate,
  open,
  onOpenChange,
  onChanged,
}: CandidateDetailModalProps) {
  const [role, setRole] = useState("");
  const [rating, setRating] = useState(0);
  const [nextStep, setNextStep] = useState("");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset local state every time a new candidate is shown.
  useEffect(() => {
    if (!candidate) return;
    setRole(candidate.role_applying_for ?? "");
    setRating(candidate.rating ?? 0);
    setNextStep(isoToLocalInput(candidate.next_step_at));
    setNewNote("");
    setError(null);
  }, [candidate]);

  if (!candidate) return null;

  async function updateCandidate(
    patch: Partial<Candidate>,
    options: { closeAfter?: boolean } = {}
  ) {
    if (!candidate) return;
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("candidates")
      .update(payload)
      .eq("id", candidate.id)
      .select()
      .single();

    setSaving(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    if (data) onChanged?.(data as Candidate);
    if (options.closeAfter) onOpenChange(false);
  }

  async function handleSaveEdits() {
    await updateCandidate({
      role_applying_for: role.trim() || null,
      rating: rating > 0 ? rating : null,
      next_step_at: localInputToIso(nextStep),
    });
  }

  async function handleAddNote() {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    const merged = appendNote(candidate?.notes ?? null, trimmed);
    await updateCandidate({ notes: merged });
    setNewNote("");
  }

  async function handleMoveStage(stage: CandidateStage) {
    await updateCandidate({ stage, sort_order: 0 });
  }

  async function handleNotAFit() {
    await updateCandidate({ stage: "rejected", sort_order: 0 }, { closeAfter: true });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{candidate.full_name}</span>
            <span className="rounded-full bg-[color:var(--color-brand-fog)]/60 px-2 py-0.5 text-xs font-medium text-[color:var(--color-brand-mist)] capitalize">
              {candidate.stage}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Contact strip */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {candidate.email && (
              <a
                href={`mailto:${candidate.email}`}
                className="inline-flex items-center gap-1 hover:text-[color:var(--color-brand-electric)]"
              >
                <Mail className="size-3.5" /> {candidate.email}
              </a>
            )}
            {candidate.phone && (
              <a
                href={`tel:${candidate.phone}`}
                className="inline-flex items-center gap-1 hover:text-[color:var(--color-brand-electric)]"
              >
                <Phone className="size-3.5" /> {candidate.phone}
              </a>
            )}
            {candidate.source && (
              <span className="inline-flex items-center gap-1">
                Source: <span className="text-foreground">{candidate.source}</span>
              </span>
            )}
            {candidate.resume_url && (
              <a
                href={candidate.resume_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-[color:var(--color-brand-electric)]"
              >
                <LinkIcon className="size-3.5" /> Resume
              </a>
            )}
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="detail-role"
              >
                Role Applying For
              </label>
              <Input
                id="detail-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Lead GHL Engineer"
              />
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
                    onClick={() => setRating(n === rating ? 0 : n)}
                    className="p-0.5"
                  >
                    <Star
                      className={cn(
                        "size-5 transition-colors",
                        n <= rating
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
                htmlFor="detail-next"
              >
                Next Step
              </label>
              <Input
                id="detail-next"
                type="datetime-local"
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={handleSaveEdits}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Edits"}
            </Button>
          </div>

          {/* Notes log */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Notes</h3>
            <div className="rounded-md border border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-slate)]/40 p-3 max-h-48 overflow-y-auto text-xs whitespace-pre-wrap text-foreground/90">
              {candidate.notes && candidate.notes.trim() ? (
                candidate.notes
              ) : (
                <span className="text-muted-foreground italic">
                  No notes yet.
                </span>
              )}
            </div>
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note (timestamped on save)…"
              className="min-h-20"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddNote}
                disabled={saving || !newNote.trim()}
              >
                Append Note
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-[color:var(--color-brand-danger)]">
              {error}
            </p>
          )}

          {/* Move to stage */}
          <div className="space-y-2 pt-2 border-t border-[color:var(--color-brand-fog)]">
            <h3 className="text-sm font-semibold">Move to Stage</h3>
            <div className="flex flex-wrap gap-2">
              {STAGE_BUTTONS.map((s) => {
                const active = candidate.stage === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => handleMoveStage(s.value)}
                    disabled={saving || active}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition",
                      active
                        ? "cursor-default opacity-60"
                        : "hover:brightness-110"
                    )}
                    style={{
                      borderColor: `color-mix(in srgb, ${s.color} 50%, transparent)`,
                      color: s.color,
                      backgroundColor: active
                        ? `color-mix(in srgb, ${s.color} 25%, transparent)`
                        : `color-mix(in srgb, ${s.color} 12%, transparent)`,
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleNotAFit}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--color-brand-danger)]/50 bg-[color:var(--color-brand-danger)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--color-brand-danger)] hover:bg-[color:var(--color-brand-danger)]/20"
              >
                <X className="size-3" /> Not a Fit
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
