/**
 * CREAIT Command Center MCP tools — exposes the operational state of the
 * business to any MCP client (Hermes Agent, Claude Desktop, etc.). These
 * are the verbs Maurice would otherwise click through the dashboard.
 *
 * All tools hardcode org_id='creait' for now. Multi-org graduation will
 * route org_id from the calling agent's auth context.
 */
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ORG_ID = process.env.DEFAULT_ORG_ID ?? "org_3J6RO66XyUmqeMbZ8RwIyFTCf7J";

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error("Supabase not configured on MCP server — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function jsonText(obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] };
}

function currentQuarter(): string {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

function quarterEnd(quarter: string): string {
  const [y, q] = quarter.split("-Q").map(Number);
  const monthEnd = q * 3;
  const last = new Date(y, monthEnd, 0).getDate();
  return `${y}-${String(monthEnd).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function defaultTodoDue(): string {
  return new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
}

// ============================================================================
// READ tools
// ============================================================================

export const ccDashboardInput = {};
export async function ccDashboard() {
  const supabase = client();
  const today = new Date(new Date().toDateString()).toISOString();

  const [rocksRes, statusesRes, todosRes, issuesRes, kpisRes, prioritiesRes] = await Promise.all([
    supabase.from("cc_rocks").select("*").eq("org_id", ORG_ID).eq("quarter", currentQuarter()).order("sort_order"),
    supabase.from("cc_rock_status_updates").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("cc_todos").select("*").eq("org_id", ORG_ID).eq("done", false).order("due_date", { nullsFirst: false }),
    supabase.from("ids_items").select("*").eq("org_id", ORG_ID).eq("is_long_term", false).neq("status", "solved").neq("status", "dropped").gte("priority", 7).order("priority", { ascending: false }).limit(10),
    supabase.from("kpis").select("*").eq("org_id", ORG_ID).order("sort_order"),
    supabase.from("company_priorities").select("*").eq("org_id", ORG_ID).neq("status", "dropped").order("sort_order"),
  ]);

  const rocks = rocksRes.data ?? [];
  const statuses = statusesRes.data ?? [];
  const latestByRock = new Map<string, { status: string; created_at: string }>();
  for (const s of statuses) if (!latestByRock.has(s.rock_id)) latestByRock.set(s.rock_id, s);

  const overdueTodos = (todosRes.data ?? []).filter((t) => t.due_date && t.due_date < today.slice(0, 10));
  const offTrackRocks = rocks
    .map((r) => ({ rock: r, latest: latestByRock.get(r.id) }))
    .filter((x) => x.latest && (x.latest.status === "red" || x.latest.status === "yellow"))
    .map((x) => ({ id: x.rock.id, title: x.rock.title, status: x.latest!.status, last_update: x.latest!.created_at }));

  return jsonText({
    quarter: currentQuarter(),
    priorities: (prioritiesRes.data ?? []).map((p) => p.title),
    rocks: {
      total: rocks.length,
      off_track: offTrackRocks,
      summary: rocks.map((r) => ({ id: r.id, title: r.title, status: r.status, weekly: latestByRock.get(r.id)?.status ?? "no_update" })),
    },
    overdue_todos: overdueTodos.map((t) => ({ id: t.id, title: t.title, due_date: t.due_date, owner_id: t.owner_id, carried_forward: t.carried_forward_count })),
    open_todos_count: (todosRes.data ?? []).length,
    high_priority_issues: (issuesRes.data ?? []).map((i) => ({ id: i.id, title: i.title, priority: i.priority, status: i.status })),
    kpis: (kpisRes.data ?? []).map((k) => ({ name: k.name, value: k.value, target: k.target, unit: k.unit, status: k.value >= (k.target ?? 0) ? "on_track" : "behind" })),
  });
}

// ----------- Rocks -----------

export const ccListRocksInput = {
  quarter: z.string().optional().describe("Quarter like '2026-Q3'. Defaults to current quarter."),
  include_all_quarters: z.boolean().optional().describe("If true, returns rocks from all quarters."),
};
export async function ccListRocks({ quarter, include_all_quarters }: { quarter?: string; include_all_quarters?: boolean }) {
  const supabase = client();
  let q = supabase.from("cc_rocks").select("*").eq("org_id", ORG_ID).order("sort_order");
  if (!include_all_quarters) q = q.eq("quarter", quarter ?? currentQuarter());
  const { data, error } = await q;
  if (error) return jsonText({ error: error.message });
  return jsonText({ count: data?.length ?? 0, rocks: data ?? [] });
}

export const ccCreateRockInput = {
  title: z.string().min(3).describe("Short outcome-focused title."),
  description: z.string().optional(),
  rock_type: z.enum(["company", "individual", "departmental"]).optional().describe("Defaults to 'company'."),
  smart_specific: z.string().optional(),
  smart_measurable: z.string().optional(),
  smart_relevant: z.string().optional(),
  quarter: z.string().optional().describe("Defaults to current quarter."),
};
export async function ccCreateRock(args: {
  title: string; description?: string; rock_type?: "company" | "individual" | "departmental";
  smart_specific?: string; smart_measurable?: string; smart_relevant?: string; quarter?: string;
}) {
  const supabase = client();
  const q = args.quarter ?? currentQuarter();
  const { data, error } = await supabase.from("cc_rocks").insert({
    org_id: ORG_ID,
    title: args.title,
    description: args.description ?? null,
    rock_type: args.rock_type ?? "company",
    quarter: q,
    status: "on_track",
    smart_specific: args.smart_specific ?? null,
    smart_measurable: args.smart_measurable ?? null,
    smart_relevant: args.smart_relevant ?? null,
    due_date: quarterEnd(q),
    sort_order: 999,
  }).select().single();
  if (error) return jsonText({ ok: false, error: error.message });
  return jsonText({ ok: true, rock_id: data?.id, message: `Rock added for ${q}` });
}

export const ccSetRockStatusInput = {
  rock_id: z.string().describe("UUID of the rock."),
  status: z.enum(["green", "yellow", "red"]).describe("Weekly status snapshot."),
  note: z.string().optional(),
};
export async function ccSetRockStatus({ rock_id, status, note }: { rock_id: string; status: "green" | "yellow" | "red"; note?: string }) {
  const supabase = client();
  // Service role bypasses RLS, so confirm the rock belongs to this org before
  // attaching a status update to it.
  const { data: rock, error: rockError } = await supabase
    .from("cc_rocks")
    .select("id")
    .eq("id", rock_id)
    .eq("org_id", ORG_ID)
    .maybeSingle();
  if (rockError) return jsonText({ ok: false, error: rockError.message });
  if (!rock) return jsonText({ ok: false, error: `Rock ${rock_id} not found in this org` });
  const { error } = await supabase.from("cc_rock_status_updates").insert({ rock_id, status, note: note ?? null });
  if (error) return jsonText({ ok: false, error: error.message });
  return jsonText({ ok: true, message: `Rock marked ${status}` });
}

// ----------- To-Dos -----------

export const ccListTodosInput = {
  filter: z.enum(["open", "overdue", "done", "all"]).optional().describe("Defaults to 'open'."),
};
export async function ccListTodos({ filter = "open" }: { filter?: "open" | "overdue" | "done" | "all" }) {
  const supabase = client();
  let q = supabase.from("cc_todos").select("*").eq("org_id", ORG_ID).order("due_date", { nullsFirst: false });
  if (filter === "open") q = q.eq("done", false);
  if (filter === "done") q = q.eq("done", true);
  const { data, error } = await q;
  if (error) return jsonText({ error: error.message });
  const today = new Date().toISOString().slice(0, 10);
  let rows = data ?? [];
  if (filter === "overdue") rows = rows.filter((t) => !t.done && t.due_date && t.due_date < today);
  return jsonText({ count: rows.length, todos: rows });
}

export const ccCreateTodoInput = {
  title: z.string().min(2),
  description: z.string().optional(),
  due_date: z.string().optional().describe("ISO date YYYY-MM-DD. Defaults to today + 7 days."),
  owner_id: z.string().optional().describe("team_members.id UUID."),
};
export async function ccCreateTodo(args: { title: string; description?: string; due_date?: string; owner_id?: string }) {
  const supabase = client();
  const { data, error } = await supabase.from("cc_todos").insert({
    org_id: ORG_ID,
    title: args.title,
    description: args.description ?? null,
    due_date: args.due_date ?? defaultTodoDue(),
    owner_id: args.owner_id ?? null,
  }).select().single();
  if (error) return jsonText({ ok: false, error: error.message });
  return jsonText({ ok: true, todo_id: data?.id });
}

export const ccCompleteTodoInput = {
  todo_id: z.string(),
};
export async function ccCompleteTodo({ todo_id }: { todo_id: string }) {
  const supabase = client();
  // Scoped to the org and selected back: an UPDATE matching zero rows still
  // reports success, which would tell the agent it closed a To-Do it never touched.
  const { data, error } = await supabase
    .from("cc_todos")
    .update({ done: true, updated_at: new Date().toISOString() })
    .eq("id", todo_id)
    .eq("org_id", ORG_ID)
    .select("id");
  if (error) return jsonText({ ok: false, error: error.message });
  if (!data || data.length === 0) return jsonText({ ok: false, error: `To-Do ${todo_id} not found in this org` });
  return jsonText({ ok: true });
}

// ----------- Issues (IDS) -----------

export const ccListIssuesInput = {
  long_term: z.boolean().optional().describe("If true, returns long-term (parked) issues. Default false = short-term."),
  status: z.enum(["open", "discussing", "solved", "all"]).optional().describe("Defaults to all non-solved."),
};
export async function ccListIssues({ long_term, status }: { long_term?: boolean; status?: "open" | "discussing" | "solved" | "all" }) {
  const supabase = client();
  let q = supabase.from("ids_items").select("*").eq("org_id", ORG_ID).order("priority", { ascending: false });
  if (long_term !== undefined) q = q.eq("is_long_term", long_term);
  if (status && status !== "all") q = q.eq("status", status);
  else q = q.neq("status", "dropped");
  const { data, error } = await q;
  if (error) return jsonText({ error: error.message });
  return jsonText({ count: data?.length ?? 0, issues: data ?? [] });
}

export const ccCreateIssueInput = {
  title: z.string().min(2),
  description: z.string().optional(),
  priority: z.number().min(1).max(10).optional().describe("Defaults to 5."),
  long_term: z.boolean().optional().describe("Default false = short-term (current week IDS)."),
};
export async function ccCreateIssue(args: { title: string; description?: string; priority?: number; long_term?: boolean }) {
  const supabase = client();
  const { data, error } = await supabase.from("ids_items").insert({
    org_id: ORG_ID,
    title: args.title,
    description: args.description ?? null,
    status: "open",
    priority: args.priority ?? 5,
    is_long_term: args.long_term ?? false,
  }).select().single();
  if (error) return jsonText({ ok: false, error: error.message });
  return jsonText({ ok: true, issue_id: data?.id });
}

// ----------- Wins / Headlines -----------

export const ccAddWinInput = {
  title: z.string().min(2),
  description: z.string().optional(),
};
export async function ccAddWin({ title, description }: { title: string; description?: string }) {
  const supabase = client();
  const { data, error } = await supabase.from("wins").insert({
    org_id: ORG_ID, title, description: description ?? null,
  }).select().single();
  if (error) return jsonText({ ok: false, error: error.message });
  return jsonText({ ok: true, win_id: data?.id });
}

export const ccAddHeadlineInput = {
  text: z.string().min(2),
  category: z.enum(["customer", "employee", "market", "general"]).optional(),
};
export async function ccAddHeadline({ text, category }: { text: string; category?: "customer" | "employee" | "market" | "general" }) {
  const supabase = client();
  const { data, error } = await supabase.from("cc_headlines").insert({
    org_id: ORG_ID, text, category: category ?? "general",
  }).select().single();
  if (error) return jsonText({ ok: false, error: error.message });
  return jsonText({ ok: true, headline_id: data?.id });
}

// ----------- KPIs -----------

export const ccListKpisInput = {};
export async function ccListKpis() {
  const supabase = client();
  const { data, error } = await supabase.from("kpis").select("*").eq("org_id", ORG_ID).order("sort_order");
  if (error) return jsonText({ error: error.message });
  return jsonText({ count: data?.length ?? 0, kpis: data ?? [] });
}
