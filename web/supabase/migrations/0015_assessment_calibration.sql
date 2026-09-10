-- =============================================================================
-- 0015 — Calibration attempts (facilitator certification, Sep 9 2026)
--
-- A trainee scores a calibration case blind — the intake, the session capture
-- and the data room, without the key — and the app compares the thirty scores
-- to the key afterwards. The cases themselves live in the codebase
-- (web/lib/calibration-cases/*.json) so the key never sits in a table a
-- trainee can query; only the attempt is stored here.
--
-- cc_assessment_calibrations
--   case_slug       which case (file name without .json in lib/calibration-cases).
--   key_version     the key's version string at the time of the attempt, so an
--                   attempt scored against an older key can be told apart from
--                   one scored against the current one.
--   trainee_id      Clerk user id of the person scoring; trainee_name is the
--                   display name captured at write time (survives a rename).
--   answers         { scores: { P1: { score, na, evidence, note }, … },
--                     primary_constraint, momentum_initiative } — the
--                   trainee's work in progress, autosaved.
--   result          written once at submission: per-indicator deltas and the
--                   pass/fail stats (see compareToKey in lib/calibration.ts).
--   submitted_at    null while in progress. A submitted attempt is never
--                   edited; a retake is a new row.
--
-- RLS: org_isolation, same shape as every cc_ table (0003/0004). Every
-- founder in the org can read every attempt — calibration is a team record,
-- and the disagreements are the agenda for the next rubric session.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cc_assessment_calibrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        TEXT NOT NULL,
  case_slug     TEXT NOT NULL,
  key_version   TEXT,
  trainee_id    TEXT NOT NULL,
  trainee_name  TEXT,
  answers       JSONB NOT NULL DEFAULT '{}'::jsonb,
  result        JSONB,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_assessment_calibrations_org
  ON public.cc_assessment_calibrations (org_id, trainee_id, case_slug, submitted_at);

COMMENT ON TABLE public.cc_assessment_calibrations IS
  'One blind-scoring attempt at a calibration case. Cases and keys live in the codebase (web/lib/calibration-cases); only the trainee''s answers and the comparison result are stored.';
COMMENT ON COLUMN public.cc_assessment_calibrations.answers IS
  '{ scores: { <indicator>: { score, na, evidence, note } }, primary_constraint, momentum_initiative }. Autosaved while in progress; frozen at submission.';
COMMENT ON COLUMN public.cc_assessment_calibrations.result IS
  'Comparison to the key, written at submission: { items: { <indicator>: { yours, key, delta, evidence_steps, has_note } }, stats: { exact, within_one, evidence_within_one, notes_missing, mad, pillar_ranking_match, pass } }.';

ALTER TABLE public.cc_assessment_calibrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON public.cc_assessment_calibrations;
CREATE POLICY org_isolation ON public.cc_assessment_calibrations FOR ALL
  USING      (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)))
  WITH CHECK (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)));
