/**
 * The comparison: the trainee's thirty against the key's thirty, with the
 * key's note and "why not one higher" beside every indicator. Server-safe —
 * no hooks — so the page can render a stored result without shipping the key
 * to the browser as state.
 *
 * The number that matters is not the composite; it is where the two people
 * disagreed by two or more. Those rows are the agenda for the next rubric
 * session, so they are lit first and listed at the top.
 */

import { cn } from "@/lib/utils";
import {
  EVIDENCE_SHORT,
  INDICATORS_BY_PILLAR,
  PILLARS,
  SCALE_LABELS,
} from "@/lib/assessment-instrument";
import { OVERLAY_FLAGS } from "@/lib/assessment-instrument";
import type {
  CalibrationAnswers,
  CalibrationKey,
  CalibrationResult,
} from "@/lib/calibration";

function evidenceLabel(v: string): string {
  return EVIDENCE_SHORT[v] ?? v;
}

function Stat({
  label,
  value,
  bar,
  ok,
}: {
  label: string;
  value: string;
  bar: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-lg bg-[color:var(--color-brand-slate)]/50 px-3.5 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums leading-none",
          ok ? "text-[color:var(--color-brand-success)]" : "text-[color:var(--color-brand-warning)]"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{bar}</p>
    </div>
  );
}

function ScoreCell({ score, na }: { score: number | null; na: boolean }) {
  return (
    <span className="font-semibold tabular-nums">
      {na ? "N/A" : score ?? "—"}
    </span>
  );
}

export function CalibrationResults({
  answers,
  result,
  caseKey,
  traineeName,
}: {
  answers: CalibrationAnswers;
  result: CalibrationResult;
  caseKey: CalibrationKey;
  traineeName: string | null;
}) {
  const { stats, items, rule } = result;
  const disagreements = Object.entries(items).filter(([, it]) => !it.within_one);
  const overlayLabel = (k: string) => OVERLAY_FLAGS.find((f) => f.key === k)?.label ?? k;

  return (
    <div className="flex flex-col gap-8">
      {/* Verdict */}
      <section
        className={cn(
          "rounded-xl px-5 py-4 ring-1 ring-inset",
          stats.pass
            ? "bg-[color:var(--color-brand-success)]/10 ring-[color:var(--color-brand-success)]/30"
            : "bg-[color:var(--color-brand-warning)]/8 ring-[color:var(--color-brand-warning)]/30"
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {traineeName ? `${traineeName} · ` : ""}result
        </p>
        <p className="mt-1 text-lg font-semibold">
          {stats.pass ? "Within the calibration bar." : "Not yet within the calibration bar."}
        </p>
        <p className="mt-1 max-w-[70ch] text-[12.5px] leading-relaxed text-muted-foreground">
          Your composite {stats.your_score ?? "—"} against the key&apos;s {stats.key_score ?? "—"}
          {caseKey.band ? ` (${caseKey.band})` : ""}. A disagreement of two or more points is not a
          fail by itself — it is the agenda for the next rubric session. Write those rows into the
          rubric changelog with the reasoning on both sides.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Within ±1"
            value={`${stats.within_one}/${stats.total}`}
            bar={`bar ${rule.within_one_min}`}
            ok={stats.within_one >= rule.within_one_min}
          />
          <Stat
            label="Exact"
            value={`${stats.exact}/${stats.total}`}
            bar={`bar ${rule.exact_min}`}
            ok={stats.exact >= rule.exact_min}
          />
          <Stat
            label="Evidence within a step"
            value={`${stats.evidence_within_one}/${stats.total}`}
            bar={`bar ${rule.evidence_within_one_min}`}
            ok={stats.evidence_within_one >= rule.evidence_within_one_min}
          />
          <Stat
            label="Scores without a note"
            value={String(stats.notes_missing)}
            bar="bar 0"
            ok={stats.notes_missing <= rule.notes_missing_max}
          />
          <Stat
            label="Pillar ranking"
            value={stats.pillar_ranking_match ? "Same" : "Differs"}
            bar="must match"
            ok={stats.pillar_ranking_match}
          />
          <Stat
            label="Mean deviation"
            value={stats.mad === null ? "—" : stats.mad.toFixed(2)}
            bar="points per indicator"
            ok={(stats.mad ?? 9) <= 0.5}
          />
        </div>
      </section>

      {/* Pillars */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[color:var(--color-brand-electric)]">
          Pillar scores
        </h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {PILLARS.map((p) => {
            const yours = stats.your_pillars[p.key];
            const theirs = stats.key_pillars[p.key];
            return (
              <div key={p.key} className="flex items-baseline justify-between rounded-lg bg-[color:var(--color-brand-slate)]/40 px-3.5 py-2.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.07em]">{p.label}</span>
                <span className="text-[13px] tabular-nums">
                  <span className="font-semibold">{yours ?? "—"}</span>
                  <span className="mx-1.5 text-muted-foreground/60">vs key</span>
                  <span className="font-semibold">{theirs ?? "—"}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Disagreements first */}
      {disagreements.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[color:var(--color-brand-warning)]">
            Two or more apart — the calibration agenda ({disagreements.length})
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {disagreements.map(([key, it]) => {
              const ind = PILLARS.flatMap((p) => INDICATORS_BY_PILLAR[p.key]).find((i) => i.key === key)!;
              const k = caseKey.scores[key];
              return (
                <li key={key} className="rounded-lg bg-[color:var(--color-brand-warning)]/8 px-3.5 py-2.5 ring-1 ring-inset ring-[color:var(--color-brand-warning)]/25">
                  <p className="text-[13px] font-medium">
                    <span className="mr-2 font-mono text-[11px] text-muted-foreground">{key}</span>
                    {ind.label}
                    <span className="ml-3 tabular-nums">
                      you <ScoreCell score={it.yours} na={it.yours_na} /> · key{" "}
                      <ScoreCell score={it.key} na={it.key_na} />
                    </span>
                  </p>
                  {k?.note && (
                    <p className="mt-1 text-[12px] leading-snug text-foreground/85">
                      <span className="text-muted-foreground">Key: </span>
                      {k.note}
                    </p>
                  )}
                  {k?.why_not_higher && (
                    <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                      <span className="text-muted-foreground/70">Why not one higher: </span>
                      {k.why_not_higher}
                    </p>
                  )}
                  {answers.scores[key as keyof typeof answers.scores]?.note && (
                    <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                      <span className="text-muted-foreground/70">You wrote: </span>
                      {answers.scores[key as keyof typeof answers.scores]?.note}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* All thirty */}
      {PILLARS.map((p) => (
        <section key={p.key}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[color:var(--color-brand-electric)]">
            {p.label}
            <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
              {p.question}
            </span>
          </h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12px]">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="py-1.5 pr-3 font-semibold">Indicator</th>
                  <th className="py-1.5 pr-3 text-center font-semibold">You</th>
                  <th className="py-1.5 pr-3 text-center font-semibold">Key</th>
                  <th className="py-1.5 pr-3 text-center font-semibold">Δ</th>
                  <th className="py-1.5 pr-3 text-center font-semibold">Evidence</th>
                  <th className="py-1.5 font-semibold">The key&apos;s note</th>
                </tr>
              </thead>
              <tbody>
                {INDICATORS_BY_PILLAR[p.key].map((ind) => {
                  const it = items[ind.key];
                  const k = caseKey.scores[ind.key];
                  const a = answers.scores[ind.key];
                  if (!it) return null;
                  return (
                    <tr
                      key={ind.key}
                      className={cn(
                        "border-t border-border/40 align-top",
                        !it.within_one && "bg-[color:var(--color-brand-warning)]/6"
                      )}
                    >
                      <td className="py-2 pr-3">
                        <span className="mr-1.5 font-mono text-[10.5px] text-muted-foreground/70">{ind.key}</span>
                        {ind.label}
                        {!it.has_note && (
                          <span className="ml-2 rounded bg-[color:var(--color-brand-warning)]/15 px-1 py-0.5 text-[10px] font-medium text-[color:var(--color-brand-warning)]">
                            no note
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <ScoreCell score={it.yours} na={it.yours_na} />
                      </td>
                      <td className="py-2 pr-3 text-center">
                        <ScoreCell score={it.key} na={it.key_na} />
                        {it.key !== null && (
                          <span className="block text-[10px] text-muted-foreground/70">{SCALE_LABELS[it.key]}</span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-3 text-center font-semibold tabular-nums",
                          it.exact
                            ? "text-[color:var(--color-brand-success)]"
                            : it.within_one
                              ? "text-foreground"
                              : "text-[color:var(--color-brand-warning)]"
                        )}
                      >
                        {it.delta === null ? (it.exact ? "0" : "N/A") : it.delta > 0 ? `+${it.delta}` : String(it.delta)}
                      </td>
                      <td className="py-2 pr-3 text-center tabular-nums">
                        <span className={cn(it.evidence_steps > 1 && "text-[color:var(--color-brand-warning)]")}>
                          {evidenceLabel(it.your_evidence)}
                        </span>
                        <span className="mx-1 text-muted-foreground/50">/</span>
                        {evidenceLabel(it.key_evidence)}
                      </td>
                      <td className="py-2">
                        <p className="leading-snug text-foreground/85">{k?.note}</p>
                        {k?.why_not_higher && (
                          <p className="mt-0.5 leading-snug text-muted-foreground">
                            <span className="text-muted-foreground/70">Why not one higher: </span>
                            {k.why_not_higher}
                          </p>
                        )}
                        {a?.note && (
                          <p className="mt-0.5 leading-snug text-muted-foreground/80">
                            <span className="text-muted-foreground/60">You: </span>
                            {a.note}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* The judgement calls */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-[color:var(--color-brand-slate)]/40 px-4 py-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[color:var(--color-brand-electric)]">
            Primary Business Constraint
          </h3>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">You</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed">
            {answers.primary_constraint.trim() || <span className="text-muted-foreground">— not named —</span>}
          </p>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Key</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed">{caseKey.assessment.primary_constraint ?? "—"}</p>
          {caseKey.assessment.constraint_symptoms && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              <span className="text-muted-foreground/70">Shows up in: </span>
              {caseKey.assessment.constraint_symptoms}
            </p>
          )}
          {caseKey.assessment.owner_belief && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              <span className="text-muted-foreground/70">Owner&apos;s belief: </span>
              &ldquo;{caseKey.assessment.owner_belief}&rdquo;
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground/80">
            Same root cause, different words, is a pass. A symptom in place of the root is not — a reviewer decides.
          </p>
        </div>
        <div className="rounded-xl bg-[color:var(--color-brand-slate)]/40 px-4 py-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[color:var(--color-brand-electric)]">
            Early Momentum Initiative
          </h3>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">You</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed">
            {answers.momentum_initiative.trim() || <span className="text-muted-foreground">— not named —</span>}
          </p>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Key</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed">{caseKey.assessment.momentum_initiative ?? "—"}</p>
          {caseKey.assessment.overlay_flags && caseKey.assessment.overlay_flags.length > 0 && (
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
              <span className="text-muted-foreground/70">Overlay flags in the key: </span>
              {caseKey.assessment.overlay_flags.map(overlayLabel).join(" · ")}
            </p>
          )}
          {caseKey.edge_cases.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                What this case was built to test
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {caseKey.edge_cases.map((e) => (
                  <li key={e} className="flex gap-2 text-[11.5px] leading-snug text-muted-foreground">
                    <span aria-hidden className="mt-[6px] size-1 shrink-0 rounded-full bg-[color:var(--color-brand-mist)]/60" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
