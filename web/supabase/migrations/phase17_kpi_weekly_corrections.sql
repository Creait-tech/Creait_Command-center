-- =============================================================================
-- phase17 — Retroactive corrections on the weekly scorecard
--
-- The Level 10 scorecard is what the leadership team acts on, so a number in a
-- past week has to be correctable ("we said 100 emails, it was closer to 80")
-- without the correction being either silent or temporary.
--
-- Three things this migration adds:
--
--  1. `cc_kpi_weekly.corrections` — an append-only JSONB log of every change to
--     an already-recorded value: {from, to, from_source, by, by_name, at}. The
--     row already records WHO entered the current number (`entered_by`); what
--     was missing was what it used to say.
--
--  2. `cc_kpi_weekly_record()` — one statement that upserts the week's value,
--     stamps the actor, marks the row `source = 'manual'`, and appends the
--     correction entry, all under a single FOR UPDATE row lock. A
--     read-modify-write from the app would let two founders editing the same
--     cell during a live meeting drop one another's log entry. Same reasoning,
--     and the same SECURITY INVOKER stance, as `cc_assessment_plan_append`
--     in 0005: RLS still applies to the caller exactly as it would for a
--     direct UPDATE.
--
--  3. `cc_kpi_weekly_protect_manual` — a trigger making "a human correction
--     wins permanently" a guarantee rather than a convention. Any UPDATE that
--     tries to turn a `manual` row into a `sync` row keeps the human's value,
--     source and attribution instead. It does not raise: a sync job that
--     re-derives a week it shouldn't own carries on and simply leaves the
--     corrected cell alone.
-- =============================================================================

ALTER TABLE public.cc_kpi_weekly
  ADD COLUMN IF NOT EXISTS corrections JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.cc_kpi_weekly.corrections IS
  'Append-only log of retroactive edits: [{from, to, from_source, by, by_name, at}]. Written only by cc_kpi_weekly_record().';

-- -----------------------------------------------------------------------------
-- Manual entries are never overwritten by a job.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_kpi_weekly_protect_manual()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD.source = 'manual' AND NEW.source = 'sync' THEN
    NEW.value           := OLD.value;
    NEW.source          := OLD.source;
    NEW.entered_by      := OLD.entered_by;
    NEW.entered_by_name := OLD.entered_by_name;
    NEW.corrections     := OLD.corrections;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS cc_kpi_weekly_protect_manual ON public.cc_kpi_weekly;
CREATE TRIGGER cc_kpi_weekly_protect_manual
  BEFORE UPDATE ON public.cc_kpi_weekly
  FOR EACH ROW
  EXECUTE FUNCTION public.cc_kpi_weekly_protect_manual();

-- -----------------------------------------------------------------------------
-- One atomic "a person entered this week's number".
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_kpi_weekly_record(
  p_org        TEXT,
  p_kpi        UUID,
  p_week       DATE,
  p_value      NUMERIC,
  p_actor      TEXT,
  p_actor_name TEXT
)
RETURNS SETOF public.cc_kpi_weekly
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_existing public.cc_kpi_weekly;
  v_entry    jsonb;
BEGIN
  SELECT * INTO v_existing
    FROM public.cc_kpi_weekly
   WHERE kpi_id = p_kpi AND week_start = p_week
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY
      INSERT INTO public.cc_kpi_weekly
        (org_id, kpi_id, week_start, value, source, entered_by, entered_by_name)
      VALUES
        (p_org, p_kpi, p_week, p_value, 'manual', p_actor, p_actor_name)
      RETURNING *;
    RETURN;
  END IF;

  -- Belt and braces alongside RLS: never let a caller's org id be used to
  -- stamp a row that belongs to a different workspace.
  IF v_existing.org_id <> p_org THEN
    RAISE EXCEPTION 'cc_kpi_weekly row belongs to a different org';
  END IF;

  -- Only a genuine change is a correction. Re-typing the same number, or
  -- confirming a synced figure by hand, is not history worth recording.
  IF v_existing.value IS DISTINCT FROM p_value THEN
    v_entry := jsonb_build_object(
      'from',        to_jsonb(v_existing.value),
      'to',          to_jsonb(p_value),
      'from_source', v_existing.source,
      'by',          p_actor,
      'by_name',     p_actor_name,
      'at',          to_jsonb(now())
    );
  END IF;

  RETURN QUERY
    UPDATE public.cc_kpi_weekly
       SET value           = p_value,
           source          = 'manual',
           entered_by      = p_actor,
           entered_by_name = p_actor_name,
           corrections     = CASE
                               WHEN v_entry IS NULL THEN COALESCE(corrections, '[]'::jsonb)
                               ELSE COALESCE(corrections, '[]'::jsonb) || jsonb_build_array(v_entry)
                             END,
           updated_at      = now()
     WHERE id = v_existing.id
    RETURNING *;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.cc_kpi_weekly_record(TEXT, UUID, DATE, NUMERIC, TEXT, TEXT)
  TO anon, authenticated, service_role;
