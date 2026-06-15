"use client";
import { useOrganization } from "@clerk/nextjs";

/**
 * Read the active org_id (Clerk organization slug) from the browser.
 * Returns the slug (e.g. "creait", "trembly-bald") or the fallback if
 * no active org is loaded yet (during initial render or auth transition).
 *
 * Use in client components for mutations and realtime channel filters
 * that need to scope to the active workspace.
 */
export function useActiveOrgId(fallback: string = "creait"): string {
  const { organization } = useOrganization();
  return organization?.slug ?? fallback;
}
