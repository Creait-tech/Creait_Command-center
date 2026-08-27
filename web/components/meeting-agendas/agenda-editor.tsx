"use client";

import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AGENDA_LIMITS,
  CAPTURE_SECTION_KEYS,
  CONCLUDE_KEY,
  isCaptureKey,
  slugifyKey,
  type AgendaSection,
} from "@/lib/meeting-agendas";
import {
  addSection,
  budgetReadout,
  moveSection,
  removeSection,
  replaceSection,
  uniqueKey,
  type AgendaDraft,
} from "@/components/meeting-agendas/agenda-draft";

interface Props {
  draft: AgendaDraft;
  onChange: (next: AgendaDraft) => void;
  /** Blocks every control while a save or reset is in flight. */
  busy: boolean;
}

const TONE_CLASS: Record<"match" | "over" | "under", string> = {
  match:
    "border-[color:var(--color-brand-success)]/35 bg-[color:var(--color-brand-success)]/10 text-[color:var(--color-brand-success)]",
  over:
    "border-[color:var(--color-brand-warning)]/35 bg-[color:var(--color-brand-warning)]/10 text-[color:var(--color-brand-warning)]",
  under:
    "border-[color:var(--color-brand-mist)]/30 bg-[color:var(--color-brand-slate)]/50 text-[color:var(--color-brand-mist)]",
};

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}

/**
 * One meeting type's agenda, as a form.
 *
 * The rules the meeting room depends on are shown here rather than enforced
 * silently: the three capture keys are locked and say what they drive, and the
 * concluding section can't be moved off the end or deleted. Everything else —
 * names, wording, minutes, order, extra sections — is the org's to change.
 */
export function AgendaEditor({ draft, onChange, busy }: Props) {
  const readout = budgetReadout(draft);
  const lastIndex = draft.sections.length - 1;
  const concludeIsLast = draft.sections[lastIndex]?.key === CONCLUDE_KEY;

  function patch(index: number, next: Partial<AgendaSection>) {
    onChange(replaceSection(draft, index, next));
  }

  /**
   * The key follows the name until someone edits the key themselves. Comparing
   * against the *previous* name is what detects that: once a key has been typed
   * by hand it no longer matches, so it stops being rewritten.
   */
  function renameSection(index: number, label: string) {
    const section = draft.sections[index];
    const keyIsAuto =
      !isCaptureKey(section.key) &&
      (section.key === "" || section.key === slugifyKey(section.label) || section.label === "");
    if (!keyIsAuto) {
      patch(index, { label });
      return;
    }
    const taken = draft.sections.filter((_, i) => i !== index).map((s) => s.key);
    patch(index, { label, key: uniqueKey(label || "section", taken) });
  }

  return (
    <div className="space-y-5">
      {/* Meeting-level fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <FieldLabel htmlFor="agenda-label">Meeting name</FieldLabel>
          <Input
            id="agenda-label"
            value={draft.label}
            disabled={busy}
            maxLength={AGENDA_LIMITS.maxLabel}
            onChange={(e) => onChange({ ...draft, label: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">Shown in the meeting picker and at the top of the room.</p>
        </div>
        <div className="space-y-1">
          <FieldLabel htmlFor="agenda-cadence">Cadence</FieldLabel>
          <Input
            id="agenda-cadence"
            value={draft.cadence}
            disabled={busy}
            maxLength={AGENDA_LIMITS.maxCadence}
            placeholder="Weekly · 90 min"
            onChange={(e) => onChange({ ...draft, cadence: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">How often it runs, in your own words.</p>
        </div>
        <div className="space-y-1">
          <FieldLabel htmlFor="agenda-prefix">Title prefix</FieldLabel>
          <Input
            id="agenda-prefix"
            value={draft.titlePrefix}
            disabled={busy}
            maxLength={AGENDA_LIMITS.maxTitlePrefix}
            onChange={(e) => onChange({ ...draft, titlePrefix: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">
            Every meeting is saved as{" "}
            <span className="text-foreground">
              {draft.titlePrefix || "…"} — Monday, Sep 1
            </span>
            .
          </p>
        </div>
        <div className="space-y-1">
          <FieldLabel htmlFor="agenda-purpose">Purpose</FieldLabel>
          <Textarea
            id="agenda-purpose"
            value={draft.purpose}
            disabled={busy}
            maxLength={AGENDA_LIMITS.maxPurpose}
            rows={2}
            onChange={(e) => onChange({ ...draft, purpose: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">One line on what this meeting is for.</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">Agenda sections</h4>
            <p className="text-xs text-muted-foreground">
              The meeting room walks these in order, with a timer on each.
            </p>
          </div>
          <span className={`rounded-md border px-2.5 py-1 text-xs tabular-nums ${TONE_CLASS[readout.tone]}`}>
            {readout.message}
          </span>
        </div>

        <ol className="space-y-2">
          {draft.sections.map((section, index) => {
            const locked = isCaptureKey(section.key);
            const isConclude = section.key === CONCLUDE_KEY;
            const canMoveUp = !isConclude && index > 0;
            const canMoveDown =
              !isConclude && index < lastIndex && !(concludeIsLast && index === lastIndex - 1);

            return (
              <li
                key={`${section.key}-${index}`}
                className="rounded-lg border border-border bg-[color:var(--color-brand-slate)]/40 p-3 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {index + 1}.
                  </span>

                  <div className="flex-1 space-y-1">
                    <FieldLabel htmlFor={`section-label-${index}`}>Section name</FieldLabel>
                    <Input
                      id={`section-label-${index}`}
                      value={section.label}
                      disabled={busy}
                      maxLength={AGENDA_LIMITS.maxLabel}
                      placeholder="Name this section"
                      onChange={(e) => renameSection(index, e.target.value)}
                    />
                  </div>

                  <div className="w-24 shrink-0 space-y-1">
                    <FieldLabel htmlFor={`section-minutes-${index}`}>Minutes</FieldLabel>
                    <Input
                      id={`section-minutes-${index}`}
                      type="number"
                      min={1}
                      max={AGENDA_LIMITS.maxBudgetSec / 60}
                      inputMode="numeric"
                      disabled={busy}
                      value={Math.round(section.budgetSec / 60) || ""}
                      onChange={(e) => patch(index, { budgetSec: Math.max(0, Number(e.target.value) || 0) * 60 })}
                    />
                  </div>

                  <div className="flex shrink-0 items-center gap-1 pt-5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${section.label || "section"} earlier`}
                      disabled={busy || !canMoveUp}
                      onClick={() => onChange(moveSection(draft, index, -1))}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${section.label || "section"} later`}
                      disabled={busy || !canMoveDown}
                      onClick={() => onChange(moveSection(draft, index, 1))}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${section.label || "section"}`}
                      disabled={busy || isConclude}
                      onClick={() => onChange(removeSection(draft, index))}
                    >
                      <Trash2 className={isConclude ? "" : "text-[color:var(--color-brand-danger)]"} />
                    </Button>
                  </div>
                </div>

                <div className="pl-7 space-y-2">
                  <div className="space-y-1">
                    <FieldLabel htmlFor={`section-desc-${index}`}>What happens here</FieldLabel>
                    <Textarea
                      id={`section-desc-${index}`}
                      value={section.description}
                      disabled={busy}
                      maxLength={AGENDA_LIMITS.maxDescription}
                      rows={2}
                      placeholder="The instruction everyone sees while this section is running."
                      onChange={(e) => patch(index, { description: e.target.value })}
                    />
                  </div>

                  {locked ? (
                    <div className="rounded-md border border-[color:var(--color-brand-electric)]/30 bg-[color:var(--color-brand-electric)]/10 px-2.5 py-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[color:var(--color-brand-electric)]">
                        <Lock className="size-3" />
                        <span>
                          Key <code className="font-mono">{section.key}</code> — can&rsquo;t be renamed
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {CAPTURE_SECTION_KEYS[section.key]} The name, minutes and wording above are yours to change;
                        the key is what the meeting room matches on, so renaming it would remove that step rather than
                        rename it.
                        {isConclude ? " This section also has to stay last." : ""}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <FieldLabel htmlFor={`section-key-${index}`}>Key</FieldLabel>
                      <Input
                        id={`section-key-${index}`}
                        value={section.key}
                        disabled={busy}
                        maxLength={AGENDA_LIMITS.maxKey}
                        className="font-mono text-xs"
                        onChange={(e) => patch(index, { key: e.target.value })}
                        onBlur={(e) => patch(index, { key: slugifyKey(e.target.value) })}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        An internal name, written for you from the section name. Lower-case letters, numbers and
                        underscores.
                      </p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <Button
          variant="outline"
          size="sm"
          disabled={busy || draft.sections.length >= AGENDA_LIMITS.maxSections}
          onClick={() => onChange(addSection(draft))}
        >
          <Plus />
          Add a section
        </Button>
      </div>
    </div>
  );
}
