/**
 * One display name for a Clerk user, one fallback ladder.
 *
 * Attribution written into a row outlives the session that wrote it — a
 * release signature, an audit line, a "corrected by". So the ladder ends at
 * the email address rather than at a placeholder: "Teammate" on a delivered
 * $7,500 engagement records nothing at all.
 *
 * Structurally typed rather than importing Clerk's `User`, so this stays
 * usable from a server action, a server component, or a test with a literal.
 *
 * NOTE: several older modules still carry their own copy of this ladder
 * (eos-actions, team-invites, profile-actions, proposal-actions, level-10
 * actions). They are deliberately untouched here; fold them in separately.
 */

export interface DisplayNameUser {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
}

/** The best available human name, or null when Clerk knows nothing usable. */
export function displayNameOf(
  user: DisplayNameUser | null | undefined
): string | null {
  return (
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.trim() ||
    null
  );
}
