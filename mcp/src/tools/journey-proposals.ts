/**
 * Journey-template proposals — how Hermes asks to change the SHAPE of the
 * CREAIT delivery journey: the milestones every client walks through and the
 * deliverables inside them.
 *
 * Nothing here mutates `journey_milestones` or `journey_deliverables`. Every
 * path files a pending row in `cc_agent_proposals` and returns; a teammate
 * accepts it in the Command Center and only that acceptance changes the
 * template.
 *
 * Deletions carry their cost. The foreign keys cascade — removing a milestone
 * removes its deliverables, and removing a deliverable removes every client's
 * tick against it — so every delete proposal reports the tracked progress that
 * would go with it, by client, before an approver decides.
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ORG_ID,
  client,
  diff,
  duplicateText,
  errorText,
  fileProposal,
  findPendingDuplicate,
  loadClients,
  loadPendingProposals,
  loadTemplate,
  noChangeText,
  resolveDeliverable,
  resolveMilestone,
  sameLabel,
  type ClientRow,
  type DeliverableRow,
  type MilestoneRow,
} from "./proposal-core.js";

// ============================================================================
// Tracked-progress impact — what a deletion would cost
// ============================================================================

type JourneyImpactRow = { client_id: string; deliverable_id: string; done: boolean | null };

/**
 * What tracked client progress hangs off these deliverables. An approver has to
 * see this BEFORE accepting a deletion, because the foreign keys cascade:
 * removing a milestone removes its deliverables, and removing a deliverable
 * removes every client's tick against it. The ticks do not come back.
 */
async function trackedProgress(
  supabase: SupabaseClient,
  deliverableIds: string[],
  clients: ClientRow[],
): Promise<{
  tracked_rows: number;
  completed: number;
  not_completed: number;
  clients_affected: Array<{ id: string; name: string | null; tracked: number; completed: number }>;
} | { error: string }> {
  if (deliverableIds.length === 0) {
    return { tracked_rows: 0, completed: 0, not_completed: 0, clients_affected: [] };
  }
  const { data, error } = await supabase
    .from("cc_client_journey")
    .select("client_id, deliverable_id, done")
    .eq("org_id", ORG_ID)
    .in("deliverable_id", deliverableIds);
  if (error) return { error: error.message };

  const rows = (data ?? []) as JourneyImpactRow[];
  const byClient = new Map<string, { tracked: number; completed: number }>();
  let completed = 0;
  for (const r of rows) {
    const bucket = byClient.get(r.client_id) ?? { tracked: 0, completed: 0 };
    bucket.tracked += 1;
    if (r.done === true) {
      bucket.completed += 1;
      completed += 1;
    }
    byClient.set(r.client_id, bucket);
  }
  const nameById = new Map(clients.map((c) => [c.id, c.name] as const));

  return {
    tracked_rows: rows.length,
    completed,
    not_completed: rows.length - completed,
    clients_affected: [...byClient.entries()]
      .map(([id, b]) => ({ id, name: nameById.get(id) ?? null, tracked: b.tracked, completed: b.completed }))
      .sort((a, b) => b.completed - a.completed),
  };
}

// ============================================================================
// cc_propose_journey_change
// ============================================================================

const JOURNEY_TARGETS = ["milestone", "deliverable"] as const;
const JOURNEY_OPERATIONS = ["add", "update", "remove", "reorder"] as const;

export const ccProposeJourneyChangeInput = {
  target: z
    .enum(JOURNEY_TARGETS)
    .describe("'milestone' for a journey stage, 'deliverable' for a checklist item inside a stage."),
  operation: z
    .enum(JOURNEY_OPERATIONS)
    .describe(
      "'add' a new one, 'update' an existing one (this covers renaming), 'remove' one, or 'reorder' the whole set.",
    ),
  rationale: z
    .string()
    .min(10)
    .describe(
      "REQUIRED. Why the template should change, in a sentence a teammate can judge. Never restate the operation — say what led you to it.",
    ),
  milestone: z
    .string()
    .optional()
    .describe(
      "Milestone name (e.g. 'Onboarding') or uuid. Required to update/remove a milestone, to add a deliverable, and to reorder deliverables. Optional when updating or removing a deliverable, where it only narrows the lookup.",
    ),
  deliverable: z
    .string()
    .optional()
    .describe("Deliverable title or uuid. Required to update or remove a deliverable."),
  name: z
    .string()
    .optional()
    .describe(
      "The milestone name or deliverable title. Required for 'add'. On 'update' this is the rename — omit it to leave the name alone.",
    ),
  description: z.string().optional().describe("Longer explanation shown under the name."),
  required: z
    .boolean()
    .optional()
    .describe("Deliverables only. Whether the item counts toward a client's required-completion total."),
  sort_order: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Position within its list. Use 'reorder' instead when moving several at once."),
  order: z
    .array(z.string().min(1))
    .optional()
    .describe(
      "Required for 'reorder'. The COMPLETE list of names or uuids in the order proposed — every item in the set, none repeated. A partial list is rejected rather than guessed at.",
    ),
  evidence: z
    .string()
    .optional()
    .describe("Where the belief came from — meeting name and date, a quote, a file path. Give the human something to check."),
};

export async function ccProposeJourneyChange(args: {
  target: (typeof JOURNEY_TARGETS)[number];
  operation: (typeof JOURNEY_OPERATIONS)[number];
  rationale: string;
  milestone?: string;
  deliverable?: string;
  name?: string;
  description?: string;
  required?: boolean;
  sort_order?: number;
  order?: string[];
  evidence?: string;
}) {
  const supabase = client();

  let milestones: MilestoneRow[];
  let deliverables: DeliverableRow[];
  let clients: ClientRow[];
  let pending: Awaited<ReturnType<typeof loadPendingProposals>>;
  try {
    const [template, allClients, pendingRows] = await Promise.all([
      loadTemplate(supabase),
      loadClients(supabase),
      loadPendingProposals(supabase, "journey_template"),
    ]);
    milestones = template.milestones;
    deliverables = template.deliverables;
    clients = allClients;
    pending = pendingRows;
  } catch (err) {
    return errorText("QUERY_FAILED", (err as Error).message);
  }

  const milestoneName = (id: string) => milestones.find((m) => m.id === id)?.name ?? null;
  const table = args.target === "milestone" ? "journey_milestones" : "journey_deliverables";

  // ---------------------------------------------------------------- reorder
  if (args.operation === "reorder") {
    if (!args.order || args.order.length === 0) {
      return errorText("ORDER_REQUIRED", "operation='reorder' needs `order` — the complete list, in the order proposed.");
    }

    let pool: Array<{ id: string; label: string | null; sort_order: number | null }>;
    let scopeLabel: string;
    let scopeMilestone: MilestoneRow | null = null;

    if (args.target === "milestone") {
      pool = milestones.map((m) => ({ id: m.id, label: m.name, sort_order: m.sort_order }));
      scopeLabel = "the journey milestones";
    } else {
      if (!args.milestone) {
        return errorText(
          "MILESTONE_REQUIRED",
          "Reordering deliverables happens inside one milestone. Pass `milestone` to say which.",
        );
      }
      const resolved = resolveMilestone(args.milestone, milestones);
      if (!resolved.ok) return resolved.result;
      scopeMilestone = resolved.milestone;
      pool = deliverables
        .filter((d) => d.milestone_id === resolved.milestone.id)
        .map((d) => ({ id: d.id, label: d.title, sort_order: d.sort_order }));
      scopeLabel = `the deliverables in "${resolved.milestone.name}"`;
    }

    const resolvedIds: string[] = [];
    for (const entry of args.order) {
      const hit =
        pool.find((p) => p.id === entry.trim()) ??
        pool.find((p) => sameLabel(p.label, entry));
      if (!hit) {
        return errorText("ORDER_ENTRY_NOT_FOUND", `"${entry}" is not one of ${scopeLabel}.`, {
          known: pool.map((p) => ({ id: p.id, label: p.label, sort_order: p.sort_order })),
        });
      }
      if (resolvedIds.includes(hit.id)) {
        return errorText("ORDER_DUPLICATE", `"${entry}" appears more than once in \`order\`.`);
      }
      resolvedIds.push(hit.id);
    }
    if (resolvedIds.length !== pool.length) {
      const missing = pool.filter((p) => !resolvedIds.includes(p.id)).map((p) => p.label);
      return errorText(
        "ORDER_INCOMPLETE",
        `\`order\` must list all ${pool.length} of ${scopeLabel}; ${missing.length} were left out. A partial order is ambiguous, so nothing was filed.`,
        { missing },
      );
    }

    const currentIds = [...pool].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((p) => p.id);
    if (currentIds.join(",") === resolvedIds.join(",")) {
      return noChangeText(`${scopeLabel} are already in that order. No proposal filed.`, {
        current_order: currentIds.map((id) => pool.find((p) => p.id === id)?.label ?? id),
      });
    }

    const labelOf = (id: string) => pool.find((p) => p.id === id)?.label ?? id;
    const dupe = findPendingDuplicate(pending, { action: "reorder", targetTable: table, label: scopeLabel });
    if (dupe) return duplicateText(dupe, `reordering ${scopeLabel}`);

    return fileProposal(supabase, {
      action: "reorder",
      targetKind: "journey_template",
      targetTable: table,
      targetId: scopeMilestone?.id ?? null,
      rationale: args.rationale,
      evidence: args.evidence,
      summary: `Reorder ${scopeLabel}`,
      payload: {
        target: { kind: "journey_template", table, id: scopeMilestone?.id ?? null, label: scopeLabel },
        operation: "reorder",
        scope_milestone: scopeMilestone ? { id: scopeMilestone.id, name: scopeMilestone.name } : null,
        current: { order: currentIds.map((id) => ({ id, label: labelOf(id) })) },
        proposed: { order: resolvedIds.map((id, i) => ({ id, label: labelOf(id), sort_order: i })) },
      },
      impact: {
        reorders_only: true,
        note: "Reordering changes presentation order. No client's tracked progress is added or removed by it.",
      },
    });
  }

  // -------------------------------------------------------------------- add
  if (args.operation === "add") {
    if (!args.name?.trim()) {
      return errorText("NAME_REQUIRED", "operation='add' needs `name` — the milestone name or deliverable title.");
    }
    const proposedName = args.name.trim();

    if (args.target === "milestone") {
      const clash = milestones.find((m) => sameLabel(m.name, proposedName));
      if (clash) {
        return noChangeText(
          `A milestone called "${clash.name}" already exists. Nothing filed — update it instead if it needs to change.`,
          { existing: { id: clash.id, name: clash.name, sort_order: clash.sort_order } },
        );
      }
      const dupe = findPendingDuplicate(pending, { action: "create", targetTable: table, label: proposedName });
      if (dupe) return duplicateText(dupe, `adding a milestone called "${proposedName}"`);

      const nextOrder = args.sort_order ?? Math.max(-1, ...milestones.map((m) => m.sort_order ?? 0)) + 1;
      return fileProposal(supabase, {
        action: "create",
        targetKind: "journey_template",
        targetTable: table,
        targetId: null,
        rationale: args.rationale,
        evidence: args.evidence,
        summary: `Add a journey milestone: "${proposedName}"`,
        payload: {
          target: { kind: "journey_template", table, id: null, label: proposedName },
          operation: "create",
          current: null,
          proposed: {
            org_id: ORG_ID,
            name: proposedName,
            description: args.description?.trim() ?? null,
            sort_order: nextOrder,
          },
        },
        impact: {
          adds_to_every_client: true,
          clients_in_scope: clients.length,
          note:
            "A new milestone starts empty — it contributes deliverables only once items are added to it. " +
            "Existing client progress is unaffected.",
        },
      });
    }

    // deliverable
    if (!args.milestone) {
      return errorText("MILESTONE_REQUIRED", "Adding a deliverable needs `milestone` — which stage it belongs to.");
    }
    const resolved = resolveMilestone(args.milestone, milestones);
    if (!resolved.ok) return resolved.result;
    const parent = resolved.milestone;

    const siblings = deliverables.filter((d) => d.milestone_id === parent.id);
    const clash = siblings.find((d) => sameLabel(d.title, proposedName));
    if (clash) {
      return noChangeText(
        `"${parent.name}" already has a deliverable called "${clash.title}". Nothing filed — update it instead if it needs to change.`,
        { existing: { id: clash.id, title: clash.title, milestone: parent.name } },
      );
    }
    const dupe = findPendingDuplicate(pending, { action: "create", targetTable: table, label: proposedName });
    if (dupe) return duplicateText(dupe, `adding a deliverable called "${proposedName}"`);

    const nextOrder = args.sort_order ?? Math.max(-1, ...siblings.map((d) => d.sort_order ?? 0)) + 1;
    return fileProposal(supabase, {
      action: "create",
      targetKind: "journey_template",
      targetTable: table,
      targetId: null,
      rationale: args.rationale,
      evidence: args.evidence,
      summary: `Add a deliverable to "${parent.name}": "${proposedName}"`,
      payload: {
        target: { kind: "journey_template", table, id: null, label: proposedName },
        operation: "create",
        milestone: { id: parent.id, name: parent.name },
        current: null,
        proposed: {
          milestone_id: parent.id,
          title: proposedName,
          description: args.description?.trim() ?? null,
          required: args.required ?? true,
          sort_order: nextOrder,
        },
      },
      impact: {
        adds_to_every_client: true,
        clients_in_scope: clients.length,
        note:
          `Every client's denominator grows by one: ${deliverables.length} deliverables today, ${deliverables.length + 1} if accepted. ` +
          "Completion percentages will drop for everyone until the new item is ticked.",
      },
    });
  }

  // ----------------------------------------------------------------- update
  if (args.operation === "update") {
    if (args.target === "milestone") {
      if (!args.milestone) {
        return errorText("MILESTONE_REQUIRED", "operation='update' on a milestone needs `milestone`.");
      }
      const resolved = resolveMilestone(args.milestone, milestones);
      if (!resolved.ok) return resolved.result;
      const row = resolved.milestone;

      const proposed: Record<string, unknown> = {};
      if (args.name !== undefined) proposed.name = args.name.trim();
      if (args.description !== undefined) proposed.description = args.description.trim();
      if (args.sort_order !== undefined) proposed.sort_order = args.sort_order;
      if (Object.keys(proposed).length === 0) {
        return errorText(
          "NOTHING_PROPOSED",
          "Pass at least one of name, description or sort_order — otherwise there is nothing to change.",
        );
      }
      const changes = diff(
        { name: row.name, description: row.description, sort_order: row.sort_order },
        proposed,
      );
      if (changes.length === 0) {
        return noChangeText(`"${row.name}" already has those values. No change needed, so nothing was filed.`, {
          milestone: { id: row.id, name: row.name, description: row.description, sort_order: row.sort_order },
        });
      }
      const dupe = findPendingDuplicate(pending, { action: "update", targetTable: table, targetId: row.id });
      if (dupe) return duplicateText(dupe, `the "${row.name}" milestone`);

      const renaming = changes.some((c) => c.field === "name");
      return fileProposal(supabase, {
        action: "update",
        targetKind: "journey_template",
        targetTable: table,
        targetId: row.id,
        rationale: args.rationale,
        evidence: args.evidence,
        summary: renaming
          ? `Rename the milestone "${row.name}" to "${proposed.name}"`
          : `Edit the milestone "${row.name}"`,
        payload: {
          target: { kind: "journey_template", table, id: row.id, label: row.name },
          operation: "update",
          current: { name: row.name, description: row.description, sort_order: row.sort_order },
          proposed,
          changes,
        },
        impact: {
          renames: renaming,
          deliverables_under_it: deliverables.filter((d) => d.milestone_id === row.id).length,
          note: renaming
            ? "A rename keeps the same row, so every client's tracked progress under this milestone stays attached."
            : "Editing a milestone's text changes no client's tracked progress.",
        },
      });
    }

    // deliverable
    if (!args.deliverable) {
      return errorText("DELIVERABLE_REQUIRED", "operation='update' on a deliverable needs `deliverable`.");
    }
    let pool = deliverables;
    if (args.milestone) {
      const scoped = resolveMilestone(args.milestone, milestones);
      if (!scoped.ok) return scoped.result;
      pool = deliverables.filter((d) => d.milestone_id === scoped.milestone.id);
    }
    const resolvedDeliverable = resolveDeliverable(args.deliverable, pool, milestoneName);
    if (!resolvedDeliverable.ok) return resolvedDeliverable.result;
    const row = resolvedDeliverable.deliverable;

    const proposed: Record<string, unknown> = {};
    if (args.name !== undefined) proposed.title = args.name.trim();
    if (args.description !== undefined) proposed.description = args.description.trim();
    if (args.required !== undefined) proposed.required = args.required;
    if (args.sort_order !== undefined) proposed.sort_order = args.sort_order;
    if (Object.keys(proposed).length === 0) {
      return errorText(
        "NOTHING_PROPOSED",
        "Pass at least one of name, description, required or sort_order — otherwise there is nothing to change.",
      );
    }
    const changes = diff(
      { title: row.title, description: row.description, required: row.required, sort_order: row.sort_order },
      proposed,
    );
    if (changes.length === 0) {
      return noChangeText(`"${row.title}" already has those values. No change needed, so nothing was filed.`, {
        deliverable: {
          id: row.id,
          title: row.title,
          description: row.description,
          required: row.required,
          sort_order: row.sort_order,
        },
      });
    }
    const dupe = findPendingDuplicate(pending, { action: "update", targetTable: table, targetId: row.id });
    if (dupe) return duplicateText(dupe, `the "${row.title}" deliverable`);

    const impact = await trackedProgress(supabase, [row.id], clients);
    if ("error" in impact) return errorText("QUERY_FAILED", impact.error);

    const renaming = changes.some((c) => c.field === "title");
    const requiredChange = changes.find((c) => c.field === "required");

    return fileProposal(supabase, {
      action: "update",
      targetKind: "journey_template",
      targetTable: table,
      targetId: row.id,
      rationale: args.rationale,
      evidence: args.evidence,
      summary: renaming
        ? `Rename the deliverable "${row.title}" to "${proposed.title}"`
        : `Edit the deliverable "${row.title}"`,
      payload: {
        target: { kind: "journey_template", table, id: row.id, label: row.title },
        operation: "update",
        milestone: { id: row.milestone_id, name: milestoneName(row.milestone_id) },
        current: {
          title: row.title,
          description: row.description,
          required: row.required,
          sort_order: row.sort_order,
        },
        proposed,
        changes,
      },
      impact: {
        renames: renaming,
        tracked_progress: impact,
        required_change: requiredChange
          ? {
              from: requiredChange.from,
              to: requiredChange.to,
              note:
                requiredChange.to === false
                  ? "Making this optional shrinks every client's required-completion denominator."
                  : "Making this required grows every client's required-completion denominator.",
            }
          : null,
        note:
          "Editing a deliverable keeps the same row id, so the " +
          `${impact.tracked_rows} tracked client rows against it (${impact.completed} already ticked) stay attached.`,
      },
    });
  }

  // ----------------------------------------------------------------- remove
  if (args.target === "milestone") {
    if (!args.milestone) {
      return errorText("MILESTONE_REQUIRED", "operation='remove' on a milestone needs `milestone`.");
    }
    const resolved = resolveMilestone(args.milestone, milestones);
    if (!resolved.ok) return resolved.result;
    const row = resolved.milestone;

    const dupe = findPendingDuplicate(pending, { action: "delete", targetTable: table, targetId: row.id });
    if (dupe) return duplicateText(dupe, `removing the "${row.name}" milestone`);

    const children = deliverables.filter((d) => d.milestone_id === row.id);
    const impact = await trackedProgress(supabase, children.map((d) => d.id), clients);
    if ("error" in impact) return errorText("QUERY_FAILED", impact.error);

    return fileProposal(supabase, {
      action: "delete",
      targetKind: "journey_template",
      targetTable: table,
      targetId: row.id,
      rationale: args.rationale,
      evidence: args.evidence,
      summary:
        `Remove the milestone "${row.name}" — with it, ${children.length} deliverables and ` +
        `${impact.tracked_rows} tracked client rows (${impact.completed} already ticked)`,
      payload: {
        target: { kind: "journey_template", table, id: row.id, label: row.name },
        operation: "delete",
        current: { name: row.name, description: row.description, sort_order: row.sort_order },
        proposed: null,
        deliverables_removed: children.map((d) => ({ id: d.id, title: d.title, required: d.required })),
      },
      impact: {
        destructive: true,
        cascades: true,
        deliverables_removed: children.length,
        tracked_progress_lost: impact,
        note:
          `Accepting this deletes ${children.length} deliverables and ${impact.tracked_rows} rows of client progress ` +
          `— ${impact.completed} of them already marked done. The foreign keys cascade, so those ticks cannot be recovered ` +
          "after the fact. Read `impact.tracked_progress_lost.clients_affected` before accepting.",
      },
    });
  }

  // remove deliverable
  if (!args.deliverable) {
    return errorText("DELIVERABLE_REQUIRED", "operation='remove' on a deliverable needs `deliverable`.");
  }
  let pool = deliverables;
  if (args.milestone) {
    const scoped = resolveMilestone(args.milestone, milestones);
    if (!scoped.ok) return scoped.result;
    pool = deliverables.filter((d) => d.milestone_id === scoped.milestone.id);
  }
  const resolvedDeliverable = resolveDeliverable(args.deliverable, pool, milestoneName);
  if (!resolvedDeliverable.ok) return resolvedDeliverable.result;
  const row = resolvedDeliverable.deliverable;

  const dupe = findPendingDuplicate(pending, { action: "delete", targetTable: table, targetId: row.id });
  if (dupe) return duplicateText(dupe, `removing the "${row.title}" deliverable`);

  const impact = await trackedProgress(supabase, [row.id], clients);
  if ("error" in impact) return errorText("QUERY_FAILED", impact.error);

  return fileProposal(supabase, {
    action: "delete",
    targetKind: "journey_template",
    targetTable: table,
    targetId: row.id,
    rationale: args.rationale,
    evidence: args.evidence,
    summary:
      `Remove the deliverable "${row.title}" from "${milestoneName(row.milestone_id)}" — ` +
      `${impact.tracked_rows} tracked client rows (${impact.completed} already ticked) go with it`,
    payload: {
      target: { kind: "journey_template", table, id: row.id, label: row.title },
      operation: "delete",
      milestone: { id: row.milestone_id, name: milestoneName(row.milestone_id) },
      current: {
        title: row.title,
        description: row.description,
        required: row.required,
        sort_order: row.sort_order,
      },
      proposed: null,
    },
    impact: {
      destructive: true,
      cascades: true,
      tracked_progress_lost: impact,
      note:
        `Accepting this deletes ${impact.tracked_rows} rows of client progress against this item — ` +
        `${impact.completed} already marked done, across ${impact.clients_affected.length} clients. ` +
        "The foreign key cascades, so those ticks cannot be recovered afterwards. " +
        `Every client's denominator also shrinks from ${deliverables.length} to ${deliverables.length - 1}.`,
    },
  });
}
