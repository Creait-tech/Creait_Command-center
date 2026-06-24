-- Phase 12: per-org OAuth token storage for outbound Gmail send.
-- Applied to remote project choxhzsfmiftdaanrkpa via Supabase MCP
-- (migration name: phase12_oauth_tokens).

CREATE TABLE cc_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google',
  email TEXT,
  refresh_token TEXT NOT NULL,
  scopes TEXT,
  connected_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider)
);

ALTER TABLE cc_oauth_tokens ENABLE ROW LEVEL SECURITY;
-- INTENTIONALLY no policies: refresh_token is sensitive. RLS-enabled + zero
-- policies = deny all to anon/authenticated; only the service role (which
-- bypasses RLS) can read/write. Do NOT add an org_isolation policy here.
