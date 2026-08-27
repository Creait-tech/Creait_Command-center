/**
 * Consequences, stated before anyone clicks Accept.
 *
 * Two of the changes Hermes can now propose are destructive in ways nothing in
 * the database will complain about:
 *
 *  - **Journey deletions cascade.** `cc_client_journey.deliverable_id` is
 *    `ON DELETE CASCADE`, so deleting a deliverable erases every client's tick
 *    against it — the completion date and who set it included — and deleting a
 *    milestone does that for every deliverable under it. Postgres raises
 *    nothing; the rows are simply gone.
 *  - **KPI renames orphan the GHL sync.** `ghlSync` finds each KPI with
 *    `.eq('name', name).maybeSingle()`. Rename the row and the hourly job keeps
 *    computing the number and writes it nowhere: no error, no log line, a
 *    scoreboard figure that quietly stops moving.
 *
 * What this component renders on the card is the snapshot Hermes filed. It is
 * the agent's reasoning, not evidence — the numbers are re-read from the
 * database when the confirmation opens, and again when Accept is pressed.
 */

import { AlertTriangle, Info, TriangleAlert } from "lucide-react";

import {
  impactGhlSyncOrphan,
  impactGhlSyncWarning,
  impactGhlSynced,
  impactNote,
  impactRevenueLeaving,
  impactTrackedProgressLost,
  type AgentProposal,
  type TrackedProgressImpact,
} from "@/components/proposals/proposal-payload";

/** "Asia K., Rad Media and 2 others" — never an unbounded wall of names. */
function nameList(names: string[], cap = 3): string {
  const known = names.filter(Boolean);
  if (known.length === 0) return "";
  if (known.length <= cap) {
    if (known.length === 1) return known[0];
    return `${known.slice(0, -1).join(", ")} and ${known[known.length - 1]}`;
  }
  const rest = known.length - cap;
  return `${known.slice(0, cap).join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
}

/**
 * A hairline tinted panel — the repo's pattern for a warning that sits inside
 * other content. Deliberately not a thick coloured left rule on a rounded
 * card; that pattern was abandoned here.
 */
function Notice({
  tone,
  icon,
  headline,
  children,
}: {
  tone: "danger" | "warning" | "muted";
  icon: React.ReactNode;
  headline: string;
  children?: React.ReactNode;
}) {
  const styles = {
    danger:
      "border-[color:var(--color-brand-danger)]/35 bg-[color:var(--color-brand-danger)]/8 text-[color:var(--color-brand-danger)]",
    warning:
      "border-[color:var(--color-brand-warning)]/35 bg-[color:var(--color-brand-warning)]/8 text-[color:var(--color-brand-warning)]",
    muted:
      "border-[color:var(--color-brand-fog)] bg-[color:var(--color-brand-charcoal)]/40 text-[color:var(--color-brand-mist)]",
  }[tone];

  return (
    <div className={`space-y-1.5 rounded-lg border p-3 ${styles}`}>
      <p className="flex items-start gap-2 text-xs font-semibold">
        <span className="mt-px shrink-0" aria-hidden>
          {icon}
        </span>
        <span>{headline}</span>
      </p>
      {children && (
        <div className="space-y-1.5 pl-6 text-[11px] leading-relaxed text-foreground/90">
          {children}
        </div>
      )}
    </div>
  );
}

/** The cascade, in the numbers Hermes recorded when it filed. */
export function TrackedProgressNotice({
  impact,
  what,
}: {
  impact: TrackedProgressImpact;
  what: string;
}) {
  if (impact.trackedRows === 0) {
    return (
      <Notice
        tone="warning"
        icon={<TriangleAlert className="size-3.5" />}
        headline={`No client progress is tracked against ${what}`}
      >
        <p>
          Nothing recorded is lost, but {what} disappears from the template for
          every client, current and future.
        </p>
      </Notice>
    );
  }

  const who = nameList(impact.clients.map((c) => c.name ?? "").filter(Boolean));

  return (
    <Notice
      tone="danger"
      icon={<AlertTriangle className="size-3.5" />}
      headline={`${impact.trackedRows} tracked client row${
        impact.trackedRows === 1 ? "" : "s"
      } would be erased — ${impact.completed} already ticked done`}
    >
      {who && (
        <p>
          Affected: {who}. Every one of those clients loses the tick, the
          completion date and the record of who set it, and their progress
          percentage drops.
        </p>
      )}
      <p>
        The foreign keys cascade, so this happens in silence and the rows cannot
        be recovered from the app afterwards.
      </p>
    </Notice>
  );
}

/** The sync going quiet, spelled out. */
export function GhlSyncOrphanNotice({
  kpiName,
  removing,
  renamingTo,
  currentValue,
}: {
  kpiName: string;
  removing: boolean;
  renamingTo: string | null;
  currentValue: number | null;
}) {
  return (
    <Notice
      tone="danger"
      icon={<AlertTriangle className="size-3.5" />}
      headline={`This stops the hourly GHL sync updating “${kpiName}”`}
    >
      <p>
        The sync finds this KPI by its <strong>exact name</strong> and writes
        with <code className="font-mono">maybeSingle()</code>.{" "}
        {removing
          ? "With the row gone it matches nothing"
          : `Renamed to “${renamingTo}” it matches nothing`}
        , so every hour it will keep computing the number and write it nowhere —
        no error, no log line, nothing on this screen.
      </p>
      <p>
        {removing
          ? "The KPI's recorded history goes with the row."
          : `The scoreboard figure freezes at ${
              currentValue === null ? "its last value" : currentValue
            } and stays there until someone changes the name the sync writes by.`}
      </p>
    </Notice>
  );
}

/**
 * The impact Hermes filed with the proposal, rendered on the card.
 *
 * Always labelled as the agent's own reading — the authoritative numbers are
 * the ones the confirmation dialog re-reads.
 */
export function FiledImpactNotice({ proposal }: { proposal: AgentProposal }) {
  const trackedLost = impactTrackedProgressLost(proposal.payload);
  const orphan = impactGhlSyncOrphan(proposal.payload);
  const syncWarning = impactGhlSyncWarning(proposal.payload);
  const revenue = impactRevenueLeaving(proposal.payload);
  const note = impactNote(proposal.payload);

  const hasHardImpact = trackedLost !== null || orphan || syncWarning !== null;
  if (!hasHardImpact && !note && revenue === null) return null;

  return (
    <div className="space-y-2">
      {trackedLost && (
        <TrackedProgressNotice impact={trackedLost} what="this" />
      )}

      {orphan && (
        <Notice
          tone="danger"
          icon={<AlertTriangle className="size-3.5" />}
          headline="This would orphan the hourly GHL sync"
        >
          <p>
            The sync matches this KPI on its exact name. After this change it
            matches nothing, so the number silently stops updating — confirm
            before accepting to see the current value it would freeze at.
          </p>
        </Notice>
      )}

      {syncWarning && (
        <Notice
          tone="warning"
          icon={<TriangleAlert className="size-3.5" />}
          headline="This KPI would never receive a synced value"
        >
          <p>{syncWarning}</p>
        </Notice>
      )}

      {revenue !== null && revenue > 0 && (
        <Notice
          tone="warning"
          icon={<TriangleAlert className="size-3.5" />}
          headline={`$${revenue}/mo comes off the active roster`}
        />
      )}

      {note && (
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>
            <span className="text-[color:var(--color-brand-mist)]">
              Hermes&rsquo; own reading:
            </span>{" "}
            {note}
            {impactGhlSynced(proposal.payload) && !orphan
              ? " (the sync keeps finding it.)"
              : ""}
          </span>
        </p>
      )}
    </div>
  );
}
