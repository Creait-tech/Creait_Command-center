import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Strategy, VtoData } from "@/lib/supabase/types";

/**
 * A compact, plain-text picture of the company for the AI to reason from:
 * the vision, the numbers, what the team is already working on, and what is
 * unresolved. Used by prep-session synthesis and by rock suggestions, so
 * both see the same company and neither invents one.
 *
 * Deliberately short. A model given fifty rows of history writes about the
 * history; a model given the shape of the business writes about the business.
 * Everything here is read through the caller's RLS session — this never uses
 * the service role, so it can only ever describe the org the user is in.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface CompanyBrief {
  /** Rendered prompt block. */
  text: string;
  /** True when there was almost nothing to describe — callers may warn. */
  thin: boolean;
}

function line(label: string, value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? `${label}: ${v}` : null;
}

function renderVto(vto: VtoData | null): string[] {
  if (!vto) return [];
  const out: string[] = [];
  if (vto.core_values?.length) out.push(`Core values: ${vto.core_values.join(", ")}`);
  if (vto.core_focus?.purpose) out.push(`Purpose: ${vto.core_focus.purpose}`);
  if (vto.core_focus?.niche) out.push(`Niche: ${vto.core_focus.niche}`);
  if (vto.ten_year_target) out.push(`10-year target: ${vto.ten_year_target}`);
  if (vto.marketing_strategy?.target_market) out.push(`Target market: ${vto.marketing_strategy.target_market}`);
  if (vto.marketing_strategy?.three_uniques?.length) out.push(`Three uniques: ${vto.marketing_strategy.three_uniques.join("; ")}`);
  if (vto.three_year_picture) out.push(`3-year picture: ${vto.three_year_picture}`);
  if (vto.one_year_plan) out.push(`1-year plan: ${vto.one_year_plan}`);
  return out;
}

export async function buildCompanyBrief(
  supabase: Supabase,
  orgId: string,
  opts: { quarter?: string } = {},
): Promise<CompanyBrief> {
  const [strategyRes, kpisRes, rocksRes, clientsRes, issuesRes, headlinesRes] = await Promise.all([
    supabase.from("strategy").select("*").eq("org_id", orgId).maybeSingle(),
    supabase.from("kpis").select("name, value, target, unit, goal_operator").eq("org_id", orgId).order("sort_order"),
    supabase
      .from("cc_rocks")
      .select("title, status, quarter, rock_type, due_date")
      .eq("org_id", orgId)
      .order("quarter", { ascending: false })
      .limit(30),
    supabase.from("cc_clients").select("name, company, status, tier, mrr, health").eq("org_id", orgId).order("mrr", { ascending: false, nullsFirst: false }).limit(25),
    supabase
      .from("ids_items")
      .select("title, status, is_long_term")
      .eq("org_id", orgId)
      .in("status", ["open", "discussing"])
      .order("priority", { ascending: false })
      .limit(25),
    supabase.from("cc_headlines").select("text, category").eq("org_id", orgId).order("created_at", { ascending: false }).limit(15),
  ]);

  const strategy = strategyRes.data as Strategy | null;
  const kpis = (kpisRes.data as Array<{ name: string; value: number | null; target: number | null; unit: string | null; goal_operator: string | null }> | null) ?? [];
  const rocks = (rocksRes.data as Array<{ title: string; status: string; quarter: string; rock_type: string; due_date: string | null }> | null) ?? [];
  const clients = (clientsRes.data as Array<{ name: string; company: string | null; status: string | null; tier: string | null; mrr: number | null; health: string | null }> | null) ?? [];
  const issues = (issuesRes.data as Array<{ title: string; status: string; is_long_term: boolean }> | null) ?? [];
  const headlines = (headlinesRes.data as Array<{ text: string; category: string }> | null) ?? [];

  const sections: string[] = [];

  const identity = [
    line("Mission", strategy?.mission),
    line("Vision", strategy?.vision),
    line("Ideal client", strategy?.icp),
    line("Value ladder", strategy?.value_ladder),
    ...renderVto((strategy?.vto as VtoData | null) ?? null),
  ].filter(Boolean) as string[];
  if (identity.length > 0) sections.push(`## Who this company is\n${identity.join("\n")}`);

  if (kpis.length > 0) {
    const rows = kpis.map((k) => {
      const unit = k.unit === "USD" ? "$" : "";
      const current = k.value === null ? "not measured" : `${unit}${k.value}`;
      const target = k.target === null ? "no target" : `target ${unit}${k.target}`;
      return `- ${k.name}: ${current} (${target})`;
    });
    sections.push(`## The scorecard right now\n${rows.join("\n")}`);
  }

  const activeQuarter = opts.quarter;
  const thisQuarter = activeQuarter ? rocks.filter((r) => r.quarter === activeQuarter) : [];
  const priorRocks = activeQuarter ? rocks.filter((r) => r.quarter !== activeQuarter).slice(0, 12) : rocks.slice(0, 12);
  if (thisQuarter.length > 0) {
    sections.push(
      `## Rocks this quarter (${activeQuarter})\n${thisQuarter.map((r) => `- [${r.status}] ${r.title} (${r.rock_type})`).join("\n")}`,
    );
  }
  if (priorRocks.length > 0) {
    sections.push(
      `## Earlier rocks and how they ended\n${priorRocks.map((r) => `- ${r.quarter} [${r.status}] ${r.title}`).join("\n")}`,
    );
  }

  if (clients.length > 0) {
    const mrr = clients.reduce((a, c) => a + (c.mrr ?? 0), 0);
    const rows = clients
      .slice(0, 15)
      .map((c) => `- ${c.company?.trim() || c.name} — ${c.status ?? "unknown"}${c.tier ? `, ${c.tier}` : ""}${c.mrr ? `, $${c.mrr}/mo` : ""}`);
    sections.push(`## Clients (total recurring $${mrr}/mo across ${clients.length})\n${rows.join("\n")}`);
  }

  if (issues.length > 0) {
    sections.push(
      `## Open issues the team has not solved\n${issues.map((i) => `- ${i.title}${i.is_long_term ? " (parked as long-term)" : ""}`).join("\n")}`,
    );
  }

  if (headlines.length > 0) {
    sections.push(`## Recent headlines\n${headlines.map((h) => `- [${h.category}] ${h.text}`).join("\n")}`);
  }

  return {
    text: sections.length > 0 ? sections.join("\n\n") : "(No company data recorded yet.)",
    thin: sections.length < 3,
  };
}
