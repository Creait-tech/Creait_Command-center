import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { ReportToolbar } from "@/components/assessments/print-button";
import {
  computeScores,
  EVIDENCE_LABELS,
  formatMoney,
  formatPayback,
  INDICATORS_BY_PILLAR,
  MIN_PILLAR_SAMPLE,
  OVERLAY_FLAGS,
  paybackMonths,
  PILLARS,
  portfolioTotals,
  SCALE_LABELS,
  toScoreMap,
} from "@/lib/assessment-instrument";

/**
 * The template supplies the quotation marks around the owner's verbatim, so
 * strip any the advisor typed — otherwise the cover renders ""like this"".
 */
function unquote(value: string): string {
  return value.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
}
import type {
  CcAssessment,
  CcAssessmentOpportunity,
  CcAssessmentScore,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * The Executive Blueprint — client-ready, print-optimized (browser
 * print → PDF is the delivery mechanism). Lives OUTSIDE the dashboard
 * route group so no app chrome ever prints. Honest by construction:
 * unscored indicators say "not examined", evidence confidence is
 * disclosed, and portfolio totals are overlap-adjusted, never raw sums.
 */

function jsonToStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function formatLongDate(d: string | null): string {
  const date = d ? new Date(`${d}T00:00:00`) : new Date();
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Static stylesheet — no user data ever flows into this string.
const REPORT_CSS = `
  .report-root {
    background: #eef1f5;
    color: #111827;
    min-height: 100vh;
    font-family: var(--font-inter), Inter, -apple-system, "Segoe UI", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .report-page {
    background: #ffffff;
    max-width: 8.5in;
    margin: 0 auto 24px;
    padding: 56px 64px;
    box-shadow: 0 2px 16px rgba(17, 24, 39, 0.12);
    position: relative;
  }
  .practice-watermark {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 40;
  }
  .practice-watermark span {
    transform: rotate(-28deg);
    font-size: 110px;
    font-weight: 900;
    letter-spacing: 0.18em;
    color: rgba(139, 92, 246, 0.13);
    user-select: none;
    white-space: nowrap;
  }
  @media screen {
    .report-root { padding: 64px 16px 48px; }
  }
  @page { size: letter; margin: 0.55in; }
  @media print {
    html, body { background: #ffffff !important; }
    .no-print { display: none !important; }
    .report-root { background: #ffffff; padding: 0; }
    .report-page {
      box-shadow: none;
      margin: 0;
      padding: 0.2in 0.15in;
      max-width: none;
      break-after: page;
    }
    .report-page:last-child { break-after: auto; }
    .avoid-break { break-inside: avoid; }
  }
`;

export default async function ExecutiveBlueprintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const supabase = await createClient();
  const orgId = await getActiveOrgId();

  const { data: assessmentRow } = await supabase
    .from("cc_assessments")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!assessmentRow) notFound();
  const assessment = assessmentRow as CcAssessment;

  const [scoresRes, oppsRes] = await Promise.all([
    supabase.from("cc_assessment_scores").select("*").eq("assessment_id", id),
    supabase
      .from("cc_assessment_opportunities")
      .select("*")
      .eq("assessment_id", id)
      .order("rank", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const scores = toScoreMap(
    (scoresRes.data as CcAssessmentScore[] | null) ?? []
  );
  const allOpps = (oppsRes.data as CcAssessmentOpportunity[] | null) ?? [];
  const opportunities = allOpps.filter((o) => o.include_in_report);

  const computed = computeScores(scores);
  const portfolio = portfolioTotals(opportunities, assessment.overlap_factor);
  const overlayFlags = jsonToStrings(assessment.overlay_flags);
  const activeWarnings = OVERLAY_FLAGS.filter((f) =>
    overlayFlags.includes(f.key)
  );
  const planItems = jsonToStrings(assessment.plan_items);
  const reportDate = formatLongDate(
    assessment.delivered_at ?? assessment.started_at
  );
  const clientLine = assessment.company
    ? `${assessment.company} · ${assessment.client_name}`
    : assessment.client_name;
  const hasEstimateBasedOpp = opportunities.some(
    (o) => o.confidence === "low"
  );

  const blue = "#0284c7";
  const ink = "#111827";
  const muted = "#5b6675";
  const line = "#e4e9f0";

  return (
    <div className="report-root">
      <style>{REPORT_CSS}</style>
      <ReportToolbar assessmentId={assessment.id} />

      {assessment.is_practice && (
        <div className="practice-watermark" aria-hidden>
          <span>PRACTICE</span>
        </div>
      )}

      {/* ── Cover ─────────────────────────────────────────────────────── */}
      <section
        className="report-page"
        style={{ display: "flex", flexDirection: "column", minHeight: "9.5in" }}
      >
        {assessment.is_practice && (
          <p
            style={{
              border: "2px solid #8b5cf6",
              color: "#6d28d9",
              borderRadius: 8,
              padding: "8px 14px",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              alignSelf: "flex-start",
            }}
          >
            Practice engagement — not a client deliverable
          </p>
        )}
        <div style={{ marginTop: "auto" }}>
          <p style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.3em", color: blue }}>
            C R E A i T
          </p>
          <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15, marginTop: 20 }}>
            Growth &amp; AI Diagnostic
          </h1>
          <p style={{ fontSize: 22, color: muted, marginTop: 6 }}>
            Executive Blueprint
          </p>
          <div style={{ borderTop: `2px solid ${line}`, marginTop: 40, paddingTop: 24 }}>
            <p style={{ fontSize: 18, fontWeight: 700 }}>{clientLine}</p>
            {assessment.industry && (
              <p style={{ fontSize: 14, color: muted, marginTop: 2 }}>
                {assessment.industry}
              </p>
            )}
            <p style={{ fontSize: 14, color: muted, marginTop: 10 }}>
              {reportDate} · Prepared by CREAiT
            </p>
          </div>
        </div>
        <p style={{ marginTop: "auto", fontSize: 11, color: muted }}>
          Confidential. Prepared for the named recipient. Figures are
          evidence-based estimates, not guarantees, and are shown as ranges
          with their basis. This is not a business valuation or appraisal.
        </p>
      </section>

      {/* ── Dashboard ─────────────────────────────────────────────────── */}
      <section className="report-page">
        <SectionHeading label="At a glance" title="The One-Page Dashboard" />

        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", marginTop: 24 }}>
          <div style={{ textAlign: "center", minWidth: 150 }}>
            <p style={{ fontSize: 64, fontWeight: 800, color: blue, lineHeight: 1 }}>
              {computed.creaitScore ?? "—"}
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: ink, marginTop: 6 }}>
              CREAiT Score
            </p>
            <p style={{ fontSize: 12, color: muted }}>
              {computed.band ? `Band: ${computed.band}` : "Not yet scored"} ·{" "}
              {computed.scoredCount}/30 indicators examined
            </p>
          </div>
          <div style={{ flex: 1 }}>
            {PILLARS.map((p) => {
              const value = computed.pillars[p.key];
              return (
                <div key={p.key} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700 }}>
                      {p.label}{" "}
                      <span style={{ color: muted, fontWeight: 400 }}>
                        ({Math.round(p.weight * 100)}%) — {p.question}
                      </span>
                    </span>
                    <span style={{ fontWeight: 700 }}>
                      {value ?? "not examined"}
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#eef1f5", borderRadius: 4 }}>
                    <div
                      style={{
                        height: 8,
                        width: `${value ?? 0}%`,
                        background: blue,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {assessment.primary_constraint && (
          <div
            className="avoid-break"
            style={{
              border: `1px solid ${line}`,
              borderLeft: `4px solid ${blue}`,
              borderRadius: 8,
              padding: "14px 18px",
              marginTop: 20,
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: muted }}>
              Primary Business Constraint
            </p>
            <p style={{ fontSize: 15, marginTop: 6, lineHeight: 1.5 }}>
              {assessment.primary_constraint}
            </p>
          </div>
        )}

        <div className="avoid-break" style={{ marginTop: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: muted, marginBottom: 8 }}>
            The annual opportunity ({opportunities.length} priced initiative
            {opportunities.length === 1 ? "" : "s"}, overlap-adjusted ×
            {portfolio.overlapFactor} — not additive with each other)
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Low", value: portfolio.adjLow },
              { label: "Expected", value: portfolio.adjExpected },
              { label: "High", value: portfolio.adjHigh },
            ].map((cell) => (
              <div
                key={cell.label}
                style={{
                  flex: 1,
                  border: `1px solid ${line}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: 20, fontWeight: 800, color: cell.label === "Expected" ? blue : ink }}>
                  {formatMoney(cell.value)}
                </p>
                <p style={{ fontSize: 11, color: muted }}>{cell.label} / year</p>
              </div>
            ))}
          </div>
        </div>

        {activeWarnings.length > 0 && (
          <div
            className="avoid-break"
            style={{
              border: "1px solid #f3c6bf",
              background: "#fff6f4",
              borderRadius: 8,
              padding: "12px 16px",
              marginTop: 20,
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 700, color: "#b03a2e" }}>
              Critical constraint warning{activeWarnings.length > 1 ? "s" : ""}{" "}
              — these sit alongside the score and are never averaged away:
            </p>
            <ul style={{ margin: "6px 0 0 18px", fontSize: 12.5, color: "#7f2d22", lineHeight: 1.6 }}>
              {activeWarnings.map((w) => (
                <li key={w.key}>{w.label}</li>
              ))}
            </ul>
          </div>
        )}

        {assessment.owner_belief && (
          <p style={{ fontSize: 13, color: muted, marginTop: 20, lineHeight: 1.6 }}>
            <b style={{ color: ink }}>What you told us:</b>{" "}
            &ldquo;{unquote(assessment.owner_belief)}&rdquo; — this report tests
            that belief against the evidence.
          </p>
        )}
      </section>

      {/* ── Score detail ──────────────────────────────────────────────── */}
      <section className="report-page">
        <SectionHeading
          label="How the score works"
          title="The CREAiT Score, indicator by indicator"
        />
        <p style={{ fontSize: 13, color: muted, lineHeight: 1.6, marginTop: 10 }}>
          Thirty indicators, ten per pillar, each scored 0–4 against written
          behavioral anchors (0 Absent · 1 Informal · 2 Developing · 3
          Established · 4 Scalable). Pillar score = average ÷ 4 × 100. CREAiT
          Score = Profit × 40% + Systems × 35% + Leverage × 25%. Evidence
          level is disclosed per indicator: Reported (you told us),
          Demonstrated (we watched it work), Documented (we saw the record).
          An indicator we did not examine says so — nothing here is assumed.
        </p>

        {PILLARS.map((pillar) => {
          const examined = computed.pillarScoredCounts[pillar.key];
          const thinPillar = examined > 0 && examined < MIN_PILLAR_SAMPLE;
          const unexamined = INDICATORS_BY_PILLAR[pillar.key].filter((ind) => {
            const row = scores[ind.key];
            return !row || (!row.not_applicable && row.score === null);
          });
          const shown = INDICATORS_BY_PILLAR[pillar.key].filter(
            (ind) => !unexamined.includes(ind)
          );
          return (
          <div key={pillar.key} className="avoid-break" style={{ marginTop: 22 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: blue }}>
              {pillar.label}{" "}
              <span style={{ color: muted, fontWeight: 400 }}>
                — {pillar.question}
              </span>
              <span style={{ float: "right", color: ink }}>
                {examined === 0
                  ? "not examined"
                  : thinPillar
                    ? `insufficient data (${examined} of 10)`
                    : computed.pillars[pillar.key]}
              </span>
            </p>
            <p style={{ fontSize: 11, color: muted, marginTop: 2 }}>
              {examined} of 10 indicators examined
              {thinPillar
                ? " — too few to state a pillar score; treat the rows below as observations, not a verdict."
                : ""}
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Indicator</th>
                  <th style={{ ...thStyle, width: 90 }}>Score</th>
                  <th style={{ ...thStyle, width: 100 }}>Evidence</th>
                  <th style={{ ...thStyle, width: "38%" }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((ind) => {
                  const row = scores[ind.key];
                  const isNa = row?.not_applicable ?? false;
                  const score = isNa ? null : row?.score ?? null;
                  return (
                    <tr key={ind.key}>
                      <td style={tdStyle}>
                        <b>{ind.key}</b> {ind.label}
                      </td>
                      <td style={tdStyle}>
                        {isNa
                          ? "N/A (excluded)"
                          : `${score} · ${SCALE_LABELS[score as 0 | 1 | 2 | 3 | 4]}`}
                      </td>
                      <td style={tdStyle}>
                        {row && !isNa && score !== null
                          ? EVIDENCE_LABELS[row.evidence_confidence]
                          : "—"}
                      </td>
                      <td style={{ ...tdStyle, color: muted }}>
                        {row?.notes ?? ""}
                      </td>
                    </tr>
                  );
                })}
                {unexamined.length > 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ ...tdStyle, color: muted, fontStyle: "italic" }}
                    >
                      {unexamined.length} indicator
                      {unexamined.length > 1 ? "s" : ""} not examined in this
                      engagement: {unexamined.map((i) => i.key).join(", ")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          );
        })}
      </section>

      {/* ── Primary constraint ────────────────────────────────────────── */}
      <section className="report-page">
        <SectionHeading
          label="The finding that matters most"
          title="Your Primary Business Constraint"
        />
        {assessment.primary_constraint ? (
          <div style={{ marginTop: 16 }}>
            {assessment.owner_belief && (
              <ConstraintBlock label="You said">
                &ldquo;{unquote(assessment.owner_belief)}&rdquo;
              </ConstraintBlock>
            )}
            {assessment.constraint_symptoms && (
              <ConstraintBlock label="The symptoms you've been living with">
                {assessment.constraint_symptoms}
              </ConstraintBlock>
            )}
            <ConstraintBlock label="The root constraint" highlight>
              {assessment.primary_constraint}
            </ConstraintBlock>
            {assessment.constraint_cost && (
              <ConstraintBlock label="What it costs each year (basis shown — these are separate numbers, not one total)">
                {assessment.constraint_cost}
              </ConstraintBlock>
            )}
            {assessment.constraint_fix && (
              <ConstraintBlock label="First intervention & how we'll know it's working">
                {assessment.constraint_fix}
              </ConstraintBlock>
            )}
            {assessment.momentum_initiative && (
              <ConstraintBlock label="Early Momentum Initiative (a measurable win inside 30 days)">
                {assessment.momentum_initiative}
              </ConstraintBlock>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: muted, marginTop: 14 }}>
            Primary constraint not yet named for this engagement.
          </p>
        )}
      </section>

      {/* ── Opportunities ─────────────────────────────────────────────── */}
      <section className="report-page">
        <SectionHeading
          label="We show you the math"
          title="The Profit Opportunities"
        />
        <p style={{ fontSize: 13, color: muted, lineHeight: 1.6, marginTop: 10 }}>
          Every figure below is an annual operating-profit estimate shown as a
          range with its basis and its cost to capture. Payback = fix cost ÷
          expected monthly recovery. The portfolio total is overlap-adjusted
          (×{portfolio.overlapFactor}) because initiatives share the same
          customers and hours — we never add raw maximums.
          {hasEstimateBasedOpp &&
            " Items marked low-confidence are based on your estimates; treat the ranges as wide."}
        </p>

        {opportunities.length === 0 ? (
          <p style={{ fontSize: 13, color: muted, marginTop: 16 }}>
            No priced opportunities in this report yet.
          </p>
        ) : (
          opportunities.map((opp, i) => {
            const monthly =
              opp.annual_expected !== null ? opp.annual_expected / 12 : null;
            const payback = paybackMonths(opp.fix_cost, opp.annual_expected);
            return (
              <div
                key={opp.id}
                className="avoid-break"
                style={{
                  border: `1px solid ${line}`,
                  borderRadius: 8,
                  padding: "16px 20px",
                  marginTop: 16,
                }}
              >
                <p style={{ fontSize: 15, fontWeight: 800 }}>
                  {i + 1}. {opp.title}
                  <span
                    style={{
                      float: "right",
                      fontSize: 11,
                      fontWeight: 700,
                      color: muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {opp.confidence} confidence
                  </span>
                </p>
                {opp.finding && (
                  <p style={{ fontSize: 13, color: ink, lineHeight: 1.6, marginTop: 8 }}>
                    {opp.finding}
                  </p>
                )}
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 12.5 }}>
                  <tbody>
                    <tr>
                      <td style={mathLabel}>Annual impact (low / expected / high)</td>
                      <td style={mathValue}>
                        {formatMoney(opp.annual_low)} /{" "}
                        <b>{formatMoney(opp.annual_expected)}</b> /{" "}
                        {formatMoney(opp.annual_high)}
                      </td>
                    </tr>
                    <tr>
                      <td style={mathLabel}>Cost to fix</td>
                      <td style={mathValue}>{formatMoney(opp.fix_cost)}</td>
                    </tr>
                    <tr>
                      <td style={mathLabel}>Expected monthly recovery</td>
                      <td style={mathValue}>
                        {monthly !== null
                          ? `${formatMoney(opp.annual_expected)} ÷ 12 = ${formatMoney(monthly)}/mo`
                          : "—"}
                      </td>
                    </tr>
                    <tr>
                      <td style={mathLabel}>Payback</td>
                      <td style={mathValue}>
                        {payback !== null && opp.fix_cost !== null
                          ? `${formatMoney(opp.fix_cost)} ÷ ${formatMoney(monthly)}/mo ≈ ${formatPayback(payback)}`
                          : "—"}
                      </td>
                    </tr>
                    {opp.months_to_benefit !== null && (
                      <tr>
                        <td style={mathLabel}>Time to first benefit</td>
                        <td style={mathValue}>
                          {/* Numeric columns can arrive as strings, so compare
                              the coerced value — "1 months" otherwise. */}
                          {`${opp.months_to_benefit} ${
                            Number(opp.months_to_benefit) === 1
                              ? "month"
                              : "months"
                          }`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {opp.confidence === "low" && (
                  <p style={{ fontSize: 11.5, color: muted, marginTop: 8 }}>
                    Based on your estimates — we widened this range and will
                    firm it up with real measurement in the first 30 days.
                  </p>
                )}
              </div>
            );
          })
        )}

        {opportunities.length > 0 && (
          <div
            className="avoid-break"
            style={{
              borderTop: `2px solid ${ink}`,
              marginTop: 20,
              paddingTop: 12,
              fontSize: 13.5,
            }}
          >
            <b>Portfolio, overlap-adjusted (×{portfolio.overlapFactor}):</b>{" "}
            low {formatMoney(portfolio.adjLow)} · expected{" "}
            <b style={{ color: blue }}>{formatMoney(portfolio.adjExpected)}</b>{" "}
            · high {formatMoney(portfolio.adjHigh)} per year.
            <span style={{ color: muted }}>
              {" "}
              Raw sum before adjustment: {formatMoney(portfolio.rawLow)} /{" "}
              {formatMoney(portfolio.rawExpected)} /{" "}
              {formatMoney(portfolio.rawHigh)}.
            </span>
          </div>
        )}
      </section>

      {/* ── 90-day plan ───────────────────────────────────────────────── */}
      <section className="report-page">
        <SectionHeading
          label="Yours to run, with or without us"
          title="The 90-Day Plan"
        />
        <p style={{ fontSize: 13, color: muted, lineHeight: 1.6, marginTop: 10 }}>
          This plan is complete and fully usable on its own. Priorities are
          deliberately few — the constraint gets fixed by finishing, not by
          starting.
        </p>
        {planItems.length === 0 ? (
          <p style={{ fontSize: 13, color: muted, marginTop: 16 }}>
            90-day plan not yet drafted for this engagement.
          </p>
        ) : (
          <ol style={{ margin: "18px 0 0 0", padding: 0, listStyle: "none" }}>
            {planItems.map((item, i) => (
              <li
                key={`${i}-${item}`}
                className="avoid-break"
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "12px 0",
                  borderBottom: `1px solid ${line}`,
                  fontSize: 13.5,
                  lineHeight: 1.6,
                }}
              >
                <span
                  style={{
                    fontWeight: 800,
                    color: blue,
                    minWidth: 24,
                    fontSize: 15,
                  }}
                >
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        )}
        {activeWarnings.length > 0 && (
          <p style={{ fontSize: 12, color: muted, marginTop: 16, lineHeight: 1.6 }}>
            {/* One expression: JSX drops the space between an expression and
                following text when that text wraps to the next line. */}
            {`Note: while the critical ${
              activeWarnings.length > 1
                ? "constraint warnings are"
                : "constraint warning is"
            } active, growth initiatives that depend on the weak foundation carry a “Prepare First” label — foundation work comes first.`}
          </p>
        )}
      </section>

      {/* ── What's next ───────────────────────────────────────────────── */}
      <section className="report-page">
        <SectionHeading label="If you want help" title="What's Next" />
        <p style={{ fontSize: 13.5, lineHeight: 1.7, marginTop: 12 }}>
          The plan above is yours either way. If you want us alongside you,
          there are two ways we work — and your diagnostic fee returns as 50%
          credit on everything we build.
        </p>
        <div style={{ display: "flex", gap: 14, marginTop: 20 }}>
          <div style={nextCard}>
            <p style={{ fontSize: 15, fontWeight: 800 }}>CREAiT Builds</p>
            <p style={{ fontSize: 13, color: muted, marginTop: 4 }}>
              $4,500–14,000 fixed scope
            </p>
            <p style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 8 }}>
              We implement the workflow fixes priced in this report. Each
              opportunity above is already a scoped build — the estimating is
              done.
            </p>
          </div>
          <div style={nextCard}>
            <p style={{ fontSize: 15, fontWeight: 800 }}>CREAiT Advisory</p>
            <p style={{ fontSize: 13, color: muted, marginTop: 4 }}>
              $2,500–3,500 / month
            </p>
            <p style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 8 }}>
              We run the 90-day plan with you — weekly rhythm, scoreboard,
              builds folded in, score re-tested quarterly.
            </p>
          </div>
        </div>
        <div
          style={{
            border: `1px solid ${line}`,
            borderLeft: `4px solid ${blue}`,
            borderRadius: 8,
            padding: "14px 18px",
            marginTop: 20,
            fontSize: 13.5,
            lineHeight: 1.6,
          }}
        >
          <b>The credit, plainly:</b>{" "}
          your diagnostic fee returns as 50% credit on everything we build,
          until it&apos;s used up.
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.7, marginTop: 24 }}>
          You don&apos;t need more hustle. You need cleaner systems and
          clearer days.
        </p>
        <p style={{ fontSize: 12, color: muted, marginTop: 40 }}>
          CREAiT · Growth &amp; AI Diagnostic · {reportDate} · Info@creait.tech
        </p>
      </section>
    </div>
  );
}

// ── Small presentational helpers (server-safe) ─────────────────────────
const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#5b6675",
  borderBottom: "1px solid #e4e9f0",
  padding: "4px 6px",
};

const tdStyle: React.CSSProperties = {
  padding: "5px 6px",
  borderBottom: "1px solid #f0f3f7",
  verticalAlign: "top",
};

const mathLabel: React.CSSProperties = {
  padding: "4px 0",
  color: "#5b6675",
  width: "45%",
};

const mathValue: React.CSSProperties = {
  padding: "4px 0",
  fontVariantNumeric: "tabular-nums",
};

const nextCard: React.CSSProperties = {
  flex: 1,
  border: "1px solid #e4e9f0",
  borderRadius: 8,
  padding: "16px 18px",
};

function SectionHeading({ label, title }: { label: string; title: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#0284c7",
        }}
      >
        {label}
      </p>
      <h2 style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{title}</h2>
    </div>
  );
}

function ConstraintBlock({
  label,
  children,
  highlight,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className="avoid-break"
      style={{
        border: highlight ? "1px solid #bcd9ea" : "1px solid #e4e9f0",
        borderLeft: highlight ? "4px solid #0284c7" : "4px solid #e4e9f0",
        background: highlight ? "#f4fafd" : "#ffffff",
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 12,
      }}
    >
      <p
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#5b6675",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 13.5, lineHeight: 1.65, marginTop: 5, whiteSpace: "pre-line" }}>
        {children}
      </p>
    </div>
  );
}
