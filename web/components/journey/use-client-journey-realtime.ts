"use client";

import { useEffect, useRef } from "react";
import { createBrowserClient as createClient } from "@/lib/supabase/client";

interface Options {
  /** Null when no client is selected — nothing is subscribed. */
  clientId: string | null;
  /** Resubscribes on workspace switch; RLS does the actual isolation. */
  orgId: string;
  onJourneyChange: () => void;
  onActivityChange: () => void;
}

/** Coalesce the burst of events a single toggle can produce. */
const DEBOUNCE_MS = 250;

/**
 * Keeps one operator's timeline in step with everyone else's.
 *
 * `cc_client_journey` and `cc_client_activity` are both in the
 * `supabase_realtime` publication. Postgres emits from the WAL after commit,
 * so it makes no difference that the writes themselves go through server
 * actions — a tick by Maurice reaches Jaylyn's open tab either way.
 *
 * Handlers refetch rather than patching state from the payload: a DELETE only
 * carries the primary key, and re-reading through the org-scoped action is the
 * one path that can't drift out of sync with what the database actually holds.
 */
export function useClientJourneyRealtime({
  clientId,
  orgId,
  onJourneyChange,
  onActivityChange,
}: Options) {
  // Refs, not deps: the callbacks close over state that changes every render,
  // and rebuilding the channel that often would drop events mid-reconnect.
  const journeyRef = useRef(onJourneyChange);
  const activityRef = useRef(onActivityChange);

  useEffect(() => {
    journeyRef.current = onJourneyChange;
    activityRef.current = onActivityChange;
  });

  useEffect(() => {
    if (!clientId) return;

    const supabase = createClient();
    let journeyTimer: ReturnType<typeof setTimeout> | null = null;
    let activityTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`journey-client-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cc_client_journey",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          if (journeyTimer) clearTimeout(journeyTimer);
          journeyTimer = setTimeout(() => journeyRef.current(), DEBOUNCE_MS);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cc_client_activity",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          if (activityTimer) clearTimeout(activityTimer);
          activityTimer = setTimeout(() => activityRef.current(), DEBOUNCE_MS);
        },
      )
      .subscribe();

    return () => {
      if (journeyTimer) clearTimeout(journeyTimer);
      if (activityTimer) clearTimeout(activityTimer);
      void supabase.removeChannel(channel);
    };
  }, [clientId, orgId]);
}
