-- 0016 — A second signature on release, and a real link to what the
-- engagement became.
--
--   1. Second signature. 0012 records `reviewed_by` at the transition to
--      delivered, but nothing stopped the person who ran the engagement from
--      releasing their own work. This adds the facilitator to the row
--      (`facilitator_id` / `facilitator_name`, set to the creator by default
--      and editable in Setup) and the releaser's Clerk user id
--      (`reviewed_by_id`, beside the existing display name). The rule lives in
--      updateAssessment(): on a real (non-practice) engagement the releaser
--      must be a different Clerk user from the facilitator, and the
--      facilitator must be recorded. Practice engagements are exempt.
--
--      facilitator_id / facilitator_name are part of the delivered record and
--      are NOT release-safe — they lock with the document. reviewed_by_id is
--      written by the release itself, so it joins the allow-list below.
--
--   2. Conversion. The $7,500 Diagnostic fee is credited toward a Build or
--      Advisory retainer inside 60 days. The follow-through job used to guess
--      whether that happened by matching the assessment's company name against
--      cc_clients. `converted_to`, `converted_on` and `converted_client_id`
--      make it a fact: recorded from the workbench once the engagement is
--      delivered, so all three are release-safe. ON DELETE SET NULL — losing a
--      client row must never delete the engagement or its conversion record.

ALTER TABLE public.cc_assessments
  ADD COLUMN IF NOT EXISTS facilitator_id      TEXT,
  ADD COLUMN IF NOT EXISTS facilitator_name    TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by_id      TEXT,
  ADD COLUMN IF NOT EXISTS converted_to        TEXT
    CHECK (converted_to IN ('build', 'advisory')),
  ADD COLUMN IF NOT EXISTS converted_on        DATE,
  ADD COLUMN IF NOT EXISTS converted_client_id UUID
    REFERENCES public.cc_clients(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cc_assessments.facilitator_id IS
  'Clerk user id of the person who ran the engagement. Defaults to the creator; editable in Setup. On a non-practice engagement the releaser must be a different user.';
COMMENT ON COLUMN public.cc_assessments.facilitator_name IS
  'Display name of the facilitator, captured at write time so the record survives a rename or a departure.';
COMMENT ON COLUMN public.cc_assessments.reviewed_by_id IS
  'Clerk user id of the person who signed the release, beside the reviewed_by display name. Written at the transition to delivered; cleared on reopen.';
COMMENT ON COLUMN public.cc_assessments.converted_to IS
  'What the delivered Diagnostic became: build or advisory. Null = not yet. Read by the follow-through job for the $7,500 credit clock.';
COMMENT ON COLUMN public.cc_assessments.converted_on IS
  'Business date (America/New_York) the Build or Advisory was agreed.';
COMMENT ON COLUMN public.cc_assessments.converted_client_id IS
  'The cc_clients row the engagement became. ON DELETE SET NULL; must belong to the same org (checked in recordConversion).';

CREATE INDEX IF NOT EXISTS idx_cc_assessments_converted_client
  ON public.cc_assessments (converted_client_id)
  WHERE converted_client_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- The delivered-row lock (0012), with the new release-safe columns.
--
-- The field list below is unchanged from 0012 — the lock covers exactly the
-- same report-bearing columns — and is restated only because a trigger function
-- has to be replaced whole. What changes is what is deliberately absent from
-- it: reviewed_by_id joins reviewed_by / reviewed_at as part of the release
-- record, and converted_to / converted_on / converted_client_id are recorded
-- after delivery by definition. facilitator_id / facilitator_name are NOT in
-- the list either, but for the opposite reason: they are report-bearing (the
-- delivered record says who ran the engagement), so they are refused after
-- release like the constraint block is.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_assessments_lock_delivered_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD.status = 'delivered' AND NEW.status = 'delivered' AND (
       NEW.primary_constraint  IS DISTINCT FROM OLD.primary_constraint  OR
       NEW.constraint_symptoms IS DISTINCT FROM OLD.constraint_symptoms OR
       NEW.constraint_cost     IS DISTINCT FROM OLD.constraint_cost     OR
       NEW.constraint_fix      IS DISTINCT FROM OLD.constraint_fix      OR
       NEW.momentum_initiative IS DISTINCT FROM OLD.momentum_initiative OR
       NEW.overlay_flags       IS DISTINCT FROM OLD.overlay_flags       OR
       NEW.plan_items          IS DISTINCT FROM OLD.plan_items          OR
       NEW.overlap_factor      IS DISTINCT FROM OLD.overlap_factor      OR
       NEW.annual_revenue      IS DISTINCT FROM OLD.annual_revenue      OR
       NEW.gross_margin        IS DISTINCT FROM OLD.gross_margin        OR
       NEW.operating_profit    IS DISTINCT FROM OLD.operating_profit    OR
       NEW.owner_belief        IS DISTINCT FROM OLD.owner_belief        OR
       NEW.owner_objective     IS DISTINCT FROM OLD.owner_objective     OR
       NEW.pnl_on_file         IS DISTINCT FROM OLD.pnl_on_file         OR
       NEW.documents           IS DISTINCT FROM OLD.documents           OR
       NEW.facilitator_id      IS DISTINCT FROM OLD.facilitator_id      OR
       NEW.facilitator_name    IS DISTINCT FROM OLD.facilitator_name
     ) THEN
    RAISE EXCEPTION
      'Assessment % is delivered — move it back to status ''review'' before editing what the report says.',
      OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS cc_assessments_lock_delivered ON public.cc_assessments;
CREATE TRIGGER cc_assessments_lock_delivered
  BEFORE UPDATE ON public.cc_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.cc_assessments_lock_delivered_row();
