/**
 * Shared authorship vocabulary for the EOS surfaces (To-Dos, Rocks, Wins, IDS
 * items, Headlines) and for naming people consistently across the app.
 *
 * This module is deliberately runtime-free and client-safe: it holds types and
 * pure helpers only, so both server actions (`lib/eos-actions.ts`,
 * `lib/profile-actions.ts`) and client components can import from it. The
 * server-side actor resolution — the part that must never be influenced by the
 * browser — lives in the action modules.
 *
 * Migration `phase15_authorship_everywhere` added the columns below, but
 * `lib/supabase/types.ts` is owned by other work in flight and still describes
 * the pre-migration column set. The row shapes are widened here instead, in one
 * documented place, rather than sprinkling `as unknown as` through every query.
 * Once the generated types catch up, these interfaces can collapse to aliases.
 */

import type {
  Headline,
  IdsItem,
  Rock,
  TeamMember,
  Todo,
  Win,
} from "@/lib/supabase/types";

/** Columns stamped on every row a person creates. */
export interface CreatedByColumns {
  created_by: string | null;
  created_by_name: string | null;
}

/** Columns stamped on every row a person edits. */
export interface UpdatedByColumns {
  updated_by: string | null;
  updated_by_name: string | null;
}

export type AuthoredTodo = Todo & CreatedByColumns & UpdatedByColumns;
export type AuthoredRock = Rock & CreatedByColumns & UpdatedByColumns;
export type AuthoredIdsItem = IdsItem & CreatedByColumns & UpdatedByColumns;
/** `wins` and `cc_headlines` are append-only — creation is the only event. */
export type AuthoredWin = Win & CreatedByColumns;
export type AuthoredHeadline = Headline & CreatedByColumns;

/** `team_members` with the self-service profile fields. */
export type Person = TeamMember & {
  display_name: string | null;
  pronouns: string | null;
};

/**
 * The name a person has chosen for themselves, falling back to the roster
 * name. `display_name` is opt-in and starts null for everyone, so the fallback
 * is the common path, not an edge case.
 */
export function personName(member: {
  display_name?: string | null;
  full_name: string;
}): string {
  const chosen = member.display_name?.trim();
  return chosen && chosen.length > 0 ? chosen : member.full_name;
}

/** Same rule, for the places that only ever hold a possibly-missing member. */
export function personNameOr(
  member: { display_name?: string | null; full_name: string } | null | undefined,
  fallback: string,
): string {
  return member ? personName(member) : fallback;
}

/**
 * Whether a stamped actor id belongs to a signed-in teammate or to an agent.
 *
 * Clerk user ids are prefixed `user_`. Anything else in `created_by` came from
 * a non-human writer (Hermes, a webhook, an import), and showing it with the
 * teammate glyph would misattribute a machine action to a person.
 */
export function actorTypeOf(actorId: string | null): "human" | "agent" {
  return actorId?.startsWith("user_") ? "human" : "agent";
}

/**
 * Widen rows read with `select("*")` to their authored shape.
 *
 * The query really does return the authorship columns; only the generated
 * `Row` types are behind. Routing every cast through here keeps the
 * `as unknown as` in one named place instead of scattering it, and gives a
 * single line to delete once `lib/supabase/types.ts` is regenerated.
 */
export function asAuthoredRows<T>(rows: unknown): T[] {
  return (rows as T[] | null) ?? [];
}

/** The result shape every authorship server action returns. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
