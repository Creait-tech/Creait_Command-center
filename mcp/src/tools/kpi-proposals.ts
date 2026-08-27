/**
 * Scorecard KPI proposals — how Hermes asks to change what the Level 10
 * scoreboard measures.
 *
 * Nothing here mutates `kpis`. Every path files a pending row in
 * `cc_agent_proposals`; a teammate accepts it in the Command Center and only
 * that acceptance changes the scoreboard.
 *
 * The trap this module exists to surface: `ghlSync` finds KPIs by their exact
 * `name` and writes with `.maybeSingle()`, so renaming or removing a synced
 * KPI produces no error at all — the sync keeps computing the number every
 * hour and writes it nowhere, and the scoreboard silently freezes at its last
 * value. Any proposal that would cause that says so, loudly, in `impact`.
 *
 * A KPI's current `value` is deliberately not proposable here. That is data
 * written by the sync or by a teammate in the scoreboard, not configuration.
 */
import { z } from "zod";

import {
  ORG_ID,
  GHL_SYNCED_KPI_NAMES,
  KPI_SOURCES,
  client,
  diff,
  duplicateText,
  errorText,
  fileProposal,
  findPendingDuplicate,
  loadKpis,
  loadPendingProposals,
  noChangeText,
  resolveKpi,
  sameLabel,
  type KpiRow,
} from "./proposal-core.js";

// ============================================================================
// cc_propose_kpi_change
// ============================================================================

const KPI_OPERATIONS = ["add", "update", "remove"] as const;

/** True when this KPI's value is written by the hourly GHL sync. */
function isGhlSynced(kpi: KpiRow): boolean {
  return kpi.source === "ghl" || GHL_SYNCED_KPI_NAMES.some((n) => sameLabel(n, kpi.name));
}

export const ccProposeKpiChangeInput = {
  operation: z.enum(KPI_OPERATIONS).describe("'add' a scorecard KPI, 'update' an existing one, or 'remove' one."),
  rationale: z
    .string()
    .min(10)
    .describe(
      "REQUIRED. Why the scorecard should change, in a sentence a teammate can judge. Never restate the operation — say what led you to it.",
    ),
  kpi: z.string().optional().describe("KPI name (e.g. 'Active Deals') or uuid. Required for 'update' and 'remove'."),
  name: z
    .string()
    .optional()
    .describe("The KPI's name. Required for 'add'. On 'update' this is the rename — omit it to leave the name alone."),
  target: z.number().optional().describe("The number the team is aiming at."),
  unit: z.string().optional().describe("How the number reads — 'USD', 'count', '%'."),
  source: z
    .enum(KPI_SOURCES)
    .optional()
    .describe("Where the value comes from: 'manual', 'ghl', 'stripe', 'google', 'other'."),
  description: z.string().optional().describe("What the KPI means, shown under its name."),
  sort_order: z.number().int().min(0).optional().describe("Position on the scoreboard."),
  evidence: z
    .string()
    .optional()
    .describe("Where the belief came from — meeting name and date, a quote, a file path."),
};

export async function ccProposeKpiChange(args: {
  operation: (typeof KPI_OPERATIONS)[number];
  rationale: string;
  kpi?: string;
  name?: string;
  target?: number;
  unit?: string;
  source?: (typeof KPI_SOURCES)[number];
  description?: string;
  sort_order?: number;
  evidence?: string;
}) {
  const supabase = client();

  let kpis: KpiRow[];
  let pending: Awaited<ReturnType<typeof loadPendingProposals>>;
  try {
    const [kpiRows, pendingRows] = await Promise.all([loadKpis(supabase), loadPendingProposals(supabase, "kpi")]);
    kpis = kpiRows;
    pending = pendingRows;
  } catch (err) {
    return errorText("QUERY_FAILED", (err as Error).message);
  }

  const table = "kpis" as const;

  // -------------------------------------------------------------------- add
  if (args.operation === "add") {
    if (!args.name?.trim()) return errorText("NAME_REQUIRED", "operation='add' needs `name`.");
    const proposedName = args.name.trim();

    const clash = kpis.find((k) => sameLabel(k.name, proposedName));
    if (clash) {
      return noChangeText(
        `A KPI called "${clash.name}" is already on the scoreboard. Nothing filed — update it instead if it needs to change.`,
        { existing: { id: clash.id, name: clash.name, target: clash.target, unit: clash.unit, source: clash.source } },
      );
    }
    const dupe = findPendingDuplicate(pending, { action: "create", targetTable: table, label: proposedName });
    if (dupe) return duplicateText(dupe, `adding a KPI called "${proposedName}"`);

    const source = args.source ?? "manual";
    const nextOrder = args.sort_order ?? Math.max(-1, ...kpis.map((k) => k.sort_order ?? 0)) + 1;

    // A ghl-sourced KPI only ever receives a value if its name is one the
    // sync writes by. Anything else sits at zero forever, looking broken.
    const ghlNameRecognised = GHL_SYNCED_KPI_NAMES.some((n) => sameLabel(n, proposedName));
    const ghlWarning =
      source === "ghl" && !ghlNameRecognised
        ? `source='ghl' but the GHL sync only writes KPIs named ${GHL_SYNCED_KPI_NAMES.map((n) => `"${n}"`).join(", ")}. ` +
          `"${proposedName}" would never receive a synced value — it would stay at 0. Use source='manual' or match one of those names.`
        : null;

    return fileProposal(supabase, {
      action: "create",
      targetKind: "kpi",
      targetTable: table,
      targetId: null,
      rationale: args.rationale,
      evidence: args.evidence,
      summary: `Add a scorecard KPI: "${proposedName}"`,
      payload: {
        target: { kind: "kpi", table, id: null, label: proposedName },
        operation: "create",
        current: null,
        proposed: {
          org_id: ORG_ID,
          name: proposedName,
          description: args.description?.trim() ?? null,
          target: args.target ?? null,
          unit: args.unit?.trim() ?? null,
          source,
          sort_order: nextOrder,
        },
      },
      impact: {
        ghl_sync_warning: ghlWarning,
        note:
          "A new KPI starts at 0 with no history. " +
          (source === "manual"
            ? "Someone has to enter its value in the Level 10 scoreboard."
            : "Its value only moves when a sync writes it."),
      },
    });
  }

  if (!args.kpi) {
    return errorText("KPI_REQUIRED", `operation='${args.operation}' needs \`kpi\` — the name or uuid of the KPI.`);
  }
  const resolved = resolveKpi(args.kpi, kpis);
  if (!resolved.ok) return resolved.result;
  const row = resolved.kpi;
  const synced = isGhlSynced(row);

  // ----------------------------------------------------------------- remove
  if (args.operation === "remove") {
    const dupe = findPendingDuplicate(pending, { action: "delete", targetTable: table, targetId: row.id });
    if (dupe) return duplicateText(dupe, `removing the "${row.name}" KPI`);

    return fileProposal(supabase, {
      action: "delete",
      targetKind: "kpi",
      targetTable: table,
      targetId: row.id,
      rationale: args.rationale,
      evidence: args.evidence,
      summary: `Remove the scorecard KPI "${row.name}"`,
      payload: {
        target: { kind: "kpi", table, id: row.id, label: row.name },
        operation: "delete",
        current: {
          name: row.name,
          description: row.description,
          value: row.value,
          target: row.target,
          unit: row.unit,
          source: row.source,
          sort_order: row.sort_order,
        },
        proposed: null,
      },
      impact: {
        destructive: true,
        ghl_synced: synced,
        ghl_sync_orphan: synced,
        last_synced_at: row.last_synced_at,
        note: synced
          ? `"${row.name}" is written by the hourly GHL sync, which finds it by exact name. Removing it means the sync ` +
            "keeps computing that number every hour and quietly writes it nowhere — no error, no scoreboard entry. " +
            "Its recorded history in cc_kpi_history goes with the row too."
          : "This KPI is entered by hand. Removing it also removes its recorded history in cc_kpi_history.",
      },
    });
  }

  // ----------------------------------------------------------------- update
  const proposed: Record<string, unknown> = {};
  if (args.name !== undefined) proposed.name = args.name.trim();
  if (args.description !== undefined) proposed.description = args.description.trim();
  if (args.target !== undefined) proposed.target = args.target;
  if (args.unit !== undefined) proposed.unit = args.unit.trim();
  if (args.source !== undefined) proposed.source = args.source;
  if (args.sort_order !== undefined) proposed.sort_order = args.sort_order;

  if (Object.keys(proposed).length === 0) {
    return errorText(
      "NOTHING_PROPOSED",
      "Pass at least one of name, target, unit, source, description or sort_order. A KPI's current `value` is not proposable here — it is written by the sync or by a teammate in the scoreboard.",
    );
  }

  const changes = diff(
    {
      name: row.name,
      description: row.description,
      target: row.target,
      unit: row.unit,
      source: row.source,
      sort_order: row.sort_order,
    },
    proposed,
  );
  if (changes.length === 0) {
    return noChangeText(`"${row.name}" already has those values. No change needed, so nothing was filed.`, {
      kpi: {
        id: row.id,
        name: row.name,
        target: row.target,
        unit: row.unit,
        source: row.source,
        sort_order: row.sort_order,
      },
    });
  }
  const dupe = findPendingDuplicate(pending, { action: "update", targetTable: table, targetId: row.id });
  if (dupe) return duplicateText(dupe, `the "${row.name}" KPI`);

  const rename = changes.find((c) => c.field === "name");
  const orphansSync = Boolean(rename) && synced;

  return fileProposal(supabase, {
    action: "update",
    targetKind: "kpi",
    targetTable: table,
    targetId: row.id,
    rationale: args.rationale,
    evidence: args.evidence,
    summary: rename ? `Rename the KPI "${row.name}" to "${rename.to}"` : `Edit the KPI "${row.name}"`,
    payload: {
      target: { kind: "kpi", table, id: row.id, label: row.name },
      operation: "update",
      current: {
        name: row.name,
        description: row.description,
        value: row.value,
        target: row.target,
        unit: row.unit,
        source: row.source,
        sort_order: row.sort_order,
      },
      proposed,
      changes,
    },
    impact: {
      ghl_synced: synced,
      ghl_sync_orphan: orphansSync,
      last_synced_at: row.last_synced_at,
      note: orphansSync
        ? `WARNING: the hourly GHL sync finds this KPI by its exact name "${row.name}". Renaming it to "${rename?.to}" ` +
          "makes the sync match nothing — it reports no error, writes no value, and the number silently stops updating " +
          `at ${row.value}. Either keep the name, or have someone change the name the sync writes by in the same pass.`
        : synced
          ? "This KPI is written by the GHL sync. The name is unchanged, so the sync keeps finding it."
          : "This KPI is entered by hand, so nothing external depends on its name.",
    },
  });
}
