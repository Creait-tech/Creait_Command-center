"use client";

import { useState, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ResearchBriefing } from "@/lib/supabase/types";

interface Props {
  initialArchive: ResearchBriefing[];
}

export function ArchiveTab({ initialArchive }: Props) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ResearchBriefing | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return initialArchive;
    return initialArchive.filter(
      (b) =>
        b.title.toLowerCase().includes(q) || b.content.toLowerCase().includes(q),
    );
  }, [search, initialArchive]);

  if (initialArchive.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          No briefings archived yet. Generate one from Today's Briefing or Deep Research.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search archived briefings…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No matches</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setView(b)}
              className="w-full text-left"
            >
              <Card className="hover:border-[color:var(--color-brand-electric)] transition-colors">
                <CardContent className="pt-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs rounded-full px-2 py-0.5 bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)]">
                      {b.briefing_type}
                    </span>
                    <span className="text-xs text-muted-foreground">{b.briefing_date}</span>
                  </div>
                  <p className="font-medium text-sm">{b.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {b.content.slice(0, 200)}
                  </p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Dialog open={view !== null} onOpenChange={(open) => !open && setView(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{view?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {view && (
              <div className="prose prose-sm prose-invert max-w-none">
                <Markdown remarkPlugins={[remarkGfm]}>{view.content}</Markdown>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
