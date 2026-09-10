-- 0018: prep sessions — the solo questionnaire before a long meeting.
--
-- A quarterly, annual or Focus Day gets a prep session ahead of time. Each
-- participant answers the questions alone; a reveal rule decides when they
-- can see each other's answers; a synthesis (written by the AI from every
-- answer, stored here as a draft) opens the room with the disagreements and
-- proposed rocks already on screen. Nothing in a synthesis becomes real
-- until someone in the room accepts it.

-- Focus Day joins the EOS meeting set.
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_meeting_type_check;
ALTER TABLE meetings
  ADD CONSTRAINT meetings_meeting_type_check
  CHECK (meeting_type IN (
    'level_10', 'quarterly', 'annual', 'quarterly_conversation', 'same_page',
    'huddle', 'financial', 'state_of_company', 'focus_day',
    'client', 'internal', 'sales', 'other'
  ));

CREATE TABLE IF NOT EXISTS cc_prep_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           TEXT NOT NULL,
  meeting_type     TEXT NOT NULL,
  title            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'synthesized', 'closed')),
  -- When a participant may read the others' answers:
  --   after_all — once everyone has submitted (default; avoids anchoring)
  --   at_close  — once the session is synthesized or closed
  --   live      — as they are written
  reveal           TEXT NOT NULL DEFAULT 'after_all' CHECK (reveal IN ('after_all', 'at_close', 'live')),
  due_at           TIMESTAMPTZ,
  participant_ids  UUID[] NOT NULL DEFAULT '{}',
  synthesis        JSONB,
  synthesized_at   TIMESTAMPTZ,
  synthesis_model  TEXT,
  meeting_id       UUID REFERENCES meetings(id) ON DELETE SET NULL,
  created_by       TEXT,
  created_by_name  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_prep_sessions_org ON cc_prep_sessions (org_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS cc_prep_questions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL,
  session_id   UUID NOT NULL REFERENCES cc_prep_sessions(id) ON DELETE CASCADE,
  -- Matches an agenda section key so the synthesis lands in the right part
  -- of the room.
  section_key  TEXT NOT NULL,
  prompt       TEXT NOT NULL,
  help         TEXT,
  kind         TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'list')),
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cc_prep_questions_session ON cc_prep_questions (session_id, sort_order);

CREATE TABLE IF NOT EXISTS cc_prep_answers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL,
  session_id   UUID NOT NULL REFERENCES cc_prep_sessions(id) ON DELETE CASCADE,
  question_id  UUID NOT NULL REFERENCES cc_prep_questions(id) ON DELETE CASCADE,
  member_id    UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  answer       TEXT,
  items        TEXT[] NOT NULL DEFAULT '{}',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_cc_prep_answers_session ON cc_prep_answers (session_id, member_id);

CREATE TABLE IF NOT EXISTS cc_prep_participants (
  session_id    UUID NOT NULL REFERENCES cc_prep_sessions(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  org_id        TEXT NOT NULL,
  submitted_at  TIMESTAMPTZ,
  PRIMARY KEY (session_id, member_id)
);

-- A meeting started from a prep session carries the link so the room can
-- show the synthesis section by section.
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS prep_session_id UUID REFERENCES cc_prep_sessions(id) ON DELETE SET NULL;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['cc_prep_sessions', 'cc_prep_questions', 'cc_prep_answers', 'cc_prep_participants'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY org_isolation ON %I FOR ALL
      USING      (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)))
      WITH CHECK (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)))
    $f$, t);
  END LOOP;
END $$;
