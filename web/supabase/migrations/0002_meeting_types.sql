-- =============================================================================
-- 0002 — EOS meeting types
--
-- EOS is a meeting system, not one meeting. The original CHECK constraint only
-- allowed 'level_10' plus a few generic values, so the meeting room could never
-- run anything but a Level 10 agenda.
--
-- This widens the constraint to the full EOS set while keeping the legacy
-- values ('client','internal','sales','other') so existing rows stay valid.
-- =============================================================================

ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_meeting_type_check;

ALTER TABLE meetings
  ADD CONSTRAINT meetings_meeting_type_check
  CHECK (meeting_type IN (
    -- EOS meeting system
    'level_10',
    'quarterly',
    'annual',
    'quarterly_conversation',
    'same_page',
    'huddle',
    'financial',
    'state_of_company',
    -- legacy / non-EOS, retained so historical rows remain valid
    'client',
    'internal',
    'sales',
    'other'
  ));

-- Meeting history is almost always read by type + recency.
CREATE INDEX IF NOT EXISTS meetings_org_type_scheduled_idx
  ON meetings (org_id, meeting_type, scheduled_at DESC);

COMMENT ON COLUMN meetings.meeting_type IS
  'EOS meeting system type. Agenda templates live in web/lib/meeting-agendas.ts — keep the two in sync.';
