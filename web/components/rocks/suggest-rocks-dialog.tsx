"use client";

import { useState } from "react";
import { Lightbulb, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { suggestRocks, type RockSuggestion } from "@/lib/rock-suggestions";
import { personName, type Person } from "@/lib/authorship";
import type { RockDraft } from "./add-rock-dialog";

interface Props {
  quarter: string;
  members: Person[];
  /** Hands a chosen suggestion to the Add Rock form, prefilled and editable. */
  onUse: (draft: RockDraft) => void;
}

/**
 * "Suggest rocks" — ideas drawn from the company's own vision, scorecard,
 * past rocks, clients and unsolved issues.
 *
 * Every suggestion shows the fact it rests on, so the team can judge it
 * rather than take it on faith, and nothing is written until someone picks
 * one and fills in the real form.
 */
export function SuggestRocksDialog({ quarter, members, onUse }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState("");
  const [suggestions, setSuggestions] = useState<RockSuggestion[] | null>(null);
  const [thin, setThin] = useState(false);
  const [model, setModel] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    const result = await suggestRocks({ quarter, focus: focus.trim() || null });
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSuggestions(result.data.suggestions);
    setThin(result.data.thin);
    setModel(result.data.model);
    if (result.data.suggestions.length === 0) {
      toast.error("The model returned no ideas. Try again, or add more company context under Vision and Strategy.");
    }
  }

  function use(s: RockSuggestion) {
    const owner = s.suggestedOwner
      ? members.find((m) => personName(m).toLowerCase() === s.suggestedOwner!.trim().toLowerCase())
      : undefined;
    onUse({
      title: s.title,
      description: s.why,
      rockType: s.rockType,
      ownerId: owner?.id,
      smartMeasurable: s.doneLooksLike,
    });
    setOpen(false);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Lightbulb className="size-4" />
        Suggest rocks
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rock ideas for {quarter}</DialogTitle>
            <DialogDescription>
              Drawn from your vision and 1-year plan, the scorecard against target, what shipped and what slipped last
              quarter, the client list, and the issues nobody has solved. Ideas only — nothing is saved until you pick one.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              placeholder="Optional: what should these be aimed at? e.g. getting advisory retainers to three"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void run();
                }
              }}
            />
            <Button onClick={() => void run()} disabled={loading}>
              <Sparkles className="size-4" />
              {loading ? "Thinking…" : suggestions ? "Again" : "Suggest"}
            </Button>
          </div>

          {thin && (
            <p className="text-xs text-[color:var(--color-brand-warning)]">
              There isn&apos;t much company context recorded yet, so these will be generic. Filling in Vision and the
              scorecard makes them sharper.
            </p>
          )}

          {suggestions && suggestions.length > 0 && (
            <ul className="space-y-2">
              {suggestions.map((s, i) => (
                <li key={i} className="rounded-lg border border-border p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{s.title}</p>
                      {s.why && <p className="text-xs text-muted-foreground mt-0.5">{s.why}</p>}
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => use(s)}>
                      <Plus className="size-3.5" />
                      Use
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-medium uppercase tracking-wider",
                        s.rockType === "company"
                          ? "bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)]"
                          : "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)]",
                      )}
                    >
                      {s.rockType}
                    </span>
                    {s.suggestedOwner && <span className="text-muted-foreground">owner: {s.suggestedOwner}</span>}
                  </div>
                  {s.doneLooksLike && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">Done looks like: </span>
                      {s.doneLooksLike}
                    </p>
                  )}
                  {s.evidence && (
                    <p className="text-[11px] text-muted-foreground border-l-2 border-border pl-2">
                      Based on: {s.evidence}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <DialogFooter className="items-center">
            {model && <span className="text-[11px] text-muted-foreground mr-auto">Written by {model}</span>}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
