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

import {
  SESSION_BLOCK_SCRIPTS,
  TRIAGE_PROMPT_IDS,
  isTriagePrompt,
  type SessionPrompt,
} from "@/lib/assessment-facilitation";
// The intake module never imports this one, so the dependency runs one way and
// there is no cycle to break.
import { intakePrefill, type IntakePrefill } from "@/lib/assessment-intake";
import { parseLooseNumber } from "@/lib/loose-number";
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

/**
 * The numbers captured live, in the block where the script asks for them.
 *
 * The first four are the engine numbers the calculator has always needed and
 * their keys are load-bearing — they are already in stored `session_notes`
 * JSON, so they are never renamed. The four after them exist because the cross
 * checks below need a second, independent reading of something the P&L or the
 * intake already claims: a stated gross margin to hold against the accounts, a
 * concentration percentage to hold against the 25% overlay threshold, and a
 * headcount to hold the repetitive-hours inventory against.
 *
 * `block` is where the field renders, so the facilitator is asked for a number
 * at the moment the script asks the question rather than in one wall of inputs
 * at the top of Block 2.
 */
export const ENGINE_METRICS = [
  {
    key: "leads_per_month",
    label: "Leads per month",
    hint: "Any source. Estimates are fine.",
    block: "b2",
  },
  {
    key: "conversion_rate",
    label: "Quote → close rate",
    hint: "Percentage, or 'x of the last 10'.",
    block: "b2",
  },
  {
    key: "avg_deal_value",
    label: "Average first-year value of a new customer",
    hint: "Dollars, typical not best — a year of the customer, not the first visit or first job alone.",
    block: "b2",
  },
  {
    key: "response_time",
    label: "Typical response time",
    hint: "Inquiry to first human contact.",
    block: "b2",
  },
  {
    key: "gross_margin_pct",
    label: "Gross margin they state",
    hint: "Their number, not the P&L's.",
    block: "b2",
  },
  {
    key: "headcount",
    label: "People on the payroll",
    hint: "Full-time equivalents, owner included.",
    block: "b4",
  },
  {
    key: "repetitive_hours_week",
    label: "Repetitive hours per week, by role",
    hint: "Hours one person in that role spends each week on work that repeats — one role per line, 'Admin 22'. Not the role's total hours.",
    block: "b4",
    multiline: true,
  },
  {
    key: "largest_customer_pct",
    label: "Largest paying customer, % of annual revenue",
    hint: "One customer who pays you — not a referral source, agent or channel. Percentage; above 25 raises the overlay flag.",
    block: "b5",
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  hint: string;
  block: BlockId;
  /** Rendered as a textarea — the hours inventory is one role per line. */
  multiline?: boolean;
}>;

export type EngineMetricKey = (typeof ENGINE_METRICS)[number]["key"];

/** The metrics captured in one block, in script order. */
export function engineMetricsForBlock(id: BlockId) {
  return ENGINE_METRICS.filter((m) => m.block === id);
}

export type CrossCheckId =
  | "margin_vs_pnl"
  | "funnel_vs_revenue"
  | "concentration"
  | "hours_vs_headcount";

export type CrossCheckStatus = "pass" | "flag" | "insufficient";

/** One cross-check outcome as stored in `session_notes.crossChecks`. */
export interface CrossCheckRecord {
  /** The status at the moment the facilitator wrote the note. */
  status: CrossCheckStatus;
  /** The computed one-liner, banked so the note reads back in context. */
  detail: string;
  /** The facilitator's own line: what the owner said when asked about it. */
  note: string;
}

export type SessionNotes = {
  blocks?: Partial<Record<BlockId, string>>;
  elapsed?: Partial<Record<BlockId, number>>;
  crossChecks?: Partial<Record<CrossCheckId, CrossCheckRecord>>;
} & Partial<Record<EngineMetricKey, string>>;

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

  if (
    raw.crossChecks &&
    typeof raw.crossChecks === "object" &&
    !Array.isArray(raw.crossChecks)
  ) {
    const stored = raw.crossChecks as Record<string, unknown>;
    const checks: Partial<Record<CrossCheckId, CrossCheckRecord>> = {};
    for (const def of CROSS_CHECKS) {
      const v = stored[def.id];
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      const row = v as Record<string, unknown>;
      const status = row.status;
      checks[def.id] = {
        status: isCrossCheckStatus(status) ? status : "insufficient",
        detail: typeof row.detail === "string" ? row.detail : "",
        note: typeof row.note === "string" ? row.note : "",
      };
    }
    out.crossChecks = checks;
  }

  return out;
}

function isCrossCheckStatus(v: unknown): v is CrossCheckStatus {
  return v === "pass" || v === "flag" || v === "insufficient";
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

// ── Pacing ──────────────────────────────────────────────────────────────────

export interface ScheduledPrompt {
  prompt: SessionPrompt;
  /** Seconds into the block this question should start. */
  startsAt: number;
  /** Seconds into the block it should be finished. */
  endsAt: number;
  /** On the triage list — dropped first when the block is over budget. */
  triage: boolean;
}

/**
 * The block's questions with a running clock against each.
 *
 * The time boxes are cumulative on purpose: what a facilitator needs mid-block
 * is not "this one is worth five minutes", it is "you should be on question
 * seven by now". The block timer already counts up, so the comparison is free.
 */
export function promptSchedule(id: BlockId): ScheduledPrompt[] {
  const prompts = SESSION_BLOCK_SCRIPTS[id]?.prompts ?? [];
  let cursor = 0;
  return prompts.map((prompt) => {
    const startsAt = cursor;
    cursor += Math.max(0, prompt.minutes) * 60;
    return {
      prompt,
      startsAt,
      endsAt: cursor,
      triage: isTriagePrompt(prompt.id),
    };
  });
}

/** Index of the question the clock says you should be on, or -1 past the end. */
export function pacedPromptIndex(
  schedule: ScheduledPrompt[],
  elapsedSeconds: number
): number {
  return schedule.findIndex((s) => elapsedSeconds < s.endsAt);
}

// ── Reading the numbers people actually type ────────────────────────────────

/**
 * Pull a number out of whatever got typed in a live session.
 *
 * These fields are filled at conversational speed while someone is talking, so
 * they arrive as "$12,500", "about 40", "1.2m" or "35%". Anything that does not
 * contain a number returns null, which every check below reports as
 * insufficient rather than guessing.
 *
 * The reader is shared with the intake (lib/loose-number.ts) — the two used to
 * be separate copies, and both read "40 monthly" as forty million.
 *
 * // examples: "3 managers" → 3 · "1.2m" → 1,200,000 · "$45k" → 45,000 ·
 * //           "40 min" → 40
 */
export { parseLooseNumber };

/**
 * Percentages, in the three shapes owners give them.
 *
 * "3 of 10" and "3/10" become 30 because the Block 2 script explicitly invites
 * that answer ("Percentage, or 'x of the last 10'"). A bare decimal below one —
 * "0.35" — is read as a fraction; a bare "1" is read as one percent, since an
 * owner claiming a 100% close rate types "100".
 */
export function parseLoosePercent(
  raw: string | null | undefined
): number | null {
  if (typeof raw !== "string") return null;
  const ratio = raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .match(/(\d+(?:\.\d+)?)\s*(?:\/|of|out of)\s*(\d+(?:\.\d+)?)/);
  if (ratio) {
    const numerator = Number(ratio[1]);
    const denominator = Number(ratio[2]);
    if (denominator > 0) return (numerator / denominator) * 100;
  }
  const value = parseLooseNumber(raw);
  if (value === null) return null;
  if (value > 0 && value < 1 && raw.includes(".") && !raw.includes("%")) {
    return value * 100;
  }
  return value;
}

export interface HoursRow {
  label: string;
  hours: number;
}

/**
 * The repetitive-work inventory, one role per line.
 *
 * Block 4 builds this list out loud — "Admin 22, owner 9, dispatcher 15" — so
 * accept lines, commas and semicolons as separators and take the first number
 * in each entry as the hours.
 */
export function parseHoursRows(raw: string | null | undefined): HoursRow[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/[\n;,]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const hours = parseLooseNumber(segment);
      if (hours === null || hours <= 0) return null;
      const label = segment.replace(/-?\d+(?:\.\d+)?\s*(?:h|hr|hrs|hours)?/i, "").trim();
      return { label: label || "Unlabelled", hours };
    })
    .filter((row): row is HoursRow => row !== null);
}

/**
 * What the owner's pre-assessment intake already told us.
 *
 * The intake is stored as free JSON keyed by QUESTION ID (migration 0013) —
 * `q17`, not `gross_margin` — so reading it by business name finds nothing.
 * intakePrefill is the one place that knows which question holds which figure,
 * and it returns the typed values with "not currently known" left as null, so
 * every check below asks it rather than guessing at key names.
 */
function intakeFigures(
  assessment: CrossCheckAssessment
): IntakePrefill | null {
  const intake = assessment.intake;
  if (!intake || typeof intake !== "object" || Array.isArray(intake)) return null;
  return intakePrefill(intake);
}

// ── Live cross-checks ───────────────────────────────────────────────────────

/** The financial facts a check holds the session's answers against. */
export interface CrossCheckAssessment {
  annual_revenue: number | null;
  gross_margin: number | null;
  operating_profit: number | null;
  intake?: Json | null;
  /**
   * Whether the baseline figures were read off a P&L or copied from the
   * owner's intake. The margin check words its line differently for each —
   * "on file" promises a document, and the simulation run caught the check
   * saying it about a self-reported number.
   */
  pnl_on_file?: boolean | null;
}

export interface CrossCheckResult {
  id: CrossCheckId;
  title: string;
  status: CrossCheckStatus;
  /** One line, with the numbers in it. Read out loud if it flags. */
  detail: string;
}

export interface CrossCheck {
  id: CrossCheckId;
  title: string;
  /** What the facilitator asks when this flags. Never an accusation. */
  askOnFlag: string;
  /** The earliest block whose inputs make this computable. */
  fromBlock: BlockId;
  compute(
    notes: SessionNotes,
    assessment: CrossCheckAssessment
  ): CrossCheckResult;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const money = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** What a check works out, before the id and title are stapled back on. */
type CrossCheckOutcome = Pick<CrossCheckResult, "status" | "detail">;

const insufficient = (detail: string): CrossCheckOutcome => ({
  status: "insufficient",
  detail,
});
const flag = (detail: string): CrossCheckOutcome => ({ status: "flag", detail });
const pass = (detail: string): CrossCheckOutcome => ({ status: "pass", detail });

/**
 * Wrap a check so `compute` returns the full result while the body only has to
 * work out a status and a line. Nothing here depends on `this`, so a check can
 * safely be pulled off the array and passed around.
 */
function defineCrossCheck(spec: {
  id: CrossCheckId;
  title: string;
  askOnFlag: string;
  fromBlock: BlockId;
  run: (
    notes: SessionNotes,
    assessment: CrossCheckAssessment
  ) => CrossCheckOutcome;
}): CrossCheck {
  const { id, title, askOnFlag, fromBlock, run } = spec;
  return {
    id,
    title,
    askOnFlag,
    fromBlock,
    compute: (notes, assessment) => ({ id, title, ...run(notes, assessment) }),
  };
}

/**
 * The four arithmetic checks that only work while the owner is still in the
 * room.
 *
 * The rigor review found the session capturing what the owner says and the
 * report later discovering it cannot be reconciled with the P&L — by which
 * point the only options are to publish a number nobody can defend or to go
 * back and ask. Every check here is a subtraction anyone could do on paper; the
 * value is purely that it happens at minute forty rather than at midnight.
 *
 * A flag is never a verdict — the guide's posture holds and the day ends
 * without one. It is a prompt to ask one more question, which is why each check
 * carries `askOnFlag`.
 */
export const CROSS_CHECKS: CrossCheck[] = [
  defineCrossCheck({
    id: "margin_vs_pnl",
    title: "Stated margin vs the P&L",
    askOnFlag:
      "I have two different margin numbers — help me understand which one you run the business on.",
    fromBlock: "b2",
    run(notes, assessment) {
      const stated =
        parseLoosePercent(notes.gross_margin_pct) ??
        intakeFigures(assessment)?.gross_margin ??
        null;
      const filed =
        typeof assessment.gross_margin === "number" &&
        Number.isFinite(assessment.gross_margin)
          ? assessment.gross_margin
          : null;
      const revenue = assessment.annual_revenue ?? 0;
      const operating =
        typeof assessment.operating_profit === "number" && revenue > 0
          ? (assessment.operating_profit / revenue) * 100
          : null;

      // Without a P&L the baseline margin is the owner's own intake answer, so
      // the line has to say so — the check is then "today vs the intake", not
      // "today vs the books".
      const source = assessment.pnl_on_file ? "on file" : "on the intake";
      const sourceSays = assessment.pnl_on_file
        ? "the file says"
        : "the intake said";

      if (stated === null) return insufficient("No gross margin captured yet.");
      if (filed === null && operating === null) {
        return insufficient(
          `They say ${round1(stated)}% — nothing on file to hold it against.`
        );
      }
      if (filed !== null && Math.abs(stated - filed) > 8) {
        return flag(
          `They say ${round1(stated)}%, ${sourceSays} ${round1(filed)}% — ${round1(Math.abs(stated - filed))} points apart.`
        );
      }
      // A gross margin under the operating margin is arithmetically impossible,
      // and it is the shape a guessed number usually arrives in.
      if (operating !== null && stated < operating - 0.5) {
        return flag(
          `Stated gross margin ${round1(stated)}% sits below operating margin ${round1(operating)}% — one of the two is wrong.`
        );
      }
      return pass(
        filed !== null
          ? `${round1(stated)}% stated against ${round1(filed)}% ${source}.`
          : `${round1(stated)}% stated, above the ${round1(operating ?? 0)}% operating margin as it should be.`
      );
    },
  }),
  defineCrossCheck({
    id: "funnel_vs_revenue",
    title: "Funnel vs revenue",
    askOnFlag:
      "Multiplying your own numbers gives a different revenue than the one on the P&L — where does the gap come from?",
    fromBlock: "b2",
    run(notes, assessment) {
      const perMonth = parseLooseNumber(notes.leads_per_month);
      const close = parseLoosePercent(notes.conversion_rate);
      const value = parseLooseNumber(notes.avg_deal_value);
      // The engagement's own revenue first; the intake's is the fallback for a
      // session running before the baseline was copied across.
      const revenue =
        assessment.annual_revenue ??
        intakeFigures(assessment)?.annual_revenue ??
        null;

      const missing = [
        perMonth === null ? "leads" : null,
        close === null ? "close rate" : null,
        value === null ? "average value" : null,
        !revenue || revenue <= 0 ? "annual revenue" : null,
      ].filter((m): m is string => m !== null);
      if (missing.length) return insufficient(`Still need ${missing.join(", ")}.`);

      // Leads are captured monthly; the comparison is against a year of revenue.
      const leadsPerYear = (perMonth as number) * 12;
      const implied =
        leadsPerYear * ((close as number) / 100) * (value as number);
      // A funnel only explains revenue that arrives through an inquiry.
      // Contracts, retainers and repeat customers mostly do not, so a
      // repeat-heavy business compared against its whole top line flags every
      // time. When the intake's revenue-model split is on file, the floor the
      // funnel must explain is the new-business share (one-time projects,
      // products, other); without it, the total, and the detail says which.
      const share = intakeFigures(assessment)?.new_business_share ?? null;
      const total = revenue as number;
      const leadDriven = share === null ? total : total * share;
      // Two ways the numbers cannot hang together: the funnel implies more
      // revenue than the whole company books, or it explains well under the
      // lead-driven part of it. Anything between is a pass — the detail still
      // prints both bases so the facilitator can read the gap out loud.
      const overTotal = implied / total;
      const ofLeadDriven = leadDriven > 0 ? implied / leadDriven : null;
      const detail =
        `${Math.round(leadsPerYear)} leads/yr × ${round1(close as number)}% × ${money(value as number)} = ${money(implied)} — ` +
        `${Math.round(overTotal * 100)}% of the ${money(total)} top line` +
        (share === null
          ? " (no revenue-model split on file)."
          : `, ${ofLeadDriven === null ? "n/a" : `${Math.round(ofLeadDriven * 100)}%`} of the ${money(leadDriven)} of new business (${Math.round(share * 100)}% per the intake).`);
      const tooHigh = overTotal > 1.6;
      const tooLow = ofLeadDriven !== null && ofLeadDriven < 0.6;
      return tooHigh || tooLow ? flag(detail) : pass(detail);
    },
  }),
  defineCrossCheck({
    id: "concentration",
    title: "Customer concentration",
    askOnFlag:
      "Talk me through that largest account — what would a bad quarter there do to the year?",
    fromBlock: "b5",
    run(notes, assessment) {
      const session = parseLoosePercent(notes.largest_customer_pct);
      const intake = intakeFigures(assessment)?.largest_customer_pct ?? null;
      if (session === null && intake === null) {
        return insufficient("Largest-customer share not captured yet.");
      }

      const value = (session ?? intake) as number;
      if (session !== null && intake !== null && Math.abs(session - intake) > 10) {
        return flag(
          `Today ${round1(session)}%, intake said ${round1(intake)}% — ${round1(Math.abs(session - intake))} points of drift.`
        );
      }
      if (value > 25) {
        return flag(
          `${round1(value)}% in one customer — above the 25% overlay threshold.`
        );
      }
      return pass(
        `${round1(value)}% in the largest customer, under the 25% threshold.`
      );
    },
  }),
  defineCrossCheck({
    id: "hours_vs_headcount",
    title: "Repetitive hours vs capacity",
    askOnFlag:
      "By these numbers a third of the payroll is doing repetitive work — does that match what you see?",
    fromBlock: "b4",
    run(notes, assessment) {
      const intake = intakeFigures(assessment);
      const rows = parseHoursRows(notes.repetitive_hours_week);
      // The intake's q44 inventory stands in for the live list until the
      // facilitator has built one out loud, but it is a single total — there
      // are no per-role rows in it to overload.
      const intakeHours = intake?.repetitive_hours_weekly ?? null;
      const heads = parseLooseNumber(notes.headcount) ?? intake?.headcount ?? null;
      if (!rows.length && (intakeHours === null || intakeHours <= 0)) {
        return insufficient("No repetitive-hours rows captured yet.");
      }
      if (heads === null || heads <= 0) {
        return insufficient("Headcount not captured yet.");
      }

      const total = rows.length
        ? rows.reduce((sum, r) => sum + r.hours, 0)
        : (intakeHours as number);
      const capacity = heads * 40;
      const share = total / capacity;
      const overloaded = rows.filter((r) => r.hours > 40);

      if (overloaded.length) {
        const worst = overloaded
          .map((r) => `${r.label} ${round1(r.hours)}h`)
          .join(", ");
        return flag(`${worst} — more repetitive work than a full week holds.`);
      }
      const detail = `${round1(total)}h/wk of ${Math.round(capacity)}h capacity — ${Math.round(share * 100)}% of the payroll.`;
      return share > 0.35 ? flag(detail) : pass(detail);
    },
  }),
];

export const CROSS_CHECK_IDS: CrossCheckId[] = CROSS_CHECKS.map((c) => c.id);

/** Run every check. Order is stable, so the panel never reshuffles mid-session. */
export function runCrossChecks(
  notes: SessionNotes,
  assessment: CrossCheckAssessment
): CrossCheckResult[] {
  return CROSS_CHECKS.map((check) => {
    try {
      return check.compute(notes, assessment);
    } catch {
      // A live session is the worst possible place for a thrown parse error.
      return {
        id: check.id,
        title: check.title,
        ...insufficient("Could not read the numbers captured."),
      };
    }
  });
}

// ── Script integrity ────────────────────────────────────────────────────────

/**
 * Assert the two things a facilitator cannot check in the room.
 *
 * One: each block's time boxes add up to the budget the guide gives that block,
 * so the per-prompt clock and the block clock cannot disagree. Two: dropping
 * every prompt on the triage list still leaves every indicator with a source,
 * which is the only reason a facilitator is allowed to drop them at all.
 *
 * Returns the problems rather than throwing — it runs at import in development
 * (below) and a script typo must not take the workbench down mid-session.
 */
export function validateSessionScripts(): string[] {
  const problems: string[] = [];

  for (const block of SESSION_BLOCKS) {
    const prompts = SESSION_BLOCK_SCRIPTS[block.id]?.prompts ?? [];
    if (!prompts.length) {
      problems.push(`${block.id}: no prompts`);
      continue;
    }
    for (const p of prompts) {
      if (!Number.isFinite(p.minutes) || p.minutes <= 0) {
        problems.push(`${block.id}/${p.id}: minutes must be a positive number`);
      }
    }
    const sum = prompts.reduce((total, p) => total + p.minutes, 0);
    if (sum !== block.minutes) {
      problems.push(
        `${block.id}: prompts sum to ${sum} min, block budget is ${block.minutes} min`
      );
    }
  }

  const allPrompts = SESSION_BLOCKS.flatMap(
    (b) => SESSION_BLOCK_SCRIPTS[b.id]?.prompts ?? []
  );
  const byId = new Map(allPrompts.map((p) => [p.id, p]));

  for (const id of TRIAGE_PROMPT_IDS) {
    if (!byId.has(id)) problems.push(`triage list names unknown prompt ${id}`);
  }
  for (const p of allPrompts) {
    if (p.cutWhenLong && !TRIAGE_PROMPT_IDS.includes(p.id)) {
      problems.push(`${p.id}: cutWhenLong set but not in TRIAGE_PROMPT_IDS`);
    }
    if (!p.cutWhenLong && TRIAGE_PROMPT_IDS.includes(p.id)) {
      problems.push(`${p.id}: in TRIAGE_PROMPT_IDS but cutWhenLong not set`);
    }
  }

  // Coverage is checked with the whole triage list removed at once — a prompt
  // whose only backup is also on the list would pass a one-at-a-time check.
  const survivors = allPrompts.filter((p) => !isTriagePrompt(p.id));
  const stillFed = new Set(survivors.flatMap((p) => p.feedsIndicators));
  const fedByAnyone = new Set(allPrompts.flatMap((p) => p.feedsIndicators));
  for (const indicator of fedByAnyone) {
    if (!stillFed.has(indicator)) {
      problems.push(
        `indicator ${indicator} loses its only source when the triage prompts are cut`
      );
    }
  }

  return problems;
}

if (process.env.NODE_ENV !== "production") {
  const problems = validateSessionScripts();
  if (problems.length) {
    console.error(
      `[assessment-session] session script problems:\n  ${problems.join("\n  ")}`
    );
  }
}
