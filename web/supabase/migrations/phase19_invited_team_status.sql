-- =============================================================================
-- phase19 — "invited" is a state of its own
--
-- A teammate who has been invited but has not signed up yet is neither
-- `active` (they cannot sign in) nor `inactive` (that means someone whose
-- access was taken away). With only those two options an outstanding invite
-- either vanished from the roster entirely or sat there looking like a working
-- account, which is how the same person gets invited three times.
--
-- Paired with the Team panel in Settings, which sends the invitation email
-- through Resend because this Clerk instance is a development instance and
-- has never delivered one.
-- =============================================================================

ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_status_check;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_status_check
  CHECK (status = ANY (ARRAY['active','invited','inactive','offboarded']));

COMMENT ON COLUMN public.team_members.status IS
  'active = signed in and working. invited = invitation sent, no Clerk account yet. inactive = suspended/duplicate. offboarded = left.';
