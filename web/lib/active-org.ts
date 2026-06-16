import "server-only";
import { auth } from "@clerk/nextjs/server";

/**
 * The canonical workspace identifier is the Clerk **organization ID**
 * (e.g. "org_3Ef1Yc..."), NOT the slug. Clerk org slugs can carry random
 * suffixes and can't be renamed on this instance, so we key all data on the
 * stable, immutable org id. Matches the JWT template's `org_id` claim
 * ({{org.id}}) that Supabase RLS reads via auth.jwt().
 *
 * CREAIT's org id is the default fallback for unauthenticated server
 * contexts (webhooks, cron) that operate on the primary workspace.
 */
export const CREAIT_ORG_ID = "org_3Ef1YcutwEZFZHEMLwhF57jbEEh";

export async function getActiveOrgId(fallback: string = CREAIT_ORG_ID): Promise<string> {
  try {
    const { orgId } = await auth();
    return orgId ?? fallback;
  } catch {
    return fallback;
  }
}
