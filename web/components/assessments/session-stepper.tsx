"use client";

/**
 * The engagement rail.
 *
 * Free navigation on purpose: a diagnostic is a conversation, and owners answer
 * the question they want to answer. Gating steps would force the facilitator to
 * fight the client. Completion is shown, never enforced — the delivery gate
 * lives on Review, where it belongs.
 *
 * Two of these steps are whole modes rather than forms. Session is what you run
 * with the client in the room; Scoring is what you do afterwards, from the notes
 * Session captured. The Facilitator Guide is explicit that those are different
 * sittings, so they are different steps.
 */

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type StepId =
  | "setup"
  | "session"
  | "scoring"
  | "opportunities"
  | "constraint"
  | "plan"
  | "review";

export const STEP_IDS: StepId[] = [
  "setup",
  "session",
  "scoring",
  "opportunities",
  "constraint",
  "plan",
  "review",
];

export function isStepId(value: string | undefined | null): value is StepId {
  return !!value && (STEP_IDS as string[]).includes(value);
}

export interface StepMeta {
  id: StepId;
  label: string;
  /** One line at the top of the step: what this step is for. */
  purpose: string;
  /** Where in the delivery this sits. */
  when: string;
}

export const STEPS: Record<StepId, StepMeta> = {
  setup: {
    id: "setup",
    label: "Setup",
    purpose:
      "Name the engagement the way it should read on the report cover, and who you'll be sitting with.",
    when: "Before the intensive",
  },
  session: {
    id: "session",
    label: "Session",
    purpose:
      "Four hours, five blocks, one conversation. Say the lines, capture what you hear, give no verdict today.",
    when: "Live, client in the room",
  },
  scoring: {
    id: "scoring",
    label: "Scoring",
    purpose:
      "Same day, while it's fresh. Score all thirty indicators from your notes — the notes are here beside them.",
    when: "After the intensive",
  },
  opportunities: {
    id: "opportunities",
    label: "Opportunities",
    purpose:
      "Price the two or three strongest findings. Low, expected and high — with the math you can defend.",
    when: "Analysis window",
  },
  constraint: {
    id: "constraint",
    label: "Constraint",
    purpose:
      "Name the one root cause the symptoms share, then flag anything a score can never average away.",
    when: "Analysis window",
  },
  plan: {
    id: "plan",
    label: "90-day plan",
    purpose:
      "The plan has to be worth $7,500 standing alone — fully usable without CREAiT.",
    when: "Analysis window",
  },
  review: {
    id: "review",
    label: "Review & deliver",
    purpose:
      "Check what's thin, then hand over the Executive Blueprint.",
    when: "Results session",
  },
};

export type StepStatus = "empty" | "partial" | "complete";

export function SessionStepper({
  current,
  statuses,
  counts,
  onSelect,
}: {
  current: StepId;
  statuses: Record<StepId, StepStatus>;
  /** Optional trailing figure per step, e.g. "19/30". */
  counts: Partial<Record<StepId, string>>;
  onSelect: (id: StepId) => void;
}) {
  return (
    <nav
      aria-label="Engagement steps"
      className="-mx-1 overflow-x-auto border-b border-border/70"
    >
      <ol className="flex min-w-max items-stretch px-1">
        {STEP_IDS.map((id, i) => {
          const step = STEPS[id];
          const status = statuses[id];
          const active = id === current;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-[13px] transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold tabular-nums transition-colors",
                    status === "complete"
                      ? "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]"
                      : status === "partial"
                        ? "bg-[color:var(--color-brand-electric)]/20 text-[color:var(--color-brand-electric)]"
                        : "bg-[color:var(--color-brand-fog)]/60 text-[color:var(--color-brand-mist)]"
                  )}
                >
                  {status === "complete" ? (
                    <Check className="size-2.5" strokeWidth={3} />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={cn(active && "font-semibold")}>
                  {step.label}
                </span>
                {counts[id] && (
                  <span className="text-[11px] tabular-nums text-muted-foreground/80">
                    {counts[id]}
                  </span>
                )}
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-opacity duration-200 motion-reduce:transition-none",
                    active
                      ? "bg-[color:var(--color-brand-electric)] opacity-100"
                      : "opacity-0"
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The one-line brief that opens every step. */
export function StepIntro({
  step,
  trailing,
}: {
  step: StepMeta;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight">
          {step.label}
          <span className="ml-2.5 text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
            {step.when}
          </span>
        </h2>
        <p className="mt-1 max-w-[68ch] text-[13px] leading-relaxed text-muted-foreground">
          {step.purpose}
        </p>
      </div>
      {trailing}
    </div>
  );
}
