-- =============================================================================
-- 0011 — cc_meeting_agendas
--
-- Makes the EOS meeting agendas editable from Settings instead of only from
-- web/lib/meeting-agendas.ts. One row per org per meeting type; the code
-- constants remain the fallback and the "reset to EOS default" source, so an
-- org with no row here behaves exactly as it did before this migration.
--
-- Only the eight EOS types are editable. A brand-new meeting *type* is not a
-- data change: meetings.meeting_type carries its own CHECK constraint
-- (migration 0002) and lib/supabase/types.ts carries the matching union, so a
-- ninth type would need both of those plus this one. The CHECK below keeps that
-- honest — this table cannot describe a type the meetings table would reject.
--
-- The sections CHECK is the same rule the application enforces: an agenda must
-- end with a section keyed 'conclude', because that is the section in which the
-- meeting room renders the 1–10 rating and the Finish button that saves the
-- meeting. An agenda without it can be started and never saved.
-- =============================================================================

CREATE TABLE IF NOT EXISTS cc_meeting_agendas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          TEXT NOT NULL,
  type            TEXT NOT NULL
                    CHECK (type IN ('level_10','quarterly','annual','quarterly_conversation',
                                    'same_page','huddle','financial','state_of_company')),
  label           TEXT NOT NULL,
  cadence         TEXT NOT NULL DEFAULT '',
  purpose         TEXT NOT NULL DEFAULT '',
  title_prefix    TEXT NOT NULL,
  sections        JSONB NOT NULL,
  updated_by      TEXT,
  updated_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cc_meeting_agendas_org_type_key UNIQUE (org_id, type),

  -- Non-empty array whose final element is the concluding section.
  CONSTRAINT cc_meeting_agendas_sections_shape CHECK (
    jsonb_typeof(sections) = 'array'
    AND jsonb_array_length(sections) > 0
    AND (sections -> (jsonb_array_length(sections) - 1)) ->> 'key' = 'conclude'
  )
);

CREATE INDEX IF NOT EXISTS idx_cc_meeting_agendas_org ON cc_meeting_agendas (org_id, type);

-- Same org isolation as every other cc_* table: the Clerk org_id claim, read
-- from the JWT, with the request-setting fallback. No permissive bypass.
ALTER TABLE cc_meeting_agendas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON cc_meeting_agendas;
CREATE POLICY org_isolation ON cc_meeting_agendas FOR ALL
  USING      (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)))
  WITH CHECK (org_id = coalesce(auth.jwt() ->> 'org_id', current_setting('request.jwt.claim.org_id', true)));

-- Seed the EOS standard for every org that already has meetings. The org ids
-- are read from the data rather than written in — no workspace is named here.
-- ON CONFLICT DO NOTHING so re-running never overwrites a customised agenda.
INSERT INTO cc_meeting_agendas (org_id, type, label, cadence, purpose, title_prefix, sections)
SELECT o.org_id, d.type, d.label, d.cadence, d.purpose, d.title_prefix, d.sections
FROM (SELECT DISTINCT org_id FROM meetings WHERE org_id IS NOT NULL) AS o
CROSS JOIN (
  VALUES
    ('level_10', 'Level 10 Meeting', 'Weekly · 90 min', 'Leadership execution meeting: scorecard, Rocks, issues, accountability.', 'L10', '[{"key":"segue","label":"Segue","budgetSec":300,"description":"Each person: 1 personal + 1 business good news. Stay connected."},{"key":"scorecard","label":"Scorecard","budgetSec":300,"description":"Each KPI: on-track or off-track. NO discussion. Off-track → Issue."},{"key":"rocks","label":"Rock Review","budgetSec":300,"description":"Each Rock owner: on-track or off-track. NO discussion. Off-track → Issue."},{"key":"headlines","label":"Customer/Employee Headlines","budgetSec":300,"description":"One-sentence updates. If it needs discussion → Issue."},{"key":"todos","label":"To-Do Review","budgetSec":300,"description":"Done / not done. Carry over or drop to Issues."},{"key":"ids","label":"IDS — Identify, Discuss, Solve","budgetSec":3600,"description":"Top 3 issues. Identify root cause → discuss → solve forever."},{"key":"conclude","label":"Conclude","budgetSec":300,"description":"Recap To-Dos. Everyone rates the meeting 1–10. Target ≥ 8."}]'::jsonb),
    ('huddle', 'Team Huddle', 'Daily or as needed · 15 min', 'Fast check-in. Remove blockers, share what matters, get back to work.', 'Huddle', '[{"key":"headlines","label":"Headlines","budgetSec":300,"description":"One sentence each. Anything the team needs to know today."},{"key":"ids","label":"Blockers","budgetSec":420,"description":"What''s in your way right now? Small blockers solve here; big ones become Issues."},{"key":"conclude","label":"Priorities","budgetSec":180,"description":"Each person names their one priority for today. Rate 1–10."}]'::jsonb),
    ('financial', 'Financial Review', 'Monthly · 60 min', 'Monthly look at financial performance against the plan.', 'Financial', '[{"key":"scorecard","label":"Scorecard","budgetSec":600,"description":"Every financial measurable: on-track or off-track. No discussion yet."},{"key":"pnl","label":"P&L Review","budgetSec":900,"description":"Revenue, cost, margin against plan. Where did the money actually go?"},{"key":"cash","label":"Cash Position","budgetSec":600,"description":"Cash on hand, runway, receivables, and the tax reserve. Profit is opinion; cash is fact."},{"key":"ids","label":"IDS — Variances","budgetSec":1200,"description":"Every material variance becomes an issue. Solve the cause, not the number."},{"key":"conclude","label":"Actions","budgetSec":300,"description":"To-Dos with owners and dates. Rate the meeting 1–10."}]'::jsonb),
    ('quarterly', 'Quarterly Planning', 'Every 90 days · full day', 'Recalibrate priorities, review the prior quarter, set new Rocks, solve major issues.', 'Quarterly', '[{"key":"segue","label":"Segue","budgetSec":1800,"description":"Best personal and business news from the last 90 days. Reconnect before you work."},{"key":"prior_quarter","label":"Prior Quarter Review","budgetSec":3600,"description":"Rock completion rate and the scorecard trend. Target 80%+ Rocks done. Be honest about misses."},{"key":"vto","label":"V/TO Review","budgetSec":3600,"description":"Is the vision still right? Core values, focus, 10-year target, marketing strategy, 3-year picture."},{"key":"rocks","label":"Establish Next Quarter''s Rocks","budgetSec":7200,"description":"3–7 company Rocks. Each one specific, measurable, and owned by exactly one person."},{"key":"ids","label":"IDS — Quarterly Issues","budgetSec":7200,"description":"Everything blocking the next 90 days. Solve it here or it follows you into the quarter."},{"key":"conclude","label":"Conclude","budgetSec":1800,"description":"Recap Rocks and To-Dos, agree the cascading message, rate the day 1–10."}]'::jsonb),
    ('quarterly_conversation', 'Quarterly Conversation', 'Every 90 days · 1-on-1 · 60 min', 'Leader and direct report: performance, fit, and support.', '1-on-1', '[{"key":"opener","label":"Opener","budgetSec":300,"description":"Not a performance review. A conversation. Set that expectation first."},{"key":"working","label":"What''s Working","budgetSec":900,"description":"They go first. Listen more than you talk."},{"key":"not_working","label":"What''s Not Working","budgetSec":900,"description":"Both directions. You ask for feedback too."},{"key":"gwc","label":"GWC Check","budgetSec":600,"description":"Do they Get it, Want it, and have the Capacity to do it? All three, honestly."},{"key":"next_90","label":"Next 90 Days","budgetSec":600,"description":"Their Rocks, their role, what support they need from you."},{"key":"conclude","label":"Conclude","budgetSec":300,"description":"Agree the commitments. Rate the conversation 1–10."}]'::jsonb),
    ('same_page', 'Same Page Meeting', 'As needed · 60 min', 'Resolve misalignment between two key people before it spreads.', 'Same Page', '[{"key":"purpose","label":"Name the Gap","budgetSec":300,"description":"State plainly what you''re here to get aligned on. No preamble."},{"key":"perspective_a","label":"First Perspective","budgetSec":900,"description":"One person, uninterrupted. The other only asks clarifying questions."},{"key":"perspective_b","label":"Second Perspective","budgetSec":900,"description":"Swap. Same rules."},{"key":"ids","label":"IDS — Where We Diverge","budgetSec":1200,"description":"Identify the real disagreement, discuss it, solve it. It is almost never the thing you came in arguing about."},{"key":"conclude","label":"Commitments","budgetSec":300,"description":"What each of you will do differently. Rate the conversation 1–10."}]'::jsonb),
    ('state_of_company', 'State of the Company', 'Monthly or quarterly · 60 min', 'Company-wide communication. Reinforce vision, priorities and progress.', 'State of the Company', '[{"key":"been","label":"Where We''ve Been","budgetSec":600,"description":"The story so far. Short. People need context before numbers."},{"key":"are","label":"Where We Are","budgetSec":900,"description":"Honest current state — the scorecard, the Rocks, the wins and the misses."},{"key":"going","label":"Where We''re Going","budgetSec":900,"description":"The vision, restated. People need to hear it more often than feels necessary."},{"key":"headlines","label":"Headlines","budgetSec":600,"description":"Customer and employee news worth the whole room hearing."},{"key":"conclude","label":"Q&A and Close","budgetSec":600,"description":"Open floor. Then rate the session 1–10."}]'::jsonb),
    ('annual', 'Annual Planning', 'Yearly · two days', 'Reset the long-term vision, refine the V/TO, set the year''s direction.', 'Annual', '[{"key":"segue","label":"Segue","budgetSec":2700,"description":"Wins from the year. Everyone speaks. This sets the tone for two days."},{"key":"prior_year","label":"Prior Year Review","budgetSec":5400,"description":"Revenue, profit, measurables, Rock completion. What actually happened versus what you said would happen."},{"key":"team_health","label":"Team Health","budgetSec":5400,"description":"Right people, right seats. GWC on every seat. The conversation nobody wants and everybody needs."},{"key":"vto","label":"V/TO — Full Rebuild","budgetSec":10800,"description":"Core values, core focus, 10-year target, marketing strategy, 3-year picture, 1-year plan."},{"key":"rocks","label":"Q1 Rocks","budgetSec":7200,"description":"Translate the 1-year plan into 3–7 Rocks for the first quarter."},{"key":"ids","label":"IDS — Annual Issues","budgetSec":7200,"description":"The structural issues. The ones that have been on the list all year."},{"key":"conclude","label":"Conclude","budgetSec":2700,"description":"Cascading message, commitments, rate the session 1–10."}]'::jsonb)
) AS d(type, label, cadence, purpose, title_prefix, sections)
ON CONFLICT (org_id, type) DO NOTHING;
