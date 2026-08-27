"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgendaEditor } from "@/components/meeting-agendas/agenda-editor";
import {
  draftBudgetSec,
  draftMatches,
  formatBudget,
  toDraft,
  type AgendaDraft,
  type StoredAgenda,
} from "@/components/meeting-agendas/agenda-draft";
import {
  resetMeetingAgenda,
  saveMeetingAgenda,
} from "@/app/(dashboard)/settings/agenda-actions";
import {
  MEETING_TYPE_ORDER,
  applyAgendaOverrides,
  isCustomised,
  validateAgenda,
  type MeetingType,
} from "@/lib/meeting-agendas";

interface Props {
  agendas: StoredAgenda[];
}

type ByType = Record<string, StoredAgenda>;
type DraftsByType = Record<string, AgendaDraft>;

function index(agendas: StoredAgenda[]): ByType {
  return Object.fromEntries(agendas.map((a) => [a.agenda.type, a]));
}

function drafts(agendas: StoredAgenda[]): DraftsByType {
  return Object.fromEntries(agendas.map((a) => [a.agenda.type, toDraft(a.agenda)]));
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Settings → Meeting agendas.
 *
 * The eight EOS meetings, editable. Adding a ninth *type* is deliberately not
 * offered: `meetings.meeting_type` is a CHECK-constrained column, so a type
 * this page invented would be rejected the moment someone tried to start that
 * meeting. The note in the sidebar says so rather than leaving it a mystery.
 */
export function MeetingAgendasPanel({ agendas }: Props) {
  const [stored, setStored] = useState<ByType>(() => index(agendas));
  const [edited, setEdited] = useState<DraftsByType>(() => drafts(agendas));
  const [selected, setSelected] = useState<MeetingType>("level_10");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const current = stored[selected];
  const draft = edited[selected];

  if (!current || !draft) return null;

  const dirty = !draftMatches(draft, current.agenda);
  const validation = validateAgenda(draft);
  const errors = validation.ok ? [] : validation.errors;
  const lastEditedOn = formatDate(current.updatedAt);

  function accept(next: StoredAgenda) {
    setStored((prev) => ({ ...prev, [next.agenda.type]: next }));
    setEdited((prev) => ({ ...prev, [next.agenda.type]: toDraft(next.agenda) }));
    // Put it in front of the code defaults straight away, so a meeting started
    // in another tab-open of this session runs the agenda just saved.
    applyAgendaOverrides([next.agenda]);
  }

  async function save() {
    if (!validation.ok) return;
    setBusy(true);
    const result = await saveMeetingAgenda(draft);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    accept(result.data);
    toast.success(`${result.data.agenda.label} agenda saved`);
  }

  async function reset() {
    setBusy(true);
    const result = await resetMeetingAgenda(selected);
    setBusy(false);
    setConfirmReset(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    accept(result.data);
    toast.success(`${result.data.agenda.label} is back to the EOS standard`);
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-[color:var(--color-brand-electric)]/15 flex items-center justify-center shrink-0">
            <CalendarClock className="size-4 text-[color:var(--color-brand-electric)]" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Meeting agendas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              These are the agendas the meeting room runs — the sections, the order and the minutes on each timer.
              They start as the EOS standard. Change them here and the next meeting of that type follows your version.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[15rem_1fr] gap-4">
          {/* Meeting type list */}
          <div className="space-y-2">
            <ul className="space-y-1">
              {MEETING_TYPE_ORDER.map((type) => {
                const entry = stored[type];
                const typeDraft = edited[type];
                if (!entry || !typeDraft) return null;
                const active = type === selected;
                const unsaved = !draftMatches(typeDraft, entry.agenda);
                const customised = isCustomised(entry.agenda);
                return (
                  <li key={type}>
                    <button
                      type="button"
                      onClick={() => setSelected(type)}
                      aria-current={active ? "true" : undefined}
                      className={
                        active
                          ? "w-full rounded-lg border border-[color:var(--color-brand-electric)]/40 bg-[color:var(--color-brand-electric)]/10 px-3 py-2 text-left"
                          : "w-full rounded-lg border border-transparent px-3 py-2 text-left hover:bg-muted/50"
                      }
                    >
                      <span className="block text-sm font-medium">{entry.agenda.label}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {formatBudget(draftBudgetSec(typeDraft))} · {typeDraft.sections.length} sections
                      </span>
                      <span className="mt-0.5 block text-[11px]">
                        {unsaved ? (
                          <span className="text-[color:var(--color-brand-warning)]">Unsaved changes</span>
                        ) : customised ? (
                          <span className="text-[color:var(--color-brand-electric)]">Customised</span>
                        ) : (
                          <span className="text-muted-foreground">EOS standard</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="rounded-lg border border-border bg-[color:var(--color-brand-slate)]/40 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                <span className="text-foreground">These eight are the whole list.</span> A brand-new meeting type
                can&rsquo;t be added here: the database restricts what a meeting&rsquo;s type may be, so a type invented
                on this page would be refused the moment someone tried to start that meeting. Adding one is a change to
                the database and the code together. Renaming one of the eight to suit how you actually work is fine, and
                is what this page is for.
              </p>
            </div>
          </div>

          {/* Editor */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-[color:var(--color-brand-slate)]/40 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                <span className="text-foreground">Two rules the meeting room depends on.</span> Every agenda has to end
                with the <code className="font-mono">conclude</code> section — that is where the 1–10 rating and the
                Finish button live, and a meeting with no way to conclude can be started but never saved. And three
                sections carry keys the room matches on (
                <code className="font-mono">headlines</code>, <code className="font-mono">ids</code>,{" "}
                <code className="font-mono">conclude</code>): their names and timings are yours, their keys are locked.
              </p>
            </div>

            <AgendaEditor
              draft={draft}
              busy={busy}
              onChange={(next) => setEdited((prev) => ({ ...prev, [selected]: next }))}
            />

            {errors.length > 0 && (
              <div className="rounded-lg border border-[color:var(--color-brand-danger)]/40 bg-[color:var(--color-brand-danger)]/10 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-brand-danger)]">
                  <AlertTriangle className="size-3.5" />
                  <span>{errors.length === 1 ? "One thing to fix before saving" : `${errors.length} things to fix before saving`}</span>
                </div>
                <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-[11px] text-muted-foreground">
                {current.updatedByName ? (
                  <>
                    Last edited by <span className="text-foreground">{current.updatedByName}</span>
                    {lastEditedOn ? ` on ${lastEditedOn}` : ""}.
                  </>
                ) : (
                  "Nobody has edited this agenda yet — it is the EOS standard as shipped."
                )}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirmReset(true)}
                >
                  <RotateCcw />
                  Reset to EOS default
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || !dirty}
                  onClick={() =>
                    setEdited((prev) => ({ ...prev, [selected]: toDraft(current.agenda) }))
                  }
                >
                  Discard changes
                </Button>
                <Button size="sm" disabled={busy || !dirty || errors.length > 0} onClick={save}>
                  {busy ? "Saving…" : "Save agenda"}
                </Button>
              </div>
            </div>

            {!dirty && errors.length === 0 && (
              <p className="flex items-center gap-1.5 text-[11px] text-[color:var(--color-brand-success)]">
                <CheckCircle2 className="size-3.5" />
                Saved. This is what the next {current.agenda.label.toLowerCase()} will run.
              </p>
            )}
          </div>
        </div>

        <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reset {current.agenda.label} to the EOS standard?</DialogTitle>
              <DialogDescription>
                Every section, timing and description goes back to the EOS default that ships with the Command Center.
                Your current version of this agenda is replaced and can&rsquo;t be recovered. Other meeting types are
                untouched.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirmReset(false)}>
                Keep my version
              </Button>
              <Button variant="destructive" size="sm" disabled={busy} onClick={reset}>
                {busy ? "Resetting…" : "Reset to EOS standard"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
