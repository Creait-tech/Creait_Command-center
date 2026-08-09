import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/active-org";
import { ReportToolbar } from "@/components/assessments/print-button";
import { CountUp } from "@/components/assessments/report/count-up";
import { ScoreBandRail } from "@/components/assessments/report/score-band";
import { PillarBars } from "@/components/assessments/report/pillar-bars";
import { MoneyMap } from "@/components/assessments/report/money-map";
import {
  PaybackTimeline,
  paybackRows,
} from "@/components/assessments/report/payback-timeline";
import { BleedProjection } from "@/components/assessments/report/bleed-projection";
import {
  RoadmapToGoal,
  roadmapRows,
} from "@/components/assessments/report/roadmap-to-goal";
import {
  computePotentialScores,
  computeScores,
  EVIDENCE_LABELS,
  formatMoney,
  formatPayback,
  INDICATORS,
  INDICATORS_BY_PILLAR,
  MIN_PILLAR_SAMPLE,
  MIN_POTENTIAL_SET,
  MIN_REPORT_RESOLVED,
  OVERLAY_FLAGS,
  paybackMonths,
  PILLARS,
  portfolioTotals,
  SCALE_LABELS,
  toScoreMap,
} from "@/lib/assessment-instrument";

import type {
  CcAssessment,
  CcAssessmentOpportunity,
  CcAssessmentScore,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

/**
 * The template supplies the quotation marks around the owner's verbatim, so
 * strip any the advisor typed — otherwise the cover renders ""like this"".
 */
function unquote(value: string): string {
  return value.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
}

/**
 * The Executive Blueprint — client-ready, print-optimized (browser
 * print → PDF is the delivery mechanism). Lives OUTSIDE the dashboard
 * route group so no app chrome ever prints. Honest by construction:
 * unscored indicators say "not examined", evidence confidence is
 * disclosed, and portfolio totals are overlap-adjusted, never raw sums.
 *
 * The page order is deliberate:
 *   cover → the mirror (their words vs the evidence) → the one-page dashboard
 *   → what waiting costs → the three things to start → then every working.
 * Findings land first; the arithmetic is there to be checked, not waded
 * through. Limitations are disclosed after the rigor has been shown rather
 * than before it, and the document ends on the owner, never on a price list.
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

/**
 * Static stylesheet — no user data ever flows into this string.
 *
 * The app shell is hard-coded dark (`<html class="dark">` plus
 * `color-scheme: dark` in globals.css). A client prints this page, so the
 * whole subtree is pinned to a light scheme: without that override the print
 * canvas, the @page margin bands and any UA-styled element render dark and
 * the PDF comes out as a black rectangle with unreadable text.
 */
const REPORT_CSS = `
  html:has(.report-root) {
    color-scheme: light;
    background: #eef1f5;
  }
  html:has(.report-root) body {
    background: #eef1f5;
    color: #111827;
  }
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
    color: #111827;
    max-width: 8.5in;
    margin: 0 auto 24px;
    padding: 56px 64px;
    box-shadow: 0 2px 16px rgba(17, 24, 39, 0.12);
    position: relative;
    /* Client notes, findings and plan lines are free text — a pasted URL or a
       long unbroken token must wrap, not run off the printed page. */
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .report-page table { table-layout: fixed; }
  .report-page td, .report-page th { overflow-wrap: anywhere; }
  .report-flag {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }
  /* One watermark per printed sheet. A single position:fixed element only
     repeats across pages in some browsers, so a practice run could otherwise
     print pages 2+ with no mark at all. */
  .is-practice .report-page::after {
    content: "PRACTICE";
    position: absolute;
    top: 45%;
    left: 0;
    right: 0;
    text-align: center;
    transform: rotate(-24deg);
    font-size: 96px;
    font-weight: 900;
    letter-spacing: 0.18em;
    color: rgba(139, 92, 246, 0.13);
    pointer-events: none;
    user-select: none;
    z-index: 1;
  }
  .practice-strip {
    border: 2px solid #8b5cf6;
    background: #f5f1ff;
    color: #5b21b6;
    border-radius: 8px;
    padding: 7px 14px;
    margin-bottom: 18px;
    font-weight: 800;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    position: relative;
    z-index: 2;
  }
  .draft-strip {
    border: 2px solid #c2410c;
    background: #fff5ed;
    color: #9a3412;
    border-radius: 8px;
    padding: 9px 14px;
    margin-bottom: 18px;
    font-size: 12.5px;
    line-height: 1.5;
    position: relative;
    z-index: 2;
  }
  @media screen {
    .report-root { padding: 64px 16px 48px; }
  }
  @page { size: letter; margin: 0.55in; }
  @media print {
    html:has(.report-root), html:has(.report-root) body {
      background: #ffffff !important;
      color-scheme: light !important;
    }
    .no-print, [data-sonner-toaster] { display: none !important; }
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
    /* Never split a table row across a page break, and repeat headers when a
       table does have to flow onto a second sheet. */
    .report-page tr { break-inside: avoid; }
    .report-page thead { display: table-header-group; }
    .report-page h1, .report-page h2 { break-after: avoid; }
  }

  /* ── Entrance sequence ──────────────────────────────────────────────────
     The RESTING state of every animated element is the finished exhibit.
     Keyframes supply only a "from", and only inside a screen + motion-welcome
     query — so print, prefers-reduced-motion, and any engine that drops the
     animation all land on a complete, correct chart rather than an empty one. */
  @media screen and (prefers-reduced-motion: no-preference) {
    .rp-grow-x {
      transform-box: fill-box;
      transform-origin: left center;
      animation: rp-grow 820ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--d, 0ms);
    }
    @keyframes rp-grow { from { transform: scaleX(0); } }

    .rp-fade {
      animation: rp-fadein 460ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--d, 0ms);
    }
    @keyframes rp-fadein { from { opacity: 0; } }

    .rp-seg {
      transform-box: fill-box;
      transform-origin: center center;
      animation: rp-segin 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--d, 0ms);
    }
    @keyframes rp-segin { from { opacity: 0; transform: scaleY(0.3); } }

    .rp-needle {
      animation: rp-needlein 1000ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: 300ms;
    }
    @keyframes rp-needlein {
      from { opacity: 0; transform: translateX(var(--from, 0px)); }
    }

    .rp-rise {
      animation: rp-risein 620ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: var(--d, 0ms);
    }
    @keyframes rp-risein { from { opacity: 0; transform: translateY(10px); } }
  }
  @media print {
    .rp-grow-x, .rp-fade, .rp-seg, .rp-needle, .rp-rise {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
  }

  /* A rule the owner writes on — the commitment device on "Start Monday". */
  .rp-fill { flex: 1; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
`;

/**
 * The browser stamps the document title into the printed page header, so the
 * generic app title would put "CREAIT Command Center" on top of the client's
 * PDF. Name the deliverable instead.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { userId } = await auth();
  if (!userId) return { title: "Growth & AI Diagnostic" };

  const { id } = await params;
  const supabase = await createClient();
  const orgId = await getActiveOrgId();
  const { data } = await supabase
    .from("cc_assessments")
    .select("client_name, company, is_practice")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  const row = data as Pick<
    CcAssessment,
    "client_name" | "company" | "is_practice"
  > | null;
  if (!row) return { title: "Growth & AI Diagnostic" };

  const who = row.company || row.client_name;
  return {
    title: `${row.is_practice ? "PRACTICE — " : ""}Growth & AI Diagnostic — ${who}`,
    robots: { index: false, follow: false },
  };
}

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
  const potential = computePotentialScores(scores);
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

  // Report-readiness. Below the threshold the pillar averages rest on a
  // handful of indicators and the document reads as an unfinished checklist —
  // it must say so on the page, not only in the workbench the client never sees.
  const isDraft = computed.resolvedCount < MIN_REPORT_RESOLVED;
  const draftNotice = `Draft — ${computed.resolvedCount} of ${INDICATORS.length} indicators resolved (${MIN_REPORT_RESOLVED} required). Scores and figures below are incomplete and this document is not ready to hand to a client.`;
  const thinPillarLabels = PILLARS.filter((p) => computed.thinPillars[p.key])
    .map((p) => `${p.label} (${computed.pillarScoredCounts[p.key]} of 10)`)
    .join(", ");

  /**
   * The potential composite renders ONLY on a solid current reading: enough
   * advisor-set targets (never a "potential" built on three guesses), a
   * non-provisional, non-draft engagement, and both composites computable.
   */
  const showPotential =
    !isDraft &&
    !computed.provisional &&
    computed.creaitScore !== null &&
    potential.creaitScore !== null &&
    potential.potentialSet >= MIN_POTENTIAL_SET;

  /** Same guard family for the two-paths projection — a provisional or thin
      engagement never projects a recovery it hasn't measured. */
  const goalRows = roadmapRows(opportunities, portfolio.overlapFactor);
  const showRoadmap =
    !isDraft &&
    !computed.provisional &&
    portfolio.adjExpected > 0 &&
    goalRows.length > 0;

  /**
   * Dollar-titled identity — exact, overlap-adjusted, only when priced. A
   * draft never takes the finished-deliverable identity: a cover that names a
   * dollar figure two inches above "not ready to hand to a client" undercuts
   * both lines.
   */
  const roadmapIdentity =
    !isDraft && portfolio.includedCount > 0 && portfolio.adjExpected > 0
      ? `The ${formatMoney(portfolio.adjExpected)} Profit Recovery Roadmap`
      : null;

  const firstName = assessment.client_name.trim().split(/\s+/)[0] || "there";
  const hasBlueprints = opportunities.some((o) => o.blueprint);

  /** The lowest-scored indicators — the evidence standing behind the mirror. */
  const weakest = INDICATORS.map((ind) => ({ ind, row: scores[ind.key] }))
    .filter(
      (r): r is { ind: (typeof INDICATORS)[number]; row: CcAssessmentScore } =>
        Boolean(r.row) && !r.row.not_applicable && r.row.score !== null
    )
    .sort((a, b) => (a.row.score as number) - (b.row.score as number))
    .slice(0, 3);

  /** Ranked actions — the advisor's own ranking, re-presented, top three only. */
  const topActions = opportunities.slice(0, 3);
  const timeline = paybackRows(opportunities);
  const showMirror = Boolean(
    assessment.owner_belief || assessment.primary_constraint
  );

  const blue = "#0284c7";
  const ink = "#111827";
  const muted = "#5b6675";
  const line = "#e4e9f0";
  const tint = "#f4fafd";

  /** Repeated at the top of every printed page so no sheet can stand alone. */
  const pageBanners = (
    <>
      {assessment.is_practice && (
        <p className="practice-strip">
          Practice engagement — not a client deliverable
        </p>
      )}
      {isDraft && <p className="draft-strip">{draftNotice}</p>}
    </>
  );

  return (
    <div
      className={`report-root${assessment.is_practice ? " is-practice" : ""}`}
    >
      <style>{REPORT_CSS}</style>
      <ReportToolbar assessmentId={assessment.id} />

      {/* ── Cover ─────────────────────────────────────────────────────── */}
      <section
        className="report-page"
        style={{ display: "flex", flexDirection: "column", minHeight: "9in" }}
      >
        {pageBanners}
        <div style={{ marginTop: "auto", position: "relative", zIndex: 2 }}>
          <p style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.3em", color: blue }}>
            C R E A i T
          </p>
          <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15, marginTop: 20 }}>
            Growth &amp; AI Diagnostic
          </h1>
          {roadmapIdentity ? (
            <>
              <p
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: ink,
                  marginTop: 8,
                  letterSpacing: "-0.015em",
                }}
              >
                {roadmapIdentity}
              </p>
              <p style={{ fontSize: 12, color: muted, marginTop: 6 }}>
                Expected annual operating-profit impact of the priced
                initiatives, overlap-adjusted. The arithmetic is inside.
              </p>
            </>
          ) : (
            <p style={{ fontSize: 22, color: muted, marginTop: 6 }}>
              Executive Blueprint
            </p>
          )}
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

      {/* ── Advisor letter ────────────────────────────────────────────── */}
      <section className="report-page">
        {pageBanners}
        <div
          style={{
            maxWidth: "64ch",
            fontSize: 13.5,
            lineHeight: 1.8,
            position: "relative",
            zIndex: 2,
          }}
        >
          <p style={{ fontSize: 12, color: muted }}>{reportDate}</p>
          <p style={{ marginTop: 26, fontSize: 15, fontWeight: 600 }}>
            Dear {firstName},
          </p>
          <p style={{ marginTop: 16 }}>
            {/* One template literal: JSX swallows the space between an
                expression and text that wraps to the next line. */}
            {`Thank you for the trust it takes to open a business to outside eyes. Over the course of this diagnostic you gave us hours of your time, straight answers to uncomfortable questions, and a look at how ${
              assessment.company?.trim() || "your business"
            } actually runs — not how anyone wishes it ran. We don't take that lightly, and this report was written to be worth it.`}
          </p>
          <p style={{ marginTop: 14 }}>
            What we examined is the machinery underneath your results: the
            growth engine that turns attention into revenue, the systems that
            decide whether the business can run and grow without you, and how
            much of the daily work runs on automation and AI instead of memory
            and heroics. Thirty indicators, each scored against written
            standards, with the evidence behind every one of them disclosed.
          </p>
          <p style={{ marginTop: 14 }}>
            A word on how to read what follows. Every number in these pages
            shows its arithmetic — nothing asks to be taken on faith. Ranges
            are ranges: where we estimate, we say so and state the basis.
            Where we did not examine something, the page says &ldquo;not
            examined&rdquo; rather than guessing. If a figure ever looks
            wrong, check the math printed beside it; that is exactly what
            it&apos;s there for.
          </p>
          <p style={{ marginTop: 14 }}>
            The plan in the back is yours to run, with us or without us.
            Either way, our aim for this document is simple: that a year from
            now the business runs cleaner, owes you fewer of its hours, and
            makes more money — and that you can point to the page where that
            started.
          </p>
          <p style={{ marginTop: 26 }}>With genuine appreciation for what you&apos;ve built,</p>
          <div style={{ marginTop: 30, borderTop: `2px solid ${line}`, paddingTop: 14, maxWidth: 260 }}>
            <p style={{ fontSize: 15, fontWeight: 800 }}>Maurice Grant</p>
            <p style={{ fontSize: 12.5, color: muted, marginTop: 2 }}>
              CREAiT · getcreait.com
            </p>
          </div>
        </div>
      </section>

      {/* ── The mirror ────────────────────────────────────────────────── */}
      {showMirror && (
        <section className="report-page">
          {pageBanners}
          <SectionHeading
            title="What you told us, and what the evidence says"
            deck="Every diagnostic starts with the owner's own diagnosis. Ours is only worth what you paid for it if it can disagree with you — and show its work."
          />

          {assessment.owner_belief && (
            <div className="avoid-break" style={{ marginTop: 30 }}>
              <p style={labelCap}>You said</p>
              <blockquote
                className="rp-rise"
                style={{
                  margin: "10px 0 0",
                  fontSize: 25,
                  lineHeight: 1.4,
                  fontWeight: 600,
                  color: ink,
                  letterSpacing: "-0.012em",
                }}
              >
                &ldquo;{unquote(assessment.owner_belief)}&rdquo;
              </blockquote>
            </div>
          )}

          {assessment.primary_constraint && (
            <div
              className="avoid-break rp-rise"
              style={{
                ["--d" as string]: "160ms",
                border: "1px solid #c9e4f5",
                background: tint,
                borderRadius: 10,
                padding: "18px 22px",
                marginTop: 26,
              }}
            >
              <p style={{ ...labelCap, color: blue }}>The evidence says</p>
              <p style={{ fontSize: 17, lineHeight: 1.55, marginTop: 8, fontWeight: 500 }}>
                {assessment.primary_constraint}
              </p>
            </div>
          )}

          {weakest.length > 0 && (
            <div className="avoid-break" style={{ marginTop: 28 }}>
              <p style={labelCap}>The weakest readings behind that finding</p>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: 10,
                  fontSize: 12.5,
                }}
              >
                <tbody>
                  {weakest.map(({ ind, row }) => (
                    <tr key={ind.key}>
                      <td style={{ ...tdStyle, width: 40, fontWeight: 800, color: blue }}>
                        {ind.key}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{ind.label}</td>
                      <td style={{ ...tdStyle, width: 126 }}>
                        {`${row.score} · ${SCALE_LABELS[row.score as 0 | 1 | 2 | 3 | 4]}`}
                      </td>
                      <td style={{ ...tdStyle, width: 104, color: muted }}>
                        {EVIDENCE_LABELS[row.evidence_confidence]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: muted, marginTop: 8, lineHeight: 1.6 }}>
                Scored 0–4 against written behavioral anchors. The last column
                says how we know: Reported (you told us), Demonstrated (we
                watched it work), Documented (we saw the record). We never score
                an indicator we did not examine.
              </p>
            </div>
          )}

          {activeWarnings.length > 0 && (
            <div
              className="avoid-break"
              style={{
                border: "1px solid #f3c6bf",
                background: "#fff6f4",
                borderRadius: 10,
                padding: "14px 18px",
                marginTop: 24,
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 800, color: "#b03a2e" }}>
                {`Critical constraint warning${
                  activeWarnings.length > 1 ? "s" : ""
                } — these sit alongside the score and are never averaged away:`}
              </p>
              <ul style={{ margin: "6px 0 0 18px", fontSize: 12.5, color: "#7f2d22", lineHeight: 1.6 }}>
                {activeWarnings.map((w) => (
                  <li key={w.key}>{w.label}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ── Dashboard ─────────────────────────────────────────────────── */}
      <section className="report-page">
        {pageBanners}
        <SectionHeading
          title="The One-Page Dashboard"
          deck="Everything that matters on one sheet. Every number here is either measured or shown with its arithmetic."
        />

        {/* Score + the band it sits in */}
        <div className="avoid-break" style={{ marginTop: 22 }}>
          <div style={{ display: "flex", gap: 30, alignItems: "flex-end" }}>
            <div style={{ minWidth: 172 }}>
              <p style={labelCap}>
                CREAiT Score{computed.provisional ? " (provisional)" : ""}
              </p>
              <p
                style={{
                  fontSize: 72,
                  fontWeight: 800,
                  color: ink,
                  lineHeight: 1,
                  marginTop: 4,
                  letterSpacing: "-0.035em",
                }}
              >
                {computed.creaitScore === null ? (
                  "—"
                ) : (
                  <CountUp value={computed.creaitScore} />
                )}
                <span style={{ fontSize: 21, fontWeight: 600, color: muted }}>
                  {" "}
                  / 100
                </span>
              </p>
              <p style={{ fontSize: 14, fontWeight: 800, color: blue, marginTop: 8 }}>
                {computed.band ?? "Not yet scored"}
              </p>
              <p style={{ fontSize: 11, color: muted, marginTop: 3, lineHeight: 1.5 }}>
                {`Built on ${computed.scoredCount} of ${INDICATORS.length} indicators`}
                {computed.naCount > 0 ? ` · ${computed.naCount} excluded as N/A` : ""}
              </p>
            </div>
            <div style={{ flex: 1, paddingBottom: 6 }}>
              <ScoreBandRail
                score={computed.creaitScore}
                potential={showPotential ? potential.creaitScore : null}
              />
            </div>
          </div>
          <p style={{ fontSize: 11, color: muted, marginTop: 10, lineHeight: 1.6 }}>
            Profit × 40% + Systems × 35% + Leverage × 25%, renormalized over the
            pillars that carry data. The band describes how the business runs
            today. It is not a grade, and it is not a prediction.
          </p>
          {showPotential && (
            <p style={{ fontSize: 11, color: muted, marginTop: 6, lineHeight: 1.6 }}>
              <b style={{ color: ink }}>
                {`The hollow marker is the target: ${potential.creaitScore} · ${potential.band}`}
              </b>
              {` — where this business lands with the 90-day plan executed, from targets your advisor set indicator by indicator (${potential.potentialSet} of ${computed.scoredCount} scored). Set by your advisor, not a projection we can promise.`}
            </p>
          )}
        </div>

        {/* Pillars */}
        <div className="avoid-break" style={{ marginTop: 20 }}>
          <p style={labelCap}>The three pillars, and how much of each we saw</p>
          <div style={{ marginTop: 12 }}>
            <PillarBars
              pillars={computed.pillars}
              counts={computed.pillarScoredCounts}
              thin={computed.thinPillars}
              potentials={showPotential ? potential.pillars : undefined}
            />
          </div>
          <p style={{ fontSize: 11, color: muted, marginTop: 2, lineHeight: 1.6 }}>
            {`Fewer than ${MIN_PILLAR_SAMPLE} of a pillar\u2019s 10 indicators reads as insufficient data, never as a number \u2014 a hatched rail means we did not look at enough of it.`}
            {showPotential &&
              " Outlined bars are the advisor-set targets with the 90-day plan executed \u2014 not projections."}
          </p>
        </div>

        {computed.provisional && !isDraft && (
          <p style={{ fontSize: 12, color: muted, marginTop: 12, lineHeight: 1.6 }}>
            {thinPillarLabels
              ? `The composite is provisional: ${thinPillarLabels} rests on too few indicators to state as a pillar score. It still contributes at its full weight, so treat the headline number as directional until those indicators are examined.`
              : `The composite is provisional — fewer than ${MIN_REPORT_RESOLVED} of ${INDICATORS.length} indicators have been resolved.`}
          </p>
        )}

        {/* The money map */}
        {opportunities.length > 0 && (
          <div style={{ marginTop: 20 }}>
            {/* The chart must never split; the total beneath it may reflow, so
                they take separate break scopes. One avoid-break around both
                pushed the whole exhibit to a fresh sheet over a few pixels. */}
            <div className="avoid-break">
              <p style={labelCap}>
                {`Where the money is — ${opportunities.length} priced initiative${
                  opportunities.length === 1 ? "" : "s"
                }, ranked by expected annual impact`}
              </p>
              <div style={{ marginTop: 12 }}>
                <MoneyMap opportunities={opportunities} />
              </div>
            </div>
            <div
              className="avoid-break"
              style={{
                borderTop: `2px solid ${ink}`,
                marginTop: 12,
                paddingTop: 12,
                display: "flex",
                gap: 24,
                alignItems: "baseline",
              }}
            >
              <div style={{ flex: "0 0 auto" }}>
                <p style={labelCap}>
                  {portfolio.overlapApplied ? "Portfolio, overlap-adjusted" : "Portfolio"}
                </p>
                <p
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    color: blue,
                    letterSpacing: "-0.025em",
                    lineHeight: 1.2,
                    marginTop: 2,
                  }}
                >
                  {formatMoney(portfolio.adjExpected)}
                  <span style={{ fontSize: 13, fontWeight: 600, color: muted }}>
                    {" "}
                    / year expected
                  </span>
                </p>
              </div>
              <p style={{ fontSize: 11.5, color: muted, lineHeight: 1.6, flex: 1 }}>
                {`Range ${formatMoney(portfolio.adjLow)} – ${formatMoney(
                  portfolio.adjHigh
                )}. `}
                {portfolio.overlapApplied
                  ? `The raw sum of these initiatives is ${formatMoney(
                      portfolio.rawExpected
                    )}; we multiply by ${
                      portfolio.overlapFactor
                    } because they share the same customers and the same hours. We never add raw maximums.`
                  : "There is a single initiative here, so there is no overlap to discount — the total is that initiative's own range."}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── What waiting costs ────────────────────────────────────────── */}
      {portfolio.adjExpected > 0 && (
        <section className="report-page">
          {pageBanners}
          <SectionHeading
            title="What waiting costs"
            deck="This is the same money as the page before, seen from the other side. Profit you do not capture is profit you do not have."
          />

          <div className="avoid-break" style={{ marginTop: 24 }}>
            <BleedProjection
              annualExpected={portfolio.adjExpected}
              operatingProfit={assessment.operating_profit}
            />
          </div>

          <div
            className="avoid-break"
            style={{
              border: `1px solid ${line}`,
              borderRadius: 10,
              padding: "14px 18px",
              marginTop: 20,
              fontSize: 12,
              color: muted,
              lineHeight: 1.65,
            }}
          >
            <b style={{ color: ink }}>What this projection is, and is not.</b>{" "}
            It is the {portfolio.overlapApplied ? "overlap-adjusted " : ""}
            expected case from the priced initiatives, divided by twelve and
            repeated. It assumes the gap stays exactly the size we measured, and
            it does not compound. It is not a forecast of your revenue and it is
            not a promise of recovery — it is what the evidence in this report
            implies you are leaving on the table, month after month, while
            nothing changes.
          </div>

          {timeline.length > 0 && (
            <div className="avoid-break" style={{ marginTop: 24 }}>
              <p style={labelCap}>And how fast each fix pays for itself</p>
              <div style={{ marginTop: 12 }}>
                <PaybackTimeline rows={timeline} />
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Roadmap to goal — two paths, one chart ────────────────────── */}
      {showRoadmap && (
        <section className="report-page">
          {pageBanners}
          <SectionHeading
            title="The same twelve months, lived twice"
            deck="One path changes nothing. The other executes the plan, initiative by initiative, each starting when its build lands. Same calendar, same arithmetic, one axis — and a projection, not a promise."
          />

          <div className="avoid-break" style={{ marginTop: 24 }}>
            <RoadmapToGoal
              rows={goalRows}
              annualExpected={portfolio.adjExpected}
              overlapApplied={portfolio.overlapApplied}
              overlapFactor={portfolio.overlapFactor}
            />
          </div>

          <div
            className="avoid-break"
            style={{
              border: `1px solid ${line}`,
              borderRadius: 10,
              padding: "14px 18px",
              marginTop: 20,
              fontSize: 12,
              color: muted,
              lineHeight: 1.65,
            }}
          >
            <b style={{ color: ink }}>Read this chart the way we drew it.</b>{" "}
            Both paths assume the measured gaps stay exactly the size they are
            today. The recovery line starts each initiative at its
            months-to-benefit and runs it at flat rate after — no compounding,
            no growth assumptions, no momentum effects. If the plan slips, the
            solid line slips with it; if the business grows, both lines were
            too small. This is the shape of the choice, not a forecast of
            either path.
          </div>
        </section>
      )}

      {/* ── Start Monday ──────────────────────────────────────────────── */}
      {topActions.length > 0 && (
        <section className="report-page">
          {pageBanners}
          <SectionHeading
            title="If you do only three things, do these"
            deck="In this order, ranked by expected annual operating-profit impact. Everything else in this report can wait."
          />

          <ol style={{ margin: "24px 0 0", padding: 0, listStyle: "none" }}>
            {topActions.map((opp, i) => {
              const monthly =
                opp.annual_expected !== null ? opp.annual_expected / 12 : null;
              const payback = paybackMonths(opp.fix_cost, opp.annual_expected);
              return (
                <li
                  key={opp.id}
                  className="avoid-break rp-rise"
                  style={{
                    ["--d" as string]: `${i * 110}ms`,
                    border: `1px solid ${line}`,
                    borderRadius: 10,
                    padding: "18px 22px",
                    marginBottom: 14,
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      fontSize: 30,
                      fontWeight: 800,
                      color: blue,
                      lineHeight: 1,
                      letterSpacing: "-0.04em",
                      minWidth: 28,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.35 }}>
                      {opp.title}
                    </p>
                    <p style={{ fontSize: 12.5, color: muted, marginTop: 6, lineHeight: 1.65 }}>
                      {`Worth ${formatMoney(
                        opp.annual_expected
                      )} a year in the expected case (range ${formatMoney(
                        opp.annual_low
                      )} – ${formatMoney(opp.annual_high)}).`}
                      {opp.fix_cost !== null && monthly !== null && payback !== null
                        ? ` Costs ${formatMoney(opp.fix_cost)} to put in place${
                            payback < 1
                              ? " and pays that back inside the first month."
                              : ` and pays that back in about ${formatPayback(payback)}.`
                          }`
                        : ""}
                      {opp.months_to_benefit !== null
                        ? ` First returns land around month ${Number(
                            opp.months_to_benefit
                          )}.`
                        : ""}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        gap: 22,
                        marginTop: 16,
                        fontSize: 10.5,
                        color: muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        fontWeight: 700,
                      }}
                    >
                      <span className="rp-fill">Owner</span>
                      <span className="rp-fill">Starts on</span>
                      <span className="rp-fill">First checkpoint</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {planItems.length > 0 && (
            <div
              className="avoid-break"
              style={{
                border: "1px solid #c9e4f5",
                background: tint,
                borderRadius: 10,
                padding: "16px 20px",
                marginTop: 8,
              }}
            >
              <p style={{ ...labelCap, color: blue }}>Your first move this week</p>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, marginTop: 8, fontWeight: 500 }}>
                {planItems[0]}
              </p>
              <p style={{ fontSize: 11, color: muted, marginTop: 8 }}>
                Step one of the 90-day plan later in this report, repeated here
                so nothing has to be looked up on Monday.
              </p>
            </div>
          )}

          <p style={{ fontSize: 12, color: muted, marginTop: 18, lineHeight: 1.7 }}>
            Fill in the three lines on each card before you close this document.
            Name the person, name the date, and name the day you will first
            check whether it worked. An initiative with no owner and no start
            date is a finding, not a plan — and findings do not change
            businesses.
          </p>
        </section>
      )}

      {/* ── Score detail ──────────────────────────────────────────────── */}
      <section className="report-page">
        {pageBanners}
        <SectionHeading
          title="The CREAiT Score, indicator by indicator"
          deck="The full working. Check any line of it."
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
          const thinPillar = computed.thinPillars[pillar.key];
          const unexamined = INDICATORS_BY_PILLAR[pillar.key].filter((ind) => {
            const row = scores[ind.key];
            return !row || (!row.not_applicable && row.score === null);
          });
          const shown = INDICATORS_BY_PILLAR[pillar.key].filter(
            (ind) => !unexamined.includes(ind)
          );
          return (
          <div key={pillar.key} className="avoid-break" style={{ marginTop: 22 }}>
            {/* Flex, not float: a floated score escapes its block when the
                pillar heading wraps or lands on a page break. */}
            <p className="report-flag" style={{ fontSize: 14, fontWeight: 800, color: blue }}>
              <span>
                {pillar.label}{" "}
                <span style={{ color: muted, fontWeight: 400 }}>
                  — {pillar.question}
                </span>
              </span>
              <span
                style={{
                  color: examined === 0 || thinPillar ? muted : ink,
                  whiteSpace: "nowrap",
                }}
              >
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
        {pageBanners}
        <SectionHeading
          title="Your Primary Business Constraint"
          deck="Where it came from, what it costs, and what moves first."
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
        {pageBanners}
        <SectionHeading
          title="The Profit Opportunities"
          deck="We show you the math before you spend a dollar."
        />
        <p style={{ fontSize: 13, color: muted, lineHeight: 1.6, marginTop: 10 }}>
          Every figure below is an annual operating-profit estimate shown as a
          range with its basis and its cost to capture. Payback = fix cost ÷
          expected monthly recovery.{" "}
          {portfolio.overlapApplied
            ? `The portfolio total is overlap-adjusted (×${portfolio.overlapFactor}) because initiatives share the same customers and hours — we never add raw maximums.`
            : "There is a single initiative here, so there is no overlap to discount — the total is that initiative's own range."}
          {hasEstimateBasedOpp &&
            " Items marked low-confidence are based on your estimates; treat the ranges as wide."}
          {hasBlueprints &&
            " Where a build is named, it is scoped the way we would build it: the automation or AI workflow, the manual work it replaces, and the hours it hands back."}
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
                <p className="report-flag" style={{ fontSize: 15, fontWeight: 800 }}>
                  <span>
                    {i + 1}. {opp.title}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      whiteSpace: "nowrap",
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
                {opp.blueprint && (
                  <div
                    style={{
                      borderTop: `1px solid ${line}`,
                      marginTop: 14,
                      paddingTop: 12,
                    }}
                  >
                    <p style={{ ...labelCap, color: blue }}>
                      The build that captures this
                    </p>
                    <p style={{ fontSize: 13, lineHeight: 1.65, marginTop: 6 }}>
                      {opp.blueprint}
                    </p>
                    {(opp.replaces ||
                      opp.hours_recovered_weekly !== null) && (
                      <p
                        style={{
                          fontSize: 12,
                          color: muted,
                          marginTop: 8,
                          lineHeight: 1.65,
                        }}
                      >
                        {opp.replaces && (
                          <>
                            <b style={{ color: ink }}>What it replaces:</b>{" "}
                            {opp.replaces}
                          </>
                        )}
                        {opp.replaces &&
                          opp.hours_recovered_weekly !== null &&
                          " "}
                        {opp.hours_recovered_weekly !== null && (
                          <b style={{ color: ink, whiteSpace: "nowrap" }}>
                            {`≈ ${Number(opp.hours_recovered_weekly)} hours/week of manual work recovered.`}
                          </b>
                        )}
                      </p>
                    )}
                  </div>
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
            <b>
              {portfolio.overlapApplied
                ? `Portfolio, overlap-adjusted (×${portfolio.overlapFactor}):`
                : "Portfolio:"}
            </b>{" "}
            low {formatMoney(portfolio.adjLow)} · expected{" "}
            <b style={{ color: blue }}>{formatMoney(portfolio.adjExpected)}</b>{" "}
            · high {formatMoney(portfolio.adjHigh)} per year.
            {portfolio.overlapApplied && (
              <span style={{ color: muted }}>
                {" "}
                Raw sum before adjustment: {formatMoney(portfolio.rawLow)} /{" "}
                {formatMoney(portfolio.rawExpected)} /{" "}
                {formatMoney(portfolio.rawHigh)}.
              </span>
            )}
          </div>
        )}
      </section>

      {/* ── 90-day plan ───────────────────────────────────────────────── */}
      <section className="report-page">
        {pageBanners}
        <SectionHeading
          title="The 90-Day Plan"
          deck="Yours to run, with or without us."
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
        {planItems.length > 0 && (
          <p style={{ fontSize: 12, color: muted, marginTop: 16, lineHeight: 1.7 }}>
            Write a name and a start date beside each line. A priority that
            names who and when gets finished far more often than one that names
            only what.
          </p>
        )}
        {activeWarnings.length > 0 && (
          <p style={{ fontSize: 12, color: muted, marginTop: 12, lineHeight: 1.6 }}>
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

      {/* ── The decision frame ────────────────────────────────────────── */}
      <section className="report-page">
        {pageBanners}
        <SectionHeading
          title="What to do with this report"
          deck="There are three honest ways to leave this page. All three are choices; only one of them pretends not to be."
        />

        <ol style={{ margin: "24px 0 0", padding: 0, listStyle: "none" }}>
          <li style={pathCard} className="avoid-break">
            <p style={pathTitle}>1 · Take the plan and run it yourselves</p>
            <p style={pathBody}>
              The 90-day plan, the priced initiatives and the builds behind
              them are complete and usable without us — that was the deal when
              you paid for a diagnostic instead of a pitch. Name an owner and a
              start date for each priority, hold the checkpoints, and re-check
              the arithmetic in ninety days. Everything you need to start is in
              these pages.
            </p>
          </li>
          <li style={pathCard} className="avoid-break">
            <p style={pathTitle}>2 · Run it with CREAiT</p>
            <p style={pathBody}>
              We build the workflows priced in this report as fixed-scope
              builds, or run the whole plan alongside you on advisory — weekly
              rhythm, a scoreboard, builds folded in, and the score re-tested
              each quarter. Working together starts exactly where this document
              ends: same numbers, same priorities, no re-discovery. Your
              diagnostic fee returns as 50% credit on everything we build. The
              final page lays both options out.
            </p>
          </li>
          <li style={pathCard} className="avoid-break">
            <p style={pathTitle}>3 · Do nothing</p>
            <p style={pathBody}>
              {portfolio.adjExpected > 0
                ? `Also a real option — it just isn't free: the gap measured in these pages runs at about ${formatMoney(
                    portfolio.adjExpected / 12
                  )} a month for as long as nothing changes.`
                : "Also a real option — the gaps documented in these pages simply stay where they are."}
            </p>
          </li>
        </ol>
      </section>

      {/* ── About this report ─────────────────────────────────────────── */}
      <section className="report-page">
        {pageBanners}
        <SectionHeading
          title="About this report"
          deck="How the numbers were made, and where their edges are."
        />

        <p style={aboutHead}>How the score works</p>
        <p style={aboutBody}>
          Thirty indicators, ten to a pillar — Profit (is the growth engine
          working?), Systems (can it run and grow without the owner?), and
          Leverage (how much runs on systems and AI?). Each is scored 0–4
          against written behavioral anchors: 0 Absent, 1 Informal, 2
          Developing, 3 Established, 4 Scalable. An indicator that does not
          apply to your business is excluded from the average entirely — it is
          never counted as a zero. Pillar scores average the indicators we
          examined; the composite weighs Profit at 40%, Systems at 35% and
          Leverage at 25%, renormalized over whatever pillars carry data. An
          indicator we did not examine is disclosed as exactly that.
        </p>

        <p style={aboutHead}>How we know what we claim</p>
        <p style={aboutBody}>
          Every scored indicator carries an evidence grade: Reported (you told
          us), Demonstrated (we watched it work), or Documented (we saw the
          record). A grade never changes a score — it tells you how much
          weight the reading can bear, and it widens the financial ranges
          built on it.
        </p>

        <p style={aboutHead}>How the money was estimated</p>
        <p style={aboutBody}>
          Every opportunity is an annual operating-profit estimate stated as a
          low / expected / high range with its basis printed beside it. The
          portfolio total multiplies the sum by an overlap factor
          {portfolio.overlapApplied
            ? ` (×${portfolio.overlapFactor} in this report)`
            : ""}{" "}
          because initiatives share the same customers and the same hours — we
          never add raw maximums. Payback is the cost to fix divided by the
          expected monthly recovery.
          {showPotential &&
            " Where a target score appears, it is your advisor's judgement of where an indicator lands with the 90-day plan executed — set by hand, labeled as such, and never a projection."}
        </p>

        <p style={aboutHead}>What this report is not</p>
        <p style={aboutBody}>
          It is built from the information you provided and what we directly
          observed during the engagement; we did not audit your books or
          independently verify financial statements. It is not an audit, a
          business valuation or appraisal, or financial, legal or tax advice.
          The figures are ranges with a stated basis — treat the expected case
          as the middle of a range, not a number the future owes you. Results
          depend on execution: on owners, start dates and checkpoints, and on
          conditions that can change underneath any plan. And the score
          describes how the business runs today — it is not a grade of you,
          and it is not a prediction.
        </p>
      </section>

      {/* ── What's next ───────────────────────────────────────────────── */}
      <section className="report-page">
        {pageBanners}
        <SectionHeading title="What's Next" deck="If you want help." />
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
            border: "1px solid #c9e4f5",
            background: "#f4fafd",
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
        {/* The document ends on the owner, not on a price. */}
        <div style={{ borderTop: `2px solid ${line}`, marginTop: 44, paddingTop: 28 }}>
          <p
            style={{
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1.35,
              letterSpacing: "-0.02em",
              maxWidth: "24ch",
            }}
          >
            You don&apos;t need more hustle. You need cleaner systems and
            clearer days.
          </p>
        </div>
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

/** Small uppercase caption naming an exhibit. */
const labelCap: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.11em",
  color: "#5b6675",
};

const nextCard: React.CSSProperties = {
  flex: 1,
  border: "1px solid #e4e9f0",
  borderRadius: 8,
  padding: "16px 18px",
};

/** The three paths on "What to do with this report". */
const pathCard: React.CSSProperties = {
  border: "1px solid #e4e9f0",
  borderRadius: 10,
  padding: "18px 22px",
  marginBottom: 14,
};

const pathTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
};

const pathBody: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  marginTop: 8,
};

/** "About this report" appendix typography. */
const aboutHead: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  marginTop: 22,
};

const aboutBody: React.CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.7,
  color: "#3d4653",
  marginTop: 6,
  maxWidth: "72ch",
};

/**
 * A message-titled heading, after the consulting "action title" convention:
 * the h2 states the finding and an optional deck carries the "so what". No
 * kicker — an eyebrow above a heading restates the heading in smaller type.
 */
function SectionHeading({ title, deck }: { title: string; deck?: string }) {
  return (
    <div>
      <h2
        style={{
          fontSize: 27,
          fontWeight: 800,
          lineHeight: 1.2,
          letterSpacing: "-0.022em",
          maxWidth: "30ch",
        }}
      >
        {title}
      </h2>
      {deck && (
        <p
          style={{
            fontSize: 14,
            color: "#5b6675",
            lineHeight: 1.55,
            marginTop: 8,
            maxWidth: "62ch",
          }}
        >
          {deck}
        </p>
      )}
      <div style={{ height: 2, background: "#111827", width: 44, marginTop: 16 }} />
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
