"use client";

import { useState } from "react";
import { Plus, ExternalLink, ArrowRight } from "lucide-react";
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
import type { AdvisorInsight } from "@/lib/supabase/types";

interface AdvisorFeedProps {
  insights: AdvisorInsight[];
  onChange: (next: AdvisorInsight[]) => void;
}

interface DraftInsight {
  advisor_name: string;
  insight: string;
  category: string;
  source: string;
  source_url: string;
  occurred_at: string;
}

const EMPTY_DRAFT: DraftInsight = {
  advisor_name: "",
  insight: "",
  category: "",
  source: "",
  source_url: "",
  occurred_at: "",
};

function formatWhen(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function AdvisorFeed({ insights, onChange }: AdvisorFeedProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<DraftInsight>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingInitiativeId, setCreatingInitiativeId] = useState<
    string | null
  >(null);

  function openDialog() {
    setDraft({
      ...EMPTY_DRAFT,
      occurred_at: new Date().toISOString().slice(0, 10),
    });
    setError(null);
    setDialogOpen(true);
  }

  async function saveInsight() {
    if (!draft.insight.trim()) {
      setError("Insight is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const payload = {
      org_id: "creait",
      advisor_name: draft.advisor_name.trim() || null,
      insight: draft.insight.trim(),
      category: draft.category.trim() || null,
      source: draft.source.trim() || null,
      source_url: draft.source_url.trim() || null,
      occurred_at: draft.occurred_at ? draft.occurred_at : null,
    };

    const { data, error: insertError } = await supabase
      .from("advisor_insights")
      .insert(payload)
      .select()
      .single();

    setSaving(false);
    if (insertError || !data) {
      setError(insertError?.message ?? "Failed to save insight.");
      return;
    }
    onChange([data as AdvisorInsight, ...insights]);
    setDialogOpen(false);
  }

  async function createInitiative(insight: AdvisorInsight) {
    setCreatingInitiativeId(insight.id);
    const supabase = createClient();
    const titleSource = insight.insight.trim();
    const title =
      "From advisor: " +
      (titleSource.length > 60
        ? titleSource.slice(0, 60).trimEnd() + "…"
        : titleSource);

    const { error: insertError } = await supabase.from("initiatives").insert({
      org_id: "creait",
      title,
      description: insight.insight,
      status: "on_track",
      progress: 0,
    });

    setCreatingInitiativeId(null);
    if (insertError) {
      setError(insertError.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openDialog}>
          <Plus className="size-3.5" />
          Add Insight
        </Button>
      </div>

      {insights.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex items-center justify-center h-32 text-sm text-muted-foreground">
          No advisor insights logged yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {insights.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-slate)]/40 p-4 space-y-2"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">
                    {entry.advisor_name || "Anonymous advisor"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatWhen(entry.occurred_at)}
                  </span>
                  {entry.category && (
                    <span className="inline-flex items-center rounded-full bg-[color:var(--color-brand-violet)]/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[color:var(--color-brand-violet)]">
                      {entry.category}
                    </span>
                  )}
                </div>
                {entry.source_url && (
                  <a
                    href={entry.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[color:var(--color-brand-electric)] hover:underline"
                  >
                    {entry.source || "Source"}
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {entry.insight}
              </p>
              <div className="flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => createInitiative(entry)}
                  disabled={creatingInitiativeId === entry.id}
                >
                  <ArrowRight className="size-3.5" />
                  {creatingInitiativeId === entry.id
                    ? "Creating…"
                    : "Create Initiative from this"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Advisor Insight</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="advisor-name">Advisor</Label>
                <Input
                  id="advisor-name"
                  value={draft.advisor_name}
                  onChange={(e) =>
                    setDraft({ ...draft, advisor_name: e.target.value })
                  }
                  placeholder="Name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="advisor-when">When</Label>
                <Input
                  id="advisor-when"
                  type="date"
                  value={draft.occurred_at}
                  onChange={(e) =>
                    setDraft({ ...draft, occurred_at: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="advisor-insight">Insight *</Label>
              <Textarea
                id="advisor-insight"
                value={draft.insight}
                onChange={(e) =>
                  setDraft({ ...draft, insight: e.target.value })
                }
                placeholder="What they told you, verbatim if possible."
                className="min-h-24 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="advisor-category">Category</Label>
                <Input
                  id="advisor-category"
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                  placeholder="positioning, sales, ops…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="advisor-source">Source</Label>
                <Input
                  id="advisor-source"
                  value={draft.source}
                  onChange={(e) =>
                    setDraft({ ...draft, source: e.target.value })
                  }
                  placeholder="Call, email, podcast…"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="advisor-url">Source URL</Label>
              <Input
                id="advisor-url"
                type="url"
                value={draft.source_url}
                onChange={(e) =>
                  setDraft({ ...draft, source_url: e.target.value })
                }
                placeholder="https://"
              />
            </div>

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
            <Button onClick={saveInsight} disabled={saving}>
              {saving ? "Saving…" : "Save Insight"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
