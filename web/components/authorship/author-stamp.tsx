"use client";

import { ActorStamp } from "@/components/journey/actor-stamp";
import { actorTypeOf } from "@/lib/authorship";

interface Props {
  /** `created_by_name` / `updated_by_name` straight off the row. */
  name: string | null;
  /** `created_by` / `updated_by` — used only to tell a person from an agent. */
  actorId?: string | null;
  /** The timestamp the stamp describes. */
  at: string | null;
  /** Leading words, e.g. "added by" or "edited by". */
  label?: string;
  className?: string;
}

/**
 * "added by Jaylyn · 2d ago" — the quiet authorship line under a To-Do, Rock,
 * Win or issue.
 *
 * Deliberately a thin wrapper over the journey module's `ActorStamp` rather
 * than a second implementation: the dot-or-bot glyph, the relative time and
 * the hover tooltip should not drift into two different notions of the same
 * thing. All this adds is the leading label, because unlike a journey
 * deliverable these rows already show an *owner*, and an unlabelled name next
 * to one would read as a second owner.
 *
 * Renders nothing when there is no author. Every row created before the
 * authorship columns landed has none, and "Unknown" would be a claim we can't
 * support — an absent stamp is honest, an invented one isn't.
 */
export function AuthorStamp({
  name,
  actorId,
  at,
  label = "added by",
  className,
}: Props) {
  if (!name || !name.trim()) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[10px] leading-none text-muted-foreground">
      <span>{label}</span>
      <ActorStamp
        name={name}
        type={actorTypeOf(actorId ?? null)}
        at={at}
        className={className}
      />
    </span>
  );
}
