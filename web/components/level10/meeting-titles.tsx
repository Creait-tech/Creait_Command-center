"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Meeting titles by id, provided once per page so any row — a to-do, an
 * issue, a headline, a win — can say which meeting it was captured in
 * without every component threading a map through its props.
 */
const MeetingTitlesContext = createContext<Record<string, string>>({});

export function MeetingTitlesProvider({
  titles,
  children,
}: {
  titles: Record<string, string>;
  children: ReactNode;
}) {
  return <MeetingTitlesContext.Provider value={titles}>{children}</MeetingTitlesContext.Provider>;
}

/**
 * "from L10 — Friday, Sep 12", linking to the meeting record. Renders
 * nothing when the row was not captured in a meeting, or the meeting is
 * unknown to this page.
 */
export function MeetingStamp({ meetingId, className }: { meetingId: string | null | undefined; className?: string }) {
  const titles = useContext(MeetingTitlesContext);
  if (!meetingId) return null;
  const title = titles[meetingId];
  if (!title) return null;
  return (
    <Link
      href={`/level-10/meeting/${meetingId}`}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-[color:var(--color-brand-electric)]",
        className,
      )}
      title="Open the meeting record"
    >
      <CalendarCheck className="size-3" />
      from {title}
    </Link>
  );
}
