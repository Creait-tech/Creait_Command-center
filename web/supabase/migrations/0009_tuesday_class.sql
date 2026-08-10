-- =============================================================================
-- 0009 — AI Tuesday class: registrations, sessions, attendance
--
-- The free weekly class is the top of CREAiT's offer ladder. Registration used
-- to go through a Zoom form the CRM never saw, so GHL's reminder automation
-- never fired and show rate was unmeasurable. These three tables move
-- registration into the Command Center and make attendance a number.
--
-- RLS follows the cc_* `org_isolation` pattern from 0003: authenticated reads
-- and writes are scoped to the Clerk org_id claim. The PUBLIC registration
-- insert deliberately does NOT go through these policies — it runs server-side
-- with the service role, which bypasses RLS, because an anonymous visitor has
-- no Clerk claim to check.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- REGISTRATIONS — one row per person, ever. Re-registering updates in place.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_class_registrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         TEXT NOT NULL,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL,
  business_name  TEXT,
  industry       TEXT,
  -- "What's the most annoying thing in your business right now?" — a required
  -- micro-commitment that feeds the class opening and accumulates as market
  -- research. Kept as free text on purpose; never enumerate it.
  annoyance      TEXT NOT NULL,
  -- Null when the GHL upsert failed. A null here is the reconciliation queue:
  -- the registration is safe, the CRM just hasn't caught up.
  ghl_contact_id TEXT,
  source         TEXT NOT NULL DEFAULT 'web',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email is the identity for this list: dedupe on it so a second registration
-- updates the person rather than creating a duplicate GHL contact.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_class_registrations_org_email
  ON cc_class_registrations (org_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_cc_class_registrations_org_created
  ON cc_class_registrations (org_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- SESSIONS — one row per Tuesday.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_class_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL,
  session_date DATE NOT NULL,
  topic        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_class_sessions_org_date
  ON cc_class_sessions (org_id, session_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- ATTENDANCE — one row per (session, person) ONLY once a human has decided.
--
-- Tri-state by construction: no row means "not yet marked", and an unmarked
-- person must never be tagged in GHL. A half-finished check-off that tagged
-- everyone would text a real attendee that we missed them.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_class_attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES cc_class_sessions(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES cc_class_registrations(id) ON DELETE SET NULL,
  email           TEXT NOT NULL,
  attended        BOOLEAN NOT NULL,
  -- 'manual' is John's check-off and always wins; 'zoom' is the participant
  -- import, which may never overwrite a manual mark.
  source          TEXT NOT NULL DEFAULT 'manual'
                    CHECK (source IN ('manual', 'zoom')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_class_attendance_session_email
  ON cc_class_attendance (session_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_cc_class_attendance_registration
  ON cc_class_attendance (registration_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — same org_isolation shape as every other cc_* table.
-- Attendance filters through its session so a row can never outlive its org.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE cc_class_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_class_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_class_attendance    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation ON cc_class_registrations;
DROP POLICY IF EXISTS org_isolation ON cc_class_sessions;
DROP POLICY IF EXISTS org_isolation ON cc_class_attendance;

CREATE POLICY org_isolation ON cc_class_registrations FOR ALL
  USING      (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)))
  WITH CHECK (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)));

CREATE POLICY org_isolation ON cc_class_sessions FOR ALL
  USING      (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)))
  WITH CHECK (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)));

CREATE POLICY org_isolation ON cc_class_attendance FOR ALL
  USING      (session_id IN (SELECT id FROM cc_class_sessions WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))))
  WITH CHECK (session_id IN (SELECT id FROM cc_class_sessions WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))));
