"use client";
import { useOrganization } from "@clerk/nextjs";

/**
 * Active workspace id (Clerk **organization ID**, e.g. "org_3Ef1Yc...").
 * We key data on the stable org id, not the slug (slugs can carry random
 * suffixes and aren't renamable on this instance). Matches the server
 * helper getActiveOrgId() and the JWT `org_id` claim ({{org.id}}).
 */
export const CREAIT_ORG_ID = "org_3Ef1YcutwEZFZHEMLwhF57jbEEh";

export function useActiveOrgId(fallback: string = CREAIT_ORG_ID): string {
  const { organization } = useOrganization();
  return organization?.id ?? fallback;
}
