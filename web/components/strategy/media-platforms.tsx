"use client";

import { useState } from "react";
import { Plus, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type { MediaPlatform } from "@/lib/supabase/types";

interface MediaPlatformsProps {
  platforms: MediaPlatform[];
  onChange: (next: MediaPlatform[]) => void;
}

const PLATFORM_OPTIONS = [
  "LinkedIn",
  "Twitter",
  "YouTube",
  "TikTok",
  "Instagram",
  "Other",
] as const;

interface DraftPlatform {
  name: string;
  platform: string;
  handle: string;
  url: string;
  followers: string;
}

const EMPTY_DRAFT: DraftPlatform = {
  name: "",
  platform: "LinkedIn",
  handle: "",
  url: "",
  followers: "",
};

function formatFollowers(n: number): string {
  if (!n || n <= 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function MediaPlatforms({ platforms, onChange }: MediaPlatformsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<DraftPlatform>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setDraft(EMPTY_DRAFT);
    setError(null);
    setDialogOpen(true);
  }

  async function savePlatform() {
    if (!draft.name.trim()) {
      setError("Name is required.");
      return;
    }
    const followers = draft.followers ? Number(draft.followers) : 0;
    if (Number.isNaN(followers) || followers < 0) {
      setError("Followers must be a non-negative number.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const nextSort =
      platforms.reduce((max, p) => Math.max(max, p.sort_order), -1) + 1;

    const payload = {
      org_id: "creait",
      name: draft.name.trim(),
      platform: draft.platform || null,
      handle: draft.handle.trim() || null,
      url: draft.url.trim() || null,
      followers,
      active: true,
      sort_order: nextSort,
    };

    const { data, error: insertError } = await supabase
      .from("media_platforms")
      .insert(payload)
      .select()
      .single();

    setSaving(false);
    if (insertError || !data) {
      setError(insertError?.message ?? "Failed to save platform.");
      return;
    }
    onChange([...platforms, data as MediaPlatform]);
    setDialogOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openDialog}>
          <Plus className="size-3.5" />
          Add Platform
        </Button>
      </div>

      {platforms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex items-center justify-center h-32 text-sm text-muted-foreground">
          No platforms tracked yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {platforms.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-slate)]/40 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold truncate">{p.name}</h3>
                  {p.platform && (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {p.platform}
                    </p>
                  )}
                </div>
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[color:var(--color-brand-electric)] hover:text-[color:var(--color-brand-electric-glow)]"
                    aria-label={`Open ${p.name}`}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>

              {p.handle && (
                <p className="text-sm text-muted-foreground truncate">
                  {p.handle.startsWith("@") ? p.handle : `@${p.handle}`}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-[color:var(--color-brand-fog)]/50">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" />
                  {formatFollowers(p.followers)} followers
                </span>
                <span className="opacity-60">Activity: —</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Media Platform</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mp-name">Name *</Label>
              <Input
                id="mp-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="CREAIT on LinkedIn"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mp-platform">Platform</Label>
              <select
                id="mp-platform"
                value={draft.platform}
                onChange={(e) =>
                  setDraft({ ...draft, platform: e.target.value })
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {PLATFORM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="mp-handle">Handle</Label>
                <Input
                  id="mp-handle"
                  value={draft.handle}
                  onChange={(e) =>
                    setDraft({ ...draft, handle: e.target.value })
                  }
                  placeholder="@getcreait"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mp-followers">Followers</Label>
                <Input
                  id="mp-followers"
                  type="number"
                  min="0"
                  value={draft.followers}
                  onChange={(e) =>
                    setDraft({ ...draft, followers: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mp-url">URL</Label>
              <Input
                id="mp-url"
                type="url"
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
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
            <Button onClick={savePlatform} disabled={saving}>
              {saving ? "Saving…" : "Save Platform"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
