-- =============================================================================
-- 0005 — Atomic 90-day plan-item writes
--
-- 0004 stores the 90-day plan as a JSONB array on cc_assessments. The app
-- mutated it with a read-modify-write round trip, which is only safe while a
-- single browser tab is doing the editing: two tabs (or two founders on the
-- same engagement, which is the normal case during a live scoring session)
-- both read the same array and the second write silently discards the first
-- item. A dropped 90-day priority is a defect in a $7,500 deliverable.
--
-- These two functions do the mutation inside a single statement / a single
-- FOR UPDATE row lock, so concurrent callers serialize on the row and every
-- item survives regardless of arrival order.
--
-- SECURITY INVOKER (the default) on purpose: RLS still applies to the caller
-- exactly as it does for a direct UPDATE. The explicit org_id predicate is the
-- same belt-and-braces check the server actions already make.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cc_assessment_plan_append(
  p_id    UUID,
  p_org   TEXT,
  p_item  TEXT
)
RETURNS SETOF public.cc_assessments
LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  UPDATE public.cc_assessments
     SET plan_items = COALESCE(plan_items, '[]'::jsonb) || to_jsonb(btrim(p_item)),
         updated_at = now()
   WHERE id = p_id
     AND org_id = p_org
     AND btrim(COALESCE(p_item, '')) <> ''
  RETURNING *;
$$;

-- Removes ONE occurrence. Prefers the caller's index while it still holds the
-- expected text; otherwise falls back to the first text match so a concurrent
-- insert can never shift the index onto the wrong line.
CREATE OR REPLACE FUNCTION public.cc_assessment_plan_remove(
  p_id     UUID,
  p_org    TEXT,
  p_item   TEXT,
  p_index  INTEGER
)
RETURNS SETOF public.cc_assessments
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_items jsonb;
  v_idx   integer;
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

  IF p_index IS NOT NULL
     AND p_index >= 0
     AND p_index < jsonb_array_length(v_items)
     AND v_items ->> p_index = p_item
  THEN
    v_idx := p_index;
  ELSE
    SELECT MIN(t.ord)::integer - 1 INTO v_idx
      FROM jsonb_array_elements_text(v_items) WITH ORDINALITY AS t(val, ord)
     WHERE t.val = p_item;
  END IF;

  IF v_idx IS NULL THEN
    -- Already gone (another tab removed it). Return the row unchanged so the
    -- client converges on the truth instead of erroring.
    RETURN QUERY SELECT * FROM public.cc_assessments
                  WHERE id = p_id AND org_id = p_org;
    RETURN;
  END IF;

  RETURN QUERY
    UPDATE public.cc_assessments
       SET plan_items = v_items - v_idx,
           updated_at = now()
     WHERE id = p_id AND org_id = p_org
    RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cc_assessment_plan_append(UUID, TEXT, TEXT)
  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cc_assessment_plan_remove(UUID, TEXT, TEXT, INTEGER)
  TO anon, authenticated, service_role;
