/**
 * Row shapes and pure helpers for prep sessions.
 *
 * Separate from `prep-actions.ts` because that file is `"use server"`, and a
 * server-action module may export only async functions — a sync helper there
 * makes Turbopack treat the module as having no exports and the build fails.
 */

import type { Person } from "@/lib/authorship";
import type { Json } from "@/lib/supabase/types";
import type { PrepSynthesis } from "@/lib/prep-synthesis";

export type PrepReveal = "after_all" | "at_close" | "live";
export type PrepStatus = "open" | "synthesized" | "closed";

export interface PrepSessionRow {
  id: string;
  org_id: string;
  meeting_type: string;
  title: string;
  status: PrepStatus;
  reveal: PrepReveal;
  due_at: string | null;
  participant_ids: string[];
  synthesis: Json | null;
  synthesized_at: string | null;
  synthesis_model: string | null;
  meeting_id: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrepQuestionRow {
  id: string;
  session_id: string;
  section_key: string;
  prompt: string;
  help: string | null;
  kind: "text" | "list";
  sort_order: number;
}

export interface PrepAnswerRow {
  id: string;
  session_id: string;
  question_id: string;
  member_id: string;
  answer: string | null;
  items: string[];
  updated_at: string;
}

export interface PrepParticipantRow {
  session_id: string;
  member_id: string;
  submitted_at: string | null;
}

export const REVEAL_LABELS: Record<PrepReveal, string> = {
  after_all: "Blind until everyone submits",
  at_close: "Blind until the session is synthesized",
  live: "Everyone sees answers as they're written",
};

export const REVEAL_HELP: Record<PrepReveal, string> = {
  after_all: "Nobody anchors on anyone else's answer. The usual choice.",
  at_close: "Answers stay private until the facilitator runs the synthesis.",
  live: "Useful for a team already aligned, or a session run together.",
};

/**
 * Whether a viewer may read everyone else's answers yet.
 *
 * `live` always; `at_close` once the session is synthesized or closed;
 * `after_all` once every participant has submitted.
 */
export function canSeeOthers(
  session: Pick<PrepSessionRow, "reveal" | "status">,
  participants: PrepParticipantRow[],
): boolean {
  if (session.reveal === "live") return true;
  if (session.status === "synthesized" || session.status === "closed") return true;
  if (session.reveal === "at_close") return false;
  return participants.length > 0 && participants.every((p) => p.submitted_at !== null);
}

/** Read a stored synthesis back in its typed shape. */
export function prepSynthesisOf(session: Pick<PrepSessionRow, "synthesis">): PrepSynthesis | null {
  const raw = session.synthesis;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as unknown as PrepSynthesis;
}

/** One prep session as a viewer is allowed to see it. */
export interface PrepSessionView {
  session: PrepSessionRow;
  questions: PrepQuestionRow[];
  participants: PrepParticipantRow[];
  people: Person[];
  /** Every answer the viewer is allowed to see — always their own. */
  answers: PrepAnswerRow[];
  viewerMemberId: string | null;
  revealed: boolean;
}

