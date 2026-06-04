-- CREAIT Command Center — Initial Schema
-- 22 tables + 3 additions (reports_to, watch_type, tech_watch_items)
-- Org isolation via RLS on every table.
-- All tables use TEXT org_id (Clerk-injected via JWT claim 'org_id').

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. GOALS
-- =============================================================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  timeframe TEXT NOT NULL CHECK (timeframe IN ('week','month','quarter','year')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','complete','dropped')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  due_date DATE,
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. SUBTASKS (child of goals; no own org_id — inherits via parent)
-- =============================================================================
CREATE TABLE subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. COMPANY_PRIORITIES
-- =============================================================================
CREATE TABLE company_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','complete','dropped')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. MEETINGS (Level 10 + Read.ai-imported)
-- =============================================================================
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  meeting_type TEXT DEFAULT 'level_10' CHECK (meeting_type IN ('level_10','client','internal','sales','other')),
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  transcript TEXT,
  summary TEXT,
  attendees JSONB DEFAULT '[]'::jsonb,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual','readai','zoom','other')),
  source_id TEXT,
  recording_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 5. WINS (Level 10 wins board)
-- =============================================================================
CREATE TABLE wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner_id UUID,
  win_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 6. KPIS (scoreboard)
-- =============================================================================
CREATE TABLE kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  value NUMERIC NOT NULL DEFAULT 0,
  target NUMERIC,
  unit TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ghl','stripe','google','other')),
  source_query TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 7. IDS_ITEMS (Level 10 Issues / Discuss / Solve)
-- =============================================================================
CREATE TABLE ids_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','discussing','solved','dropped')),
  priority INTEGER NOT NULL DEFAULT 0,
  owner_id UUID,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 8. INITIATIVES (Rocks / quarterly initiatives)
-- =============================================================================
CREATE TABLE initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track','at_risk','off_track','complete','dropped')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  owner_id UUID,
  quarter TEXT,
  start_date DATE,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 9. INITIATIVE_TASKS (child of initiatives; no own org_id)
-- =============================================================================
CREATE TABLE initiative_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID,
  due_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 10. TEAM_MEMBERS (roster + org chart)
-- =============================================================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  clerk_user_id TEXT,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member','viewer')),
  title TEXT,
  department TEXT,
  avatar_url TEXT,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','offboarded')),
  joined_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Addition: org chart parent reference
ALTER TABLE team_members ADD COLUMN reports_to UUID REFERENCES team_members(id);

-- =============================================================================
-- 11. MEMBER_KPIS (per-member scorecard; no own org_id)
-- =============================================================================
CREATE TABLE member_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  target NUMERIC,
  unit TEXT,
  period TEXT DEFAULT 'week' CHECK (period IN ('day','week','month','quarter')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 12. CANDIDATES (recruiting kanban)
-- =============================================================================
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role_applying_for TEXT,
  stage TEXT NOT NULL DEFAULT 'applied' CHECK (stage IN ('applied','screening','interview','offer','hired','rejected','withdrew')),
  source TEXT,
  resume_url TEXT,
  notes TEXT,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  next_step_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 13. JOURNEY_MILESTONES (client journey template stages)
-- =============================================================================
CREATE TABLE journey_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  default_duration_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 14. JOURNEY_DELIVERABLES (per-milestone deliverables; no own org_id)
-- =============================================================================
CREATE TABLE journey_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES journey_milestones(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 15. ADVISOR_INSIGHTS (extracted advisor calls / insights)
-- =============================================================================
CREATE TABLE advisor_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  advisor_name TEXT,
  insight TEXT NOT NULL,
  category TEXT,
  source TEXT,
  source_url TEXT,
  occurred_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 16. STRATEGY (single-row brand/strategy doc)
-- =============================================================================
CREATE TABLE strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  mission TEXT,
  vision TEXT,
  values TEXT,
  brand_positioning TEXT,
  brand_voice TEXT,
  icp TEXT,
  value_ladder TEXT,
  flywheel TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 17. MEDIA_PLATFORMS (content channels)
-- =============================================================================
CREATE TABLE media_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT,
  handle TEXT,
  url TEXT,
  followers INTEGER DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 18. RESEARCH_BRIEFINGS (daily briefings + deep research outputs)
-- =============================================================================
CREATE TABLE research_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  briefing_type TEXT NOT NULL DEFAULT 'daily' CHECK (briefing_type IN ('daily','deep_research','market','custom')),
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]'::jsonb,
  generated_by TEXT,
  briefing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 19. COMPETITORS (competitive intel + tech watch parents)
-- =============================================================================
CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT,
  notes TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Addition: distinguish direct competitors from tech-watch entries
ALTER TABLE competitors ADD COLUMN watch_type TEXT DEFAULT 'competitor'
  CHECK (watch_type IN ('competitor','tech_watch'));

-- =============================================================================
-- 20. MESSAGES (comms inbox — GHL / Gmail / etc unified)
-- =============================================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ghl_sms','ghl_email','ghl_dm','gmail','linkedin','other')),
  source_id TEXT,
  thread_id TEXT,
  contact_name TEXT,
  contact_handle TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound')),
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read','replied','snoozed','archived')),
  priority_score INTEGER NOT NULL DEFAULT 0,
  draft_reply TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 21. SKILLS (skill library)
-- =============================================================================
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  preferred_model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  tools JSONB DEFAULT '[]'::jsonb,
  input_schema JSONB DEFAULT '{}'::jsonb,
  output_schema JSONB DEFAULT '{}'::jsonb,
  category TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 22. AGENTS (long-running background agents)
-- =============================================================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  skill_id UUID REFERENCES skills(id) ON DELETE SET NULL,
  schedule_cron TEXT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive','active','paused','error')),
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 23. SCHEDULED_TASKS (Inngest event log / scheduled runs)
-- =============================================================================
CREATE TABLE scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  skill_id UUID REFERENCES skills(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  schedule_cron TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled')),
  scheduled_for TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 24. RUN_HISTORY (every skill / agent invocation)
-- =============================================================================
CREATE TABLE run_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  skill_id UUID REFERENCES skills(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  scheduled_task_id UUID REFERENCES scheduled_tasks(id) ON DELETE SET NULL,
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual','cron','webhook','agent','chat')),
  model TEXT,
  input JSONB DEFAULT '{}'::jsonb,
  output JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed','cancelled')),
  error TEXT,
  duration_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC(10,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- =============================================================================
-- ADDITION 3: TECH_WATCH_ITEMS (child of competitors; no own org_id semantics —
-- but plan specifies org_id column for direct filtering)
-- =============================================================================
CREATE TABLE tech_watch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  snippet TEXT,
  source_url TEXT,
  source_type TEXT CHECK (source_type IN ('news','blog','hiring','social','other')),
  published_at TIMESTAMPTZ,
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX idx_goals_org_timeframe ON goals(org_id, timeframe);
CREATE INDEX idx_subtasks_goal ON subtasks(goal_id, sort_order);
CREATE INDEX idx_kpis_org_sort ON kpis(org_id, sort_order);
CREATE INDEX idx_messages_org_status_priority ON messages(org_id, status, priority_score DESC);
CREATE INDEX idx_run_history_org_created ON run_history(org_id, created_at DESC);
CREATE INDEX idx_team_members_org_reports_to ON team_members(org_id, reports_to);
CREATE INDEX idx_tech_watch_competitor_published ON tech_watch_items(competitor_id, published_at DESC);
CREATE INDEX idx_company_priorities_org_sort ON company_priorities(org_id, sort_order);
CREATE INDEX idx_initiatives_org_status ON initiatives(org_id, status);
CREATE INDEX idx_initiative_tasks_initiative ON initiative_tasks(initiative_id, sort_order);
CREATE INDEX idx_candidates_org_stage ON candidates(org_id, stage, sort_order);
CREATE INDEX idx_ids_items_org_status ON ids_items(org_id, status, priority DESC);
CREATE INDEX idx_research_briefings_org_date ON research_briefings(org_id, briefing_date DESC);
CREATE INDEX idx_meetings_org_scheduled ON meetings(org_id, scheduled_at DESC);

-- =============================================================================
-- REALTIME
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE goals;
ALTER PUBLICATION supabase_realtime ADD TABLE subtasks;
ALTER PUBLICATION supabase_realtime ADD TABLE kpis;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE run_history;
ALTER PUBLICATION supabase_realtime ADD TABLE ids_items;
ALTER PUBLICATION supabase_realtime ADD TABLE research_briefings;
ALTER PUBLICATION supabase_realtime ADD TABLE tech_watch_items;

-- =============================================================================
-- ROW LEVEL SECURITY — enable on every table
-- =============================================================================
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ids_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiative_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisor_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_watch_items ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES — org_id isolation via Clerk JWT claim 'org_id'
-- Parent-direct: tables with their own org_id column
-- =============================================================================
CREATE POLICY "org_isolation" ON goals
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON company_priorities
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON meetings
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON wins
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON kpis
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON ids_items
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON initiatives
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON team_members
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON candidates
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON journey_milestones
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON advisor_insights
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON strategy
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON media_platforms
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON research_briefings
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON competitors
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON messages
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON skills
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON agents
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON scheduled_tasks
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON run_history
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

CREATE POLICY "org_isolation" ON tech_watch_items
  FOR ALL USING (org_id = current_setting('request.jwt.claim.org_id', true));

-- Child tables: derive org_id via parent subquery
CREATE POLICY "org_isolation" ON subtasks
  FOR ALL USING (
    goal_id IN (
      SELECT id FROM goals
      WHERE org_id = current_setting('request.jwt.claim.org_id', true)
    )
  );

CREATE POLICY "org_isolation" ON initiative_tasks
  FOR ALL USING (
    initiative_id IN (
      SELECT id FROM initiatives
      WHERE org_id = current_setting('request.jwt.claim.org_id', true)
    )
  );

CREATE POLICY "org_isolation" ON member_kpis
  FOR ALL USING (
    member_id IN (
      SELECT id FROM team_members
      WHERE org_id = current_setting('request.jwt.claim.org_id', true)
    )
  );

CREATE POLICY "org_isolation" ON journey_deliverables
  FOR ALL USING (
    milestone_id IN (
      SELECT id FROM journey_milestones
      WHERE org_id = current_setting('request.jwt.claim.org_id', true)
    )
  );
