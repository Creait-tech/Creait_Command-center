-- =============================================================================
-- 0012 — Assessment release gate (rubric v2, Sep 8 2026)
--
-- A $7,500 deliverable needs a moment where a named human says "this is
-- releasable", and a delivered engagement needs to stop moving underneath the
-- PDF the client is holding. This migration adds both, plus the data-room
-- evidence the Profit pillar's honesty depends on.
--
-- cc_assessments
--   reviewed_by / reviewed_at   who signed the release and when. Written by
--                               updateAssessment() at the transition to
--                               'delivered', from the Clerk user in session.
--   delivered_at                NOT added here: it already exists from 0004 as
--                               DATE and stays that way (verified against the
--                               live schema). The release writes an
--                               America/New_York date into it — the report
--                               prints a date, never a timestamp, and
--                               reviewed_at below carries the exact instant.
--   delivered_snapshot          the exact scores, opportunities, computed
--                               scores and readiness result at release. The
--                               report re-renders from live rows, so without
--                               this there is no record of what was actually
--                               handed over.
--   pnl_on_file                 whether we hold a real P&L. false makes the
--                               report print the unaudited-figures disclosure
--                               and widens Reported-only ranges by ±25%.
--   documents                   the data-room checklist as
--                               [{name, kind, received_on}] — kind is one of
--                               pnl · revenue_by_customer · ar_aging ·
--                               rate_card · job_cost · other (see
--                               ASSESSMENT_DOCUMENT_KINDS in
--                               lib/assessment-instrument.ts).
--   meeting_id                  the results session in `meetings`, so the War
--                               Room transcript and the report can be read
--                               side by side. ON DELETE SET NULL — losing a
--                               recording must never delete an engagement.
--
-- cc_assessment_opportunities
--   basis_reported_only         the advisor's statement that every indicator
--                               this finding draws on is Reported. There is no
--                               indicator→opportunity mapping in the schema,
--                               so this is set by hand in the opportunity
--                               editor. It triggers the ±25% widening on its
--                               own, whether or not a P&L is on file.
--
-- SCORE INTEGRALITY: 0004 already declares score and potential_score as
-- SMALLINT CHECK (BETWEEN 0 AND 4). SMALLINT cannot hold 2.5, so integrality
-- is already guaranteed by the column type and no further CHECK is added here.
-- The app rejects fractional input before it reaches Postgres as well
-- (upsertIndicatorScore), because a rounded score is a silently wrong score.
--
-- RLS: the new columns live on tables that already carry org_isolation from
-- 0004; no policy changes are needed and none are made.
-- =============================================================================

ALTER TABLE public.cc_assessments
  ADD COLUMN IF NOT EXISTS reviewed_by        TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS pnl_on_file        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS documents          JSONB   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS meeting_id         UUID
    REFERENCES public.meetings(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cc_assessments.reviewed_by IS
  'Display name of the person who signed the release. Captured at write time so the record survives a rename or a departure.';
COMMENT ON COLUMN public.cc_assessments.delivered_snapshot IS
  'What was actually delivered: {scores, opportunities, computed, readiness, at}. Written once, at the transition to delivered.';
COMMENT ON COLUMN public.cc_assessments.pnl_on_file IS
  'false = Profit-pillar findings rest on unaudited owner figures; the report prints the disclosure and widens Reported-only ranges by ±25%.';
COMMENT ON COLUMN public.cc_assessments.documents IS
  'Data-room checklist: [{name, kind, received_on}]. kind in (pnl, revenue_by_customer, ar_aging, rate_card, job_cost, other).';

ALTER TABLE public.cc_assessment_opportunities
  ADD COLUMN IF NOT EXISTS basis_reported_only BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.cc_assessment_opportunities.basis_reported_only IS
  'true = every indicator behind this finding is Reported. Forces the ±25% widening and the "based on your estimates" line even when a P&L is on file.';

CREATE INDEX IF NOT EXISTS idx_cc_assessments_meeting
  ON public.cc_assessments (meeting_id);

-- -----------------------------------------------------------------------------
-- A delivered engagement stops moving.
--
-- The client is holding a PDF built from these rows. An edit to a score or an
-- opportunity after release silently changes what the printed report claims to
-- say, with no version anywhere to reconcile against — the snapshot above is
-- the record of what was handed over, and it must stay the truth.
--
-- This raises rather than silently ignoring the write: a facilitator who
-- corrects a score after delivery has to make a decision, not lose a keystroke.
--
-- TO REOPEN an engagement (the only supported path):
--   1. UPDATE cc_assessments SET status = 'review' WHERE id = '<id>';
--      (in the app: the status select on the workbench header)
--   2. make the corrections
--   3. mark it delivered again — readiness is re-run and a fresh
--      delivered_snapshot, reviewed_by and reviewed_at are written.
-- Moving the parent back to 'review' is what lifts the lock; there is no
-- bypass flag and none should be added.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_assessments_lock_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
    FROM public.cc_assessments
   WHERE id = OLD.assessment_id;

  IF v_status = 'delivered' THEN
    RAISE EXCEPTION
      'Assessment % is delivered — move it back to status ''review'' before editing %.',
      OLD.assessment_id, TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS cc_assessments_lock_delivered ON public.cc_assessment_scores;
CREATE TRIGGER cc_assessments_lock_delivered
  BEFORE UPDATE ON public.cc_assessment_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.cc_assessments_lock_delivered();

DROP TRIGGER IF EXISTS cc_assessments_lock_delivered ON public.cc_assessment_opportunities;
CREATE TRIGGER cc_assessments_lock_delivered
  BEFORE UPDATE ON public.cc_assessment_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.cc_assessments_lock_delivered();
