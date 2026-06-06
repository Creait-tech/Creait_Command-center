"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type { Strategy } from "@/lib/supabase/types";

interface ValueLadderProps {
  strategy: Strategy | null;
  onUpdated: (next: Strategy) => void;
}

interface Tier {
  name: string;
  price: string;
  description: string;
  cta: string;
}

const DEFAULT_TIERS: Tier[] = [
  {
    name: "Starter",
    price: "$297",
    description: "Entry-tier engagement.",
    cta: "Get started",
  },
  {
    name: "Growth",
    price: "$497",
    description: "For scaling teams ready to invest in systems.",
    cta: "Book a call",
  },
  {
    name: "Scale",
    price: "$797",
    description: "Done-for-you growth engine.",
    cta: "Apply now",
  },
];

function parseTiers(raw: string | null | undefined): Tier[] {
  if (!raw) return DEFAULT_TIERS;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { tiers?: unknown }).tiers)
    ) {
      const tiers = (parsed as { tiers: unknown[] }).tiers
        .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === "object")
        .map((t) => ({
          name: typeof t.name === "string" ? t.name : "",
          price: typeof t.price === "string" ? t.price : "",
          description:
            typeof t.description === "string" ? t.description : "",
          cta: typeof t.cta === "string" ? t.cta : "",
        }));
      if (tiers.length > 0) return tiers;
    }
  } catch {
    // Not JSON — fall through.
  }
  return DEFAULT_TIERS;
}

export function ValueLadder({ strategy, onUpdated }: ValueLadderProps) {
  const tiers = useMemo(() => parseTiers(strategy?.value_ladder), [strategy]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Tier[]>(tiers);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit() {
    setDraft(tiers.length > 0 ? tiers : DEFAULT_TIERS);
    setError(null);
    setDialogOpen(true);
  }

  function updateTier(idx: number, field: keyof Tier, value: string) {
    const next = draft.map((t, i) => (i === idx ? { ...t, [field]: value } : t));
    setDraft(next);
  }

  function addTier() {
    setDraft([
      ...draft,
      { name: "", price: "", description: "", cta: "" },
    ]);
  }

  function removeTier(idx: number) {
    setDraft(draft.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!strategy) {
      setError("Strategy row not found. Cannot save.");
      return;
    }
    const cleaned = draft
      .map((t) => ({
        name: t.name.trim(),
        price: t.price.trim(),
        description: t.description.trim(),
        cta: t.cta.trim(),
      }))
      .filter((t) => t.name || t.price || t.description || t.cta);

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("strategy")
      .update({
        value_ladder: JSON.stringify({ tiers: cleaned }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", strategy.id)
      .select()
      .single();

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (data) onUpdated(data as Strategy);
    setDialogOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={openEdit}
          aria-label="Edit value ladder"
        >
          <Pencil className="size-3.5" />
          Edit Tiers
        </Button>
      </div>

      {tiers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex items-center justify-center h-32 text-sm text-muted-foreground">
          No tiers yet. Click Edit Tiers to add the first offer.
        </div>
      ) : (
        <ol className="space-y-3">
          {tiers.map((tier, idx) => (
            <li
              key={idx}
              style={{ marginLeft: `${idx * 28}px` }}
              className="rounded-xl border border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-slate)]/40 p-4 transition-colors hover:border-[color:var(--color-brand-electric)]/60"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Tier {idx + 1}
                    </span>
                    <h3 className="text-lg font-semibold">{tier.name || "Untitled"}</h3>
                    {tier.price && (
                      <span className="text-sm font-mono text-[color:var(--color-brand-electric)]">
                        {tier.price}
                      </span>
                    )}
                  </div>
                  {tier.description && (
                    <p className="text-sm text-muted-foreground">
                      {tier.description}
                    </p>
                  )}
                </div>
                {tier.cta && (
                  <span className="inline-flex shrink-0 items-center rounded-md bg-[color:var(--color-brand-electric)]/15 px-3 py-1.5 text-xs font-semibold text-[color:var(--color-brand-electric)]">
                    {tier.cta}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Value Ladder</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {draft.map((tier, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-[color:var(--color-brand-fog)] p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Tier {idx + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTier(idx)}
                    aria-label={`Remove tier ${idx + 1}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`tier-name-${idx}`}>Name</Label>
                    <Input
                      id={`tier-name-${idx}`}
                      value={tier.name}
                      onChange={(e) => updateTier(idx, "name", e.target.value)}
                      placeholder="Starter"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`tier-price-${idx}`}>Price</Label>
                    <Input
                      id={`tier-price-${idx}`}
                      value={tier.price}
                      onChange={(e) =>
                        updateTier(idx, "price", e.target.value)
                      }
                      placeholder="$297"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`tier-desc-${idx}`}>Description</Label>
                  <Textarea
                    id={`tier-desc-${idx}`}
                    value={tier.description}
                    onChange={(e) =>
                      updateTier(idx, "description", e.target.value)
                    }
                    placeholder="What this tier delivers."
                    className="min-h-16 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`tier-cta-${idx}`}>CTA</Label>
                  <Input
                    id={`tier-cta-${idx}`}
                    value={tier.cta}
                    onChange={(e) => updateTier(idx, "cta", e.target.value)}
                    placeholder="Get started"
                  />
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addTier}>
              <Plus className="size-3.5" />
              Add Tier
            </Button>

            {error && (
              <p className="text-xs text-[color:var(--color-brand-danger)]">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
