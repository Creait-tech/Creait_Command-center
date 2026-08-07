/**
 * The Diagnostic Intensive — session structure.
 *
 * Source of truth: "Creait Assesment build/02-Delivery-System/
 * Facilitator-Guide.md" v1, section 3. The four-hour intensive is a
 * conversation in five blocks with a 15-minute break after Block 3. Scoring is
 * explicitly NOT done in the room — the guide's "After" step is "same day,
 * while fresh — score all 30 indicators in the calculator, log evidence levels
 * … draft the Primary Constraint."
 *
 * This module holds the STRUCTURE (which blocks exist, how long they run, which
 * pillar each one informs, where the captured notes live). The read-aloud COPY
 * lives in lib/assessment-facilitation.ts so it can be rewritten without
 * touching the shape.
 */

import type { AssessmentPillar, Json } from "@/lib/supabase/types";

export type BlockId = "b1" | "b2" | "b3" | "b4" | "b5";

export const BLOCK_IDS: BlockId[] = ["b1", "b2", "b3", "b4", "b5"];

export interface SessionBlock {
  id: BlockId;
  label: string;
  /** Budget from the guide. Pacing cue, never a hard stop. */
  minutes: number;
  /** The pillar this block's answers will later be scored into. */
  pillar: AssessmentPillar | null;
  /** True where the guide puts the 15-minute break directly after. */
  breakAfter?: boolean;
}

export const SESSION_BLOCKS: SessionBlock[] = [
  { id: "b1", label: "Story & Destination", minutes: 30, pillar: null },
  { id: "b2", label: "The Growth Engine", minutes: 60, pillar: "profit" },
  {
    id: "b3",
    label: "Operations & the Machine",
    minutes: 60,
    pillar: "systems",
    breakAfter: true,
  },
  { id: "b4", label: "Time, Tools & AI", minutes: 45, pillar: "leverage" },
  { id: "b5", label: "Risk & Close", minutes: 30, pillar: null },
];

export const BLOCK_BY_ID: Record<BlockId, SessionBlock> = Object.fromEntries(
  SESSION_BLOCKS.map((b) => [b.id, b])
) as Record<BlockId, SessionBlock>;

/** Which block's notes to surface when scoring a given pillar. */
export const BLOCK_FOR_PILLAR: Record<AssessmentPillar, BlockId> = {
  profit: "b2",
  systems: "b3",
  leverage: "b4",
};

export const SESSION_TOTAL_MINUTES = SESSION_BLOCKS.reduce(
  (sum, b) => sum + b.minutes,
  0
);

/** The four engine numbers the calculator needs, captured live in Block 2. */
export const ENGINE_METRICS = [
  {
    key: "leads_per_month",
    label: "Leads per month",
    hint: "Any source. Estimates are fine.",
  },
  {
    key: "conversion_rate",
    label: "Quote → close rate",
    hint: "Percentage, or 'x of the last 10'.",
  },
  {
    key: "avg_deal_value",
    label: "Average job / deal value",
    hint: "Dollars, typical not best.",
  },
  {
    key: "response_time",
    label: "Typical response time",
    hint: "Inquiry to first human contact.",
  },
] as const;

export type EngineMetricKey = (typeof ENGINE_METRICS)[number]["key"];

export interface SessionNotes {
  blocks?: Partial<Record<BlockId, string>>;
  elapsed?: Partial<Record<BlockId, number>>;
  leads_per_month?: string;
  conversion_rate?: string;
  avg_deal_value?: string;
  response_time?: string;
}

const METRIC_KEYS: EngineMetricKey[] = ENGINE_METRICS.map((m) => m.key);

/**
 * Parse the JSONB column defensively — it is user-shaped data from the
 * database, and an older or hand-edited row must never crash the workbench.
 */
export function parseSessionNotes(value: Json | null | undefined): SessionNotes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const out: SessionNotes = {};

  if (raw.blocks && typeof raw.blocks === "object" && !Array.isArray(raw.blocks)) {
    const blocks: Partial<Record<BlockId, string>> = {};
    for (const id of BLOCK_IDS) {
      const v = (raw.blocks as Record<string, unknown>)[id];
      if (typeof v === "string") blocks[id] = v;
    }
    out.blocks = blocks;
  }

  if (
    raw.elapsed &&
    typeof raw.elapsed === "object" &&
    !Array.isArray(raw.elapsed)
  ) {
    const elapsed: Partial<Record<BlockId, number>> = {};
    for (const id of BLOCK_IDS) {
      const v = (raw.elapsed as Record<string, unknown>)[id];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        elapsed[id] = Math.round(v);
      }
    }
    out.elapsed = elapsed;
  }

  for (const key of METRIC_KEYS) {
    const v = raw[key];
    if (typeof v === "string") out[key] = v;
  }

  return out;
}

export function blockNote(notes: SessionNotes, id: BlockId): string {
  return notes.blocks?.[id] ?? "";
}

/** How much of the session has anything recorded against it. */
export function sessionCapturedCount(notes: SessionNotes): number {
  return BLOCK_IDS.filter((id) => blockNote(notes, id).trim().length > 0).length;
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
