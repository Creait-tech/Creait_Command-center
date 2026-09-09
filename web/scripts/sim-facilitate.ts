/* eslint-disable @typescript-eslint/no-explicit-any */
// Simulation harness — plays the facilitator for the 20 fictional intakes.
// Not part of the app. Run: npx tsx scripts/sim-facilitate.ts <simDir> [n...]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  toScoreMap, computeScores, assessmentReadiness, widenOpportunities, portfolioTotals, marginShift,
  OVERLAY_FLAGS, INDICATORS,
} from "../lib/assessment-instrument";
import { intakePrefill, intakeCoverage, parseIntake, intakeProgress } from "../lib/assessment-intake";
import { runCrossChecks, parseSessionNotes, validateSessionScripts } from "../lib/assessment-session";
import { compute, toCalcRecord, parseCalc, CALCULATORS } from "../lib/opportunity-calculators";

const simDir = process.argv[2];
const only = process.argv.slice(3).map(Number);
const shells: any[] = JSON.parse(readFileSync(join(simDir, "shells.json"), "utf8"));
const dbIntake: Record<string, any> = existsSync(join(simDir, "db-intake.json"))
  ? Object.fromEntries(JSON.parse(readFileSync(join(simDir, "db-intake.json"), "utf8")).map((r: any) => [r.id, r]))
  : {};
mkdirSync(join(simDir, "results"), { recursive: true });
mkdirSync(join(simDir, "sql"), { recursive: true });

const q = (s: unknown) => (s === null || s === undefined ? "NULL" : `$q$${String(s)}$q$`);
const j = (v: unknown) => `$j$${JSON.stringify(v)}$j$::jsonb`;
const num = (v: unknown) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "NULL" : String(Number(v)));

const scriptProblems = validateSessionScripts();
const summary: any[] = [];

for (const shell of shells) {
  if (only.length && !only.includes(shell.n)) continue;
  const pf = join(simDir, "personas", `sim${String(shell.n).padStart(2, "0")}.json`);
  if (!existsSync(pf)) { summary.push({ n: shell.n, error: "no persona file" }); continue; }
  const p = JSON.parse(readFileSync(pf, "utf8"));
  const findings: string[] = [];
  const r: any = { n: shell.n, company: p.company, id: shell.id, findings };

  // ── 1. Intake round-trip (what the browser saved vs what the persona typed)
  const stored = dbIntake[shell.id];
  const intakeJson = stored?.intake ?? p.intake;
  r.intake_source = stored ? "db" : "persona(no db row)";
  if (stored) {
    const parsed = parseIntake(stored.intake);
    const missing = Object.keys(p.intake).filter((k) => !(k in parsed));
    const extra = Object.keys(parsed).filter((k) => !(k in p.intake));
    const diffs: string[] = [];
    for (const k of Object.keys(p.intake)) {
      if (!(k in parsed)) continue;
      const norm = (v: any) => JSON.stringify(Array.isArray(v) && v.every((x) => typeof x === "string") ? [...v].sort() : v);
      const a = norm(p.intake[k]); const b = norm((parsed as any)[k]);
      if (a !== b) diffs.push(`${k}: typed ${a.slice(0, 60)} → stored ${b.slice(0, 60)}`);
    }
    r.intake_roundtrip = { typed: Object.keys(p.intake).length, stored: Object.keys(parsed).length, missing, extra, diffs: diffs.slice(0, 12), diffCount: diffs.length, submitted_at: stored.intake_submitted_at };
    if (missing.length && !p.intake_incomplete) findings.push(`intake: ${missing.length} answered question(s) never reached the DB: ${missing.slice(0, 8).join(", ")}`);
    if (diffs.length) findings.push(`intake: ${diffs.length} answer(s) stored differently than typed (first: ${diffs[0]})`);
    if (!stored.intake_submitted_at && !p.intake_incomplete) findings.push("intake: submitted_at is null after the driver submitted");
  }
  r.intake_progress = intakeProgress(intakeJson).map((s: any) => ({ section: s.section ?? s.id, answered: s.answered, total: s.total, missingRequired: s.missingRequired }));

  // ── 2. Pre-fill and coverage
  const pre = intakePrefill(intakeJson);
  r.prefill = pre;
  const prof = p.profile ?? {};
  const cmp = (label: string, got: number | null, want: number | undefined, tol = 0.02) => {
    if (want === undefined) return;
    if (got === null) { findings.push(`prefill: ${label} came back null (profile says ${want})`); return; }
    if (Math.abs(got - want) > Math.abs(want) * tol + 1) findings.push(`prefill: ${label} = ${got}, profile says ${want}`);
  };
  cmp("annual_revenue", pre.annual_revenue, prof.revenue);
  cmp("gross_margin", pre.gross_margin, prof.grossMarginPct);
  cmp("operating_profit", pre.operating_profit, prof.operatingProfit);
  cmp("headcount", pre.headcount, prof.headcount, 0.1);
  if (!pre.owner_belief && !p.intake_incomplete) findings.push("prefill: owner_belief (q8) is empty");
  const cov = intakeCoverage(intakeJson) as any;
  const covArr = Array.isArray(cov) ? cov : Object.values(cov);
  r.coverage_uncovered = covArr.filter((c: any) => (c.questions?.length ?? c.answered?.length ?? 0) === 0).map((c: any) => c.key ?? c.indicator);

  // ── 3. Session capture + cross-checks
  const notes = parseSessionNotes({ blocks: p.session?.blockNotes ?? {}, ...(p.session?.engine ?? {}) } as any);
  const cc = runCrossChecks(notes, { annual_revenue: prof.revenue ?? pre.annual_revenue, gross_margin: prof.grossMarginPct ?? pre.gross_margin, operating_profit: prof.operatingProfit ?? pre.operating_profit, intake: intakeJson, pnl_on_file: !!p.dataRoom?.pnl_on_file });
  r.cross_checks = cc.map((c) => ({ id: c.id, status: c.status, detail: c.detail }));
  for (const c of cc) {
    const want = p.expected?.cross_checks?.[c.id];
    if (want && want !== c.status) findings.push(`cross-check ${c.id}: got ${c.status} ("${c.detail}"), persona expected ${want}`);
  }
  const crossChecks: any = {};
  for (const c of cc) crossChecks[c.id] = { status: c.status, detail: c.detail, note: p.session?.crossCheckNotes?.[c.id] ?? "" };
  const sessionNotes = { blocks: p.session?.blockNotes ?? {}, elapsed: { b1: 1800, b2: 3600, b3: 3600, b4: 2700, b5: 1800 }, crossChecks, ...(p.session?.engine ?? {}) };

  // ── 4. Scores
  const scoreRows: any[] = [];
  for (const ind of INDICATORS as any[]) {
    const s = p.scores?.[ind.key];
    if (!s) { findings.push(`scores: ${ind.key} missing from persona`); continue; }
    if (s.score !== null && s.score !== undefined && (!Number.isInteger(s.score) || s.score < 0 || s.score > 4)) findings.push(`scores: ${ind.key} has invalid score ${s.score}`);
    scoreRows.push({ id: ind.key, assessment_id: shell.id, indicator_key: ind.key, pillar: ind.pillar, score: s.na ? null : (s.score ?? null), potential_score: s.potential_score ?? null, not_applicable: !!s.na, evidence_confidence: s.evidence ?? "unknown", notes: s.note ?? null, created_at: "", updated_at: "" });
  }
  const scoreMap = toScoreMap(scoreRows as any);
  const computed = computeScores(scoreMap);
  r.computed = { pillarsRaw: computed.pillarsRaw, composite: computed.creaitScore, band: computed.band, excluded: computed.excludedPillars, resolved: computed.resolvedCount, na: computed.naCount, exclusions: (computed as any).pillarExclusions };
  if (p.expected?.band_guess && computed.band && computed.band !== p.expected.band_guess) findings.push(`band: computed ${computed.band} (${computed.creaitScore}), persona guessed ${p.expected.band_guess}`);

  // ── 5. Opportunities via calculators
  const baseline = { annualRevenue: prof.revenue ?? pre.annual_revenue, grossMarginPct: prof.grossMarginPct ?? pre.gross_margin, operatingProfit: prof.operatingProfit ?? pre.operating_profit };
  const opps: any[] = [];
  let rank = 0;
  for (const o of p.opportunities ?? []) {
    rank += 1;
    let low: number | null = null, expected: number | null = null, high: number | null = null, calc: any = null, hours: number | null = null;
    if (o.calculator) {
      const kind = o.calculator.kind;
      if (!(CALCULATORS as any)[kind]) { findings.push(`opportunity "${o.title}": unknown calculator ${kind}`); continue; }
      const res: any = compute(kind, o.calculator.inputs, baseline);
      if (!res.ok) { findings.push(`opportunity "${o.title}": calculator refused — ${res.error}`); continue; }
      low = Math.round(res.low); expected = Math.round(res.expected); high = Math.round(res.high);
      calc = toCalcRecord(kind, res, "2026-09-09T12:00:00.000Z");
      if (parseCalc(calc) === null) findings.push(`opportunity "${o.title}": toCalcRecord output does not pass parseCalc`);
      if (res.capacityHoursWeekly !== undefined) hours = res.capacityHoursWeekly;
      if (!(low <= expected && expected <= high)) findings.push(`opportunity "${o.title}": calculator returned out-of-order range ${low}/${expected}/${high}`);
    } else if (o.hand_entered) {
      ({ annual_low: low, annual_expected: expected, annual_high: high } = o.hand_entered);
    }
    opps.push({ title: o.title, finding: o.finding ?? null, annual_low: low, annual_expected: expected, annual_high: high, fix_cost: o.fix_cost ?? null, months_to_benefit: o.months_to_benefit ?? null, confidence: o.confidence ?? "medium", rank, include_in_report: o.include_in_report !== false, blueprint: o.blueprint ?? null, replaces: o.replaces ?? null, hours_recovered_weekly: hours ?? o.hours_recovered_weekly ?? null, owner_estimate_annual: o.owner_estimate_annual ?? null, basis_reported_only: !!o.basis_reported_only, calc });
  }
  r.opportunities = opps.map((o) => ({ title: o.title, low: o.annual_low, expected: o.annual_expected, high: o.annual_high, calc: o.calc?.kind ?? "hand", chain: o.calc?.chain }));

  // ── 6. Gate, widening, portfolio
  const a = p.assessment ?? {};
  const badFlags = (a.overlay_flags ?? []).filter((f: string) => !OVERLAY_FLAGS.some((o) => o.key === f));
  if (badFlags.length) findings.push(`overlay: unknown flag keys ${badFlags.join(", ")}`);
  const gateIn = (reviewer: string | null) => ({ scores: scoreMap, opportunities: opps, assessment: { primary_constraint: a.primary_constraint ?? null, constraint_cost: a.constraint_cost ?? null, pnl_on_file: !!p.dataRoom?.pnl_on_file, reviewed_by: reviewer, overlay_flags: a.overlay_flags ?? [], overlap_factor: a.overlap_factor ?? 0.7, owner_belief: a.owner_belief ?? pre.owner_belief, plan_items: a.plan_items ?? [] } });
  const g0 = assessmentReadiness(gateIn(null));
  const g1 = assessmentReadiness(gateIn("Maurice Grant"));
  r.gate = { withoutReviewer: g0, withReviewer: g1 };
  if (!g0.blockers.some((b) => /reviewer/i.test(b))) findings.push("gate: no reviewer blocker when reviewer is null");
  if (p.expected?.gate_should_pass !== undefined && p.expected.gate_should_pass !== g1.ready) findings.push(`gate: persona expected pass=${p.expected.gate_should_pass}, got ${g1.ready}; blockers: ${g1.blockers.join(" | ")}`);
  for (const eb of p.expected?.expected_blockers ?? []) if (!g1.blockers.some((b) => b.toLowerCase().includes(String(eb).toLowerCase().slice(0, 18)))) findings.push(`gate: expected blocker not raised: "${eb}"`);
  const widened = widenOpportunities(opps, !!p.dataRoom?.pnl_on_file);
  const totals = portfolioTotals(widened as any, a.overlap_factor ?? 0.7);
  r.portfolio = { adjLow: Math.round(totals.adjLow), adjExpected: Math.round(totals.adjExpected), adjHigh: Math.round(totals.adjHigh), factor: totals.overlapFactor, widened: widened.map((w: any) => w.widened) };
  r.margin = marginShift(baseline.annualRevenue, baseline.operatingProfit, totals.adjExpected);

  // ── 7. SQL to persist exactly what the facilitator would have saved
  const sql: string[] = [];
  sql.push(`UPDATE cc_assessments SET status='scoring', annual_revenue=${num(baseline.annualRevenue)}, gross_margin=${num(baseline.grossMarginPct)}, operating_profit=${num(baseline.operatingProfit)}, owner_objective=${q(a.owner_objective ?? pre.owner_objective)}, owner_belief=${q(a.owner_belief ?? pre.owner_belief)}, primary_constraint=${q(a.primary_constraint)}, constraint_symptoms=${q(a.constraint_symptoms)}, constraint_cost=${q(a.constraint_cost)}, constraint_fix=${q(a.constraint_fix)}, momentum_initiative=${q(a.momentum_initiative)}, overlay_flags=${j(a.overlay_flags ?? [])}, plan_items=${j(a.plan_items ?? [])}, overlap_factor=${num(a.overlap_factor ?? 0.7)}, pnl_on_file=${p.dataRoom?.pnl_on_file ? "true" : "false"}, documents=${j(p.dataRoom?.documents ?? [])}, session_notes=${j(sessionNotes)}, intake_token=NULL WHERE id='${shell.id}';`);
  sql.push(`DELETE FROM cc_assessment_scores WHERE assessment_id='${shell.id}'; DELETE FROM cc_assessment_opportunities WHERE assessment_id='${shell.id}';`);
  for (const s of scoreRows) sql.push(`INSERT INTO cc_assessment_scores (assessment_id, indicator_key, pillar, score, potential_score, not_applicable, evidence_confidence, notes) VALUES ('${shell.id}', '${s.indicator_key}', '${s.pillar}', ${num(s.score)}, ${num(s.potential_score)}, ${s.not_applicable}, '${s.evidence_confidence}', ${q(s.notes)});`);
  for (const o of opps) sql.push(`INSERT INTO cc_assessment_opportunities (assessment_id, title, finding, annual_low, annual_expected, annual_high, fix_cost, months_to_benefit, confidence, rank, include_in_report, blueprint, replaces, hours_recovered_weekly, owner_estimate_annual, basis_reported_only, calc) VALUES ('${shell.id}', ${q(o.title)}, ${q(o.finding)}, ${num(o.annual_low)}, ${num(o.annual_expected)}, ${num(o.annual_high)}, ${num(o.fix_cost)}, ${num(o.months_to_benefit)}, '${o.confidence}', ${o.rank}, ${o.include_in_report}, ${q(o.blueprint)}, ${q(o.replaces)}, ${num(o.hours_recovered_weekly)}, ${num(o.owner_estimate_annual)}, ${o.basis_reported_only}, ${o.calc ? j(o.calc) : "NULL"});`);
  writeFileSync(join(simDir, "sql", `sim${String(shell.n).padStart(2, "0")}.sql`), sql.join("\n"));
  r.snapshot_for_delivery = g1.ready ? { computed: r.computed, readiness: g1, portfolio: r.portfolio } : null;
  writeFileSync(join(simDir, "results", `facilitate-${String(shell.n).padStart(2, "0")}.json`), JSON.stringify(r, null, 1));
  summary.push({ n: shell.n, company: p.company, composite: computed.creaitScore, band: computed.band, excluded: computed.excludedPillars, resolved: computed.resolvedCount, gate: g1.ready, blockers: g1.blockers.length, warnings: g1.warnings.length, crossFlags: cc.filter((c) => c.status === "flag").map((c) => c.id), portfolioExpected: r.portfolio.adjExpected, findings: findings.length });
}
writeFileSync(join(simDir, "results", "facilitate-summary.json"), JSON.stringify({ scriptProblems, summary }, null, 1));
console.log(JSON.stringify({ scriptProblems, summary }, null, 1));
