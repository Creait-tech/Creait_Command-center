-- =============================================================================
-- 0013 — Intake in-app, opportunity calculators, outcome capture (Sep 8 2026)
--
-- Three gaps the rigor review left after the release gate (0012):
--
--   1. Dollar figures were typed. An opportunity's low / expected / high now
--      carries the calculator that produced it, so every range in the report
--      is derivable from baseline inputs and the chain can be printed.
--   2. Intake answers lived in a form outside the system and were re-keyed by
--      hand. The owner's pre-assessment intake is now written straight into the
--      assessment, keyed by question id, through a tokenised link.
--   3. Nothing recorded what happened after delivery. The day-30 and day-90
--      reviews now store planned-vs-actual per plan item, which is the only
--      way the instrument learns from its own deliveries.
--
-- cc_assessment_opportunities
--   calc                 {kind, inputs, outputs, chain[]} from one of the
--                        calculators in lib/opportunity-calculators.ts; null
--                        when the range was entered by hand. The report prints
--                        `chain` in Appendix B and labels hand-entered ranges.
--
-- cc_assessments
--   intake               Owner Pre-Assessment Intake answers, keyed by the
--                        question ids in lib/assessment-intake.ts. "Not
--                        currently known" is stored as the literal string
--                        "unknown", never as 0 or null.
--   intake_token         The unguessable path segment of the owner's intake
--                        link (/intake/<token>). Rotated when the coordinator
--                        re-sends; cleared when status leaves 'intake'.
--   intake_submitted_at  When the owner pressed submit. Null while open.
--   outcomes             {day30: Review, day90: Review} where Review =
--                        {reviewed_on, reviewer, items: [{plan_item, status,
--                        kpi, baseline, actual, note}], summary}. Optional;
--                        never gates delivery.
--
-- The public intake route writes with the service-role client, scoped to a
-- single row matched on intake_token AND status = 'intake'. It may write only
-- `intake` and `intake_submitted_at`. RLS is unchanged for everything else.
-- =============================================================================

ALTER TABLE public.cc_assessment_opportunities
  ADD COLUMN IF NOT EXISTS calc JSONB;

COMMENT ON COLUMN public.cc_assessment_opportunities.calc IS
  'Calculator record {kind, inputs, outputs, chain[]} that produced the range; null = entered by hand (the report says so).';

ALTER TABLE public.cc_assessments
  ADD COLUMN IF NOT EXISTS intake              JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS intake_token        UUID,
  ADD COLUMN IF NOT EXISTS intake_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcomes            JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_assessments_intake_token
  ON public.cc_assessments (intake_token)
  WHERE intake_token IS NOT NULL;

COMMENT ON COLUMN public.cc_assessments.intake IS
  'Owner Pre-Assessment Intake answers keyed by question id (lib/assessment-intake.ts). Unknown answers are the string "unknown", never zero.';
COMMENT ON COLUMN public.cc_assessments.intake_token IS
  'Path segment of the owner intake link. Valid only while status = intake. Rotated on re-send.';
COMMENT ON COLUMN public.cc_assessments.outcomes IS
  'Day-30 and day-90 follow-through: planned vs actual per plan item. Never gates delivery.';

-- The delivered lock (0012) compares a fixed list of report-bearing fields.
-- Outcomes are recorded AFTER delivery by design, so they are deliberately not
-- added to that list. Intake is captured before scoring and is not printed in
-- the report, so it is not added either.
