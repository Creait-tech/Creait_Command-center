-- ============================================================================
-- 0011 — Seed client: Frederick Phillips / Bridge Living Co
--
-- Adds the first CREAiT implementation client to cc_clients so the
-- /clients dashboard reflects live delivery work instead of an empty roster.
--
-- Idempotent: safe to re-run. Matches on (org_id, name).
--
-- org_id must be the Clerk organization id for the CREAiT workspace. It is
-- passed in via :org_id when running through psql/Supabase SQL editor, or
-- edited inline before applying. No secrets are stored in this file.
--
-- Supporting client files live in the Google Drive CLIENTS folder:
--   https://drive.google.com/drive/folders/18nocvfA_PdS13jnbYT6nU4pOGOR6GLi6
-- ============================================================================

DO $$
DECLARE
  v_org_id TEXT := current_setting('app.seed_org_id', true);
BEGIN
  -- Fall back to the single existing org if one is already present.
  IF v_org_id IS NULL OR v_org_id = '' THEN
    SELECT org_id INTO v_org_id
    FROM cc_clients
    GROUP BY org_id
    ORDER BY count(*) DESC
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL OR v_org_id = '' THEN
    RAISE NOTICE 'Skipping Fred Phillips seed: no org_id resolved. Set app.seed_org_id and re-run.';
    RETURN;
  END IF;

  INSERT INTO cc_clients (
    org_id,
    name,
    contact_name,
    email,
    company,
    status,
    tier,
    mrr,
    start_date,
    brain_path,
    health,
    ghl_location_id,
    sort_order,
    notes
  )
  VALUES (
    v_org_id,
    'Bridge Living Co',
    'Frederick Phillips',
    'phillipsir@yahoo.com',
    'Bridge Living Company',
    'onboarding',
    'implementation',
    0,
    DATE '2026-08-21',
    'creait/03-clients/fred-phillips-bridge-living-co',
    'yellow',
    'XTyD63RiOtoZJMdlcKnn',
    10,
    'Centralized AI Business Operating System across three divisions: Bridge Living Co (affordable housing / rooms for rent), Phoenix real estate, and personal brand/content. '
    'GHL foundation is live: 5 pipelines, 49 tags, 42 contact custom fields, calendar group plus an inactive 15-minute room inquiry/tour calendar. '
    'Blocked before public launch on: legal business name and EIN/entity type for A2P 10DLC, real privacy policy and terms URLs (onboarding submitted example.com placeholders), '
    'room inventory and pricing, screening/approval process owner, and tour format/availability. '
    'SMS automations must stay off until A2P is approved. Housing approval and denial decisions require human review by design. '
    'Client files: Google Drive CLIENTS > "Fred Phillips - Bridge Living Co".'
  )
  ON CONFLICT DO NOTHING;

  -- ON CONFLICT DO NOTHING only fires on a real unique constraint; cc_clients
  -- has none on (org_id, name), so de-duplicate explicitly instead.
  DELETE FROM cc_clients c
  USING cc_clients keep
  WHERE c.org_id = v_org_id
    AND c.name = 'Bridge Living Co'
    AND keep.org_id = c.org_id
    AND keep.name = c.name
    AND keep.created_at < c.created_at;

  RAISE NOTICE 'Seeded/verified Bridge Living Co for org %', v_org_id;
END $$;
