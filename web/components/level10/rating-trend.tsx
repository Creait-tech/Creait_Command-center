import Link from "next/link";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RatedMeeting {
  id: string;
  title: string;
  rating: number | null;
  ended_at: string | null;
}

function tone(r: number): string {
  if (r >= 8) return "bg-[color:var(--color-brand-success)]";
  if (r >= 5) return "bg-[color:var(--color-brand-warning)]";
  return "bg-[color:var(--color-brand-danger)]";
}

/**
 * The last thirteen meeting ratings as bars, oldest to newest, so the team
 * sees whether meetings are getting better without opening any of them. EOS
 * target is 8 or above; the line marks it.
 */
export function RatingTrend({ meetings }: { meetings: RatedMeeting[] }) {
  const rated = meetings.filter((m) => typeof m.rating === "number").reverse();
  if (rated.length === 0) return null;
  const avg = rated.reduce((a, m) => a + (m.rating ?? 0), 0) / rated.length;
  const last = rated[rated.length - 1];

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Meeting ratings</p>
        <p className="text-sm">
          <span className="font-semibold">{avg.toFixed(1)}</span>
          <span className="text-muted-foreground"> avg over {rated.length} · last </span>
          <span className={cn("font-semibold", (last.rating ?? 0) >= 8 ? "text-[color:var(--color-brand-success)]" : "text-[color:var(--color-brand-warning)]")}>
            {last.rating?.toFixed(1)}
          </span>
        </p>
      </div>
      <div className="relative flex items-end gap-1 h-10 flex-1 max-w-64">
        <div className="absolute inset-x-0 border-t border-dashed border-[color:var(--color-brand-mist)]/50" style={{ bottom: "80%" }} aria-hidden />
        {rated.map((m) => (
          <Link
            key={m.id}
            href={`/level-10/meeting/${m.id}`}
            title={`${m.title} — ${m.rating?.toFixed(1)}/10`}
            className={cn("flex-1 min-w-1.5 rounded-sm opacity-80 hover:opacity-100", tone(m.rating ?? 0))}
            style={{ height: `${Math.max(8, ((m.rating ?? 0) / 10) * 100)}%` }}
          />
        ))}
      </div>
      <Star className="size-4 text-muted-foreground shrink-0" />
    </div>
  );
}
