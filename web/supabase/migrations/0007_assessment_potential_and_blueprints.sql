-- =============================================================================
-- 0007 — Potential scores + AI Workflow Blueprints (Executive Blueprint v2)
--
-- cc_assessment_scores.potential_score
--   The advisor-set target for an indicator with the 90-day plan executed.
--   Same 0–4 behavioral scale as `score`. NULL = no target set. It is a
--   judgement by the advisor, never a computed projection — the report only
--   renders a potential composite when enough indicators carry one (see
--   MIN_POTENTIAL_SET in lib/assessment-instrument.ts) and always labels it
--   "set by your advisor, not a projection we can promise".
--
-- cc_assessment_opportunities.blueprint / replaces / hours_recovered_weekly
--   The AI Workflow Blueprint behind a priced finding: what gets built (the
--   automation / AI / tech solution, named plainly), the manual work it
--   eliminates, and roughly how many hours a week that recovers. This is how
--   the report says "profit through AI, automation and tech" instead of
--   generic consulting advice. All optional — an opportunity without a
--   blueprint renders exactly as before.
-- =============================================================================

ALTER TABLE cc_assessment_scores
  ADD COLUMN IF NOT EXISTS potential_score SMALLINT
    CHECK (potential_score BETWEEN 0 AND 4);

ALTER TABLE cc_assessment_opportunities
  ADD COLUMN IF NOT EXISTS blueprint TEXT,
  ADD COLUMN IF NOT EXISTS replaces TEXT,
  ADD COLUMN IF NOT EXISTS hours_recovered_weekly NUMERIC;
