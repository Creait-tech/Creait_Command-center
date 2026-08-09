-- =============================================================================
-- 0008 — Owner's own estimate on an opportunity (downward-anchoring display)
--
-- cc_assessment_opportunities.owner_estimate_annual
--   What the OWNER thinks the opportunity is worth per year, captured in the
--   room. The report renders it only when it sits ABOVE our modeled expected
--   case — "The owner's own estimate was $X. We modeled $Y." — because the
--   advisor visibly lowering the number is the trust act. It never renders
--   the other way around: a report shown raising the owner's number reads as
--   salesmanship, not conservatism. NULL = not captured; nothing renders.
-- =============================================================================

ALTER TABLE cc_assessment_opportunities
  ADD COLUMN IF NOT EXISTS owner_estimate_annual NUMERIC;
