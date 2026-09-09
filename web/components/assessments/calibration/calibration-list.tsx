"use client";

/**
 * The case library and the team's record on it. What a case is designed to
 * test stays hidden until a trainee has submitted it — knowing "this one is
 * built to fail the funnel cross-check" is half the answer.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, CircleDashed, Play, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/assessment-instrument";
import { startCalibration } from "@/lib/calibration-actions";

export interface CalibrationCaseSummary {
  slug: string;
  n: number;
  company: string;
  industry: string;
  revenue: number | null;
  headcount: number | null;
  /** The current signed-in trainee's open attempt, if any. */
  myOpenAttemptId: string | null;
  /** The current trainee's submitted attempts, newest first. */
  myAttempts: Array<{ id: string; submitted_at: string; pass: boolean; within_one: number; exact: number }>;
  /** Everyone's submitted attempts on this case. */
  teamSubmitted: number;
  teamPassed: number;
}

export interface TraineeSummary {
  trainee_id: string;
  trainee_name: string | null;
  submitted: number;
  passed: number;
  cases: number;
  /** Mean within-±1 count over submitted attempts. */
  mean_within_one: number | null;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CaseRow({ c }: { c: CalibrationCaseSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const best = c.myAttempts.find((a) => a.pass) ?? c.myAttempts[0] ?? null;

  async function start() {
    setBusy(true);
    const res = await startCalibration(c.slug);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.push(`/assessments/calibration/${c.slug}?attempt=${res.data!.attemptId}`);
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium">
          <span className="mr-2 font-mono text-[11px] text-muted-foreground/70">
            {c.n === 0 ? "KEY" : String(c.n).padStart(2, "0")}
          </span>
          {c.company}
          {c.n === 0 && (
            <span className="ml-2 rounded bg-[color:var(--color-brand-violet)]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-brand-violet)]">
              founder key
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {c.industry}
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          <span className="tabular-nums">{formatMoney(c.revenue)}</span>
          {c.headcount !== null && (
            <>
              <span className="mx-1.5 text-muted-foreground/40">·</span>
              <span className="tabular-nums">{c.headcount} people</span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 text-[12px] tabular-nums text-muted-foreground">
        {best ? (
          <Link
            href={`/assessments/calibration/${c.slug}?attempt=${best.id}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors hover:bg-[color:var(--color-brand-slate)]/60",
              best.pass ? "text-[color:var(--color-brand-success)]" : "text-[color:var(--color-brand-warning)]"
            )}
            title="Open the comparison"
          >
            {best.pass ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
            {best.within_one}/30 within ±1 · {best.exact} exact
            <span className="font-normal text-muted-foreground">· {formatWhen(best.submitted_at)}</span>
          </Link>
        ) : c.myOpenAttemptId ? (
          <span className="inline-flex items-center gap-1.5">
            <CircleDashed className="size-3.5" /> in progress
          </span>
        ) : (
          <span className="text-muted-foreground/60">not attempted</span>
        )}
        {c.teamSubmitted > 0 && (
          <span
            className="text-muted-foreground/70"
            title={`${c.teamPassed} of ${c.teamSubmitted} team attempts within the bar`}
          >
            · team {c.teamPassed}/{c.teamSubmitted}
          </span>
        )}
      </div>

      {c.myOpenAttemptId ? (
        <Button
          size="sm"
          onClick={() => router.push(`/assessments/calibration/${c.slug}?attempt=${c.myOpenAttemptId}`)}
        >
          Resume
        </Button>
      ) : (
        <Button size="sm" variant={best ? "outline" : "default"} onClick={() => void start()} disabled={busy}>
          {best ? (
            <>
              <RotateCcw className="size-3.5" /> Retake
            </>
          ) : (
            <>
              <Play className="size-3.5" /> Score blind
            </>
          )}
        </Button>
      )}
    </li>
  );
}

export function CalibrationList({
  cases,
  trainees,
}: {
  cases: CalibrationCaseSummary[];
  trainees: TraineeSummary[];
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[color:var(--color-brand-electric)]">
          Cases
        </h2>
        <ul className="mt-1 divide-y divide-border/50">
          {cases.map((c) => (
            <CaseRow key={c.slug} c={c} />
          ))}
        </ul>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="rounded-xl bg-[color:var(--color-brand-slate)]/40 px-4 py-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[color:var(--color-brand-electric)]">
            The bar
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-[12px] leading-snug text-muted-foreground">
            <li>Within ±1 of the key on 27 of 30</li>
            <li>Exact on 18 or more</li>
            <li>Same pillar ranking</li>
            <li>Evidence label within one step on 27 of 30</li>
            <li>No score without a note</li>
            <li>Same Primary Constraint — a reviewer judges it</li>
          </ul>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground/80">
            Certification to run a real engagement: the key case plus two cohort cases within the bar,
            reviewed by a founder. Disagreements of 2+ go in the rubric changelog.
          </p>
        </div>

        <div className="rounded-xl bg-[color:var(--color-brand-slate)]/40 px-4 py-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[color:var(--color-brand-electric)]">
            Team record
          </h2>
          {trainees.length === 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">No attempts submitted yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border/40">
              {trainees.map((t) => (
                <li key={t.trainee_id} className="flex items-baseline justify-between gap-3 py-1.5 text-[12px]">
                  <span className="min-w-0 truncate font-medium">{t.trainee_name ?? "Unnamed"}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {t.passed}/{t.submitted} within the bar
                    {t.mean_within_one !== null ? ` · avg ${t.mean_within_one.toFixed(1)}/30` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
