"use client";

/**
 * The coordinator's side of the owner intake.
 *
 * Three jobs, in the order they happen: send the owner a link, read what came
 * back, and carry the numbers into the engagement without re-keying them.
 *
 * The fourth thing on this screen is the one that changes how the intensive is
 * run: a strip showing which of the thirty indicators the intake actually
 * produced evidence for. An indicator with nothing behind it is not a low
 * score — it is four hours of session time that has to cover it from scratch,
 * and knowing that before the session is worth more than knowing it after.
 */

import { useState } from "react";
import { Check, Copy, Link2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  INDICATORS,
  INDICATORS_BY_PILLAR,
  PILLARS,
} from "@/lib/assessment-instrument";
import {
  INTAKE_SECTIONS,
  intakeCoverage,
  isUnknown,
  moduleEApplies,
  parseIntake,
  questionsInSection,
  TABLE_ROW_KEY,
  UNKNOWN_LABEL,
  type IntakeAnswer,
} from "@/lib/assessment-intake";
import {
  applyIntakePrefill,
  issueIntakeLink,
  revokeIntakeLink,
} from "@/lib/assessment-actions";
import type { CcAssessment } from "@/lib/supabase/types";

function answerLines(value: IntakeAnswer | undefined): string[] {
  if (value === undefined) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string") return entry.trim() ? [entry.trim()] : [];
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, string>;
    const label = row[TABLE_ROW_KEY];
    const cells = Object.entries(row)
      .filter(([k, v]) => k !== TABLE_ROW_KEY && typeof v === "string" && v.trim())
      .map(([, v]) => v.trim());
    if (cells.length === 0) return [];
    return [label ? `${label}: ${cells.join(" · ")}` : cells.join(" · ")];
  });
}

export function IntakeStep({
  assessment,
  onAssessment,
}: {
  assessment: CcAssessment;
  onAssessment: (next: CcAssessment) => void;
}) {
  const [busy, setBusy] = useState<null | "issue" | "revoke" | "prefill">(null);
  const [copied, setCopied] = useState(false);
  /**
   * The absolute URL as the server built it, when this session issued the
   * link. The origin is a browser fact, so it is deliberately not read during
   * render — a server pass and a client pass would then disagree and React
   * would throw the whole subtree away. The path is shown instead, and Copy
   * puts the full address on the clipboard.
   */
  const [issuedUrl, setIssuedUrl] = useState<string | null>(null);

  const token = assessment.intake_token;
  const path = token ? `/intake/${token}` : "";
  const answers = parseIntake(assessment.intake);
  const coverage = intakeCoverage(assessment.intake);
  const moduleE = moduleEApplies(assessment.intake);
  const answeredCount = Object.keys(answers).length;
  const covered = INDICATORS.filter(
    (i) => (coverage[i.key]?.answered.length ?? 0) > 0
  ).length;

  async function issue() {
    setBusy("issue");
    const res = await issueIntakeLink(assessment.id);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onAssessment(res.data!.assessment);
    setIssuedUrl(res.data!.link.url);
    toast.success("New link issued — the previous one stopped working.");
  }

  async function revoke() {
    setBusy("revoke");
    const res = await revokeIntakeLink(assessment.id);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onAssessment(res.data!.assessment);
    setIssuedUrl(null);
    toast.success("Link revoked. Every answer already given is kept.");
  }

  async function prefill() {
    setBusy("prefill");
    const res = await applyIntakePrefill(assessment.id);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onAssessment(res.data!.assessment);
    const applied = res.data!.outcomes.filter((o) => o.applied);
    const skipped = res.data!.outcomes.filter((o) => !o.applied);
    if (applied.length === 0) {
      toast.message(
        skipped.length > 0
          ? "Nothing to fill — every one of those fields already has a value you typed."
          : "The intake has no baseline figures to carry over yet."
      );
      return;
    }
    toast.success(
      `Filled ${applied.map((o) => o.label).join(", ")}${
        skipped.length > 0
          ? ` · left ${skipped.map((o) => o.label).join(", ")} alone`
          : ""
      }`
    );
  }

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(
        issuedUrl ?? `${window.location.origin}${path}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy — select the link and copy it by hand.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── The link ─────────────────────────────────────────────────────── */}
      <div className="max-w-3xl">
        <h3 className="text-[13px] font-semibold">The owner&apos;s link</h3>
        <p className="mt-1 max-w-[74ch] text-[12px] leading-relaxed text-muted-foreground">
          One unguessable URL, live only while this engagement sits in Intake.
          Issuing a new one kills the old one, and moving the engagement out of
          Intake kills it outright.
        </p>

        {token ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-[color:var(--color-brand-slate)]/50 px-3 py-2 text-[12px]">
              {issuedUrl ?? path}
            </code>
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={issue}
              disabled={busy !== null}
            >
              <RefreshCw className="size-4" /> Re-issue
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={revoke}
              disabled={busy !== null}
            >
              <Trash2 className="size-4" /> Revoke
            </Button>
          </div>
        ) : (
          <div className="mt-3">
            <Button size="sm" onClick={issue} disabled={busy !== null}>
              <Link2 className="size-4" /> Issue intake link
            </Button>
          </div>
        )}

        <p className="mt-2 text-[11.5px] text-muted-foreground">
          {assessment.intake_submitted_at
            ? `Submitted ${new Date(assessment.intake_submitted_at).toLocaleString("en-US")}.`
            : token
              ? "Not submitted yet — answers save as the owner types, so partial work is already below."
              : "No link issued."}
          {assessment.intake_submitted_at && token
            ? " Re-issuing re-opens the form and clears that timestamp."
            : ""}
        </p>
      </div>

      {/* ── Coverage ─────────────────────────────────────────────────────── */}
      <div className="border-t border-border/60 pt-4">
        <h3 className="text-[13px] font-semibold">
          Indicator coverage
          <span className="ml-2 font-normal text-muted-foreground">
            {covered} of {INDICATORS.length} have intake evidence
          </span>
        </h3>
        <p className="mt-1 max-w-[74ch] text-[12px] leading-relaxed text-muted-foreground">
          Filled = the owner answered a question that feeds it. Outlined = they
          answered &ldquo;not currently known&rdquo;, which is a finding of its
          own. Empty = the session covers it cold.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {PILLARS.map((pillar) => (
            <div key={pillar.key} className="flex flex-wrap items-center gap-1.5">
              <span className="w-20 shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {pillar.label}
              </span>
              {INDICATORS_BY_PILLAR[pillar.key].map((ind) => {
                const c = coverage[ind.key];
                const answered = (c?.answered.length ?? 0) > 0;
                const unknown = !answered && (c?.unknown.length ?? 0) > 0;
                return (
                  <span
                    key={ind.key}
                    title={`${ind.key} · ${ind.label} — ${
                      answered
                        ? `answered: ${c!.answered.join(", ")}`
                        : unknown
                          ? `marked not currently known: ${c!.unknown.join(", ")}`
                          : c
                            ? `no answer yet (asked in ${c.asked.join(", ")})`
                            : "no intake question feeds this indicator"
                    }`}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ring-inset",
                      answered
                        ? "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)] ring-transparent"
                        : unknown
                          ? "text-[color:var(--color-brand-warning)] ring-[color:var(--color-brand-warning)]/50"
                          : "text-muted-foreground/70 ring-border/70"
                    )}
                  >
                    {ind.key}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Pre-fill ─────────────────────────────────────────────────────── */}
      <div className="border-t border-border/60 pt-4">
        <h3 className="text-[13px] font-semibold">Baseline</h3>
        <p className="mt-1 max-w-[74ch] text-[12px] leading-relaxed text-muted-foreground">
          Carries the owner&apos;s objective, their bottleneck belief verbatim,
          revenue, margin and operating profit into the engagement — but only
          into fields you have not already filled in. Anything you typed wins,
          and pressing it twice is safe.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={prefill}
          disabled={busy !== null || answeredCount === 0}
        >
          Pre-fill baseline from intake
        </Button>
      </div>

      {/* ── The answers ──────────────────────────────────────────────────── */}
      <div className="border-t border-border/60 pt-4">
        <h3 className="text-[13px] font-semibold">
          Answers
          <span className="ml-2 font-normal text-muted-foreground">
            {answeredCount} recorded · read-only
          </span>
        </h3>
        {answeredCount === 0 ? (
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Nothing yet. Answers appear here as the owner types them — there is
            no need to wait for a submission.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-5">
            {INTAKE_SECTIONS.map((section) => {
              if (section.id === "e" && !moduleE) return null;
              const questions = questionsInSection(section.id).filter(
                (q) => answers[q.id] !== undefined
              );
              if (questions.length === 0) return null;
              return (
                <div key={section.id}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {section.title}
                  </p>
                  <dl className="mt-1.5 divide-y divide-border/50">
                    {questions.map((q) => {
                      const value = answers[q.id];
                      const unknown = isUnknown(value);
                      const lines = answerLines(value);
                      return (
                        <div
                          key={q.id}
                          className="grid gap-1 py-2 sm:grid-cols-[minmax(0,20rem)_1fr] sm:gap-4"
                        >
                          <dt className="text-[12.5px] leading-snug text-muted-foreground">
                            <span className="mr-1.5 tabular-nums opacity-60">
                              {q.id}
                            </span>
                            {q.prompt}
                          </dt>
                          <dd className="text-[13px] leading-snug">
                            {unknown ? (
                              <span className="rounded bg-[color:var(--color-brand-warning)]/15 px-1.5 py-0.5 text-[11.5px] font-medium text-[color:var(--color-brand-warning)]">
                                {UNKNOWN_LABEL}
                              </span>
                            ) : lines.length === 0 ? (
                              <span className="text-muted-foreground/60">—</span>
                            ) : lines.length === 1 ? (
                              lines[0]
                            ) : (
                              <ul className="flex flex-col gap-0.5">
                                {lines.map((line, i) => (
                                  <li key={`${q.id}-${i}`}>{line}</li>
                                ))}
                              </ul>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
