"use client";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./types";

/**
 * Browser-side Supabase client. Use inside client components for Realtime
 * subscriptions and authenticated reads/writes. RLS is enforced.
 *
 * Auth is Clerk, not Supabase Auth. Every RLS policy on this project checks
 * an `org_id` claim that only exists inside a Clerk-issued JWT:
 *
 *   org_id = COALESCE(auth.jwt() ->> 'org_id', current_setting(...))
 *
 * This client previously sent only the anon key, so browser writes arrived
 * with no claim at all — the policy compared org_id against NULL, which is
 * never true, and every insert came back "new row violates row-level
 * security policy". Reads still worked because pages render on the server,
 * where the token *was* attached, which made the failure look random: the
 * data was there, but nothing could be saved.
 *
 * `accessToken` is Supabase's third-party auth hook — it runs per request
 * (REST and Realtime), so a token refreshed by Clerk mid-session is picked
 * up without rebuilding the client. Returning null degrades to anonymous
 * rather than throwing; RLS then denies the write, which is the correct
 * outcome for a signed-out caller.
 */
type ClerkGlobal = {
  loaded?: boolean;
  load?: () => Promise<unknown>;
  session?: {
    getToken: (options?: { template?: string }) => Promise<string | null>;
  };
};

/**
 * Clerk attaches itself to `window` asynchronously. A request issued before
 * it finishes loading would get a null token and be treated as anonymous —
 * and an anonymous DELETE or UPDATE does not error, it simply matches zero
 * rows and reports success. Waiting for `load()` closes that window so a
 * failure can never masquerade as a no-op.
 */
async function clerkToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const clerk = (window as unknown as { Clerk?: ClerkGlobal }).Clerk;
  if (!clerk) return null;
  try {
    if (!clerk.loaded && typeof clerk.load === "function") await clerk.load();
    // Template "supabase" is what mints the org_id claim; a default token
    // authenticates the user but carries no org, so RLS would still deny.
    return (await clerk.session?.getToken({ template: "supabase" })) ?? null;
  } catch {
    return null;
  }
}

export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createSupabaseClient<Database>(url, key, {
    // Supabase Auth is unused — Clerk owns the session. Persisting or
    // refreshing a Supabase session here would only fight the accessToken hook.
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    accessToken: clerkToken,
  });
}
