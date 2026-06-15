import "server-only";
import { auth } from "@clerk/nextjs/server";

/**
 * Resolve the active org_id for the current request from Clerk's session.
 * Returns the Clerk organization slug (e.g. "creait", "trembly-bald").
 * Falls back to the provided default if no active org (unauthenticated
 * routes, webhook handlers without a user session, etc.).
 *
 * Used by every server component / route handler that needs to scope
 * Supabase queries to the active workspace.
 */
export async function getActiveOrgId(fallback: string = "creait"): Promise<string> {
  try {
    const { orgSlug } = await auth();
    return orgSlug ?? fallback;
  } catch {
    return fallback;
  }
}
