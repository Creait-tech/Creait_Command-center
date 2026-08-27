"use client";

import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { fullTimestamp, timeAgo } from "./journey-format";
import type { ActorType } from "@/lib/supabase/types";

interface Props {
  name: string | null;
  type: ActorType | null;
  at: string | null;
  className?: string;
}

/**
 * The quiet "Jaylyn · 2d ago" line under a deliverable.
 *
 * Renders nothing at all when nobody has touched the row — an empty
 * placeholder on 40-odd untouched deliverables is noise, not information.
 * Hermes gets a bot glyph and the aqua tint so an agent tick is never read
 * as a teammate's.
 */
export function ActorStamp({ name, type, at, className }: Props) {
  if (!name) return null;
  const isAgent = type === "agent";
  const relative = timeAgo(at);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] leading-none text-muted-foreground",
        className,
      )}
      title={at ? `${name} · ${fullTimestamp(at)}` : name}
    >
      {isAgent ? (
        <Bot
          className="size-3 text-[color:var(--color-brand-aqua)]"
          aria-hidden
        />
      ) : (
        <span
          className="size-1.5 rounded-full bg-[color:var(--color-brand-mist)]"
          aria-hidden
        />
      )}
      <span
        className={cn(
          "font-medium",
          isAgent && "text-[color:var(--color-brand-aqua)]",
        )}
      >
        {name}
      </span>
      {relative && (
        <>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{relative}</span>
        </>
      )}
    </span>
  );
}
