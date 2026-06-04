/**
 * Seed script for CREAIT Command Center.
 *
 * Usage:   pnpm db:seed
 * Auth:    SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
 *
 * Idempotent — every insert is an `upsert` keyed on a stable natural column
 * (e.g. `name`, `title`) so re-running won't duplicate rows.
 *
 * Loads brand context from the CREAIT SOUL markdown file at seed time and
 * stores the full text in `strategy.brand_positioning`. Mission/vision are
 * extracted via simple heuristics; the SOUL file is treated as the source of
 * truth and the entire blob is preserved verbatim.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../lib/supabase/types";

const ORG_ID = "creait";

const SOUL_PATH =
  "/Users/reecebyob/Desktop/Desktop - Maurice’s iMac/Claude Stitch/hermes-agents-souls/creait-SOUL.md";

// =============================================================================
// Helpers
// =============================================================================

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function loadSoul(): string {
  try {
    return readFileSync(SOUL_PATH, "utf8");
  } catch (err) {
    console.warn(
      `[seed] Could not read SOUL file at ${SOUL_PATH}; using empty placeholder. (${
        (err as Error).message
      })`
    );
    return "";
  }
}

/**
 * Best-effort mission/vision extraction from the SOUL markdown.
 * Looks for sections starting with `## Mission` / `## Vision` / similar.
 * Returns nulls if not found — the full SOUL is still stored in
 * brand_positioning so nothing is lost.
 */
function extractSection(markdown: string, headings: string[]): string | null {
  for (const heading of headings) {
    const re = new RegExp(
      `^#{1,3}\\s*${heading}\\b[^\\n]*\\n+([\\s\\S]*?)(?=\\n#{1,3}\\s|$)`,
      "im"
    );
    const match = markdown.match(re);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// =============================================================================
// Seed data
// =============================================================================

const COMPANY_PRIORITIES = [
  { title: "Hit $6K MRR", sort_order: 0 },
  { title: "Ship CREAIT OS Lite snapshot", sort_order: 1 },
  { title: "Land 3 financial advisor accounts", sort_order: 2 },
  { title: "Build internal Command Center", sort_order: 3 },
];

const KPIS = [
  { name: "MRR", unit: "USD", sort_order: 0 },
  { name: "Active Deals", unit: "count", sort_order: 1 },
  { name: "Conversations 7d", unit: "count", sort_order: 2 },
  { name: "Calls Booked 7d", unit: "count", sort_order: 3 },
  { name: "New Contacts 7d", unit: "count", sort_order: 4 },
];

const TEAM_MEMBERS = [
  {
    full_name: "Maurice Grant",
    email: "info@byobseries.com",
    role: "admin" as const,
    title: "CEO",
  },
  {
    full_name: "John",
    email: null,
    role: "admin" as const,
    title: "Co-Owner",
  },
  {
    full_name: "Jaylyn",
    email: null,
    role: "admin" as const,
    title: "Co-Owner",
  },
  {
    full_name: "Ashaela",
    email: null,
    role: "admin" as const,
    title: "Co-Owner",
  },
];

const GOALS = [
  {
    title: "Close 1 new CREAIT OS client this week",
    timeframe: "week" as const,
    description: "Pipeline: warm leads from existing GHL contacts.",
    sort_order: 0,
  },
  {
    title: "Send 5 personalized advisor outbound DMs daily",
    timeframe: "week" as const,
    sort_order: 1,
  },
  {
    title: "Ship Command Center Phase 1 to cc.getcreait.com",
    timeframe: "month" as const,
    sort_order: 0,
  },
  {
    title: "Reach $2.5K MRR",
    timeframe: "month" as const,
    sort_order: 1,
  },
  {
    title: "Reach $6K MRR",
    timeframe: "quarter" as const,
    description: "From $600 baseline. Path: 10 OS Lite + 2 OS Full clients.",
    sort_order: 0,
  },
  {
    title: "Land Transworld $60K listing",
    timeframe: "quarter" as const,
    sort_order: 1,
  },
];

const TECH_WATCH_COMPETITORS = [
  { name: "66degrees", url: "https://66degrees.com", category: "AI consulting" },
  { name: "Daffy.so", url: "https://daffy.so", category: "AI workflow" },
  { name: "Clay", url: "https://clay.com", category: "AI prospecting" },
  { name: "Bardeen", url: "https://bardeen.ai", category: "AI automation" },
  { name: "n8n", url: "https://n8n.io", category: "Workflow automation" },
];

// Default skills — preferred_model uses Claude 4.6 / 4.7 ids per plan.
const SKILLS = [
  {
    name: "Daily Briefing",
    description:
      "Compile morning briefing across GHL, Gmail, and Obsidian vault. Output markdown.",
    preferred_model: "claude-sonnet-4-6",
    category: "research",
  },
  {
    name: "Draft Reply",
    description:
      "Draft a contextual reply to an inbound message in Maurice's voice.",
    preferred_model: "claude-sonnet-4-6",
    category: "comms",
  },
  {
    name: "Meeting Debrief",
    description:
      "Convert a meeting transcript into wins, IDS items, and action items.",
    preferred_model: "claude-opus-4-7",
    category: "meetings",
  },
  {
    name: "Advisor Extract",
    description:
      "Extract structured advisor insights from a long-form call transcript.",
    preferred_model: "claude-opus-4-7",
    category: "intelligence",
  },
  {
    name: "Research Topic",
    description:
      "Deep web research with citations on a strategic topic. Multi-hop.",
    preferred_model: "claude-opus-4-7",
    category: "research",
  },
  {
    name: "Weekly Summary",
    description:
      "Friday afternoon recap: wins, MRR change, pipeline movement, next week priorities.",
    preferred_model: "claude-sonnet-4-6",
    category: "ops",
  },
  {
    name: "GHL Sync",
    description:
      "Pull KPIs from GHL (deals, conversations, calls, contacts) and update scoreboard.",
    preferred_model: "claude-sonnet-4-6",
    category: "ops",
  },
  {
    name: "Tech Watch Crawl",
    description:
      "Pull latest news/blog/hiring for each tech_watch competitor; AI-summarize each card.",
    preferred_model: "claude-sonnet-4-6",
    category: "intelligence",
  },
];

const JOURNEY_MILESTONES = [
  { name: "Intake", sort_order: 0, default_duration_days: 3 },
  { name: "Onboarding", sort_order: 1, default_duration_days: 7 },
  { name: "Setup", sort_order: 2, default_duration_days: 14 },
  { name: "Launch", sort_order: 3, default_duration_days: 7 },
  { name: "30d Check-in", sort_order: 4, default_duration_days: 1 },
  { name: "60d Check-in", sort_order: 5, default_duration_days: 1 },
  { name: "90d Review", sort_order: 6, default_duration_days: 1 },
];

// =============================================================================
// Main
// =============================================================================

async function main() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("[seed] Connecting as service role to", url);

  // ---------------------------------------------------------------------------
  // Strategy (single row keyed on org_id)
  // ---------------------------------------------------------------------------
  const soul = loadSoul();
  const mission = extractSection(soul, ["Mission", "What We Do", "Purpose"]);
  const vision = extractSection(soul, ["Vision", "North Star"]);
  const values = extractSection(soul, ["Values", "Operating Principles"]);
  const icp = extractSection(soul, ["ICP", "Ideal Client", "Who We Serve"]);
  const brandVoice = extractSection(soul, [
    "Brand Voice",
    "Voice",
    "Tone",
  ]);

  // Strategy is a single conceptual row per org. Find-or-insert by org_id.
  const { data: existingStrategy, error: strategyFetchErr } = await supabase
    .from("strategy")
    .select("id")
    .eq("org_id", ORG_ID)
    .maybeSingle();

  if (strategyFetchErr) throw strategyFetchErr;

  const strategyPayload = {
    org_id: ORG_ID,
    mission,
    vision,
    values,
    brand_positioning: soul,
    brand_voice: brandVoice,
    icp,
  };

  if (existingStrategy) {
    const { error } = await supabase
      .from("strategy")
      .update(strategyPayload)
      .eq("id", existingStrategy.id);
    if (error) throw error;
    console.log("[seed] strategy: updated");
  } else {
    const { error } = await supabase.from("strategy").insert(strategyPayload);
    if (error) throw error;
    console.log("[seed] strategy: inserted");
  }

  // ---------------------------------------------------------------------------
  // Team members — upsert by (org_id, full_name).
  // No native unique constraint on full_name, so do find-or-upsert manually.
  // ---------------------------------------------------------------------------
  for (const member of TEAM_MEMBERS) {
    const { data: existing, error: fetchErr } = await supabase
      .from("team_members")
      .select("id")
      .eq("org_id", ORG_ID)
      .eq("full_name", member.full_name)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    const payload = {
      org_id: ORG_ID,
      full_name: member.full_name,
      email: member.email,
      role: member.role,
      title: member.title,
      status: "active" as const,
    };

    if (existing) {
      const { error } = await supabase
        .from("team_members")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("team_members").insert(payload);
      if (error) throw error;
    }
  }
  console.log(`[seed] team_members: ${TEAM_MEMBERS.length} upserted`);

  // ---------------------------------------------------------------------------
  // KPIs — upsert by (org_id, name)
  // ---------------------------------------------------------------------------
  for (const kpi of KPIS) {
    const { data: existing, error: fetchErr } = await supabase
      .from("kpis")
      .select("id")
      .eq("org_id", ORG_ID)
      .eq("name", kpi.name)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    const payload = {
      org_id: ORG_ID,
      name: kpi.name,
      unit: kpi.unit,
      source: "ghl" as const,
      value: 0,
      sort_order: kpi.sort_order,
    };

    if (existing) {
      const { error } = await supabase
        .from("kpis")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("kpis").insert(payload);
      if (error) throw error;
    }
  }
  console.log(`[seed] kpis: ${KPIS.length} upserted`);

  // ---------------------------------------------------------------------------
  // Company priorities — upsert by (org_id, title)
  // ---------------------------------------------------------------------------
  for (const priority of COMPANY_PRIORITIES) {
    const { data: existing, error: fetchErr } = await supabase
      .from("company_priorities")
      .select("id")
      .eq("org_id", ORG_ID)
      .eq("title", priority.title)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    const payload = {
      org_id: ORG_ID,
      title: priority.title,
      sort_order: priority.sort_order,
      status: "active" as const,
    };

    if (existing) {
      const { error } = await supabase
        .from("company_priorities")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("company_priorities")
        .insert(payload);
      if (error) throw error;
    }
  }
  console.log(
    `[seed] company_priorities: ${COMPANY_PRIORITIES.length} upserted`
  );

  // ---------------------------------------------------------------------------
  // Goals — upsert by (org_id, title)
  // ---------------------------------------------------------------------------
  for (const goal of GOALS) {
    const { data: existing, error: fetchErr } = await supabase
      .from("goals")
      .select("id")
      .eq("org_id", ORG_ID)
      .eq("title", goal.title)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    const payload = {
      org_id: ORG_ID,
      title: goal.title,
      description: goal.description ?? null,
      timeframe: goal.timeframe,
      sort_order: goal.sort_order,
      status: "active" as const,
      progress: 0,
    };

    if (existing) {
      const { error } = await supabase
        .from("goals")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("goals").insert(payload);
      if (error) throw error;
    }
  }
  console.log(`[seed] goals: ${GOALS.length} upserted`);

  // ---------------------------------------------------------------------------
  // Competitors (tech watch) — upsert by (org_id, name)
  // ---------------------------------------------------------------------------
  for (const competitor of TECH_WATCH_COMPETITORS) {
    const { data: existing, error: fetchErr } = await supabase
      .from("competitors")
      .select("id")
      .eq("org_id", ORG_ID)
      .eq("name", competitor.name)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    const payload = {
      org_id: ORG_ID,
      name: competitor.name,
      url: competitor.url,
      category: competitor.category,
      watch_type: "tech_watch" as const,
    };

    if (existing) {
      const { error } = await supabase
        .from("competitors")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("competitors").insert(payload);
      if (error) throw error;
    }
  }
  console.log(
    `[seed] competitors (tech_watch): ${TECH_WATCH_COMPETITORS.length} upserted`
  );

  // ---------------------------------------------------------------------------
  // Skills — upsert by (org_id, name)
  // ---------------------------------------------------------------------------
  for (const skill of SKILLS) {
    const { data: existing, error: fetchErr } = await supabase
      .from("skills")
      .select("id")
      .eq("org_id", ORG_ID)
      .eq("name", skill.name)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    const payload = {
      org_id: ORG_ID,
      name: skill.name,
      description: skill.description,
      preferred_model: skill.preferred_model,
      category: skill.category,
      enabled: true,
    };

    if (existing) {
      const { error } = await supabase
        .from("skills")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("skills").insert(payload);
      if (error) throw error;
    }
  }
  console.log(`[seed] skills: ${SKILLS.length} upserted`);

  // ---------------------------------------------------------------------------
  // Journey milestones — upsert by (org_id, name)
  // ---------------------------------------------------------------------------
  for (const milestone of JOURNEY_MILESTONES) {
    const { data: existing, error: fetchErr } = await supabase
      .from("journey_milestones")
      .select("id")
      .eq("org_id", ORG_ID)
      .eq("name", milestone.name)
      .maybeSingle();
    if (fetchErr) throw fetchErr;

    const payload = {
      org_id: ORG_ID,
      name: milestone.name,
      sort_order: milestone.sort_order,
      default_duration_days: milestone.default_duration_days,
    };

    if (existing) {
      const { error } = await supabase
        .from("journey_milestones")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("journey_milestones")
        .insert(payload);
      if (error) throw error;
    }
  }
  console.log(
    `[seed] journey_milestones: ${JOURNEY_MILESTONES.length} upserted`
  );

  console.log("[seed] done.");
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
