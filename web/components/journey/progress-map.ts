import type { ClientJourneyRow } from "@/app/(dashboard)/journey/actions";
import type { ActorType } from "@/lib/supabase/types";

/** The progress facts the timeline renders, including who last touched them. */
export interface DeliverableProgress {
  done: boolean;
  completedAt: string | null;
  notes: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedByType: ActorType | null;
  updatedAt: string | null;
}

/** Map keyed by deliverable_id → that client's progress. */
export type ClientProgressMap = Record<string, DeliverableProgress>;

export function rowToProgress(row: ClientJourneyRow): DeliverableProgress {
  return {
    done: row.done,
    completedAt: row.completed_at,
    notes: row.notes,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
    updatedByType: row.updated_by_type,
    updatedAt: row.updated_at,
  };
}
