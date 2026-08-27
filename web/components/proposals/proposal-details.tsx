/**
 * The "what would actually change" body of a proposal card.
 *
 * A configuration proposal is not self-explanatory the way "mark this
 * deliverable done" is. Accepting one rewrites a row every client is measured
 * against, so the card has to show the *fields*, not just a verb: which value
 * moves, from what, to what, and — for a reorder — what the list would look
 * like afterwards.
 *
 * Nothing here renders an id. Ids were resolved to names by the server loader
 * before the row reached the browser; the only strings this component prints
 * are field labels and values.
 */

import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  creationFields,
  fieldLabel,
  formatFieldValue,
} from "@/components/proposals/proposal-copy";
import {
  payloadChanges,
  payloadCurrentOrder,
  payloadDeliverablesRemoved,
  payloadProposedOrder,
  type AgentProposal,
} from "@/components/proposals/proposal-payload";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

/** `position 3 → 1`, one row per field that actually moves. */
function ChangeList({ proposal }: { proposal: AgentProposal }) {
  const changes = payloadChanges(proposal.payload);
  if (changes.length === 0) return null;

  return (
    <div>
      <SectionLabel>What would change</SectionLabel>
      <ul className="mt-1 space-y-1">
        {changes.map((change) => (
          <li
            key={change.field}
            className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs"
          >
            <span className="text-muted-foreground">{fieldLabel(change.field)}</span>
            <span className="text-[color:var(--color-brand-mist)] line-through decoration-[color:var(--color-brand-fog)]">
              {formatFieldValue(change.from)}
            </span>
            <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
            <span className="font-medium text-foreground">
              {formatFieldValue(change.to)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The fields a create would set, so nothing lands unseen. */
function CreationList({ proposal }: { proposal: AgentProposal }) {
  const fields = creationFields(proposal.payload);
  if (fields.length === 0) return null;

  return (
    <div>
      <SectionLabel>What would be created</SectionLabel>
      <ul className="mt-1 space-y-1">
        {fields.map(([label, value]) => (
          <li key={label} className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-foreground">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The proposed order, with the entries that actually move marked.
 *
 * Showing only the new list would hide the point: most of a reorder is
 * unchanged, and the two or three items that shift are the whole proposal.
 */
function OrderList({ proposal }: { proposal: AgentProposal }) {
  const proposed = payloadProposedOrder(proposal.payload);
  if (proposed.length === 0) return null;
  const before = payloadCurrentOrder(proposal.payload).map((entry) => entry.id);

  return (
    <div>
      <SectionLabel>Proposed order</SectionLabel>
      <ol className="mt-1 space-y-0.5">
        {proposed.map((entry, index) => {
          const moved = before.length > 0 && before[index] !== entry.id;
          const wasAt = before.indexOf(entry.id);
          return (
            <li
              key={entry.id}
              className={cn(
                "flex items-baseline gap-2 text-xs",
                moved ? "text-foreground" : "text-[color:var(--color-brand-mist)]",
              )}
            >
              <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span className={cn("min-w-0", moved && "font-medium")}>
                {entry.label ?? "Untitled"}
              </span>
              {moved && wasAt >= 0 && (
                <span className="text-[10px] text-[color:var(--color-brand-warning)]">
                  was {wasAt + 1}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The deliverables a milestone deletion would take with it, by name. */
function RemovedChildren({ proposal }: { proposal: AgentProposal }) {
  const titles = payloadDeliverablesRemoved(proposal.payload);
  if (titles.length === 0) return null;

  return (
    <div>
      <SectionLabel>
        {titles.length} deliverable{titles.length === 1 ? "" : "s"} deleted with it
      </SectionLabel>
      <p className="mt-1 text-xs leading-relaxed text-[color:var(--color-brand-mist)]">
        {titles.map((title) => `“${title}”`).join(", ")}
      </p>
    </div>
  );
}

/** Everything a configuration proposal would write, chosen by its action. */
export function ProposalDetails({ proposal }: { proposal: AgentProposal }) {
  switch (proposal.action) {
    case "create":
      return <CreationList proposal={proposal} />;
    case "update":
      return <ChangeList proposal={proposal} />;
    case "reorder":
      return <OrderList proposal={proposal} />;
    case "delete":
      return <RemovedChildren proposal={proposal} />;
    default:
      return null;
  }
}
