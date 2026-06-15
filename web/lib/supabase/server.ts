import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";

import type { Database } from "./types";

/**
 * Server-side Supabase client for the current request.
 *
 * Two modes (controlled by USE_CLERK_THIRD_PARTY_AUTH env var):
 *
 *   true  → Pull Clerk session token (template: 'supabase') and pass it
 *           as Authorization Bearer to Supabase. Supabase verifies via
 *           Clerk's JWKS (requires Third-Party Auth → Clerk to be
 *           configured in the Supabase dashboard). This is the
 *           production multi-org path: the JWT's `org_id` claim is what
 *           our RLS `org_isolation` policy checks.
 *
 *   false → Legacy cookie-based path. Anon key only; relies on the
 *           `phase1_creait_open` permissive policy. Default while we
 *           transition; flip env var to true once Maurice enables
 *           Third-Party Auth → Clerk in Supabase.
 *
 * Either path returns a typed Database client.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  const useClerkJwt = process.env.USE_CLERK_THIRD_PARTY_AUTH === "true";

  if (useClerkJwt) {
    let accessToken: string | null = null;
    try {
      const { getToken } = await auth();
      accessToken = await getToken({ template: "supabase" });
    } catch {
      accessToken = null; // unauth'd requests fall through to anon
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

  // Legacy cookie path — Phase 1/2/3 default
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server component cannot mutate cookies; middleware refreshes.
        }
      },
    },
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
