"use client";

import { AlertTriangle } from "lucide-react";

import type {
  DeliverableDeleteImpact,
  MilestoneDeleteImpact,
} from "@/app/(dashboard)/journey/actions";

type Impact = MilestoneDeleteImpact | DeliverableDeleteImpact;

function isMilestoneImpact(impact: Impact): impact is MilestoneDeleteImpact {
  return "deliverableCount" in impact;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/** "Asia K., ACE Financial and 2 others" — never an unbounded wall of names. */
function nameList(names: string[], cap = 4): string {
  if (names.length === 0) return "";
  if (names.length <= cap) {
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }
  const rest = names.length - cap;
  return `${names.slice(0, cap).join(", ")} and ${rest} ${plural(rest, "other")}`;
}

/** "Kickoff call", "Snapshot loaded" and 5 more */
function titleList(titles: string[], cap = 3): string {
  if (titles.length === 0) return "";
  const shown = titles.slice(0, cap).map((t) => `“${t}”`);
  const rest = titles.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ");
}

/**
 * Everything one delete would take with it, spelled out before it happens.
 *
 * The consequences here are not a guess — they come from the foreign keys as
 * they actually exist in this database:
 *
 *   cc_client_journey.deliverable_id  → ON DELETE CASCADE   (progress destroyed)
 *   cc_agent_proposals.deliverable_id → ON DELETE CASCADE   (proposals destroyed)
 *   cc_client_activity.deliverable_id → ON DELETE SET NULL  (log kept, unlinked)
 *   journey_deliverables.milestone_id → ON DELETE CASCADE   (children destroyed)
 *
 * Nothing raises an error on the way through, so a milestone delete reaches two
 * levels down into live client history in complete silence. The counts are read
 * fresh each time this opens rather than from anything the page already had.
 */
export function DeleteImpactNotice({ impact }: { impact: Impact }) {
  const milestone = isMilestoneImpact(impact) ? impact : null;
  const label = milestone ? "milestone" : "deliverable";
  const clientCount = impact.clientNames.length;

  const headline =
    impact.trackedRows > 0
      ? `${clientCount} ${plural(clientCount, "client")} ${
          clientCount === 1 ? "has" : "have"
        } progress recorded here — deleting destroys it`
      : milestone && milestone.deliverableCount > 0
        ? `This also deletes ${milestone.deliverableCount} ${plural(
            milestone.deliverableCount,
            "deliverable",
          )}`
        : "This cannot be undone";

  const lines: string[] = [];

  if (milestone) {
    lines.push(
      milestone.deliverableCount > 0
        ? `“${milestone.name}” holds ${milestone.deliverableCount} ${plural(
            milestone.deliverableCount,
            "deliverable",
          )} — ${titleList(
            milestone.deliverableTitles,
          )}. All of them are deleted with it.`
        : `“${milestone.name}” has no deliverables under it.`,
    );
  }

  if (impact.trackedRows > 0) {
    const who = nameList(impact.clientNames);
    const ticked =
      impact.tickedRows > 0
        ? `${impact.tickedRows} of them ${plural(
            impact.tickedRows,
            "is",
            "are",
          )} ticked done`
        : "none are ticked done";
    lines.push(
      `${who} ${
        clientCount === 1 ? "has" : "have"
      } ${impact.trackedRows} tracked ${plural(
        impact.trackedRows,
        "row",
      )} against ${
        milestone ? "those deliverables" : "this deliverable"
      } — ${ticked}. Those ticks, their completion dates and who set them are erased, and every affected client's progress percentage drops.`,
    );
  } else {
    lines.push(
      `No client has any progress tracked against ${
        milestone ? "these deliverables" : "this deliverable"
      }, so no completion history is lost. It disappears from the template for every client, current and future.`,
    );
  }

  if (impact.notedRows > 0) {
    lines.push(
      `${impact.notedRows} client ${plural(
        impact.notedRows,
        "note",
      )} left on ${
        milestone ? "those deliverables" : "this deliverable"
      } ${plural(impact.notedRows, "goes", "go")} with them.`,
    );
  }

  if (impact.proposalRows > 0) {
    lines.push(
      `${impact.proposalRows} pending agent ${plural(
        impact.proposalRows,
        "proposal",
      )} referencing ${
        milestone ? "them" : "it"
      } ${plural(impact.proposalRows, "is", "are")} deleted too.`,
    );
  }

  if (impact.orphanedActivity > 0) {
    lines.push(
      `${impact.orphanedActivity} activity-feed ${plural(
        impact.orphanedActivity,
        "entry",
        "entries",
      )} stay in the log but lose the link to ${
        milestone ? "this milestone" : "this deliverable"
      } — the team will read them without knowing what they were about.`,
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-[color:var(--color-brand-danger)]/35 bg-[color:var(--color-brand-danger)]/8 p-3.5">
      <p className="flex items-start gap-2 text-sm font-semibold text-[color:var(--color-brand-danger)]">
        <AlertTriangle className="mt-px size-4 shrink-0" aria-hidden />
        <span>{headline}</span>
      </p>
      <ul className="space-y-1.5 pl-6 text-xs leading-relaxed text-foreground/90">
        {lines.map((line) => (
          <li key={line} className="list-disc marker:text-[color:var(--color-brand-mist)]">
            {line}
          </li>
        ))}
      </ul>
      <p className="pl-6 text-[11px] leading-relaxed text-muted-foreground">
        Deleting a {label} cascades in the database. There is no undo, and these
        rows are not recoverable from the app.
      </p>
    </div>
  );
}
