/**
 * Opportunity range calculators — how a priced finding gets its low, expected
 * and high, in arithmetic anyone in the room can follow.
 *
 * Three rules this module exists to enforce, because the hand-typed ranges it
 * replaces broke all three at least once:
 *
 *   1. **Every dollar out is OPERATING PROFIT.** Recovered revenue is never the
 *      answer. Revenue passes through gross margin to contribution, then
 *      through any incremental delivery cost, and only what survives is
 *      printed. The sample report booked a $85,000 revenue lift as profit; on
 *      a 38%-margin business that overstated the finding by $52,700.
 *   2. **Low / expected / high come from three stated scenarios**, never from a
 *      multiplier hidden in the code. If the range is ±40%, an advisor typed
 *      the three lift figures that make it ±40% and can defend each one.
 *   3. **Recovered hours are only dollars if they are redeployed or removed.**
 *      `automation_hours` returns zero dollars and a capacity figure otherwise.
 *
 * `chain` is the printed arithmetic: one line per step, real numbers, no
 * symbols. It goes into the report's Appendix B verbatim, so a client can
 * re-derive the number without us in the room.
 *
 * Pure module — no React, no I/O, no Supabase. Safe to unit-test.
 *
 * // worked examples — Summit Exterior (baseline: revenue $1,700,000,
 * // gross margin 38%, operating profit $204,000)
 * //
 * // close_rate_lift  quoted volume $1,700,000, close 35%, lift 3 / 5 / 8 pts,
 * //                  margin 38%, incremental cost 0%
 * //   expected: $1,700,000 × 5.0 pts = $85,000 revenue
 * //             × 38% margin        = $32,300 contribution
 * //             − $0 incremental    = $32,300 operating profit  ← NOT $85,000
 * //   low $19,380 · expected $32,300 · high $51,680
 * //
 * // price_change     affected revenue $1,700,000, price +2 / +3 / +5%,
 * //                  volume loss 0.5 / 1 / 2%, margin 38%
 * //   expected: $1,700,000 × 99.0% retained × 3.0% = $50,490 price uplift
 * //             − $17,000 forgone × 38%            = $6,460 contribution lost
 * //             = $44,030 operating profit
 * //   low $30,600 · expected $44,030 · high $70,380
 * //
 * // reactivation     400 dormant customers, 5 / 8 / 12%, $4,000 average
 * //                  annual value, margin 38%
 * //   expected: 32 customers × $4,000 = $128,000 revenue × 38% = $48,640
 * //   low $30,400 · expected $48,640 · high $72,960
 * //
 * // response_time    1,200 leads/yr, 25% lost or slow, recovery 20 / 35 / 50%,
 * //                  close 35%, first-year value $6,500, margin 38%
 * //   expected: 300 lost × 35% = 105 recovered × 35% close = 36.75 customers
 * //             × $6,500 = $238,875 revenue × 38% = $90,773
 * //   low $51,870 · expected $90,773 · high $129,675
 * //
 * // automation_hours 12 h/week, $45/h loaded, automated 40 / 60 / 80%,
 * //                  52 weeks, redeployed = true
 * //   expected: 12 × 60% = 7.2 h/week × 52 = 374.4 h/yr × $45 = $16,848
 * //   low $11,232 · expected $16,848 · high $22,464, capacity 7.2 h/week
 * //   redeployed = false ⇒ $0 / $0 / $0, capacity 7.2 h/week (capacity only)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Baseline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The three engine figures from the assessment. Any of them may be null — the
 * owner has not given us a P&L yet — and a calculator that needs one it does
 * not have refuses by name rather than quietly modelling on a zero.
 */
export interface CalcBaseline {
  /** Annual revenue, dollars. */
  annualRevenue: number | null;
  /** Gross margin as a percentage: 38 means 38%. */
  grossMarginPct: number | null;
  /** Annual operating profit, dollars. */
  operatingProfit: number | null;
}

export const EMPTY_BASELINE: CalcBaseline = {
  annualRevenue: null,
  grossMarginPct: null,
  operatingProfit: null,
};

export type BaselineKey = keyof CalcBaseline;

const BASELINE_LABELS: Record<BaselineKey, string> = {
  annualRevenue: "annual revenue",
  grossMarginPct: "gross margin %",
  operatingProfit: "operating profit",
};

// ─────────────────────────────────────────────────────────────────────────────
// Typed inputs, one interface per kind
// ─────────────────────────────────────────────────────────────────────────────

export interface CloseRateLiftInputs {
  /** Proposals / quotes issued per year, in dollars of quoted work. */
  quotedVolume: number;
  /** What share of that quoted volume closes today. */
  currentClosePct: number;
  liftPointsLow: number;
  liftPointsExpected: number;
  liftPointsHigh: number;
  grossMarginPct: number;
  /** Extra delivery cost the added work carries beyond normal COGS. */
  incrementalCostPct: number;
}

export interface PriceChangeInputs {
  /** The slice of revenue the new price actually touches. */
  revenueAffected: number;
  priceChangePctLow: number;
  priceChangePctExpected: number;
  priceChangePctHigh: number;
  volumeLossPctLow: number;
  volumeLossPctExpected: number;
  volumeLossPctHigh: number;
  grossMarginPct: number;
}

export interface ReactivationInputs {
  dormantCustomers: number;
  reactivationRatePctLow: number;
  reactivationRatePctExpected: number;
  reactivationRatePctHigh: number;
  averageAnnualValue: number;
  grossMarginPct: number;
}

export interface ResponseTimeInputs {
  leadsPerYear: number;
  /** Share of those leads currently lost or answered too slowly to win. */
  shareLostPct: number;
  recoveryRatePctLow: number;
  recoveryRatePctExpected: number;
  recoveryRatePctHigh: number;
  closePct: number;
  averageFirstYearValue: number;
  grossMarginPct: number;
}

export interface AutomationHoursInputs {
  hoursPerWeek: number;
  loadedHourlyRate: number;
  automationSharePctLow: number;
  automationSharePctExpected: number;
  automationSharePctHigh: number;
  weeksPerYear: number;
  /**
   * True only when the freed hours are actually sold, redeployed onto revenue
   * work, or removed from payroll. False = capacity, not money.
   */
  redeployed: boolean;
}

export interface CalcInputMap {
  close_rate_lift: CloseRateLiftInputs;
  price_change: PriceChangeInputs;
  reactivation: ReactivationInputs;
  response_time: ResponseTimeInputs;
  automation_hours: AutomationHoursInputs;
}

export type CalcKind = keyof CalcInputMap;

export const CALC_KINDS: CalcKind[] = [
  "close_rate_lift",
  "price_change",
  "reactivation",
  "response_time",
  "automation_hours",
];

/** Loose shape the editor collects before it is narrowed to a typed input. */
export type RawCalcInputs = Record<string, number | boolean>;

// ─────────────────────────────────────────────────────────────────────────────
// Metadata — what the editor renders
// ─────────────────────────────────────────────────────────────────────────────

export type CalcFieldUnit = "usd" | "pct" | "points" | "hours" | "count" | "none";

export interface CalcField {
  key: string;
  label: string;
  unit: CalcFieldUnit;
  help?: string;
  /** Boolean fields render as a tick, not a number box. */
  boolean?: boolean;
  /** Which of the three scenarios this field feeds, when it is one of a trio. */
  scenario?: "low" | "expected" | "high";
  /** Prefill from the assessment's engine figures when we have them. */
  baselineDefault?: BaselineKey;
  /** Prefill constant when there is no baseline to take it from. */
  defaultValue?: number;
}

export interface CalculatorMeta {
  kind: CalcKind;
  label: string;
  description: string;
  /** Baseline figures this calculator prefills from, named in refusals. */
  usesBaseline: BaselineKey[];
  fields: CalcField[];
}

/** Compile-time check that every field key exists on the kind's input type. */
function fieldsFor<K extends CalcKind>(
  list: Array<CalcField & { key: keyof CalcInputMap[K] & string }>
): CalcField[] {
  return list;
}

const MARGIN_HELP =
  "Contribution margin on the added work. Every dollar below is run through this — the output is profit, not revenue.";

export const CALCULATORS: Record<CalcKind, CalculatorMeta> = {
  close_rate_lift: {
    kind: "close_rate_lift",
    label: "Close-rate lift",
    description:
      "They already quote the work — a higher share of the same proposal volume closes. Priced off quoted dollars, not total revenue.",
    usesBaseline: ["grossMarginPct"],
    fields: fieldsFor<"close_rate_lift">([
      {
        key: "quotedVolume",
        label: "Quoted volume",
        unit: "usd",
        help: "Dollars of proposals issued per year — not revenue booked.",
      },
      {
        key: "currentClosePct",
        label: "Current close rate",
        unit: "pct",
        help: "Where they are today. Current + high lift cannot exceed 100%.",
      },
      { key: "liftPointsLow", label: "Lift — low", unit: "points", scenario: "low" },
      {
        key: "liftPointsExpected",
        label: "Lift — expected",
        unit: "points",
        scenario: "expected",
        help: "Percentage POINTS added to the close rate, e.g. 35% → 40% is 5 points.",
      },
      { key: "liftPointsHigh", label: "Lift — high", unit: "points", scenario: "high" },
      {
        key: "grossMarginPct",
        label: "Gross margin",
        unit: "pct",
        baselineDefault: "grossMarginPct",
        help: MARGIN_HELP,
      },
      {
        key: "incrementalCostPct",
        label: "Incremental delivery cost",
        unit: "pct",
        defaultValue: 0,
        help: "Extra cost the added work carries beyond normal COGS — overtime, subs, a hire. Percentage of the added revenue.",
      },
    ]),
  },

  price_change: {
    kind: "price_change",
    label: "Price change",
    description:
      "A price move flows almost entirely to contribution — minus the contribution on whatever volume walks.",
    usesBaseline: ["grossMarginPct", "annualRevenue"],
    fields: fieldsFor<"price_change">([
      {
        key: "revenueAffected",
        label: "Revenue affected",
        unit: "usd",
        baselineDefault: "annualRevenue",
        help: "Only the revenue the new price actually touches — one line, one segment, or all of it.",
      },
      {
        key: "priceChangePctLow",
        label: "Price change — low",
        unit: "pct",
        scenario: "low",
      },
      {
        key: "priceChangePctExpected",
        label: "Price change — expected",
        unit: "pct",
        scenario: "expected",
      },
      {
        key: "priceChangePctHigh",
        label: "Price change — high",
        unit: "pct",
        scenario: "high",
      },
      {
        key: "volumeLossPctLow",
        label: "Volume lost — low case",
        unit: "pct",
        scenario: "low",
        help: "Pair each price move with the volume you expect to lose at it.",
      },
      {
        key: "volumeLossPctExpected",
        label: "Volume lost — expected case",
        unit: "pct",
        scenario: "expected",
      },
      {
        key: "volumeLossPctHigh",
        label: "Volume lost — high case",
        unit: "pct",
        scenario: "high",
      },
      {
        key: "grossMarginPct",
        label: "Gross margin",
        unit: "pct",
        baselineDefault: "grossMarginPct",
        help: "Used for the contribution lost with the departed volume. The price uplift itself carries no extra cost.",
      },
    ]),
  },

  reactivation: {
    kind: "reactivation",
    label: "Dormant customer reactivation",
    description:
      "Customers who already bought once. No acquisition cost, so the whole contribution is new profit.",
    usesBaseline: ["grossMarginPct"],
    fields: fieldsFor<"reactivation">([
      {
        key: "dormantCustomers",
        label: "Dormant customers",
        unit: "count",
        help: "Bought before, nothing in the window they consider normal.",
      },
      {
        key: "reactivationRatePctLow",
        label: "Reactivation rate — low",
        unit: "pct",
        scenario: "low",
      },
      {
        key: "reactivationRatePctExpected",
        label: "Reactivation rate — expected",
        unit: "pct",
        scenario: "expected",
      },
      {
        key: "reactivationRatePctHigh",
        label: "Reactivation rate — high",
        unit: "pct",
        scenario: "high",
      },
      {
        key: "averageAnnualValue",
        label: "Average annual value",
        unit: "usd",
        help: "What one reactivated customer buys in the first year.",
      },
      {
        key: "grossMarginPct",
        label: "Gross margin",
        unit: "pct",
        baselineDefault: "grossMarginPct",
        help: MARGIN_HELP,
      },
    ]),
  },

  response_time: {
    kind: "response_time",
    label: "Response time — leads recovered",
    description:
      "Leads that arrive and die on the vine. Recover a share of them, close them at the rate they already close.",
    usesBaseline: ["grossMarginPct"],
    fields: fieldsFor<"response_time">([
      { key: "leadsPerYear", label: "Leads per year", unit: "count" },
      {
        key: "shareLostPct",
        label: "Currently lost or slow",
        unit: "pct",
        help: "Share of those leads never answered, or answered too late to win.",
      },
      {
        key: "recoveryRatePctLow",
        label: "Recovery rate — low",
        unit: "pct",
        scenario: "low",
      },
      {
        key: "recoveryRatePctExpected",
        label: "Recovery rate — expected",
        unit: "pct",
        scenario: "expected",
        help: "Of the lost leads, the share the fix actually gets to in time.",
      },
      {
        key: "recoveryRatePctHigh",
        label: "Recovery rate — high",
        unit: "pct",
        scenario: "high",
      },
      {
        key: "closePct",
        label: "Close rate",
        unit: "pct",
        help: "Their existing close rate on leads they do reach. Do not inflate it here.",
      },
      {
        key: "averageFirstYearValue",
        label: "Average first-year value",
        unit: "usd",
      },
      {
        key: "grossMarginPct",
        label: "Gross margin",
        unit: "pct",
        baselineDefault: "grossMarginPct",
        help: MARGIN_HELP,
      },
    ]),
  },

  automation_hours: {
    kind: "automation_hours",
    label: "Automation — hours recovered",
    description:
      "Hours a build takes off someone's week. Dollars ONLY if those hours are sold, redeployed onto revenue work, or removed from payroll — otherwise this is capacity, and the report says capacity.",
    usesBaseline: [],
    fields: fieldsFor<"automation_hours">([
      {
        key: "hoursPerWeek",
        label: "Hours per week on the task",
        unit: "hours",
      },
      {
        key: "loadedHourlyRate",
        label: "Loaded hourly rate",
        unit: "usd",
        help: "Wage plus taxes, benefits and overhead — what the hour actually costs.",
      },
      {
        key: "automationSharePctLow",
        label: "Automated — low",
        unit: "pct",
        scenario: "low",
      },
      {
        key: "automationSharePctExpected",
        label: "Automated — expected",
        unit: "pct",
        scenario: "expected",
        help: "Share of those hours the build removes. Almost never 100%.",
      },
      {
        key: "automationSharePctHigh",
        label: "Automated — high",
        unit: "pct",
        scenario: "high",
      },
      {
        key: "weeksPerYear",
        label: "Weeks per year",
        unit: "count",
        defaultValue: 52,
      },
      {
        key: "redeployed",
        label: "Those hours are redeployed or removed",
        unit: "none",
        boolean: true,
        help: "Untick and the dollar range is $0 — the finding stands as capacity only.",
      },
    ]),
  },
};

export const CALCULATOR_LIST: CalculatorMeta[] = CALC_KINDS.map(
  (k) => CALCULATORS[k]
);

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────

export interface CalcOutputs {
  low: number;
  expected: number;
  high: number;
  /** The printed arithmetic, one line per step. */
  chain: string[];
  /** Always returned by automation_hours; undefined elsewhere. */
  capacityHoursWeekly?: number;
}

export type ComputeResult =
  | ({ ok: true } & CalcOutputs)
  | { ok: false; error: string };

/**
 * The stored `calc` JSONB. `outputs` is the range as computed — before the
 * report's Reported-only widening, which is applied downstream and stated
 * separately so the two adjustments never get confused for one another.
 */
export interface CalcRecord {
  kind: CalcKind;
  inputs: RawCalcInputs;
  outputs: {
    low: number;
    expected: number;
    high: number;
    capacityHoursWeekly?: number;
  };
  chain: string[];
  /** ISO-8601. */
  computed_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers (module-local — the report has its own)
// ─────────────────────────────────────────────────────────────────────────────

const usd = (n: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));

const num = (n: number, decimals = 1): string =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
  }).format(n);

const pct = (n: number): string => `${num(n)}%`;

/** Percentage POINTS always print a decimal, so "5.0 pts" never reads as 5%. */
const pts = (n: number): string =>
  `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n)} pts`;

const round2 = (n: number): number => Math.round(n * 100) / 100;

const dollars = (n: number): number => Math.round(n);

// ─────────────────────────────────────────────────────────────────────────────
// Input reading
// ─────────────────────────────────────────────────────────────────────────────

class InputError extends Error {}

function readerFor(kind: CalcKind, inputs: RawCalcInputs) {
  const meta = CALCULATORS[kind];
  const labelOf = (key: string) =>
    meta.fields.find((f) => f.key === key)?.label ?? key;

  return {
    n(key: string, opts?: { min?: number; max?: number }): number {
      const raw = inputs[key];
      const value = typeof raw === "boolean" ? NaN : Number(raw);
      if (raw === undefined || raw === null || !Number.isFinite(value)) {
        const field = meta.fields.find((f) => f.key === key);
        if (field?.baselineDefault) {
          throw new InputError(
            `${labelOf(key)} is needed and this assessment has no ${
              BASELINE_LABELS[field.baselineDefault]
            } on file — record it in the session step, or type it here.`
          );
        }
        throw new InputError(`${labelOf(key)} is required.`);
      }
      if (opts?.min !== undefined && value < opts.min) {
        throw new InputError(
          `${labelOf(key)} cannot be below ${num(opts.min)}.`
        );
      }
      if (opts?.max !== undefined && value > opts.max) {
        throw new InputError(
          `${labelOf(key)} cannot be above ${num(opts.max)}.`
        );
      }
      return value;
    },
    b(key: string): boolean {
      return inputs[key] === true;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The calculators
// ─────────────────────────────────────────────────────────────────────────────

function closeRateLift(inputs: RawCalcInputs): CalcOutputs {
  const r = readerFor("close_rate_lift", inputs);
  const quoted = r.n("quotedVolume", { min: 0 });
  const current = r.n("currentClosePct", { min: 0, max: 100 });
  const margin = r.n("grossMarginPct", { min: 0, max: 100 });
  const incremental = r.n("incrementalCostPct", { min: 0, max: 100 });
  const lifts = {
    low: r.n("liftPointsLow", { min: 0, max: 100 }),
    expected: r.n("liftPointsExpected", { min: 0, max: 100 }),
    high: r.n("liftPointsHigh", { min: 0, max: 100 }),
  };
  if (current + lifts.high > 100) {
    throw new InputError(
      `Close rate ${pct(current)} + high lift ${pts(
        lifts.high
      )} is above 100% — no more volume exists to close.`
    );
  }

  const profitAt = (points: number) => {
    const revenue = quoted * (points / 100);
    const contribution = revenue * (margin / 100);
    const cost = revenue * (incremental / 100);
    return { revenue, contribution, cost, profit: contribution - cost };
  };

  const e = profitAt(lifts.expected);
  const chain = [
    `Close rate ${pct(current)} → ${pct(
      current + lifts.expected
    )} on quoted volume ${usd(quoted)} (+${pts(lifts.expected)})`,
    `Quoted volume ${usd(quoted)} × close-rate lift ${pts(
      lifts.expected
    )} = ${usd(e.revenue)} revenue`,
    `× gross margin ${pct(margin)} = ${usd(e.contribution)} contribution`,
    `− incremental delivery cost ${pct(incremental)} (${usd(
      e.cost
    )}) = ${usd(e.profit)} operating profit`,
    `Scenarios ${pts(lifts.low)} / ${pts(lifts.expected)} / ${pts(
      lifts.high
    )} = ${usd(profitAt(lifts.low).profit)} low · ${usd(
      e.profit
    )} expected · ${usd(profitAt(lifts.high).profit)} high`,
  ];

  return {
    low: dollars(profitAt(lifts.low).profit),
    expected: dollars(e.profit),
    high: dollars(profitAt(lifts.high).profit),
    chain,
  };
}

function priceChange(inputs: RawCalcInputs): CalcOutputs {
  const r = readerFor("price_change", inputs);
  const affected = r.n("revenueAffected", { min: 0 });
  const margin = r.n("grossMarginPct", { min: 0, max: 100 });
  const prices = {
    low: r.n("priceChangePctLow", { min: -100, max: 100 }),
    expected: r.n("priceChangePctExpected", { min: -100, max: 100 }),
    high: r.n("priceChangePctHigh", { min: -100, max: 100 }),
  };
  const losses = {
    low: r.n("volumeLossPctLow", { min: 0, max: 100 }),
    expected: r.n("volumeLossPctExpected", { min: 0, max: 100 }),
    high: r.n("volumeLossPctHigh", { min: 0, max: 100 }),
  };

  /**
   * Price rides on the volume that stays; the volume that walks takes its
   * contribution with it. Cost of goods follows volume, not price, which is
   * why the uplift is not margined down.
   */
  const profitAt = (pricePct: number, lossPct: number) => {
    const retained = 1 - lossPct / 100;
    const retainedRevenue = affected * retained;
    const uplift = retainedRevenue * (pricePct / 100);
    const forgoneRevenue = affected * (lossPct / 100);
    const forgoneContribution = forgoneRevenue * (margin / 100);
    return {
      retainedRevenue,
      uplift,
      forgoneRevenue,
      forgoneContribution,
      profit: uplift - forgoneContribution,
    };
  };

  const e = profitAt(prices.expected, losses.expected);
  const l = profitAt(prices.low, losses.low);
  const h = profitAt(prices.high, losses.high);
  const chain = [
    `Revenue affected ${usd(affected)} × retained volume ${pct(
      100 - losses.expected
    )} = ${usd(e.retainedRevenue)} still sold`,
    `${usd(e.retainedRevenue)} × price change ${pct(
      prices.expected
    )} = ${usd(e.uplift)} price uplift (price carries no extra cost, so it lands whole)`,
    `Volume lost ${pct(losses.expected)} × ${usd(affected)} = ${usd(
      e.forgoneRevenue
    )} revenue forgone`,
    `${usd(e.forgoneRevenue)} × gross margin ${pct(margin)} = ${usd(
      e.forgoneContribution
    )} contribution lost`,
    `${usd(e.uplift)} − ${usd(e.forgoneContribution)} = ${usd(
      e.profit
    )} operating profit`,
    `Scenarios ${pct(prices.low)} at ${pct(losses.low)} loss / ${pct(
      prices.expected
    )} at ${pct(losses.expected)} / ${pct(prices.high)} at ${pct(
      losses.high
    )} = ${usd(l.profit)} low · ${usd(e.profit)} expected · ${usd(
      h.profit
    )} high`,
  ];

  return {
    low: dollars(l.profit),
    expected: dollars(e.profit),
    high: dollars(h.profit),
    chain,
  };
}

function reactivation(inputs: RawCalcInputs): CalcOutputs {
  const r = readerFor("reactivation", inputs);
  const dormant = r.n("dormantCustomers", { min: 0 });
  const value = r.n("averageAnnualValue", { min: 0 });
  const margin = r.n("grossMarginPct", { min: 0, max: 100 });
  const rates = {
    low: r.n("reactivationRatePctLow", { min: 0, max: 100 }),
    expected: r.n("reactivationRatePctExpected", { min: 0, max: 100 }),
    high: r.n("reactivationRatePctHigh", { min: 0, max: 100 }),
  };

  const profitAt = (ratePct: number) => {
    const customers = dormant * (ratePct / 100);
    const revenue = customers * value;
    return { customers, revenue, profit: revenue * (margin / 100) };
  };

  const e = profitAt(rates.expected);
  const chain = [
    `Dormant customers ${num(dormant, 0)} × reactivation rate ${pct(
      rates.expected
    )} = ${num(e.customers, 2)} customers`,
    `${num(e.customers, 2)} customers × average annual value ${usd(
      value
    )} = ${usd(e.revenue)} revenue`,
    `× gross margin ${pct(margin)} = ${usd(
      e.profit
    )} operating profit (no acquisition cost — they have bought before)`,
    `Scenarios ${pct(rates.low)} / ${pct(rates.expected)} / ${pct(
      rates.high
    )} = ${usd(profitAt(rates.low).profit)} low · ${usd(
      e.profit
    )} expected · ${usd(profitAt(rates.high).profit)} high`,
  ];

  return {
    low: dollars(profitAt(rates.low).profit),
    expected: dollars(e.profit),
    high: dollars(profitAt(rates.high).profit),
    chain,
  };
}

function responseTime(inputs: RawCalcInputs): CalcOutputs {
  const r = readerFor("response_time", inputs);
  const leads = r.n("leadsPerYear", { min: 0 });
  const shareLost = r.n("shareLostPct", { min: 0, max: 100 });
  const close = r.n("closePct", { min: 0, max: 100 });
  const value = r.n("averageFirstYearValue", { min: 0 });
  const margin = r.n("grossMarginPct", { min: 0, max: 100 });
  const rates = {
    low: r.n("recoveryRatePctLow", { min: 0, max: 100 }),
    expected: r.n("recoveryRatePctExpected", { min: 0, max: 100 }),
    high: r.n("recoveryRatePctHigh", { min: 0, max: 100 }),
  };

  const lostLeads = leads * (shareLost / 100);
  const profitAt = (recoveryPct: number) => {
    const recovered = lostLeads * (recoveryPct / 100);
    const customers = recovered * (close / 100);
    const revenue = customers * value;
    return { recovered, customers, revenue, profit: revenue * (margin / 100) };
  };

  const e = profitAt(rates.expected);
  const chain = [
    `Leads ${num(leads, 0)}/yr × lost or slow ${pct(shareLost)} = ${num(
      lostLeads
    )} leads never won`,
    `${num(lostLeads)} × recovery rate ${pct(rates.expected)} = ${num(
      e.recovered
    )} leads reached in time`,
    `${num(e.recovered)} × close rate ${pct(close)} = ${num(
      e.customers,
      2
    )} customers`,
    `${num(e.customers, 2)} × first-year value ${usd(value)} = ${usd(
      e.revenue
    )} revenue`,
    `× gross margin ${pct(margin)} = ${usd(e.profit)} operating profit`,
    `Scenarios ${pct(rates.low)} / ${pct(rates.expected)} / ${pct(
      rates.high
    )} recovery = ${usd(profitAt(rates.low).profit)} low · ${usd(
      e.profit
    )} expected · ${usd(profitAt(rates.high).profit)} high`,
  ];

  return {
    low: dollars(profitAt(rates.low).profit),
    expected: dollars(e.profit),
    high: dollars(profitAt(rates.high).profit),
    chain,
  };
}

function automationHours(inputs: RawCalcInputs): CalcOutputs {
  const r = readerFor("automation_hours", inputs);
  const hours = r.n("hoursPerWeek", { min: 0 });
  const rate = r.n("loadedHourlyRate", { min: 0 });
  const weeks = r.n("weeksPerYear", { min: 1, max: 53 });
  const redeployed = r.b("redeployed");
  const shares = {
    low: r.n("automationSharePctLow", { min: 0, max: 100 }),
    expected: r.n("automationSharePctExpected", { min: 0, max: 100 }),
    high: r.n("automationSharePctHigh", { min: 0, max: 100 }),
  };

  const hoursAt = (sharePct: number) => hours * (sharePct / 100);
  const dollarsAt = (sharePct: number) =>
    redeployed ? hoursAt(sharePct) * weeks * rate : 0;

  const capacityHoursWeekly = round2(hoursAt(shares.expected));
  const chain = [
    `${num(hours)} h/week × automated ${pct(
      shares.expected
    )} = ${num(capacityHoursWeekly)} h/week recovered`,
    redeployed
      ? `${num(capacityHoursWeekly)} h/week × ${num(
          weeks,
          0
        )} weeks = ${num(round2(capacityHoursWeekly * weeks))} h/yr`
      : `Those hours are NOT redeployed or removed — recovered time is only money once it is sold, moved onto revenue work, or taken off payroll. Dollar impact recorded as $0; this finding stands as capacity.`,
    redeployed
      ? `${num(round2(capacityHoursWeekly * weeks))} h/yr × loaded rate ${usd(
          rate
        )}/h = ${usd(dollarsAt(shares.expected))} operating profit`
      : `Capacity released: ${num(capacityHoursWeekly)} hours per week.`,
    `Scenarios ${pct(shares.low)} / ${pct(shares.expected)} / ${pct(
      shares.high
    )} automated = ${usd(dollarsAt(shares.low))} low · ${usd(
      dollarsAt(shares.expected)
    )} expected · ${usd(dollarsAt(shares.high))} high`,
  ];

  return {
    low: dollars(dollarsAt(shares.low)),
    expected: dollars(dollarsAt(shares.expected)),
    high: dollars(dollarsAt(shares.high)),
    chain,
    capacityHoursWeekly,
  };
}

const RUNNERS: Record<CalcKind, (inputs: RawCalcInputs) => CalcOutputs> = {
  close_rate_lift: closeRateLift,
  price_change: priceChange,
  reactivation: reactivation,
  response_time: responseTime,
  automation_hours: automationHours,
};

// ─────────────────────────────────────────────────────────────────────────────
// Public entry points
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which baseline figures this calculator wants but the assessment cannot
 * supply. Not a refusal on its own — the advisor may type them — but the
 * editor uses it to say what is missing before anything is entered.
 */
export function missingBaseline(
  kind: CalcKind,
  baseline: CalcBaseline
): BaselineKey[] {
  return CALCULATORS[kind].usesBaseline.filter(
    (k) => baseline[k] === null || !Number.isFinite(Number(baseline[k]))
  );
}

/** Prefill values for a fresh calculator, taken from the baseline where we have it. */
export function defaultInputs(
  kind: CalcKind,
  baseline: CalcBaseline
): RawCalcInputs {
  const out: RawCalcInputs = {};
  for (const f of CALCULATORS[kind].fields) {
    if (f.boolean) {
      out[f.key] = false;
      continue;
    }
    if (f.baselineDefault) {
      const v = baseline[f.baselineDefault];
      if (v !== null && Number.isFinite(v)) out[f.key] = v;
      continue;
    }
    if (f.defaultValue !== undefined) out[f.key] = f.defaultValue;
  }
  if (kind === "automation_hours") out.redeployed = true;
  return out;
}

/**
 * Run a calculator. Every dollar returned is annual OPERATING PROFIT.
 *
 * Returns a refusal rather than throwing, and rather than modelling on a
 * missing figure — a calculator that silently treats an absent gross margin as
 * zero (or as one) is worse than no calculator.
 */
export function compute<K extends CalcKind>(
  kind: K,
  inputs: CalcInputMap[K] | RawCalcInputs,
  baseline: CalcBaseline = EMPTY_BASELINE
): ComputeResult {
  const runner = RUNNERS[kind];
  if (!runner) return { ok: false, error: `Unknown calculator: ${kind}` };

  // Baseline fills only the gaps the advisor left empty.
  const merged: RawCalcInputs = { ...(inputs as RawCalcInputs) };
  for (const f of CALCULATORS[kind].fields) {
    if (!f.baselineDefault) continue;
    const present = merged[f.key];
    if (typeof present === "number" && Number.isFinite(present)) continue;
    const v = baseline[f.baselineDefault];
    if (v !== null && Number.isFinite(v)) merged[f.key] = v;
  }

  try {
    return { ok: true, ...runner(merged) };
  } catch (err) {
    if (err instanceof InputError) return { ok: false, error: err.message };
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Calculation failed.",
    };
  }
}

/** Build the record that gets stored on the opportunity's `calc` column. */
export function toCalcRecord(
  kind: CalcKind,
  inputs: RawCalcInputs,
  outputs: CalcOutputs,
  computedAt: string = new Date().toISOString()
): CalcRecord {
  return {
    kind,
    inputs: { ...inputs },
    outputs: {
      low: outputs.low,
      expected: outputs.expected,
      high: outputs.high,
      ...(outputs.capacityHoursWeekly !== undefined
        ? { capacityHoursWeekly: outputs.capacityHoursWeekly }
        : {}),
    },
    chain: [...outputs.chain],
    computed_at: computedAt,
  };
}

/**
 * Validate a stored `calc` value. Anything that is not a complete record —
 * including a record from a calculator kind we no longer ship — comes back
 * null, and the caller treats the range as hand-entered.
 */
export function parseCalc(json: unknown): CalcRecord | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const raw = json as Record<string, unknown>;

  const kind = raw.kind;
  if (typeof kind !== "string" || !CALC_KINDS.includes(kind as CalcKind)) {
    return null;
  }

  const rawInputs = raw.inputs;
  if (!rawInputs || typeof rawInputs !== "object" || Array.isArray(rawInputs)) {
    return null;
  }
  const inputs: RawCalcInputs = {};
  for (const [k, v] of Object.entries(rawInputs as Record<string, unknown>)) {
    if (typeof v === "boolean") inputs[k] = v;
    else if (typeof v === "number" && Number.isFinite(v)) inputs[k] = v;
    else return null;
  }

  const rawOutputs = raw.outputs;
  if (
    !rawOutputs ||
    typeof rawOutputs !== "object" ||
    Array.isArray(rawOutputs)
  ) {
    return null;
  }
  const o = rawOutputs as Record<string, unknown>;
  const money = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const low = money(o.low);
  const expected = money(o.expected);
  const high = money(o.high);
  if (low === null || expected === null || high === null) return null;
  const capacity = money(o.capacityHoursWeekly);

  const rawChain = raw.chain;
  if (!Array.isArray(rawChain) || rawChain.some((l) => typeof l !== "string")) {
    return null;
  }

  const computedAt = raw.computed_at;
  if (typeof computedAt !== "string" || !computedAt.trim()) return null;

  return {
    kind: kind as CalcKind,
    inputs,
    outputs: {
      low,
      expected,
      high,
      ...(capacity !== null ? { capacityHoursWeekly: capacity } : {}),
    },
    chain: rawChain as string[],
    computed_at: computedAt,
  };
}

/** One line, for a list row or a tooltip. */
export function describeCalc(calc: CalcRecord): string {
  const label = CALCULATORS[calc.kind]?.label ?? calc.kind;
  const capacity =
    calc.outputs.capacityHoursWeekly !== undefined
      ? `, ${num(calc.outputs.capacityHoursWeekly)} h/week capacity`
      : "";
  return `${label} — ${usd(calc.outputs.low)} / ${usd(
    calc.outputs.expected
  )} / ${usd(calc.outputs.high)} operating profit${capacity}`;
}
