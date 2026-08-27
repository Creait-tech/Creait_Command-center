"use client";

import { useState, useEffect } from "react";
import { Plus, Trophy } from "lucide-react";
import { toast } from "sonner";
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
import { Card, CardContent } from "@/components/ui/card";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { AuthorStamp } from "@/components/authorship/author-stamp";
import { asAuthoredRows, type AuthoredWin } from "@/lib/authorship";
import { createWin } from "@/lib/eos-actions";

interface WinsFeedProps {
  initialWins: AuthoredWin[];
  meetingId: string | null;
}

function sortWins(wins: AuthoredWin[]): AuthoredWin[] {
  return [...wins].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function WinsFeed({ initialWins, meetingId }: WinsFeedProps) {
  const orgId = useActiveOrgId();
  const [wins, setWins] = useState<AuthoredWin[]>(sortWins(initialWins));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function refetchWins() {
      const query = meetingId
        ? supabase
            .from("wins")
            .select("*")
            .eq("org_id", orgId)
            .eq("meeting_id", meetingId)
            .order("created_at", { ascending: false })
        : supabase
            .from("wins")
            .select("*")
            .eq("org_id", orgId)
            .order("created_at", { ascending: false })
            .limit(20);

      const { data } = await query;
      if (data) setWins(sortWins(asAuthoredRows<AuthoredWin>(data)));
    }

    const channel = supabase
      .channel("wins-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wins",
          filter: `org_id=eq.${orgId}`,
        },
        refetchWins
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [meetingId, orgId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    // Server action, not the browser client: a Win records who logged it, and
    // that name is resolved from the Clerk session rather than sent by the page.
    const result = await createWin({
      title,
      description,
      meetingId,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setWins((prev) =>
      sortWins([result.data, ...prev.filter((w) => w.id !== result.data.id)]),
    );
    setTitle("");
    setDescription("");
    setDialogOpen(false);
    toast.success("Win logged");
  }

  function formatWinDate(value: string): string {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {wins.length} win{wins.length !== 1 ? "s" : ""}
          {meetingId ? " this meeting" : " recent"}
        </p>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="size-4" />
          Submit Win
        </Button>
      </div>

      {wins.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="size-8 text-[color:var(--color-brand-mist)] mb-2" />
          <p className="text-sm font-medium">No wins yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Kick off the meeting by sharing a win.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {wins.map((win) => (
            <Card
              key={win.id}
              className="bg-[color:var(--color-brand-success)]/5 ring-1 ring-[color:var(--color-brand-success)]/20"
            >
              <CardContent className="space-y-2">
                <div className="flex items-start gap-2">
                  <Trophy className="size-4 text-[color:var(--color-brand-success)] mt-0.5 shrink-0" />
                  <p className="font-semibold text-sm leading-snug">
                    {win.title}
                  </p>
                </div>
                {win.description && (
                  <p className="text-xs text-muted-foreground line-clamp-3 pl-6">
                    {win.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {formatWinDate(win.win_date)}
                  </span>
                  <AuthorStamp
                    label="logged by"
                    name={win.created_by_name}
                    actorId={win.created_by}
                    at={win.created_at}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit a Win</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="win-title"
              >
                Win{" "}
                <span className="text-[color:var(--color-brand-danger)]">
                  *
                </span>
              </label>
              <Input
                id="win-title"
                placeholder="e.g. Closed Asia / ACE Financial"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="win-desc"
              >
                Description
              </label>
              <Textarea
                id="win-desc"
                placeholder="Optional context"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-16"
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
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !title.trim()}>
                {submitting ? "Saving…" : "Log Win"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
