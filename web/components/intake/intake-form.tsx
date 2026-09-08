"use client";

/**
 * The owner's intake form.
 *
 * Three decisions worth knowing before editing this file:
 *
 *  1. It autosaves. There is no Save button and no draft that can be lost —
 *     an owner filling this in on a phone between jobs is the whole audience,
 *     and the one thing that would waste their hour is a lost tab. Changes are
 *     coalesced for a beat and then written; the header says where the work is.
 *  2. "Not currently known" is a first-class answer, not a blank. It is a
 *     button on every question that allows it, it stores the literal string
 *     "unknown", and it counts as answered for progress. The instrument never
 *     scores it as zero, and the form must never make it feel like giving up.
 *  3. Nothing here shows a score, a band, or a judgement of any kind. The
 *     reveal belongs to the Results Session; a progress bar is the only
 *     feedback this page gives.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { saveIntakeAnswers } from "@/lib/intake-actions";
import {
  INTAKE_COMPLETION,
  INTAKE_SECTIONS,
  intakeProgress,
  isAnswered,
  isUnknown,
  moduleEApplies,
  questionsInSection,
  TABLE_ROW_KEY,
  tableRows,
  UNKNOWN,
  UNKNOWN_LABEL,
  type IntakeAnswer,
  type IntakeAnswers,
  type IntakeColumn,
  type IntakeQuestion,
  type IntakeQuestionId,
  type IntakeTableRow,
} from "@/lib/assessment-intake";

type SaveState = "idle" | "saving" | "saved" | "error" | "closed";

/** How long a burst of typing is allowed to settle before it is written. */
const AUTOSAVE_MS = 800;

// ─────────────────────────────────────────────────────────────────────────────
// Table helpers — one storage shape, two behaviours
// ─────────────────────────────────────────────────────────────────────────────

/** A fixed-row table always renders its written rows, filled or not. */
function fixedCell(
  value: IntakeAnswer | undefined,
  label: string,
  column: string
): string {
  const row = tableRows(value).find((r) => r[TABLE_ROW_KEY] === label);
  return row?.[column] ?? "";
}

function setFixedCell(
  value: IntakeAnswer | undefined,
  label: string,
  column: string,
  next: string
): IntakeTableRow[] {
  const rows = tableRows(value).filter((r) => r[TABLE_ROW_KEY] !== undefined);
  const index = rows.findIndex((r) => r[TABLE_ROW_KEY] === label);
  if (index === -1) {
    return [...rows, { [TABLE_ROW_KEY]: label, [column]: next }];
  }
  const copy = [...rows];
  copy[index] = { ...copy[index], [column]: next };
  return copy;
}

/**
 * A free-row table after one cell edit — or `undefined` once the owner has
 * emptied every row.
 *
 * The undefined matters: an empty array is not a stored answer of "no rows",
 * it is dropped on the way in, so sending `[]` would leave yesterday's rows
 * sitting in the database while the screen shows an empty grid. Undefined
 * routes the question through the patch's `__cleared` list instead, and the
 * answer is actually deleted.
 */
function setFreeCell(
  value: IntakeAnswer | undefined,
  index: number,
  column: string,
  next: string
): IntakeTableRow[] | undefined {
  const rows = tableRows(value);
  const copy = [...rows];
  while (copy.length <= index) copy.push({});
  copy[index] = { ...copy[index], [column]: next };
  // Trailing rows the owner emptied again are dropped, so an accidental tab
  // through the blank row never stores a row of nothing.
  while (
    copy.length > 0 &&
    Object.values(copy[copy.length - 1]).every((v) => !v || !v.trim())
  ) {
    copy.pop();
  }
  return copy.length > 0 ? copy : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────

export function IntakeForm({
  token,
  initialAnswers,
}: {
  token: string;
  initialAnswers: IntakeAnswers;
}) {
  const [answers, setAnswers] = useState<IntakeAnswers>(initialAnswers);
  const [save, setSave] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  const latest = useRef<IntakeAnswers>(initialAnswers);
  const dirty = useRef<Set<IntakeQuestionId>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Writes are serialised: two overlapping merges can drop the older one. */
  const queue = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(
    (submit = false): Promise<void> => {
      const ids = Array.from(dirty.current);
      dirty.current.clear();
      if (ids.length === 0 && !submit) return Promise.resolve();

      const patch: Record<string, unknown> = {};
      const cleared: string[] = [];
      for (const id of ids) {
        const value = latest.current[id];
        if (value === undefined) cleared.push(id);
        else patch[id] = value;
      }
      if (cleared.length > 0) patch.__cleared = cleared;

      /**
       * A write that did not land leaves its questions dirty again, so "Try
       * again" re-sends them and the next keystroke carries them along. The
       * ids are cleared optimistically above — without this, a failed save
       * would silently drop the patch and the retry would post nothing.
       */
      const keepDirty = () => {
        for (const id of ids) dirty.current.add(id);
      };

      const run = async () => {
        setSave("saving");
        try {
          const res = await saveIntakeAnswers(token, patch, submit);
          if (!res.ok) {
            // A closed link is final — re-queueing would only retry into the
            // same refusal — but every other failure is worth another go.
            if (!res.closed) keepDirty();
            setSave(res.closed ? "closed" : "error");
            setError(res.error);
            return;
          }
          setError(null);
          setSave("saved");
          if (res.submitted) setSubmitted(true);
        } catch {
          keepDirty();
          setSave("error");
          setError("Couldn't reach the server — your answers are still here.");
        }
      };

      queue.current = queue.current.then(run, run);
      return queue.current;
    },
    [token]
  );

  const setAnswer = useCallback(
    (id: IntakeQuestionId, value: IntakeAnswer | undefined) => {
      const next: IntakeAnswers = { ...latest.current };
      if (value === undefined) delete next[id];
      else next[id] = value;
      latest.current = next;
      setAnswers(next);
      dirty.current.add(id);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const progress = useMemo(() => intakeProgress(answers), [answers]);
  const moduleE = useMemo(() => moduleEApplies(answers), [answers]);
  // Already worked out per section, so it is a flatten rather than a second
  // parse of every answer on every keystroke.
  const missing = useMemo(
    () => progress.flatMap((p) => p.missingRequired),
    [progress]
  );

  const totals = progress.reduce(
    (acc, p) => ({ done: acc.done + p.done, total: acc.total + p.total }),
    { done: 0, total: 0 }
  );

  if (submitted) {
    return (
      <section className="ci-done" aria-live="polite">
        <h2 className="ci-h2">Your responses are in</h2>
        <p className="ci-p">{INTAKE_COMPLETION}</p>
        <p className="ci-fineprint">
          You can close this page. The link is now closed — if something needs
          correcting, tell your advisor and they&apos;ll reopen it.
        </p>
      </section>
    );
  }

  if (save === "closed") {
    return (
      <section className="ci-done" aria-live="polite">
        <h2 className="ci-h2">This link is closed</h2>
        <p className="ci-p">{error}</p>
      </section>
    );
  }

  return (
    <>
      <div className="ci-progress" role="status" aria-live="polite">
        <div className="ci-progress-head">
          <span className="ci-caps">Progress</span>
          <span className="ci-progress-count">
            {totals.done} of {totals.total} answered
          </span>
          <span className={`ci-save ci-save-${save}`}>
            {save === "saving"
              ? "Saving…"
              : save === "saved"
                ? "Saved"
                : save === "error"
                  ? "Not saved"
                  : "Saves as you type"}
          </span>
        </div>
        <ol className="ci-progress-bars">
          {progress.map((p) => {
            const section = INTAKE_SECTIONS.find((s) => s.id === p.section)!;
            const pct = p.total === 0 ? 0 : Math.round((p.done / p.total) * 100);
            const hidden = p.section === "e" && !moduleE;
            return (
              <li key={p.section} className="ci-progress-item">
                <a className="ci-progress-link" href={`#section-${p.section}`}>
                  <span className="ci-progress-label">{section.title}</span>
                  <span className="ci-progress-track" aria-hidden>
                    <span
                      className="ci-progress-fill"
                      style={{ width: hidden ? "0%" : `${pct}%` }}
                    />
                  </span>
                  <span className="ci-progress-n">
                    {hidden ? "n/a" : `${p.done}/${p.total}`}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>

      {error && save === "error" && (
        <p className="ci-alert" role="alert">
          {error}{" "}
          <button
            type="button"
            className="ci-linkbtn"
            onClick={() => void flush()}
          >
            Try again
          </button>
        </p>
      )}

      {INTAKE_SECTIONS.map((section) => {
        const questions = questionsInSection(section.id);
        const skipped = section.id === "e" && !moduleE;
        return (
          <section
            key={section.id}
            id={`section-${section.id}`}
            className="ci-section"
          >
            <h2 className="ci-h2">{section.title}</h2>
            <p className="ci-section-blurb">{section.blurb}</p>
            {skipped ? (
              <p className="ci-skip">
                Not needed — this only applies if succession or a future sale is
                one of the objectives you picked in question 3.
              </p>
            ) : (
              <ol className="ci-questions">
                {questions.map((q) => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    value={answers[q.id]}
                    missing={showMissing && missing.includes(q.id)}
                    onChange={(value) => setAnswer(q.id, value)}
                  />
                ))}
              </ol>
            )}
          </section>
        );
      })}

      <section className="ci-section ci-submit-block">
        <h2 className="ci-h2">Send it in</h2>
        <p className="ci-p">
          Anything you left blank is fine — your advisor will pick it up in the
          session. Once you send this, the link closes.
        </p>
        {showMissing && missing.length > 0 && (
          <p className="ci-alert" role="alert">
            A few answers are still needed:{" "}
            {missing.map((id) => `question ${id.replace(/^q/, "")}`).join(", ")}.
          </p>
        )}
        <button
          type="button"
          className="ci-submit"
          disabled={save === "saving"}
          onClick={() => {
            if (missing.length > 0) {
              setShowMissing(true);
              const first = document.getElementById(`q-${missing[0]}`);
              first?.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
            if (timer.current) clearTimeout(timer.current);
            void flush(true);
          }}
        >
          {save === "saving" ? "Sending…" : "Send my answers"}
        </button>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// One question
// ─────────────────────────────────────────────────────────────────────────────

function QuestionField({
  question,
  value,
  missing,
  onChange,
}: {
  question: IntakeQuestion;
  value: IntakeAnswer | undefined;
  missing: boolean;
  onChange: (value: IntakeAnswer | undefined) => void;
}) {
  const unknown = isUnknown(value);
  const number = question.id.replace(/^[qe]/, question.id.startsWith("e") ? "E" : "");
  const answered = isAnswered(value) || unknown;

  return (
    <li
      id={`q-${question.id}`}
      className={`ci-q${missing ? " ci-q-missing" : ""}${
        answered ? " ci-q-answered" : ""
      }`}
    >
      <div className="ci-q-head">
        <span className="ci-q-n" aria-hidden>
          {number}
        </span>
        <div className="ci-q-title">
          <p className="ci-q-prompt">
            {question.prompt}
            {question.required && (
              <span className="ci-req" aria-hidden>
                {" "}
                *
              </span>
            )}
          </p>
          {question.help && <p className="ci-q-help">{question.help}</p>}
        </div>
      </div>

      <div className="ci-q-body">
        {unknown ? (
          <p className="ci-unknown-state">{UNKNOWN_LABEL}</p>
        ) : (
          <QuestionInput question={question} value={value} onChange={onChange} />
        )}
      </div>

      {question.allowUnknown && (
        <button
          type="button"
          className={`ci-unknown${unknown ? " ci-unknown-on" : ""}`}
          aria-pressed={unknown}
          onClick={() => onChange(unknown ? undefined : UNKNOWN)}
        >
          {unknown ? "Answer it after all" : UNKNOWN_LABEL}
        </button>
      )}
    </li>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion;
  value: IntakeAnswer | undefined;
  onChange: (value: IntakeAnswer | undefined) => void;
}) {
  const text = typeof value === "string" ? value : "";

  switch (question.type) {
    case "long":
    case "upload_note":
      return (
        <textarea
          className="ci-textarea"
          rows={question.type === "long" ? 4 : 3}
          value={text}
          aria-label={question.prompt}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
    case "currency":
    case "percent":
      return (
        <span className="ci-scalar">
          {question.type === "currency" && <span className="ci-affix">$</span>}
          <input
            className="ci-input ci-input-num"
            inputMode="decimal"
            value={text}
            aria-label={question.prompt}
            onChange={(e) => onChange(e.target.value)}
          />
          {question.type === "percent" && <span className="ci-affix">%</span>}
        </span>
      );

    case "single":
      return (
        <div className="ci-options" role="radiogroup" aria-label={question.prompt}>
          {(question.options ?? []).map((option) => (
            <label key={option} className="ci-option">
              <input
                type="radio"
                name={`${question.id}-single`}
                checked={text === option}
                onChange={() => onChange(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );

    case "multi": {
      const picked = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : [];
      return (
        <div className="ci-options" role="group" aria-label={question.prompt}>
          {(question.options ?? []).map((option) => {
            const on = picked.includes(option);
            return (
              <label key={option} className="ci-option">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    const next = on
                      ? picked.filter((p) => p !== option)
                      : [...picked, option];
                    onChange(next.length > 0 ? next : undefined);
                  }}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case "table":
      return question.rows ? (
        <FixedTable question={question} value={value} onChange={onChange} />
      ) : (
        <FreeTable question={question} value={value} onChange={onChange} />
      );

    case "short":
    default:
      return (
        <input
          className="ci-input"
          value={text}
          aria-label={question.prompt}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

function Cell({
  column,
  value,
  label,
  onChange,
}: {
  column: IntakeColumn;
  value: string;
  label: string;
  onChange: (next: string) => void;
}) {
  if (column.type === "single") {
    return (
      <select
        className="ci-select"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {(column.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  const numeric =
    column.type === "number" ||
    column.type === "currency" ||
    column.type === "percent";
  return (
    <input
      className={`ci-input${numeric ? " ci-input-num" : ""}`}
      inputMode={numeric ? "decimal" : undefined}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function FixedTable({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion;
  value: IntakeAnswer | undefined;
  onChange: (value: IntakeAnswer) => void;
}) {
  const columns = question.columns ?? [];
  return (
    <div className="ci-grid">
      {(question.rows ?? []).map((label) => (
        <div className="ci-grid-row" key={label}>
          <span className="ci-grid-label">{label}</span>
          <div className="ci-grid-cells">
            {columns.map((column) => (
              <Cell
                key={column.key}
                column={column}
                label={`${label} — ${column.label || question.prompt}`}
                value={fixedCell(value, label, column.key)}
                onChange={(next) =>
                  onChange(setFixedCell(value, label, column.key, next))
                }
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FreeTable({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion;
  value: IntakeAnswer | undefined;
  /** undefined when the last row was emptied — the answer is cleared, not `[]`. */
  onChange: (value: IntakeAnswer | undefined) => void;
}) {
  const columns = question.columns ?? [];
  const rows = tableRows(value);
  const max = question.maxRows ?? 10;
  // One blank row is always offered, so adding a line never needs a button.
  const shown = rows.length < max ? rows.length + 1 : rows.length;

  return (
    <div className="ci-grid ci-grid-free">
      <div className="ci-grid-head" aria-hidden>
        {columns.map((column) => (
          <span
            key={column.key}
            className={`ci-grid-h${column.width === "wide" ? " ci-wide" : ""}`}
          >
            {column.label}
          </span>
        ))}
      </div>
      {Array.from({ length: shown }, (_, index) => (
        <div className="ci-grid-row ci-grid-row-free" key={index}>
          <div className="ci-grid-cells">
            {columns.map((column) => (
              <span
                key={column.key}
                className={column.width === "wide" ? "ci-wide" : undefined}
              >
                <Cell
                  column={column}
                  label={`${question.prompt} — row ${index + 1} ${column.label}`}
                  value={rows[index]?.[column.key] ?? ""}
                  onChange={(next) =>
                    onChange(setFreeCell(value, index, column.key, next))
                  }
                />
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
