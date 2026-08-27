import "server-only";

/**
 * Server-side read of the org's saved meeting agendas.
 *
 * `lib/meeting-agendas.ts` stays the interface every consumer uses; this module
 * is only how the saved rows get *to* it. Anything missing or unparseable falls
 * back to the EOS constant for that type, so the meeting room always has a
 * complete, valid set of eight agendas — a bad row degrades to the standard
 * rather than taking a meeting down.
 */

import { cache } from "react";

import { getActiveOrgId } from "@/lib/active-org";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_MEETING_AGENDAS,
  MEETING_TYPE_ORDER,
  parseAgendaRow,
  type MeetingAgenda,
  type MeetingType,
} from "@/lib/meeting-agendas";
import type { CcMeetingAgendaRow } from "@/lib/supabase/types";
import type { StoredAgenda } from "@/components/meeting-agendas/agenda-draft";

export type { StoredAgenda, CcMeetingAgendaRow };

/**
 * All eight agendas for the active org, in the canonical display order.
 *
 * `cache()` dedupes the query across a single render pass, so the dashboard
 * layout and the Settings page on the same request share one round trip.
 */
export const loadStoredAgendas = cache(async (): Promise<StoredAgenda[]> => {
  const fallback = (type: MeetingType): StoredAgenda => ({
    agenda: DEFAULT_MEETING_AGENDAS[type],
    fromDatabase: false,
    updatedByName: null,
    updatedAt: null,
  });

  let rows: CcMeetingAgendaRow[] = [];
  try {
    const orgId = await getActiveOrgId();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("cc_meeting_agendas")
      .select("*")
      .eq("org_id", orgId);
    if (error) throw new Error(error.message);
    rows = (data ?? []) as CcMeetingAgendaRow[];
  } catch {
    // A failed read must not blank the meeting picker. Every type falls back to
    // the EOS standard, which is what the app shipped with.
    return MEETING_TYPE_ORDER.map(fallback);
  }

  return MEETING_TYPE_ORDER.map((type) => {
    const row = rows.find((r) => r.type === type);
    if (!row) return fallback(type);
    const agenda = parseAgendaRow(row);
    if (!agenda) return fallback(type);
    return {
      agenda,
      fromDatabase: true,
      updatedByName: row.updated_by_name,
      updatedAt: row.updated_at,
    };
  });
});

/** Just the agendas, for handing to the browser-side override applier. */
export async function loadAgendaOverrides(): Promise<MeetingAgenda[]> {
  const stored = await loadStoredAgendas();
  return stored.filter((s) => s.fromDatabase).map((s) => s.agenda);
}
