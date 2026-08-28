/**
 * The roles a teammate can be invited as — shared by the client form and the
 * server action.
 *
 * Deliberately its own module with no `server-only` marker and no imports.
 * `lib/team-invites.ts` is server-only because it holds the Clerk secret key
 * path, and a client component importing a *value* from it (a type import is
 * erased, a const is not) pulls that whole module into the browser bundle and
 * fails the build. Keeping the shared constant here is what lets both sides
 * use one definition of the role list.
 */

export const INVITE_ROLES = [
  { value: "member", clerk: "org:member", label: "Member" },
  { value: "admin", clerk: "org:admin", label: "Admin" },
] as const;

export type InviteRole = (typeof INVITE_ROLES)[number]["value"];
