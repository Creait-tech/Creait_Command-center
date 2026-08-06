-- Phase 13: persistent conversation history for the floating AI Assistant widget.
-- Applied to remote project choxhzsfmiftdaanrkpa via Supabase MCP
-- (migration name: phase13_chat_history).
--
-- One row per conversation in cc_chat_conversations, one row per turn in
-- cc_chat_messages. Both are org-scoped via the Clerk `org_id` JWT claim —
-- real RLS, no open/bypass policy.

CREATE TABLE cc_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  clerk_user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New chat',
  page_context TEXT,
  model TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cc_chat_conv_org_user ON cc_chat_conversations(org_id, clerk_user_id, last_message_at DESC);
ALTER TABLE cc_chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON cc_chat_conversations FOR ALL
  USING (org_id = COALESCE(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)))
  WITH CHECK (org_id = COALESCE(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)));

CREATE TABLE cc_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES cc_chat_conversations(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cc_chat_msg_conv ON cc_chat_messages(conversation_id, created_at);
ALTER TABLE cc_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON cc_chat_messages FOR ALL
  USING (org_id = COALESCE(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)))
  WITH CHECK (org_id = COALESCE(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)));
