/**
 * Cross-org memory tools for the CREAIT MCP server.
 *
 * Supports three scopes:
 *   - personal: per-user across all orgs (e.g. Maurice's preferences)
 *   - org: per-org (e.g. CREAIT-specific client patterns)
 *   - shared: per-user across all their orgs (e.g. cross-business decisions)
 *
 * Backed by the `cc_memory` table in Supabase.
 */
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DEFAULT_OWNER_USER_ID = process.env.DEFAULT_OWNER_USER_ID ?? "maurice";
const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID ?? "org_3Ef1YcutwEZFZHEMLwhF57jbEEh";

function sb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("MEMORY_NOT_CONFIGURED: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set on MCP server.");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const Scope = z.enum(["personal", "org", "shared"]).default("personal");

// ----------------------------------------------------------------------------
// cc_memory_set — upsert (or insert) a memory entry
// ----------------------------------------------------------------------------
export const ccMemorySetInput = {
  content: z.string().min(1).describe("The thing to remember."),
  scope: Scope.describe("personal = per-user across orgs; org = per-org; shared = per-user across their multiple orgs."),
  namespace: z.string().default("general").describe("Logical bucket: 'people', 'decisions', 'preferences', 'patterns', 'general', etc."),
  key: z.string().optional().describe("If set, upserts on (scope, namespace, key) so re-saving overwrites."),
  org_id: z.string().optional().describe("Required for scope=org. Defaults to the configured DEFAULT_ORG_ID for convenience."),
  clerk_user_id: z.string().optional().describe("Required for scope=personal."),
  owner_user_id: z.string().optional().describe("Required for scope=shared. Groups memory across that user's orgs."),
  tags: z.array(z.string()).optional(),
  source: z.string().optional().describe("Where this memory came from: 'chat', 'hermes', 'manual', etc."),
};

export async function ccMemorySet(args: {
  content: string;
  scope: "personal" | "org" | "shared";
  namespace?: string;
  key?: string;
  org_id?: string;
  clerk_user_id?: string;
  owner_user_id?: string;
  tags?: string[];
  source?: string;
}) {
  const supabase = sb();
  const scope = args.scope;
  const namespace = args.namespace ?? "general";

  // Defaults so a casual call from Hermes "just works".
  const clerk_user_id = args.clerk_user_id ?? (scope === "personal" ? DEFAULT_OWNER_USER_ID : null);
  const org_id = args.org_id ?? (scope === "org" ? DEFAULT_ORG_ID : null);
  const owner_user_id = args.owner_user_id ?? (scope === "shared" ? DEFAULT_OWNER_USER_ID : null);

  const row = {
    scope,
    namespace,
    content: args.content,
    key: args.key ?? null,
    clerk_user_id,
    org_id,
    owner_user_id,
    tags: args.tags ?? [],
    source: args.source ?? "hermes",
    updated_at: new Date().toISOString(),
  };

  // If key is provided, upsert on (scope, namespace, key) — overwrites prior value
  if (args.key) {
    // Manual upsert: select first, update or insert
    const { data: existing } = await supabase
      .from("cc_memory")
      .select("id")
      .eq("scope", scope)
      .eq("namespace", namespace)
      .eq("key", args.key)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("cc_memory")
        .update(row)
        .eq("id", (existing as { id: string }).id)
        .select()
        .single();
      if (error) return { error: error.message };
      return { ok: true, id: (data as { id: string }).id, action: "updated", scope, namespace, key: args.key };
    }
  }

  const { data, error } = await supabase
    .from("cc_memory")
    .insert(row)
    .select()
    .single();
  if (error) return { error: error.message };
  return {
    ok: true,
    id: (data as { id: string }).id,
    action: "created",
    scope,
    namespace,
    key: args.key,
  };
}

// ----------------------------------------------------------------------------
// cc_memory_get — fetch by key or by id
// ----------------------------------------------------------------------------
export const ccMemoryGetInput = {
  id: z.string().uuid().optional(),
  scope: Scope.optional(),
  namespace: z.string().optional(),
  key: z.string().optional(),
  org_id: z.string().optional(),
};

export async function ccMemoryGet(args: {
  id?: string;
  scope?: "personal" | "org" | "shared";
  namespace?: string;
  key?: string;
  org_id?: string;
}) {
  const supabase = sb();
  let q = supabase.from("cc_memory").select("*");
  if (args.id) q = q.eq("id", args.id);
  if (args.scope) q = q.eq("scope", args.scope);
  if (args.namespace) q = q.eq("namespace", args.namespace);
  if (args.key) q = q.eq("key", args.key);
  if (args.org_id) q = q.eq("org_id", args.org_id);
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { found: false };
  return { found: true, memory: data };
}

// ----------------------------------------------------------------------------
// cc_memory_search — full-text search across content
// ----------------------------------------------------------------------------
export const ccMemorySearchInput = {
  query: z.string().min(1).describe("Free-text query. Matches against memory content."),
  scope: Scope.optional().describe("Filter to one scope. Leave blank to search all scopes the requester can see."),
  namespace: z.string().optional(),
  org_id: z.string().optional(),
  clerk_user_id: z.string().optional(),
  owner_user_id: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
};

export async function ccMemorySearch(args: {
  query: string;
  scope?: "personal" | "org" | "shared";
  namespace?: string;
  org_id?: string;
  clerk_user_id?: string;
  owner_user_id?: string;
  limit?: number;
}) {
  const supabase = sb();
  const limit = args.limit ?? 10;

  // Use Postgres full-text search via textSearch when possible; fall back to ilike for short queries.
  const isShort = args.query.trim().length < 4;
  const useFts = !isShort;

  let q = supabase.from("cc_memory").select("id,scope,namespace,key,content,tags,updated_at,org_id,source");
  if (useFts) {
    // websearch_to_tsquery handles unquoted multi-word and AND/OR semantics gracefully
    q = q.textSearch("content", args.query, { type: "websearch", config: "english" });
  } else {
    q = q.ilike("content", `%${args.query}%`);
  }
  if (args.scope) q = q.eq("scope", args.scope);
  if (args.namespace) q = q.eq("namespace", args.namespace);
  if (args.org_id) q = q.eq("org_id", args.org_id);
  if (args.clerk_user_id) q = q.eq("clerk_user_id", args.clerk_user_id);
  if (args.owner_user_id) q = q.eq("owner_user_id", args.owner_user_id);
  q = q.order("updated_at", { ascending: false }).limit(limit);

  const { data, error } = await q;
  if (error) return { error: error.message, query: args.query };
  return { count: data?.length ?? 0, results: data ?? [], query: args.query };
}

// ----------------------------------------------------------------------------
// cc_memory_list — list recent memories in a scope/namespace
// ----------------------------------------------------------------------------
export const ccMemoryListInput = {
  scope: Scope.optional(),
  namespace: z.string().optional(),
  org_id: z.string().optional(),
  clerk_user_id: z.string().optional(),
  owner_user_id: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
};

export async function ccMemoryList(args: {
  scope?: "personal" | "org" | "shared";
  namespace?: string;
  org_id?: string;
  clerk_user_id?: string;
  owner_user_id?: string;
  limit?: number;
}) {
  const supabase = sb();
  const limit = args.limit ?? 25;
  let q = supabase
    .from("cc_memory")
    .select("id,scope,namespace,key,content,tags,updated_at,org_id,source")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (args.scope) q = q.eq("scope", args.scope);
  if (args.namespace) q = q.eq("namespace", args.namespace);
  if (args.org_id) q = q.eq("org_id", args.org_id);
  if (args.clerk_user_id) q = q.eq("clerk_user_id", args.clerk_user_id);
  if (args.owner_user_id) q = q.eq("owner_user_id", args.owner_user_id);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length ?? 0, memories: data ?? [] };
}

// ----------------------------------------------------------------------------
// cc_memory_delete — remove a memory by id or key
// ----------------------------------------------------------------------------
export const ccMemoryDeleteInput = {
  id: z.string().uuid().optional(),
  scope: Scope.optional(),
  namespace: z.string().optional(),
  key: z.string().optional(),
};

export async function ccMemoryDelete(args: {
  id?: string;
  scope?: "personal" | "org" | "shared";
  namespace?: string;
  key?: string;
}) {
  const supabase = sb();
  let q = supabase.from("cc_memory").delete({ count: "exact" });
  if (args.id) q = q.eq("id", args.id);
  else if (args.scope && args.namespace && args.key) {
    q = q.eq("scope", args.scope).eq("namespace", args.namespace).eq("key", args.key);
  } else {
    return { error: "Provide either id, or (scope + namespace + key)." };
  }
  const { error, count } = await q;
  if (error) return { error: error.message };
  return { ok: true, deleted: count ?? 0 };
}
