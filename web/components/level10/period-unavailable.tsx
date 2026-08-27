"use client";

import { Info } from "lucide-react";

import { GHL_ROW_CAP_FIX_DATE } from "./weeks";

/**
 * The honest state of the Monthly / Quarterly / Annual tabs.
 *
 * Ninety.io has these tabs, so the tab bar keeps them — but they are not
 * rendered, because there is nothing truthful to render yet and a scorecard
 * that shows a fabricated roll-up is worse than one that admits a gap. Two
 * things are genuinely missing, and both are stated here rather than papered
 * over:
 *
 *  1. **No period goals.** `kpis.target` is a *weekly* number. Turning it into
 *     a monthly or annual target means multiplying it by something — and for a
 *     running level like MRR that multiplication is meaningless. Inventing the
 *     denominator would make every one of these cells a guess wearing the
 *     styling of a fact.
 *  2. **Not enough trustworthy history.** The counts below are live, so this
 *     panel stops being an excuse and starts being a progress bar the moment
 *     the weeks accumulate.
 */

export type UnavailablePeriod = "Monthly" | "Quarterly" | "Annual";

const NEEDED_WEEKS: Record<UnavailablePeriod, number> = {
  Monthly: 8,
  Quarterly: 26,
  Annual: 52,
};

const PERIOD_UNIT: Record<UnavailablePeriod, string> = {
  Monthly: "two clean months",
  Quarterly: "two clean quarters",
  Annual: "a full year",
};

interface PeriodUnavailableProps {
  period: UnavailablePeriod;
  /** Weeks that hold a number at all. */
  recordedWeeks: number;
  /** Weeks whose number is trustworthy — post-row-cap-fix or hand-corrected. */
  usableWeeks: number;
}

export function PeriodUnavailable({
  period,
  recordedWeeks,
  usableWeeks,
}: PeriodUnavailableProps) {
  const needed = NEEDED_WEEKS[period];
  const capped = Math.max(recordedWeeks - usableWeeks, 0);

  return (
    <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-charcoal)] p-6">
      <div className="flex gap-3">
        <Info className="mt-0.5 size-4 shrink-0 text-[color:var(--color-brand-mist)]" />
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">
              {period} isn&apos;t built yet — and shouldn&apos;t be faked
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              A {period.toLowerCase()} view needs {period.toLowerCase()} goals
              and {PERIOD_UNIT[period]} of trustworthy weeks. Neither exists yet,
              so this tab shows nothing rather than a roll-up nobody should act
              on.
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <dt className="text-[color:var(--color-brand-mist)]">
                Weeks recorded
              </dt>
              <dd className="font-data tabular-nums text-base font-semibold">
                {recordedWeeks}
              </dd>
            </div>
            <div>
              <dt className="text-[color:var(--color-brand-mist)]">
                Of those, trustworthy
              </dt>
              <dd className="font-data tabular-nums text-base font-semibold">
                {usableWeeks}
              </dd>
            </div>
            <div>
              <dt className="text-[color:var(--color-brand-mist)]">
                Needed for {period.toLowerCase()}
              </dt>
              <dd className="font-data tabular-nums text-base font-semibold text-[color:var(--color-brand-mist)]">
                ~{needed}
              </dd>
            </div>
          </dl>

          <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground/80">
              What would turn this on
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                A {period.toLowerCase()} goal per KPI. Today a KPI carries one
                weekly target, and multiplying it up is a guess for anything
                that isn&apos;t a per-week count.
              </li>
              <li>
                A stated rule per KPI for how weeks roll up — sum, average, or
                last reading. The Weekly grid infers this from the KPI&apos;s
                unit and name; a period view needs it recorded, not inferred.
              </li>
              {capped > 0 && (
                <li>
                  {capped} of the {recordedWeeks} recorded{" "}
                  {capped === 1 ? "week is" : "weeks are"} from before the{" "}
                  {GHL_ROW_CAP_FIX_DATE} row-cap fix. Correcting those cells on
                  the Weekly tab makes them count again.
                </li>
              )}
              <li>
                Then simply time: {Math.max(needed - usableWeeks, 0)} more clean{" "}
                {Math.max(needed - usableWeeks, 0) === 1 ? "week" : "weeks"} of
                entry.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
