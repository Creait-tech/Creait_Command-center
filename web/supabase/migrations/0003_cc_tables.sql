-- =============================================================================
-- 0003 — cc_* tables
--
-- These fourteen tables were applied directly to Supabase during Phases 1–12
-- and never committed. Application code has referenced them ever since, so a
-- rebuild from migrations — or standing up a second environment — produced a
-- database the app could not run against.
--
-- Reverse-engineered from the live schema on 2026-08-05 (project
-- choxhzsfmiftdaanrkpa): columns, defaults, CHECK/FK constraints, indexes and
-- RLS policies all match production exactly.
--
-- Written IF NOT EXISTS throughout so it is a no-op against the live database
-- and a full build anywhere else.
--
-- cc_oauth_tokens is intentionally absent — it already has phase12_oauth_tokens.sql.
-- =============================================================================

-- Every cc_* table isolates by Clerk org id, read from the JWT.
-- Kept as a single expression here so the policies below stay readable.
--   org_id = coalesce(auth.jwt() ->> 'org_id',
--                     current_setting('request.jwt.claim.org_id', true))

-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT NOT NULL,
  name            TEXT NOT NULL,
  contact_name    TEXT,
  email           TEXT,
  phone           TEXT,
  company         TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('lead','onboarding','active','paused','churned','complete')),
  tier            TEXT,
  mrr             NUMERIC DEFAULT 0,
  start_date      DATE,
  brain_path      TEXT,
  notes           TEXT,
  health          TEXT DEFAULT 'green' CHECK (health IN ('green','yellow','red')),
  ghl_location_id TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_clients_org ON cc_clients (org_id, status, sort_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROCKS  (EOS quarterly priorities)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_rocks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  rock_type        TEXT NOT NULL DEFAULT 'company'
                     CHECK (rock_type IN ('company','individual','departmental')),
  owner_id         UUID,
  quarter          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'on_track'
                     CHECK (status IN ('on_track','off_track','complete','incomplete','dropped')),
  smart_specific   TEXT,
  smart_measurable TEXT,
  smart_achievable BOOLEAN DEFAULT true,
  smart_relevant   TEXT,
  due_date         DATE NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_rocks_org_quarter ON cc_rocks (org_id, quarter, sort_order);

CREATE TABLE IF NOT EXISTS cc_rock_milestones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id    UUID NOT NULL REFERENCES cc_rocks(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT false,
  due_date   DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_rock_milestones_rock ON cc_rock_milestones (rock_id, sort_order);

-- Weekly green/yellow/red snapshot taken during Rock Review.
CREATE TABLE IF NOT EXISTS cc_rock_status_updates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id    UUID NOT NULL REFERENCES cc_rocks(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  status     TEXT NOT NULL CHECK (status IN ('green','yellow','red')),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_rock_status_updates_rock
  ON cc_rock_status_updates (rock_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- TO-DOS AND HEADLINES  (Level 10 capture)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_todos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                TEXT NOT NULL,
  meeting_id            UUID REFERENCES meetings(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  owner_id              UUID,
  done                  BOOLEAN NOT NULL DEFAULT false,
  due_date              DATE,
  -- EOS: a to-do carried more than twice is an Issue in disguise.
  carried_forward_count INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_todos_org_done_due ON cc_todos (org_id, done, due_date);

CREATE TABLE IF NOT EXISTS cc_headlines (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     TEXT NOT NULL,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  category   TEXT NOT NULL DEFAULT 'general'
               CHECK (category IN ('customer','employee','market','general')),
  text       TEXT NOT NULL,
  cascade    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_headlines_org_created ON cc_headlines (org_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- MEETING RATINGS  (the 1–10 at Conclude; EOS target is >= 8)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_meeting_ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  member_id  UUID REFERENCES team_members(id) ON DELETE SET NULL,
  rater_name TEXT,
  rating     NUMERIC NOT NULL CHECK (rating >= 0 AND rating <= 10),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_meeting_ratings_meeting ON cc_meeting_ratings (meeting_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- KPI HISTORY  (scorecard trend)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_kpi_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id      UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  org_id      TEXT NOT NULL,
  value       NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_kpi_history_kpi_time ON cc_kpi_history (kpi_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_kpi_history_org      ON cc_kpi_history (org_id, recorded_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- ACCOUNTABILITY CHART  (seats, then people in seats, scored by GWC)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_team_seats (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  parent_seat_id   UUID REFERENCES cc_team_seats(id) ON DELETE SET NULL,
  responsibilities JSONB DEFAULT '[]'::jsonb,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_team_seats_org_parent
  ON cc_team_seats (org_id, parent_seat_id, sort_order);

CREATE TABLE IF NOT EXISTS cc_seat_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id      UUID NOT NULL REFERENCES cc_team_seats(id) ON DELETE CASCADE,
  member_id    UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  gwc_get      TEXT NOT NULL DEFAULT 'unknown'
                 CHECK (gwc_get IN ('plus','plus_minus','minus','unknown')),
  gwc_want     TEXT NOT NULL DEFAULT 'unknown'
                 CHECK (gwc_want IN ('plus','plus_minus','minus','unknown')),
  gwc_capacity TEXT NOT NULL DEFAULT 'unknown'
                 CHECK (gwc_capacity IN ('plus','plus_minus','minus','unknown')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_seat_assignments_seat   ON cc_seat_assignments (seat_id);
CREATE INDEX IF NOT EXISTS idx_cc_seat_assignments_member ON cc_seat_assignments (member_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENT JOURNEY  (per-client progress against the delivery template)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_client_journey (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         TEXT NOT NULL,
  client_id      UUID NOT NULL REFERENCES cc_clients(id) ON DELETE CASCADE,
  deliverable_id UUID NOT NULL REFERENCES journey_deliverables(id) ON DELETE CASCADE,
  milestone_id   UUID REFERENCES journey_milestones(id) ON DELETE SET NULL,
  done           BOOLEAN NOT NULL DEFAULT false,
  completed_at   TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, deliverable_id)
);
CREATE INDEX IF NOT EXISTS idx_cc_client_journey_client ON cc_client_journey (client_id);
CREATE INDEX IF NOT EXISTS idx_cc_client_journey_org    ON cc_client_journey (org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- WORKSPACE  (project-scoped AI threads)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_workspace_projects (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             TEXT NOT NULL,
  name               TEXT NOT NULL,
  description        TEXT,
  system_prompt      TEXT,
  preferred_model    TEXT DEFAULT 'claude-sonnet-4-6',
  emoji              TEXT,
  archived           BOOLEAN NOT NULL DEFAULT false,
  pinned             BOOLEAN NOT NULL DEFAULT false,
  attached_files     JSONB DEFAULT '[]'::jsonb,
  tags               JSONB DEFAULT '[]'::jsonb,
  created_by_user_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_workspace_projects_org
  ON cc_workspace_projects (org_id, archived, pinned DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS cc_workspace_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES cc_workspace_projects(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content       TEXT NOT NULL,
  tool_calls    JSONB,
  model         TEXT,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  cost_usd      NUMERIC,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_workspace_messages_project
  ON cc_workspace_messages (project_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- MEMORY  (backs the cc_memory_* MCP tools)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cc_memory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope         TEXT NOT NULL CHECK (scope IN ('personal','org','shared')),
  clerk_user_id TEXT,
  org_id        TEXT,
  owner_user_id TEXT,
  namespace     TEXT NOT NULL DEFAULT 'general',
  key           TEXT,
  content       TEXT NOT NULL,
  tags          JSONB DEFAULT '[]'::jsonb,
  source        TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Whichever scope a row claims, it must carry the owner that scope implies.
  CONSTRAINT memory_scope_check CHECK (
    (scope = 'personal' AND clerk_user_id IS NOT NULL) OR
    (scope = 'org'      AND org_id        IS NOT NULL) OR
    (scope = 'shared'   AND owner_user_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_cc_memory_personal ON cc_memory (clerk_user_id, namespace, updated_at DESC) WHERE scope = 'personal';
CREATE INDEX IF NOT EXISTS idx_cc_memory_org      ON cc_memory (org_id, namespace, updated_at DESC)        WHERE scope = 'org';
CREATE INDEX IF NOT EXISTS idx_cc_memory_shared   ON cc_memory (owner_user_id, namespace, updated_at DESC) WHERE scope = 'shared';
CREATE INDEX IF NOT EXISTS idx_cc_memory_key      ON cc_memory (scope, namespace, key)                     WHERE key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cc_memory_content_fts ON cc_memory USING gin (to_tsvector('english', content));

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Tables owning org_id filter on it directly; child tables filter through their
-- parent so a row can never outlive its org.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  direct TEXT[] := ARRAY[
    'cc_clients','cc_rocks','cc_todos','cc_headlines','cc_kpi_history',
    'cc_team_seats','cc_client_journey','cc_workspace_projects'
  ];
BEGIN
  -- Enable RLS everywhere first.
  FOREACH t IN ARRAY ARRAY[
    'cc_clients','cc_rocks','cc_rock_milestones','cc_rock_status_updates',
    'cc_todos','cc_headlines','cc_meeting_ratings','cc_kpi_history',
    'cc_team_seats','cc_seat_assignments','cc_client_journey',
    'cc_workspace_projects','cc_workspace_messages','cc_memory'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON %I', t);
  END LOOP;

  FOREACH t IN ARRAY direct LOOP
    EXECUTE format($f$
      CREATE POLICY org_isolation ON %I FOR ALL
      USING      (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)))
      WITH CHECK (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)))
    $f$, t);
  END LOOP;
END $$;

CREATE POLICY org_isolation ON cc_rock_milestones FOR ALL
  USING      (rock_id IN (SELECT id FROM cc_rocks WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))))
  WITH CHECK (rock_id IN (SELECT id FROM cc_rocks WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))));

CREATE POLICY org_isolation ON cc_rock_status_updates FOR ALL
  USING      (rock_id IN (SELECT id FROM cc_rocks WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))))
  WITH CHECK (rock_id IN (SELECT id FROM cc_rocks WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))));

CREATE POLICY org_isolation ON cc_meeting_ratings FOR ALL
  USING      (meeting_id IN (SELECT id FROM meetings WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))))
  WITH CHECK (meeting_id IN (SELECT id FROM meetings WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))));

CREATE POLICY org_isolation ON cc_seat_assignments FOR ALL
  USING      (seat_id IN (SELECT id FROM cc_team_seats WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))))
  WITH CHECK (seat_id IN (SELECT id FROM cc_team_seats WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))));

CREATE POLICY org_isolation ON cc_workspace_messages FOR ALL
  USING      (project_id IN (SELECT id FROM cc_workspace_projects WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))))
  WITH CHECK (project_id IN (SELECT id FROM cc_workspace_projects WHERE org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true))));

-- Memory is the exception: personal rows belong to a user, not an org.
CREATE POLICY org_isolation ON cc_memory FOR ALL
  USING (
    scope = 'personal'
    OR (scope = 'org'    AND org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)))
    OR (scope = 'shared' AND owner_user_id = current_setting('request.jwt.claim.sub', true))
  )
  WITH CHECK (
    scope = 'personal'
    OR (scope = 'org'    AND org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)))
    OR (scope = 'shared' AND owner_user_id = current_setting('request.jwt.claim.sub', true))
  );
