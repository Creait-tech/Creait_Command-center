-- =============================================================================
-- 0004 — Assessments (Growth & AI Diagnostic delivery)
--
-- Software delivery of the $7,500 CREAiT Growth & AI Diagnostic:
--   cc_assessments               one engagement (client, status, constraint,
--                                overlay flags, 90-day plan, overlap factor)
--   cc_assessment_scores         30 indicator scores (0–4 or N/A) + evidence
--                                confidence (Reported/Demonstrated/Documented)
--   cc_assessment_opportunities  priced findings — annual low/expected/high,
--                                fix cost, months-to-benefit, confidence
--
-- Instrument definition (indicators, anchors, weights, bands) lives in
-- web/lib/assessment-instrument.ts — keep indicator_key values in sync.
--
-- RLS matches 0003 exactly: parent table isolates on the Clerk org_id claim;
-- child tables filter through their parent so a row can never outlive its org.
-- =============================================================================

CREATE TABLE IF NOT EXISTS cc_assessments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               TEXT NOT NULL,
  client_name          TEXT NOT NULL,
  company              TEXT,
  industry             TEXT,
  status               TEXT NOT NULL DEFAULT 'intake'
                         CHECK (status IN ('practice','intake','scoring','review','delivered')),
  is_practice          BOOLEAN NOT NULL DEFAULT false,
  started_at           DATE,
  delivered_at         DATE,
  -- Baseline (feeds the report; all optional)
  annual_revenue       NUMERIC,
  gross_margin         NUMERIC,
  operating_profit     NUMERIC,
  owner_objective      TEXT,
  owner_belief         TEXT,   -- intake Q8 verbatim ("you said X / evidence says Y")
  -- Primary Business Constraint (Symptoms → Root → Annual Cost → First Intervention)
  primary_constraint   TEXT,   -- root constraint, one sentence
  constraint_symptoms  TEXT,
  constraint_cost      TEXT,   -- annual cost with basis stated
  constraint_fix       TEXT,   -- first intervention & measurement
  momentum_initiative  TEXT,   -- measurable win inside 30 days
  -- Critical Constraint Overlay — array of flag keys (see assessment-instrument.ts)
  overlay_flags        JSONB NOT NULL DEFAULT '[]',
  -- 90-day plan — array of strings (v1)
  plan_items           JSONB NOT NULL DEFAULT '[]',
  -- Portfolio totals = sum × overlap factor. Never sell the raw sum.
  overlap_factor       NUMERIC NOT NULL DEFAULT 0.7,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_assessments_org
  ON cc_assessments (org_id, status, created_at DESC);

-- One row per indicator actually touched (created lazily on first score).
-- score NULL + not_applicable false = not examined (report says so — never faked).
-- not_applicable true = N/A: removed from the denominator, never counted as zero.
CREATE TABLE IF NOT EXISTS cc_assessment_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id       UUID NOT NULL REFERENCES cc_assessments(id) ON DELETE CASCADE,
  indicator_key       TEXT NOT NULL,  -- P1..P10 · S1..S10 · L1..L10
  pillar              TEXT NOT NULL CHECK (pillar IN ('profit','systems','leverage')),
  score               SMALLINT CHECK (score BETWEEN 0 AND 4),
  not_applicable      BOOLEAN NOT NULL DEFAULT false,
  -- Confidence never changes the score — it widens ranges and is disclosed.
  evidence_confidence TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (evidence_confidence IN ('reported','demonstrated','documented','unknown')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, indicator_key)
);
CREATE INDEX IF NOT EXISTS idx_cc_assessment_scores_assessment
  ON cc_assessment_scores (assessment_id, indicator_key);

-- Priced findings. Dollar figures are ANNUAL operating-profit impact
-- (low/expected/high), per the scoring engine. Payback months is computed in
-- app code: fix_cost ÷ (annual_expected ÷ 12).
CREATE TABLE IF NOT EXISTS cc_assessment_opportunities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     UUID NOT NULL REFERENCES cc_assessments(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  finding           TEXT,
  annual_low        NUMERIC,
  annual_expected   NUMERIC,
  annual_high       NUMERIC,
  fix_cost          NUMERIC,
  months_to_benefit NUMERIC,
  confidence        TEXT NOT NULL DEFAULT 'medium'
                      CHECK (confidence IN ('high','medium','low')),
  rank              INTEGER NOT NULL DEFAULT 0,
  include_in_report BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_assessment_opportunities_assessment
  ON cc_assessment_opportunities (assessment_id, rank);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (pattern copied from 0003_cc_tables.sql)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE cc_assessments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_assessment_scores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_assessment_opportunities  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON cc_assessments;
CREATE POLICY org_isolation ON cc_assessments FOR ALL
  USING      (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)))
  WITH CHECK (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)));

DROP POLICY IF EXISTS org_isolation ON cc_assessment_scores;
CREATE POLICY org_isolation ON cc_assessment_scores FOR ALL
  USING      (assessment_id IN (SELECT id FROM cc_assessments WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))))
  WITH CHECK (assessment_id IN (SELECT id FROM cc_assessments WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))));

DROP POLICY IF EXISTS org_isolation ON cc_assessment_opportunities;
CREATE POLICY org_isolation ON cc_assessment_opportunities FOR ALL
  USING      (assessment_id IN (SELECT id FROM cc_assessments WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))))
  WITH CHECK (assessment_id IN (SELECT id FROM cc_assessments WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))));
