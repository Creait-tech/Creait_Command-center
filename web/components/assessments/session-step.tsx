"use client";

/**
 * Session mode — the four-hour Diagnostic Intensive, client in the room.
 *
 * Deliberately score-free. The Facilitator Guide's posture for the intensive is
 * "curious operator, not interrogator … but give no verdict today", and the
 * whole Results Session depends on the Mirror → Gap → Fork reveal landing
 * cold. A CREAiT Score visible on a shared screen destroys that. So this screen
 * shows time and capture, never judgement — the scoring step next door is where
 * numbers live.
 *
 * What it does show is the script, big enough to read aloud from while looking
 * at a person: the structured-interview convention where the spoken line is the
 * largest element and every facilitator-only instruction is smaller and muted.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Coffee,
  Pause,
  Play,
  Quote,
  Scissors,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { updateSessionNotes } from "@/lib/assessment-actions";
import {
  BLOCK_IDS,
  CROSS_CHECKS,
  SESSION_BLOCKS,
  blockNote,
  engineMetricsForBlock,
  formatClock,
  pacedPromptIndex,
  promptSchedule,
  runCrossChecks,
  type BlockId,
  type CrossCheckId,
  type CrossCheckRecord,
  type CrossCheckResult,
  type SessionNotes,
} from "@/lib/assessment-session";
import {
  SESSION_BLOCK_SCRIPTS,
  type SessionPrompt,
} from "@/lib/assessment-facilitation";
import type { CcAssessment } from "@/lib/supabase/types";

/** Elapsed time is written back on this cadence, plus on every block change. */
const ELAPSED_SAVE_EVERY_SEC = 30;

function ReadAloud({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[color:var(--color-brand-slate)]/45 px-5 py-4 ring-1 ring-inset ring-[color:var(--color-brand-electric)]/20">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-electric)]">
        <Quote className="size-3" />
        Say this
      </p>
      <p className="mt-2 max-w-[64ch] text-[17px] font-medium leading-snug">
        {children}
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">
        {label}
        {hint && (
          <span className="ml-1.5 font-normal text-muted-foreground/70">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}


/** Where the block clock says this question sits. */
type Pace = "done" | "now" | "ahead";

/**
 * One question in the block, as an accordion row.
 *
 * The spoken line is always visible; everything the facilitator reads silently —
 * why the question earns its minutes, what to listen for, the probe for a vague
 * answer, what to write down — opens on demand. Six prompts with all of that
 * expanded is a wall of text you cannot use while looking someone in the eye.
 *
 * The right edge carries the pacing: the question's time box, and whether the
 * clock says you should be on it, past it, or not there yet. When the block has
 * gone over budget the triage questions gain a "cut if needed" tag — the drop
 * decision is made in `TRIAGE_PROMPT_IDS`, not in the room, so the facilitator
 * only has to read it.
 */
function PromptItem({
  prompt,
  index,
  open,
  pace,
  showCutTag,
  onToggle,
}: {
  prompt: SessionPrompt;
  index: number;
  open: boolean;
  pace: Pace;
  showCutTag: boolean;
  onToggle: () => void;
}) {
  const [showFollowUp, setShowFollowUp] = useState(false);

  return (
    <li
      className={cn(
        "border-b border-border/40 last:border-b-0",
        showCutTag && "bg-[color:var(--color-brand-warning)]/6"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-2.5 py-2.5 text-left"
      >
        <span className="mt-1 shrink-0 text-muted-foreground/60">
          {open ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </span>
        <span className="mt-px shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/60">
          {index + 1}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 leading-snug",
            open ? "text-[16px] font-medium" : "text-[14px]",
            pace === "done" && !open && "text-muted-foreground"
          )}
        >
          {prompt.ask}
        </span>
        <span className="mt-px flex shrink-0 items-center gap-1.5">
          {showCutTag && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-brand-warning)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--color-brand-warning)]">
              <Scissors className="size-2.5" />
              Cut if needed
            </span>
          )}
          <span
            className={cn(
              "font-data text-[11px] tabular-nums",
              pace === "now"
                ? "font-semibold text-[color:var(--color-brand-electric)]"
                : "text-muted-foreground/70"
            )}
            title={
              pace === "now"
                ? `${prompt.minutes} min — the clock says you should be here now`
                : `${prompt.minutes} min`
            }
          >
            {pace === "now" && (
              <span
                aria-hidden
                className="mr-1 inline-block size-1.5 rounded-full bg-[color:var(--color-brand-electric)] align-middle"
              />
            )}
            {prompt.minutes}m
          </span>
        </span>
      </button>

      {open && (
        <div className="ml-[38px] flex flex-col gap-2.5 pb-3.5">
          {prompt.why && (
            <p className="text-[12px] leading-snug text-muted-foreground">
              {prompt.why}
            </p>
          )}

          {prompt.listenFor?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Listen for
                <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/70">
                  not read aloud
                </span>
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {prompt.listenFor.map((l) => (
                  <li
                    key={l}
                    className="flex gap-2 text-[12.5px] leading-snug text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className="mt-[7px] size-1 shrink-0 rounded-full bg-[color:var(--color-brand-mist)]/60"
                    />
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {prompt.followUp && (
            <div>
              <button
                type="button"
                onClick={() => setShowFollowUp((v) => !v)}
                aria-expanded={showFollowUp}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {showFollowUp ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                They gave a vague answer
              </button>
              {showFollowUp && (
                <p className="mt-1 text-[14px] leading-snug">
                  {prompt.followUp}
                </p>
              )}
            </div>
          )}

          {prompt.capture && (
            <p className="text-[12px] leading-snug text-[color:var(--color-brand-aqua)]">
              Write down: {prompt.capture}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

const CROSS_CHECK_TONE: Record<
  CrossCheckResult["status"],
  { dot: string; label: string; text: string }
> = {
  pass: {
    dot: "bg-[color:var(--color-brand-success)]",
    label: "Reconciles",
    text: "text-[color:var(--color-brand-success)]",
  },
  flag: {
    dot: "bg-[color:var(--color-brand-warning)]",
    label: "Ask about it",
    text: "text-[color:var(--color-brand-warning)]",
  },
  insufficient: {
    dot: "bg-[color:var(--color-brand-fog)]",
    label: "Not yet",
    text: "text-muted-foreground",
  },
};

/**
 * The four live cross-checks.
 *
 * Deliberately arithmetic and deliberately quiet: a flag is a reason to ask one
 * more question, never a verdict, and the guide's rule that the day ends without
 * one still holds. The panel appears from Block 2, the first block whose numbers
 * make any of it computable, and each check keeps a one-line note so the answer
 * is captured in the room rather than reconstructed at midnight.
 */
function CrossCheckPanel({
  results,
  notes,
  onSaveNote,
}: {
  results: CrossCheckResult[];
  notes: SessionNotes;
  onSaveNote: (result: CrossCheckResult, note: string) => void;
}) {
  const flags = results.filter((r) => r.status === "flag").length;

  return (
    <section className="flex flex-col gap-2.5 border-t border-border/60 pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Cross-checks
        <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/70">
          {flags > 0
            ? `${flags} to ask about — no verdicts today`
            : "their numbers against the file"}
        </span>
      </p>
      <ul className="flex flex-col gap-2.5">
        {results.map((result) => {
          const tone = CROSS_CHECK_TONE[result.status];
          const check = CROSS_CHECKS.find((c) => c.id === result.id);
          return (
            <li key={result.id} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-1.5">
                <span
                  aria-hidden
                  className={cn("mt-1 size-1.5 shrink-0 rounded-full", tone.dot)}
                />
                <span className="text-[12px] font-medium">{result.title}</span>
                <span className={cn("text-[10px] uppercase tracking-[0.08em]", tone.text)}>
                  {tone.label}
                </span>
              </div>
              <p className="pl-3 text-[11.5px] leading-snug text-muted-foreground">
                {result.detail}
              </p>
              {result.status === "flag" && check && (
                <p className="pl-3 text-[11.5px] leading-snug text-[color:var(--color-brand-aqua)]">
                  Ask: {check.askOnFlag}
                </p>
              )}
              <Input
                aria-label={`Note on ${result.title}`}
                defaultValue={notes.crossChecks?.[result.id]?.note ?? ""}
                onBlur={(e) => onSaveNote(result, e.target.value)}
                placeholder="What they said when you asked"
                className="ml-3 h-7 text-[12px]"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SessionStep({
  assessment,
  notes,
  activeBlock,
  onBlockChange,
  onSaveNote,
  onSaveElapsed,
  onSaveMetric,
  onSaveCrossCheck,
  onPatchAssessment,
  onFinish,
}: {
  assessment: CcAssessment;
  notes: SessionNotes;
  activeBlock: BlockId;
  onBlockChange: (id: BlockId) => void;
  onSaveNote: (id: BlockId, text: string) => void;
  onSaveElapsed: (id: BlockId, seconds: number) => void;
  onSaveMetric: (key: string, value: string) => void;
  /**
   * Optional: the workbench serialises its session writes through one queue, so
   * pass this to put cross-check notes in the same line. Without it the note is
   * written straight to `session_notes.crossChecks` from here, which is correct
   * but not ordered against a note or a timer landing in the same second.
   */
  onSaveCrossCheck?: (id: CrossCheckId, record: CrossCheckRecord) => void;
  onPatchAssessment: (patch: Record<string, string>) => void;
  onFinish: () => void;
}) {
  const block = SESSION_BLOCKS.find((b) => b.id === activeBlock)!;
  const script = SESSION_BLOCK_SCRIPTS[activeBlock];
  const budgetSec = block.minutes * 60;

  const [elapsed, setElapsed] = useState(notes.elapsed?.[activeBlock] ?? 0);
  const [running, setRunning] = useState(true);
  const [draft, setDraft] = useState(blockNote(notes, activeBlock));
  const [openPrompt, setOpenPrompt] = useState<string | null>(
    SESSION_BLOCK_SCRIPTS[activeBlock]?.prompts?.[0]?.id ?? null
  );
  const lastSavedElapsed = useRef(elapsed);

  const flushElapsed = useCallback(
    (id: BlockId, seconds: number) => {
      if (Math.abs(seconds - lastSavedElapsed.current) < 1) return;
      lastSavedElapsed.current = seconds;
      onSaveElapsed(id, seconds);
    },
    [onSaveElapsed]
  );

  /**
   * Leaving a block banks its clock and its notes.
   *
   * The parent renders this component with key={activeBlock}, so a block change
   * unmounts and remounts it — which resets the draft and the timer for free,
   * and gives this cleanup the outgoing block's final values. Losing five
   * minutes of a live session to a mis-click is not acceptable, so the same
   * cleanup covers navigating away from the Session step entirely.
   */
  const latest = useRef({ draft, elapsed, savedNote: blockNote(notes, activeBlock) });
  useEffect(() => {
    latest.current = {
      draft,
      elapsed,
      savedNote: blockNote(notes, activeBlock),
    };
  });
  useEffect(() => {
    return () => {
      const { draft: d, savedNote, elapsed: secs } = latest.current;
      if (d !== savedNote) onSaveNote(activeBlock, d);
      if (Math.abs(secs - lastSavedElapsed.current) >= 1) {
        onSaveElapsed(activeBlock, secs);
      }
    };
    // Runs once per mounted block — the key change is what triggers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next % ELAPSED_SAVE_EVERY_SEC === 0) flushElapsed(activeBlock, next);
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running, activeBlock, flushElapsed]);

  const over = elapsed > budgetSec;
  const blockIndex = BLOCK_IDS.indexOf(activeBlock);
  const nextBlock = SESSION_BLOCKS[blockIndex + 1] ?? null;

  /** Cumulative time boxes for this block's questions. Fixed per block. */
  const schedule = useMemo(() => promptSchedule(activeBlock), [activeBlock]);
  const paceIndex = pacedPromptIndex(schedule, elapsed);
  const cutCount = schedule.filter((s) => s.triage).length;

  /**
   * Recomputed on every keystroke in a metric field, which is the point — the
   * facilitator sees the check turn while the owner is still on the subject.
   */
  const crossChecks = useMemo(
    () => runCrossChecks(notes, assessment),
    [notes, assessment]
  );
  const blockMetrics = engineMetricsForBlock(activeBlock);

  const saveCrossCheckNote = useCallback(
    (result: CrossCheckResult, note: string) => {
      const priorNote = notes.crossChecks?.[result.id]?.note ?? "";
      if (note === priorNote) return;
      const record: CrossCheckRecord = {
        status: result.status,
        detail: result.detail,
        note,
      };
      if (onSaveCrossCheck) {
        onSaveCrossCheck(result.id, record);
        return;
      }
      void updateSessionNotes(assessment.id, {
        crossChecks: { [result.id]: record },
      });
    },
    [assessment.id, notes.crossChecks, onSaveCrossCheck]
  );

  function commitDraft() {
    if (draft !== blockNote(notes, activeBlock)) onSaveNote(activeBlock, draft);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Block rail + pacing. No score, by design. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border/60 pb-4">
        <div className="flex flex-wrap gap-1">
          {SESSION_BLOCKS.map((b, i) => {
            const active = b.id === activeBlock;
            const captured = blockNote(notes, b.id).trim().length > 0;
            return (
              <div key={b.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => onBlockChange(b.id)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-left transition-colors duration-150 motion-reduce:transition-none",
                    active
                      ? "bg-[color:var(--color-brand-slate)] text-foreground"
                      : "text-muted-foreground hover:bg-[color:var(--color-brand-slate)]/50 hover:text-foreground"
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[12px]">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full",
                        captured
                          ? "bg-[color:var(--color-brand-aqua)]"
                          : "bg-[color:var(--color-brand-fog)]"
                      )}
                    />
                    <span className={cn(active && "font-semibold")}>
                      {b.label}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[10px] tabular-nums text-muted-foreground">
                    {b.minutes} min
                    {(notes.elapsed?.[b.id] ?? 0) > 0 && !active
                      ? ` · ${Math.round((notes.elapsed?.[b.id] ?? 0) / 60)} used`
                      : ""}
                  </span>
                </button>
                {b.breakAfter && (
                  <span
                    className="mx-1 flex items-center gap-1 text-[10px] text-muted-foreground/70"
                    title="15-minute break"
                  >
                    <Coffee className="size-3" />
                    15
                  </span>
                )}
                {i < SESSION_BLOCKS.length - 1 && !b.breakAfter && (
                  <span aria-hidden className="mx-0.5 text-muted-foreground/25">
                    ·
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {over && cutCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-brand-warning)]/12 px-2 py-0.5 text-[11px] text-[color:var(--color-brand-warning)]">
              <Scissors className="size-3" />
              {formatClock(elapsed - budgetSec)} over —{" "}
              {cutCount === 1
                ? "1 question tagged to cut"
                : `${cutCount} questions tagged to cut`}
            </span>
          )}
          <span
            className={cn(
              "font-data text-[15px] tabular-nums",
              over ? "text-[color:var(--color-brand-warning)]" : "text-foreground"
            )}
            title={
              over
                ? `${formatClock(elapsed - budgetSec)} over the ${block.minutes}-minute budget`
                : `${formatClock(budgetSec - elapsed)} of budget left`
            }
          >
            {formatClock(elapsed)}
            <span className="text-muted-foreground"> / {block.minutes}:00</span>
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={running ? "Pause block timer" : "Start block timer"}
            onClick={() => {
              setRunning((r) => {
                if (r) flushElapsed(activeBlock, elapsed);
                return !r;
              });
            }}
          >
            {running ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* Script */}
        <div className="flex min-w-0 flex-col gap-4">
          {script ? (
            <>
              {script.purpose && (
                <p className="max-w-[70ch] text-[12.5px] leading-relaxed text-muted-foreground">
                  {script.purpose}
                </p>
              )}
              <ReadAloud>{script.openWith}</ReadAloud>

              {(script.keyMoments?.length ?? 0) > 0 && (
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-gold)]">
                    Key moments — say these exactly
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {script.keyMoments?.map((m) => (
                      <li
                        key={m}
                        className="rounded-lg bg-[color:var(--color-brand-gold)]/8 px-3.5 py-2.5 text-[14px] leading-snug ring-1 ring-inset ring-[color:var(--color-brand-gold)]/25"
                      >
                        {m}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {script.prompts?.length > 0 && (
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Work through
                    <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/70">
                      {script.prompts.length} questions · {block.minutes} min
                      {paceIndex >= 0
                        ? ` · the clock says question ${paceIndex + 1}`
                        : " · past the budget"}
                    </span>
                  </p>
                  <ol className="mt-1.5">
                    {schedule.map((slot, i) => (
                      <PromptItem
                        key={slot.prompt.id}
                        prompt={slot.prompt}
                        index={i}
                        open={openPrompt === slot.prompt.id}
                        pace={
                          paceIndex === i
                            ? "now"
                            : elapsed >= slot.endsAt
                              ? "done"
                              : "ahead"
                        }
                        showCutTag={over && slot.triage}
                        onToggle={() =>
                          setOpenPrompt((cur) =>
                            cur === slot.prompt.id ? null : slot.prompt.id
                          )
                        }
                      />
                    ))}
                  </ol>
                </section>
              )}

              {(script.capture?.length ?? 0) > 0 && (
                <section className="border-t border-border/60 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Before you move on
                    <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/70">
                      not read aloud
                    </span>
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {script.capture?.map((c) => (
                      <li
                        key={c}
                        className="flex gap-2 text-[12.5px] leading-snug text-muted-foreground"
                      >
                        <span
                          aria-hidden
                          className="mt-[7px] size-1 shrink-0 rounded-full bg-[color:var(--color-brand-mist)]/60"
                        />
                        {c}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {script.closeWith && (
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-electric)]">
                    Close the session with this
                  </p>
                  <p className="mt-2 max-w-[64ch] rounded-xl bg-[color:var(--color-brand-slate)]/45 px-5 py-4 text-[15px] leading-relaxed ring-1 ring-inset ring-[color:var(--color-brand-electric)]/20">
                    {script.closeWith}
                  </p>
                </section>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No script is loaded for this block. Work the block from the
              Facilitator Guide and capture what you hear on the right.
            </p>
          )}
        </div>

        {/* Capture */}
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <label
              htmlFor="block-notes"
              className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              Notes · {block.label}
            </label>
            <Textarea
              id="block-notes"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              placeholder="Type as they talk. Quote them where you can — verbatim beats paraphrase when you score this tonight."
              className="mt-1.5 min-h-[280px] text-[13px] leading-relaxed"
            />
          </div>

          {activeBlock === "b1" && (
            <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
              <Field label="Owner's primary objective">
                <Input
                  defaultValue={assessment.owner_objective ?? ""}
                  onBlur={(e) =>
                    onPatchAssessment({ owner_objective: e.target.value })
                  }
                  placeholder="What success in 12 months means, in their words"
                />
              </Field>
              <Field
                label="Their bottleneck belief"
                hint="verbatim — this is the Mirror"
              >
                <Input
                  defaultValue={assessment.owner_belief ?? ""}
                  onBlur={(e) =>
                    onPatchAssessment({ owner_belief: e.target.value })
                  }
                  placeholder='"I think it&apos;s that we can&apos;t find good people"'
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Revenue $">
                  <Input
                    type="number"
                    defaultValue={assessment.annual_revenue ?? ""}
                    onBlur={(e) =>
                      onPatchAssessment({ annual_revenue: e.target.value })
                    }
                    className="tabular-nums"
                  />
                </Field>
                <Field label="Margin %">
                  <Input
                    type="number"
                    defaultValue={assessment.gross_margin ?? ""}
                    onBlur={(e) =>
                      onPatchAssessment({ gross_margin: e.target.value })
                    }
                    className="tabular-nums"
                  />
                </Field>
                <Field label="Op profit $">
                  <Input
                    type="number"
                    defaultValue={assessment.operating_profit ?? ""}
                    onBlur={(e) =>
                      onPatchAssessment({ operating_profit: e.target.value })
                    }
                    className="tabular-nums"
                  />
                </Field>
              </div>
            </div>
          )}

          {blockMetrics.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-border/60 pt-4">
              <p className="text-[11px] text-muted-foreground">
                {activeBlock === "b2"
                  ? "The engine numbers. Estimates are fine — say so out loud and mark the evidence as Reported when you score."
                  : "Numbers the cross-checks below run on. Estimates are fine; say so out loud."}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {blockMetrics.map((m) => {
                  const multiline = "multiline" in m && m.multiline;
                  return (
                    <div
                      key={m.key}
                      className={cn("min-w-0", multiline && "col-span-2")}
                    >
                      <Field label={m.label} hint={m.hint}>
                        {multiline ? (
                          <Textarea
                            defaultValue={notes[m.key] ?? ""}
                            onBlur={(e) => onSaveMetric(m.key, e.target.value)}
                            placeholder={"Admin 22\nOwner 9\nDispatcher 15"}
                            className="min-h-[72px] text-[13px]"
                          />
                        ) : (
                          <Input
                            defaultValue={notes[m.key] ?? ""}
                            onBlur={(e) => onSaveMetric(m.key, e.target.value)}
                          />
                        )}
                      </Field>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {blockIndex >= 1 && (
            <CrossCheckPanel
              results={crossChecks}
              notes={notes}
              onSaveNote={saveCrossCheckNote}
            />
          )}

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-4">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const prev = SESSION_BLOCKS[blockIndex - 1];
                if (prev) onBlockChange(prev.id);
              }}
              disabled={blockIndex === 0}
            >
              Back
            </Button>
            {nextBlock ? (
              <Button size="sm" onClick={() => onBlockChange(nextBlock.id)}>
                {nextBlock.label} <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  commitDraft();
                  flushElapsed(activeBlock, elapsed);
                  onFinish();
                }}
              >
                Session done — start scoring <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
