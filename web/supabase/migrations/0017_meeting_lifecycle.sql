-- 0017: meeting lifecycle.
--
-- A meeting is now a record with a life: it is started (status in_progress,
-- started_at set), run from /level-10/meeting/<id> where its timer state is
-- persisted in agenda_state so a refresh or a second screen resumes it, and
-- concluded (status concluded, ended_at set, one rating row per attendee).
-- Every row that existed before this migration is a finished meeting or a
-- recording, so the default is 'concluded'.

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'concluded'
    CHECK (status IN ('scheduled', 'in_progress', 'concluded')),
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS presenter_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attendee_ids UUID[] NOT NULL DEFAULT '{}';

-- The Level 10 page asks "is there a meeting running right now?" on every load.
CREATE INDEX IF NOT EXISTS idx_meetings_org_in_progress
  ON meetings (org_id, started_at DESC)
  WHERE status = 'in_progress';

-- One rating per person per meeting, so concluding upserts. NULL member_ids
-- (the old hard-coded "Self" rows) never collide — a full unique index, not a
-- partial one, because PostgREST's upsert cannot name a partial index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_meeting_ratings_member
  ON cc_meeting_ratings (meeting_id, member_id);
