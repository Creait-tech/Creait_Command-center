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

/**
 * EOS meeting system types, plus the legacy non-EOS values kept so historical
 * rows stay valid. Mirrors the CHECK constraint in
 * supabase/migrations/0002_meeting_types.sql — keep the two in sync.
 * Agenda templates live in lib/meeting-agendas.ts.
 */
export type MeetingType =
  // EOS meeting system
  | "level_10"
  | "quarterly"
  | "annual"
  | "quarterly_conversation"
  | "same_page"
  | "huddle"
  | "financial"
  | "state_of_company"
  // legacy / non-EOS
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
  rating: number | null;
  agenda_state: Json | null;
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
  /** Who created the row. Null on rows predating authorship. */
  created_by: string | null;
  created_by_name: string | null;
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
  goal_operator: KpiGoalOperator;
  /** Who owns this number in the Level 10. */
  owner_id: string | null;
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
  is_long_term: boolean;
  vote_count: number;
  /** Who created the row and who last changed it. Names are captured at write
   *  time so the record survives a rename or a teammate leaving; the id is the
   *  durable join back to a Clerk identity. Null on rows predating authorship. */
  created_by: string | null;
  created_by_name: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
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
  /** Member-maintained; preferred over full_name wherever a person is named. */
  display_name: string | null;
  pronouns: string | null;
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
  vto: Json | null;
  updated_at: string;
  created_at: string;
}

// V/TO blob shape stored in strategy.vto
export interface VtoData {
  core_values?: string[];
  core_focus?: {
    purpose?: string;
    niche?: string;
  };
  ten_year_target?: string;
  marketing_strategy?: {
    target_market?: string;
    three_uniques?: string[];
    proven_process?: string[];
    guarantee?: string;
  };
  three_year_picture?: string;
  one_year_plan?: string;
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
  /** Who created the row and who last changed it. Names are captured at write
   *  time so the record survives a rename or a teammate leaving; the id is the
   *  durable join back to a Clerk identity. Null on rows predating authorship. */
  created_by: string | null;
  created_by_name: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
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
  /** Who created the row and who last changed it. Names are captured at write
   *  time so the record survives a rename or a teammate leaving; the id is the
   *  durable join back to a Clerk identity. Null on rows predating authorship. */
  created_by: string | null;
  created_by_name: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
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
  /** Who created the row. Null on rows predating authorship. */
  created_by: string | null;
  created_by_name: string | null;
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
// KPI history — time-series snapshots for trend charts
// Prefixed `cc_*` to avoid colliding with the other app on this Supabase
// project. References the existing `kpis` table.
// =============================================================================

export interface KpiHistory {
  id: string;
  kpi_id: string;
  org_id: string;
  value: number;
  recorded_at: string;
}

// =============================================================================
// AI Workspace — Claude-Projects-style persistent threads
// =============================================================================

export interface WorkspaceProject {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  preferred_model: string;
  emoji: string | null;
  archived: boolean;
  pinned: boolean;
  attached_files: Json;
  tags: Json;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type CcClientStatus =
  | "lead"
  | "onboarding"
  | "active"
  | "paused"
  | "churned"
  | "complete";

export type CcClientHealth = "green" | "yellow" | "red";

export interface CcClient {
  id: string;
  org_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: CcClientStatus;
  tier: string | null;
  mrr: number | null;
  start_date: string | null;
  brain_path: string | null;
  notes: string | null;
  health: CcClientHealth;
  ghl_location_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Per-client journey progress — one row per (client, deliverable).
// Tracks whether a given client has completed a template deliverable.
export interface CcClientJourney {
  id: string;
  org_id: string;
  client_id: string;
  deliverable_id: string;
  milestone_id: string | null;
  done: boolean;
  completed_at: string | null;
  notes: string | null;
  /** Who last changed this row: Clerk user id for a teammate, 'hermes' for the agent. */
  updated_by: string | null;
  /** Display name captured at write time, so the log survives a rename or departure. */
  updated_by_name: string | null;
  updated_by_type: ActorType | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Assessments — the $7,500 Growth & AI Diagnostic delivered through software.
// Instrument (30 indicators, anchors, weights, bands) lives in
// lib/assessment-instrument.ts. Mirrors supabase/migrations/0004_assessments.sql.
// =============================================================================

export type AssessmentStatus =
  | "practice"
  | "intake"
  | "scoring"
  | "review"
  | "delivered";

export type AssessmentPillar = "profit" | "systems" | "leverage";

/**
 * Evidence confidence per the scoring engine: Reported (owner said so) ·
 * Demonstrated (walked through it live) · Documented (record/report seen).
 * Never changes the score — widens financial ranges and is disclosed.
 */
export type EvidenceConfidence =
  | "reported"
  | "demonstrated"
  | "documented"
  | "unknown";

export type OpportunityConfidence = "high" | "medium" | "low";

export interface CcAssessment {
  id: string;
  org_id: string;
  client_name: string;
  company: string | null;
  industry: string | null;
  status: AssessmentStatus;
  is_practice: boolean;
  started_at: string | null;
  delivered_at: string | null;
  annual_revenue: number | null;
  gross_margin: number | null;
  operating_profit: number | null;
  owner_objective: string | null;
  /** Intake Q8 verbatim — the "you said X / the evidence says Y" moment. */
  owner_belief: string | null;
  /** Primary Business Constraint — root, one sentence. */
  primary_constraint: string | null;
  constraint_symptoms: string | null;
  constraint_cost: string | null;
  constraint_fix: string | null;
  momentum_initiative: string | null;
  /** Critical Constraint Overlay flag keys (see OVERLAY_FLAGS). */
  overlay_flags: Json;
  /** 90-day plan items — array of strings (v1). */
  plan_items: Json;
  /**
   * Live capture from the 4-hour Diagnostic Intensive, keyed by the five
   * Facilitator Guide blocks (migration 0006). Parsed by SessionNotes in
   * lib/assessment-session.ts. The guide scores from these notes after the
   * session, not with the client in the room.
   */
  session_notes: Json;
  overlap_factor: number;
  created_at: string;
  updated_at: string;
}

export interface CcAssessmentScore {
  id: string;
  assessment_id: string;
  indicator_key: string;
  pillar: AssessmentPillar;
  /** 0–4 behavioral score; null = not examined (never faked in the report). */
  score: number | null;
  /**
   * Advisor-set target (0–4) with the 90-day plan executed; null = no target.
   * A judgement, never a computed projection — the report only renders a
   * potential composite when enough indicators carry one (migration 0007).
   */
  potential_score: number | null;
  /** N/A — removed from the denominator, never counted as zero. */
  not_applicable: boolean;
  evidence_confidence: EvidenceConfidence;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CcAssessmentOpportunity {
  id: string;
  assessment_id: string;
  title: string;
  finding: string | null;
  /** Annual operating-profit impact — low / expected / high, always together. */
  annual_low: number | null;
  annual_expected: number | null;
  annual_high: number | null;
  fix_cost: number | null;
  months_to_benefit: number | null;
  confidence: OpportunityConfidence;
  rank: number;
  include_in_report: boolean;
  /**
   * AI Workflow Blueprint (migration 0007): what gets built — the automation /
   * AI / tech solution named plainly. Optional; renders "The build that
   * captures this" in the report when set.
   */
  blueprint: string | null;
  /** The manual work the build eliminates. */
  replaces: string | null;
  /** Rough hours per week of manual work recovered by the build. */
  hours_recovered_weekly: number | null;
  /**
   * The owner's own annual estimate for this opportunity (migration 0008).
   * The report shows it only when it sits ABOVE our modeled expected case —
   * the advisor visibly lowering the number is the trust act.
   */
  owner_estimate_annual: number | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// OAuth tokens — per-org provider credentials for outbound sends (Gmail).
// Prefixed `cc_*`. RLS-enabled with NO policies: only the service-role client
// (which bypasses RLS) ever reads/writes this table. `refresh_token` must never
// be exposed to a browser/client query.
// =============================================================================

export type OAuthProvider = "google";

export interface CcOAuthToken {
  id: string;
  org_id: string;
  provider: OAuthProvider;
  email: string | null;
  refresh_token: string;
  scopes: string | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// AI Tuesday class (migration 0009)
// =============================================================================

export interface CcClassRegistration {
  id: string;
  org_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  business_name: string | null;
  industry: string | null;
  annoyance: string;
  /** Null when the GHL upsert failed — the reconciliation queue. */
  ghl_contact_id: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface ZoomClassParticipant {
  name: string;
  email: string | null;
}

export interface CcClassSession {
  id: string;
  org_id: string;
  /** ISO date (YYYY-MM-DD) of the Tuesday. */
  session_date: string;
  topic: string | null;
  created_at: string;
  // Automatic attendance sync state (migration 0010).
  zoom_synced_at: string | null;
  zoom_meeting_uuid: string | null;
  zoom_participant_count: number | null;
  zoom_participants: Json;
  /** Zoom names that matched no registrant — the resolve-by-hand queue. */
  zoom_unmatched: Json;
  /** Non-null means the run refused to tag anyone, and why. */
  zoom_error: string | null;
}

/** 'manual' is the human check-off and outranks 'zoom' imports. */
export type ClassAttendanceSource = "manual" | "zoom";

/**
 * A row exists ONLY once a human (or Zoom) has decided. Absence means
 * "not yet marked", which must never be tagged in GHL as either outcome.
 */
export interface CcClassAttendance {
  id: string;
  session_id: string;
  registration_id: string | null;
  email: string;
  attended: boolean;
  source: ClassAttendanceSource;
  created_at: string;
  updated_at: string;
}

export type WorkspaceMessageRole = "user" | "assistant" | "system" | "tool";

export interface WorkspaceMessage {
  id: string;
  project_id: string;
  role: WorkspaceMessageRole;
  content: string;
  tool_calls: Json | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  created_at: string;
}

// =============================================================================
// Dashboard AI Assistant chat history — persistent threads for the floating
// widget. Scoped per (org, clerk user). Mirrors
// supabase/migrations/phase13_chat_history.sql.
// =============================================================================

export type CcChatRole = "user" | "assistant";

export interface CcChatConversation {
  id: string;
  org_id: string;
  clerk_user_id: string;
  title: string;
  /** Route slug the conversation started on, e.g. "command-center". */
  page_context: string | null;
  model: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface CcChatMessage {
  id: string;
  conversation_id: string;
  org_id: string;
  role: CcChatRole;
  content: string;
  created_at: string;
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


// --- Shared client progress (multiplayer: 4 humans + Hermes) ------------------

export type ActorType = "human" | "agent";

export type ClientActivityKind =
  | "deliverable_completed"
  | "deliverable_reopened"
  | "note"
  | "status_change"
  | "proposal_accepted"
  | "proposal_rejected";

export interface CcClientActivity {
  id: string;
  org_id: string;
  client_id: string;
  actor_type: ActorType;
  actor_id: string | null;
  actor_name: string;
  kind: ClientActivityKind;
  body: string | null;
  deliverable_id: string | null;
  milestone_id: string | null;
  created_at: string;
}

export type ProposalAction = "mark_done" | "reopen" | "add_note" | "change_status";
export type ProposalStatus = "pending" | "accepted" | "rejected";

export interface CcAgentProposal {
  id: string;
  org_id: string;
  client_id: string;
  deliverable_id: string | null;
  proposed_by: string;
  action: ProposalAction;
  payload: Json | null;
  rationale: string | null;
  evidence: string | null;
  status: ProposalStatus;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  created_at: string;
}


/** Goal comparison for a KPI. A `<=` metric (cost, churn, response time) is
 *  green when it comes in *under* target; without this, such a metric scores
 *  backwards. */
export type KpiGoalOperator = ">=" | "<=" | "=";

/** One entry in a cell's append-only correction log (migration phase17).
 *  A scorecard number that gets revised in a Level 10 ("we said 100 emails, it
 *  was closer to 80") keeps what it used to say, so the revision is visible
 *  rather than silent. */
export interface WeeklyCorrection {
  /** The value the cell used to hold. `null` means it was blank. */
  from: number | null;
  /** What it was changed to. `null` means it was cleared back to blank. */
  to: number | null;
  /** Whether the replaced value had been typed or synced. */
  from_source: "manual" | "sync" | null;
  /** Clerk user id of whoever made the change. */
  by: string | null;
  by_name: string | null;
  /** ISO timestamp. */
  at: string;
}

/** One number for one KPI for one week — the unit an EOS scorecard is made of.
 *  `kpis.value` is only ever "latest" and is overwritten by the sync, so it
 *  cannot answer "what did we do the week of Nov 14". */
export interface CcKpiWeekly {
  id: string;
  org_id: string;
  kpi_id: string;
  /** Monday of the ISO week, in America/New_York. */
  week_start: string;
  value: number | null;
  /** 'sync' rows are derived and may be refreshed; 'manual' rows were typed by
   *  a person and must never be overwritten by a job. */
  source: "manual" | "sync";
  entered_by: string | null;
  entered_by_name: string | null;
  /** Append-only; written only by `cc_kpi_weekly_record()`. Arrives as jsonb —
   *  parse defensively rather than trusting the shape. */
  corrections: WeeklyCorrection[];
  created_at: string;
  updated_at: string;
}

/** One row of `cc_meeting_agendas` (migration 0011) — an org's saved override
 *  for one meeting type. A missing row means that type uses the EOS default;
 *  `lib/meeting-agendas.ts` is still the interface every consumer reads. */
export interface CcMeetingAgendaRow {
  id: string;
  org_id: string;
  /** One of the eight EOS meeting types. Kept in step with the
   *  `meetings.meeting_type` CHECK constraint by migration 0011. */
  type: string;
  label: string;
  cadence: string;
  purpose: string;
  title_prefix: string;
  /** Ordered agenda sections as jsonb; `conclude` must be last (DB CHECK).
   *  Typed `unknown` rather than a section array on purpose — what comes back
   *  from Postgres is unvalidated, and `parseAgendaRow` is the one place that
   *  decides whether a stored agenda is usable or has to fall back to the EOS
   *  default. Writes still accept a section array. */
  sections: unknown;
  updated_by: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

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
      cc_workspace_projects: Table<WorkspaceProject>;
      cc_workspace_messages: Table<WorkspaceMessage>;
      cc_clients: Table<CcClient>;
      cc_client_journey: Table<CcClientJourney>;
      // Assessments (Growth & AI Diagnostic)
      cc_assessments: Table<CcAssessment>;
      cc_assessment_scores: Table<CcAssessmentScore>;
      cc_assessment_opportunities: Table<CcAssessmentOpportunity>;
      // AI Tuesday class
      cc_class_registrations: Table<CcClassRegistration>;
      cc_class_sessions: Table<CcClassSession>;
      cc_class_attendance: Table<CcClassAttendance>;
      // OAuth tokens (Gmail send)
      cc_oauth_tokens: Table<CcOAuthToken>;
      // KPI history
      cc_kpi_history: Table<KpiHistory>;
      cc_kpi_weekly: Table<CcKpiWeekly>;
      // Editable meeting agendas (per-org overrides of the EOS defaults)
      cc_meeting_agendas: Table<CcMeetingAgendaRow>;
      // Dashboard AI Assistant chat history
      cc_chat_conversations: Table<CcChatConversation>;
      cc_client_activity: Table<CcClientActivity>;
      cc_agent_proposals: Table<CcAgentProposal>;
      cc_chat_messages: Table<CcChatMessage>;
    };
    Views: { [_ in never]: never };
    Functions: {
      /**
       * Atomic 90-day plan-item mutations (migration 0005). The JSONB array
       * is mutated under a row lock so concurrent editors can't drop an item.
       * Both return the full updated cc_assessments row.
       */
      cc_assessment_plan_append: {
        Args: { p_id: string; p_org: string; p_item: string };
        Returns: CcAssessment[];
      };
      cc_assessment_plan_remove: {
        Args: {
          p_id: string;
          p_org: string;
          p_item: string;
          p_index: number;
        };
        Returns: CcAssessment[];
      };
      /**
       * Swaps one plan item with its neighbour under the same row lock
       * (migration 0006). Returns the full updated cc_assessments row.
       */
      /**
       * Records a week's scorecard number as a human entry (migration
       * phase17). Upserts the value, stamps the actor, marks the row
       * `manual`, and appends to the correction log — all under one row
       * lock, so two founders editing the same cell in a live meeting can't
       * drop each other's history. SECURITY INVOKER: RLS applies to the
       * caller exactly as it would for a direct UPDATE.
       */
      cc_kpi_weekly_record: {
        Args: {
          p_org: string;
          p_kpi: string;
          p_week: string;
          p_value: number | null;
          p_actor: string;
          p_actor_name: string;
        };
        Returns: CcKpiWeekly[];
      };
      cc_assessment_plan_reorder: {
        Args: {
          p_id: string;
          p_org: string;
          p_item: string;
          p_index: number;
          p_direction: "up" | "down";
        };
        Returns: CcAssessment[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
