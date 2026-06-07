/**
 * Hand-written TypeScript bindings for the CREAIT Command Center schema.
 * Mirrors /web/supabase/migrations/0001_init.sql. snake_case field names
 * match Postgres column names exactly so callers can pass rows straight
 * through to the Supabase client.
 *
 * If you change the SQL migration, update this file.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// =============================================================================
// Domain types (single row)
// =============================================================================

export type Timeframe = "week" | "month" | "quarter" | "year";
export type GoalStatus = "active" | "complete" | "dropped";

export interface Goal {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  timeframe: Timeframe;
  status: GoalStatus;
  progress: number;
  sort_order: number;
  due_date: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subtask {
  id: string;
  goal_id: string;
  title: string;
  done: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyPriority {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type MeetingType =
  | "level_10"
  | "client"
  | "internal"
  | "sales"
  | "other";
export type MeetingSource = "manual" | "readai" | "zoom" | "other";

export interface Meeting {
  id: string;
  org_id: string;
  title: string;
  meeting_type: MeetingType;
  scheduled_at: string | null;
  duration_minutes: number | null;
  transcript: string | null;
  summary: string | null;
  attendees: Json;
  source: MeetingSource;
  source_id: string | null;
  recording_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Win {
  id: string;
  org_id: string;
  meeting_id: string | null;
  title: string;
  description: string | null;
  owner_id: string | null;
  win_date: string;
  created_at: string;
}

export type KpiSource = "manual" | "ghl" | "stripe" | "google" | "other";

export interface Kpi {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  value: number;
  target: number | null;
  unit: string | null;
  source: KpiSource;
  source_query: string | null;
  sort_order: number;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type IdsStatus = "open" | "discussing" | "solved" | "dropped";

export interface IdsItem {
  id: string;
  org_id: string;
  meeting_id: string | null;
  title: string;
  description: string | null;
  status: IdsStatus;
  priority: number;
  owner_id: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

export type InitiativeStatus =
  | "on_track"
  | "at_risk"
  | "off_track"
  | "complete"
  | "dropped";

export interface Initiative {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  status: InitiativeStatus;
  progress: number;
  owner_id: string | null;
  quarter: string | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InitiativeTask {
  id: string;
  initiative_id: string;
  title: string;
  done: boolean;
  owner_id: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type TeamRole = "admin" | "member" | "viewer";
export type TeamStatus = "active" | "inactive" | "offboarded";

export interface TeamMember {
  id: string;
  org_id: string;
  clerk_user_id: string | null;
  full_name: string;
  email: string | null;
  role: TeamRole;
  title: string | null;
  department: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: TeamStatus;
  joined_at: string | null;
  reports_to: string | null;
  created_at: string;
  updated_at: string;
}

export type MemberKpiPeriod = "day" | "week" | "month" | "quarter";

export interface MemberKpi {
  id: string;
  member_id: string;
  name: string;
  value: number;
  target: number | null;
  unit: string | null;
  period: MemberKpiPeriod;
  sort_order: number;
  updated_at: string;
  created_at: string;
}

export type CandidateStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrew";

export interface Candidate {
  id: string;
  org_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role_applying_for: string | null;
  stage: CandidateStage;
  source: string | null;
  resume_url: string | null;
  notes: string | null;
  rating: number | null;
  next_step_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface JourneyMilestone {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  default_duration_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface JourneyDeliverable {
  id: string;
  milestone_id: string;
  title: string;
  description: string | null;
  required: boolean;
  sort_order: number;
  created_at: string;
}

export interface AdvisorInsight {
  id: string;
  org_id: string;
  advisor_name: string | null;
  insight: string;
  category: string | null;
  source: string | null;
  source_url: string | null;
  occurred_at: string | null;
  created_at: string;
}

export interface Strategy {
  id: string;
  org_id: string;
  mission: string | null;
  vision: string | null;
  values: string | null;
  brand_positioning: string | null;
  brand_voice: string | null;
  icp: string | null;
  value_ladder: string | null;
  flywheel: string | null;
  updated_at: string;
  created_at: string;
}

export interface MediaPlatform {
  id: string;
  org_id: string;
  name: string;
  platform: string | null;
  handle: string | null;
  url: string | null;
  followers: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type StrategicBetStatus =
  | "exploring"
  | "validating"
  | "committed"
  | "dropped";

export interface StrategicBet {
  id: string;
  org_id: string;
  title: string;
  hypothesis: string | null;
  evidence: string | null;
  status: StrategicBetStatus;
  owner_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type BriefingType = "daily" | "deep_research" | "market" | "custom";

export interface ResearchBriefing {
  id: string;
  org_id: string;
  title: string;
  briefing_type: BriefingType;
  content: string;
  sources: Json;
  generated_by: string | null;
  briefing_date: string;
  created_at: string;
}

export type WatchType = "competitor" | "tech_watch";

export interface Competitor {
  id: string;
  org_id: string;
  name: string;
  url: string | null;
  notes: string | null;
  category: string | null;
  watch_type: WatchType;
  created_at: string;
  updated_at: string;
}

export type MessageSource =
  | "ghl_sms"
  | "ghl_email"
  | "ghl_dm"
  | "gmail"
  | "linkedin"
  | "other";
export type MessageDirection = "inbound" | "outbound";
export type MessageStatus =
  | "unread"
  | "read"
  | "replied"
  | "snoozed"
  | "archived";

export interface Message {
  id: string;
  org_id: string;
  source: MessageSource;
  source_id: string | null;
  thread_id: string | null;
  contact_name: string | null;
  contact_handle: string | null;
  direction: MessageDirection;
  subject: string | null;
  body: string | null;
  status: MessageStatus;
  priority_score: number;
  draft_reply: string | null;
  received_at: string;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  preferred_model: string;
  tools: Json;
  input_schema: Json;
  output_schema: Json;
  category: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type AgentStatus = "inactive" | "active" | "paused" | "error";

export interface Agent {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  skill_id: string | null;
  schedule_cron: string | null;
  status: AgentStatus;
  last_run_at: string | null;
  next_run_at: string | null;
  config: Json;
  created_at: string;
  updated_at: string;
}

export type ScheduledTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ScheduledTask {
  id: string;
  org_id: string;
  name: string;
  skill_id: string | null;
  agent_id: string | null;
  schedule_cron: string | null;
  payload: Json;
  status: ScheduledTaskStatus;
  scheduled_for: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RunTrigger = "manual" | "cron" | "webhook" | "agent" | "chat";
export type RunStatus = "running" | "succeeded" | "failed" | "cancelled";

export interface RunHistory {
  id: string;
  org_id: string;
  skill_id: string | null;
  agent_id: string | null;
  scheduled_task_id: string | null;
  trigger: RunTrigger;
  model: string | null;
  input: Json;
  output: Json;
  status: RunStatus;
  error: string | null;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  created_at: string;
  completed_at: string | null;
}

export type TechWatchSourceType =
  | "news"
  | "blog"
  | "hiring"
  | "social"
  | "other";

export interface TechWatchItem {
  id: string;
  org_id: string;
  competitor_id: string | null;
  headline: string;
  snippet: string | null;
  source_url: string | null;
  source_type: TechWatchSourceType | null;
  published_at: string | null;
  ai_summary: string | null;
  created_at: string;
}

// =============================================================================
// EOS Wave 4 — Rocks, Milestones, To-Dos, Headlines, Meeting Ratings, Seats
// All tables are prefixed `cc_*` to avoid colliding with Maurice's other app
// on the same Supabase project.
// =============================================================================

export type RockType = "company" | "individual" | "departmental";
export type RockStatus = "on_track" | "off_track" | "complete" | "incomplete" | "dropped";
export type RockStatusColor = "green" | "yellow" | "red";

export interface Rock {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  rock_type: RockType;
  owner_id: string | null;
  quarter: string;                  // e.g. "2026-Q3"
  status: RockStatus;
  smart_specific: string | null;
  smart_measurable: string | null;
  smart_achievable: boolean | null;
  smart_relevant: string | null;
  due_date: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RockMilestone {
  id: string;
  rock_id: string;
  title: string;
  done: boolean;
  due_date: string | null;
  sort_order: number;
  created_at: string;
}

export interface RockStatusUpdate {
  id: string;
  rock_id: string;
  meeting_id: string | null;
  status: RockStatusColor;
  note: string | null;
  created_at: string;
}

export interface Todo {
  id: string;
  org_id: string;
  meeting_id: string | null;
  title: string;
  description: string | null;
  owner_id: string | null;
  done: boolean;
  due_date: string | null;
  carried_forward_count: number;
  created_at: string;
  updated_at: string;
}

export type HeadlineCategory = "customer" | "employee" | "market" | "general";

export interface Headline {
  id: string;
  org_id: string;
  meeting_id: string | null;
  category: HeadlineCategory;
  text: string;
  cascade: boolean;
  created_at: string;
}

export interface MeetingRating {
  id: string;
  meeting_id: string;
  member_id: string | null;
  rater_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface TeamSeat {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  parent_seat_id: string | null;
  responsibilities: Json;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type GwcRating = "plus" | "plus_minus" | "minus" | "unknown";

export interface SeatAssignment {
  id: string;
  seat_id: string;
  member_id: string;
  gwc_get: GwcRating;
  gwc_want: GwcRating;
  gwc_capacity: GwcRating;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Database shape (standard Supabase generated layout)
// =============================================================================

// Supabase's generic constraints require Insert/Update to satisfy
// `Record<string, unknown>` — `Partial<T>` alone doesn't because it has no
// string index signature. Intersecting with the index-signature record makes
// the constraint hold while still preserving column-name autocomplete and
// type-checking on known columns.
type AnyRecord = { [key: string]: unknown };
type InsertOf<T> = Partial<T> & AnyRecord;
type UpdateOf<T> = Partial<T> & AnyRecord;

type Table<TRow> = {
  Row: TRow & AnyRecord;
  Insert: InsertOf<TRow>;
  Update: UpdateOf<TRow>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      goals: Table<Goal>;
      subtasks: Table<Subtask>;
      company_priorities: Table<CompanyPriority>;
      meetings: Table<Meeting>;
      wins: Table<Win>;
      kpis: Table<Kpi>;
      ids_items: Table<IdsItem>;
      initiatives: Table<Initiative>;
      initiative_tasks: Table<InitiativeTask>;
      team_members: Table<TeamMember>;
      member_kpis: Table<MemberKpi>;
      candidates: Table<Candidate>;
      journey_milestones: Table<JourneyMilestone>;
      journey_deliverables: Table<JourneyDeliverable>;
      advisor_insights: Table<AdvisorInsight>;
      strategy: Table<Strategy>;
      media_platforms: Table<MediaPlatform>;
      strategic_bets: Table<StrategicBet>;
      research_briefings: Table<ResearchBriefing>;
      competitors: Table<Competitor>;
      messages: Table<Message>;
      skills: Table<Skill>;
      agents: Table<Agent>;
      scheduled_tasks: Table<ScheduledTask>;
      run_history: Table<RunHistory>;
      tech_watch_items: Table<TechWatchItem>;
      // EOS Wave 4
      cc_rocks: Table<Rock>;
      cc_rock_milestones: Table<RockMilestone>;
      cc_rock_status_updates: Table<RockStatusUpdate>;
      cc_todos: Table<Todo>;
      cc_headlines: Table<Headline>;
      cc_meeting_ratings: Table<MeetingRating>;
      cc_team_seats: Table<TeamSeat>;
      cc_seat_assignments: Table<SeatAssignment>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
