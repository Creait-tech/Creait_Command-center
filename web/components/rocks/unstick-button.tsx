"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  rockId: string;
  rockTitle: string;
}

export function UnstickButton({ rockId, rockTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setOutput(null);
    setOpen(true);
    try {
      const res = await fetch(`/api/rocks/${rockId}/unstick`, { method: "POST" });
      const json = (await res.json()) as { suggestions?: string; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Failed");
      setOutput(json.suggestions ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={run}
        disabled={loading}
        className="text-[color:var(--color-brand-violet)] border-[color:var(--color-brand-violet)]/40 hover:bg-[color:var(--color-brand-violet)]/10"
      >
        <Sparkles className="size-3" />
        {loading ? "Thinking…" : "Unstick"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <Sparkles className="size-4 text-[color:var(--color-brand-violet)] inline mr-1" />
              Unstick — {rockTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="pt-1">
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Sparkles className="size-6 mx-auto mb-2 animate-pulse text-[color:var(--color-brand-violet)]" />
                Looking at milestones, status history, and SMART criteria…
              </div>
            ) : error ? (
              <p className="text-sm text-[color:var(--color-brand-danger)]">{error}</p>
            ) : output ? (
              <ScrollArea className="max-h-96 rounded border border-border bg-muted/30 p-3">
                <div className="prose prose-sm prose-invert max-w-none text-xs">
                  <Markdown remarkPlugins={[remarkGfm]}>{output}</Markdown>
                </div>
              </ScrollArea>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              <X className="size-3.5" />
              Close
            </Button>
            {output && (
              <Button onClick={run} disabled={loading}>
                <Sparkles className="size-3.5" />
                Try again
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
