"use client";

import { Mail, MessageSquare, Send, UserRound, CircleHelp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, MessageSource } from "@/lib/supabase/types";

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 60) return `${Math.max(diffMin, 1)}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SOURCE_ICONS: Record<MessageSource, LucideIcon> = {
  linkedin: UserRound,
  gmail: Mail,
  ghl_email: Mail,
  ghl_sms: MessageSquare,
  ghl_dm: Send,
  other: CircleHelp,
};

function priorityClasses(score: number): string {
  if (score >= 80)
    return "bg-[color:var(--color-brand-danger)]/10 text-[color:var(--color-brand-danger)]";
  if (score >= 50)
    return "bg-[color:var(--color-brand-warning)]/10 text-[color:var(--color-brand-warning)]";
  return "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]";
}

export interface MessageRowProps {
  message: Message;
  active: boolean;
  onClick: () => void;
}

export function MessageRow({ message, active, onClick }: MessageRowProps) {
  const Icon = SOURCE_ICONS[message.source] ?? CircleHelp;
  const isUnread = message.status === "unread";
  const preview = (message.body ?? "").slice(0, 80);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 px-3 py-3 text-left transition-colors border-b border-border/50 last:border-0",
        active
          ? "bg-[color:var(--color-brand-slate)]"
          : "hover:bg-[color:var(--color-brand-slate)]/50",
      )}
    >
      <div className="mt-0.5 shrink-0 size-7 rounded-full bg-[color:var(--color-brand-fog)] flex items-center justify-center">
        <Icon className="size-3.5 text-[color:var(--color-brand-mist)]" />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5">
          {isUnread && (
            <span className="shrink-0 size-1.5 rounded-full bg-[color:var(--color-brand-electric)]" />
          )}
          <span
            className={cn(
              "truncate text-sm leading-tight",
              isUnread ? "font-semibold" : "font-medium",
            )}
          >
            {message.contact_name ?? "Unknown"}
          </span>
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
            {formatTimeAgo(message.received_at)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground truncate flex-1">
            {preview || <em>No content</em>}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              priorityClasses(message.priority_score),
            )}
          >
            {message.priority_score}
          </span>
        </div>
      </div>
    </button>
  );
}
