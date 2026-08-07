-- =============================================================================
-- 0006 — Session notes for the Diagnostic Intensive, and atomic plan reordering
--
-- 1. session_notes
--
-- The Facilitator Guide runs the 4-hour intensive as five conversational
-- blocks (Story & Destination · The Growth Engine · Operations & the Machine ·
-- Time, Tools & AI · Risk & Close) and scores the 30 indicators AFTERWARDS,
-- from notes. Nothing in 0004 could hold those notes or the engine numbers the
-- calculator needs (leads/month, conversion, average value, response time), so
-- the workbench had nowhere to put what the facilitator actually captures live.
--
-- One JSONB column rather than five TEXT columns: the block set belongs to the
-- delivery playbook, not the schema, and it will change before the columns
-- would be worth migrating. Shape (all keys optional):
--   { "blocks":  { "b1".."b5": "free text notes" },
--     "elapsed": { "b1".."b5": seconds spent in that block },
--     "leads_per_month" | "conversion_rate" | "avg_deal_value" |
--     "response_time": "free text — estimates are fine" }
--
-- Writes are read-modify-write on the server (updateSessionNotes in
-- web/lib/assessment-actions.ts) so two blocks saving at once cannot clobber
-- each other. No RLS change: the column rides the existing cc_assessments
-- org_isolation policy from 0004.
--
-- 2. cc_assessment_plan_reorder
--
-- 0005 made appending and removing a 90-day plan item atomic. Moving one is the
-- same hazard — a read-modify-write reorder from a stale client array can
-- resurrect a deleted item or drop a concurrent insert — so it gets the same
-- treatment: one FOR UPDATE row lock, the swap done in the database.
--
-- SECURITY INVOKER (the default) on purpose: RLS still applies to the caller
-- exactly as it does for a direct UPDATE. The explicit org_id predicate is the
-- same belt-and-braces check the server actions already make.
-- =============================================================================

ALTER TABLE cc_assessments
  ADD COLUMN IF NOT EXISTS session_notes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Swaps ONE item with its neighbour. Prefers the caller's index while it still
-- holds the expected text; otherwise falls back to the first text match so a
-- concurrent insert can never shift the index onto the wrong line.
CREATE OR REPLACE FUNCTION public.cc_assessment_plan_reorder(
  p_id        UUID,
  p_org       TEXT,
  p_item      TEXT,
  p_index     INTEGER,
  p_direction TEXT
)
RETURNS SETOF public.cc_assessments
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_items jsonb;
  v_from  integer;
  v_to    integer;
  v_len   integer;
BEGIN
  SELECT plan_items INTO v_items
    FROM public.cc_assessments
   WHERE id = p_id AND org_id = p_org
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' THEN
    RETURN QUERY SELECT * FROM public.cc_assessments
                  WHERE id = p_id AND org_id = p_org;
    RETURN;
  END IF;

  v_len := jsonb_array_length(v_items);

  IF p_index IS NOT NULL
     AND p_index >= 0
     AND p_index < v_len
     AND v_items ->> p_index = p_item
  THEN
    v_from := p_index;
  ELSE
    SELECT MIN(t.ord)::integer - 1 INTO v_from
      FROM jsonb_array_elements_text(v_items) WITH ORDINALITY AS t(val, ord)
     WHERE t.val = p_item;
  END IF;

  IF v_from IS NULL THEN
    -- Already gone (another tab removed it). Return unchanged so the client
    -- converges on the truth instead of erroring.
    RETURN QUERY SELECT * FROM public.cc_assessments
                  WHERE id = p_id AND org_id = p_org;
    RETURN;
  END IF;

  v_to := CASE WHEN p_direction = 'up' THEN v_from - 1 ELSE v_from + 1 END;

  IF v_to < 0 OR v_to >= v_len THEN
    RETURN QUERY SELECT * FROM public.cc_assessments
                  WHERE id = p_id AND org_id = p_org;
    RETURN;
  END IF;

  RETURN QUERY
    UPDATE public.cc_assessments
       SET plan_items = jsonb_set(
             jsonb_set(v_items, ARRAY[v_to::text], v_items -> v_from),
             ARRAY[v_from::text],
             v_items -> v_to
           ),
           updated_at = now()
     WHERE id = p_id AND org_id = p_org
    RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION
  public.cc_assessment_plan_reorder(UUID, TEXT, TEXT, INTEGER, TEXT)
  TO anon, authenticated, service_role;
