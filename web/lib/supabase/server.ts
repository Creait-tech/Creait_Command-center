import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

import type { Database } from "./types";

/**
 * Server-side Supabase client for the current request.
 *
 * Attaches the Clerk session token (template: 'supabase') as an
 * Authorization Bearer; Supabase verifies it against Clerk's JWKS via
 * Third-Party Auth. The token's `org_id` claim is what every RLS
 * `org_isolation` policy on this project checks:
 *
 *   org_id = COALESCE(auth.jwt() ->> 'org_id', current_setting(...))
 *
 * This used to sit behind USE_CLERK_THIRD_PARTY_AUTH, defaulting to a
 * legacy anon path that leaned on the permissive `phase1_creait_open`
 * policy. That policy has since been dropped in favour of real tenant
 * isolation, which left the legacy path unable to read or write anything:
 * with no claim, the policy compares org_id against NULL and every row is
 * filtered out. Reads came back as empty lists and writes as "new row
 * violates row-level security policy" — and because the flag was unset in
 * production, that was the path actually running.
 *
 * There is no working configuration in which the anon path is correct, so
 * the flag is gone rather than left as a switch that only breaks things.
 * An unauthenticated request still degrades to anon and is correctly
 * denied by RLS.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  let accessToken: string | null = null;
  try {
    const { getToken } = await auth();
    accessToken = await getToken({ template: "supabase" });
  } catch {
    accessToken = null; // unauthenticated — RLS will deny, which is correct
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}

/**
 * Service-role client that bypasses RLS. ONLY for trusted server-side jobs:
 * seed scripts, Inngest functions, webhook handlers, cron routes.
 * Never expose to the browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Read the current Clerk-issued JWT claims (org_id, sub, email, name).
 * Returns null when unauthenticated or when Clerk session token unavailable.
 * Used by server components/actions that need to scope writes to the
 * active org without going through Supabase RLS.
 */
export async function getOrgContext(): Promise<{
  orgId: string | null;
  userId: string | null;
  email: string | null;
  name: string | null;
} | null> {
  try {
    const { userId, orgSlug, sessionClaims } = await auth();
    if (!userId) return null;
    return {
      orgId: orgSlug ?? null,
      userId,
      email: (sessionClaims as { email?: string } | null)?.email ?? null,
      name: (sessionClaims as { name?: string } | null)?.name ?? null,
    };
  } catch {
    return null;
  }
}
