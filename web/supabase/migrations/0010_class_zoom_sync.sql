-- =============================================================================
-- 0010 — AI Tuesday: automatic attendance sync state
--
-- Attendance is now taken from Zoom automatically; the manual check-off is the
-- override for whoever Zoom couldn't identify. That inverts where the truth
-- comes from, so the session row has to carry enough evidence for a human to
-- audit the run without opening a log:
--
--   - did it run, and when
--   - how many people Zoom actually reported
--   - which Zoom names matched nobody on the list (the human's 30-second job)
--   - why it refused to run, when it refused
--
-- That last one matters most. The job tags every registrant one way or the
-- other, so a failed or empty participant fetch must tag NOBODY and say so on
-- the page — never mass-tag a room full of attendees as no-shows because an
-- API hiccuped.
-- =============================================================================

ALTER TABLE cc_class_sessions
  ADD COLUMN IF NOT EXISTS zoom_synced_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS zoom_meeting_uuid      TEXT,
  ADD COLUMN IF NOT EXISTS zoom_participant_count INTEGER,
  -- Participants as reported, [{name, email}] — emails are what make matching
  -- trustworthy, and Zoom only supplies them for registered/signed-in joins.
  ADD COLUMN IF NOT EXISTS zoom_participants      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Zoom names that matched no registrant: the resolve-by-hand queue.
  ADD COLUMN IF NOT EXISTS zoom_unmatched         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Non-null means the run refused to tag anyone. Shown on the dashboard.
  ADD COLUMN IF NOT EXISTS zoom_error             TEXT;
