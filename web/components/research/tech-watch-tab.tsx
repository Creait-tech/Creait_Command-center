"use client";

import { useState } from "react";
import { Plus, ExternalLink, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddCompetitorDialog } from "./add-competitor-dialog";
import { useRouter } from "next/navigation";
import type { Competitor, TechWatchItem, TechWatchSourceType } from "@/lib/supabase/types";

const SOURCE_COLOR: Record<TechWatchSourceType, string> = {
  news: "bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)]",
  blog: "bg-[color:var(--color-brand-aqua)]/15 text-[color:var(--color-brand-aqua)]",
  hiring: "bg-[color:var(--color-brand-warning)]/15 text-[color:var(--color-brand-warning)]",
  social: "bg-[color:var(--color-brand-violet)]/15 text-[color:var(--color-brand-violet)]",
  other: "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]",
};

interface Props {
  initialCompetitors: Competitor[];
  initialItems: TechWatchItem[];
}

export function TechWatchTab({ initialCompetitors, initialItems }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (initialCompetitors.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-medium">No companies tracked yet</p>
            <p className="text-xs text-muted-foreground max-w-md">
              Add tech companies you want AI-summarized news/hiring/blog updates on — like 66degrees or other consultancies.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Add Company
            </Button>
          </CardContent>
        </Card>
        <AddCompetitorDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdded={() => router.refresh()} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Watching <span className="font-medium text-foreground">{initialCompetitors.length}</span> companies
        </p>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="size-3.5" />
          Add Company
        </Button>
      </div>

      {initialCompetitors.map((comp) => {
        const items = initialItems.filter((i) => i.competitor_id === comp.id);
        return (
          <div key={comp.id} className="space-y-3">
            <div className="flex items-center gap-3 border-b border-border pb-2">
              <h3 className="text-lg font-semibold">{comp.name}</h3>
              {comp.url && (
                <a
                  href={comp.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs text-[color:var(--color-brand-electric)] hover:underline flex items-center gap-1"
                >
                  {comp.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  <ExternalLink className="size-3" />
                </a>
              )}
              {comp.category && (
                <span className="text-xs text-muted-foreground">· {comp.category}</span>
              )}
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-1">
                No updates this week. The Tech Watch crawler ships Phase 3.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            SOURCE_COLOR[item.source_type ?? "other"],
                          )}
                        >
                          {item.source_type ?? "other"}
                        </span>
                        {item.published_at && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.published_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold leading-snug">{item.headline}</p>
                      {item.snippet && (
                        <p className="text-xs text-muted-foreground line-clamp-3">{item.snippet}</p>
                      )}
                      {item.ai_summary && (
                        <p className="text-xs italic text-[color:var(--color-brand-mist)] line-clamp-3 border-l-2 border-[color:var(--color-brand-fog)] pl-2">
                          {item.ai_summary}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        {item.source_url && (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-xs text-[color:var(--color-brand-electric)] hover:underline flex items-center gap-1"
                          >
                            Source <ExternalLink className="size-3" />
                          </a>
                        )}
                        <Button variant="ghost" size="sm">
                          <Sparkles className="size-3" />
                          Summarize
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <AddCompetitorDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdded={() => router.refresh()} />
    </div>
  );
}
