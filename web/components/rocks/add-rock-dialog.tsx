"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import type { RockType, TeamMember } from "@/lib/supabase/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultQuarter: string;
  members: TeamMember[];
}

function quarterEnd(quarter: string): string {
  const [yearStr, qStr] = quarter.split("-Q");
  const year = parseInt(yearStr, 10);
  const q = parseInt(qStr, 10);
  const monthEnd = q * 3;
  const lastDay = new Date(year, monthEnd, 0).getDate();
  return `${year}-${String(monthEnd).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function AddRockDialog({ open, onOpenChange, defaultQuarter, members }: Props) {
  const orgId = useActiveOrgId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rockType, setRockType] = useState<RockType>("company");
  const [ownerId, setOwnerId] = useState<string>("");
  const [smartSpecific, setSmartSpecific] = useState("");
  const [smartMeasurable, setSmartMeasurable] = useState("");
  const [smartRelevant, setSmartRelevant] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setRockType("company");
    setOwnerId("");
    setSmartSpecific("");
    setSmartMeasurable("");
    setSmartRelevant("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("cc_rocks").insert({
      org_id: orgId,
      title: title.trim(),
      description: description.trim() || null,
      rock_type: rockType,
      owner_id: ownerId || null,
      quarter: defaultQuarter,
      status: "on_track",
      smart_specific: smartSpecific.trim() || null,
      smart_measurable: smartMeasurable.trim() || null,
      smart_relevant: smartRelevant.trim() || null,
      due_date: quarterEnd(defaultQuarter),
      sort_order: 0,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    reset();
    onOpenChange(false);
    toast.success("Rock added");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Rock — {defaultQuarter}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Hit $6K MRR by Sept 30"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-14"
              placeholder="What does success look like?"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={rockType} onValueChange={(v) => typeof v === "string" && setRockType(v as RockType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="departmental">Departmental</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Owner</label>
              <Select value={ownerId} onValueChange={(v) => typeof v === "string" && setOwnerId(v)}>
                <SelectTrigger><SelectValue placeholder="Pick owner" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SMART criteria</p>
            <Input
              value={smartSpecific}
              onChange={(e) => setSmartSpecific(e.target.value)}
              placeholder="Specific — exactly what outcome?"
            />
            <Input
              value={smartMeasurable}
              onChange={(e) => setSmartMeasurable(e.target.value)}
              placeholder="Measurable — how will we know it's 100% complete?"
            />
            <Input
              value={smartRelevant}
              onChange={(e) => setSmartRelevant(e.target.value)}
              placeholder="Relevant — how does this support our annual plan?"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? "Saving…" : "Add Rock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
