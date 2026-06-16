"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import type {
  CcClient,
  CcClientStatus,
  CcClientHealth,
} from "@/lib/supabase/types";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatMrr(mrr: number | null): string {
  if (mrr === null || mrr === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(mrr);
}

const STATUS_LABELS: Record<CcClientStatus, string> = {
  lead: "Lead",
  onboarding: "Onboarding",
  active: "Active",
  paused: "Paused",
  churned: "Churned",
  complete: "Complete",
};

const STATUS_STYLES: Record<CcClientStatus, string> = {
  lead: "bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)]",
  onboarding: "bg-[color:var(--color-brand-aqua)]/15 text-[color:var(--color-brand-aqua)]",
  active: "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]",
  paused: "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)]",
  churned: "bg-[color:var(--color-brand-danger)]/20 text-[color:var(--color-brand-danger)]",
  complete: "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]",
};

const HEALTH_DOT: Record<CcClientHealth, string> = {
  green: "bg-[color:var(--color-brand-success)]",
  yellow: "bg-[color:var(--color-brand-warning)]",
  red: "bg-[color:var(--color-brand-danger)]",
};

const HEALTH_LABEL: Record<CcClientHealth, string> = {
  green: "Healthy",
  yellow: "At Risk",
  red: "Critical",
};

const STATUS_FILTERS: Array<{ value: "all" | CcClientStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "lead", label: "Lead" },
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "churned", label: "Churned" },
];

const STATUS_OPTIONS: Array<{ value: CcClientStatus; label: string }> = [
  { value: "lead", label: "Lead" },
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "churned", label: "Churned" },
  { value: "complete", label: "Complete" },
];

const HEALTH_OPTIONS: Array<{ value: CcClientHealth; label: string }> = [
  { value: "green", label: "Healthy" },
  { value: "yellow", label: "At Risk" },
  { value: "red", label: "Critical" },
];

// ---------------------------------------------------------------------------
function AddClientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const orgId = useActiveOrgId();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<CcClientStatus>("lead");
  const [tier, setTier] = useState("");
  const [mrr, setMrr] = useState("");
  const [startDate, setStartDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName(""); setCompany(""); setContactName(""); setEmail(""); setPhone("");
    setStatus("lead"); setTier(""); setMrr(""); setStartDate(""); setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Client name required"); return; }
    setSubmitting(true);
    const supabase = createClient();
    const mrrNum = mrr.trim() ? Number(mrr) : null;
    const { error } = await supabase.from("cc_clients").insert({
      org_id: orgId,
      name: name.trim(),
      company: company.trim() || null,
      contact_name: contactName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      status,
      tier: tier.trim() || null,
      mrr: mrrNum !== null && Number.isFinite(mrrNum) ? mrrNum : null,
      start_date: startDate || null,
      notes: notes.trim() || null,
      health: "green" as CcClientHealth,
      sort_order: 0,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    reset();
    onOpenChange(false);
    toast.success("Client added");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add Client</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Asia / Quantum Wealth Network" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Company</label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Contact</label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={status} onValueChange={(v) => typeof v === "string" && setStatus(v as CcClientStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tier</label>
              <Input value={tier} onChange={(e) => setTier(e.target.value)} placeholder="OS Lite/Full" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">MRR ($)</label>
              <Input type="number" value={mrr} onChange={(e) => setMrr(e.target.value)} placeholder="0" className="tabular-nums" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Start Date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" placeholder="Working notes…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting || !name.trim()}>{submitting ? "Saving…" : "Add Client"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
interface EditForm {
  name: string; company: string; contact_name: string; email: string; phone: string;
  status: CcClientStatus; tier: string; mrr: string; start_date: string; notes: string;
  health: CcClientHealth; ghl_location_id: string;
}

function toEdit(c: CcClient): EditForm {
  return {
    name: c.name, company: c.company ?? "", contact_name: c.contact_name ?? "",
    email: c.email ?? "", phone: c.phone ?? "", status: c.status, tier: c.tier ?? "",
    mrr: c.mrr !== null ? String(c.mrr) : "", start_date: c.start_date ?? "",
    notes: c.notes ?? "", health: c.health, ghl_location_id: c.ghl_location_id ?? "",
  };
}

function ClientDetailSheet({
  client, open, onOpenChange, onUpdated, onDeleted,
}: {
  client: CcClient | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUpdated: (c: CcClient) => void;
  onDeleted: (id: string) => void;
}) {
  const [form, setForm] = useState<EditForm | null>(client ? toEdit(client) : null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(client ? toEdit(client) : null);
    setError(null);
  }, [client]);

  if (!client || !form) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md" />
      </Sheet>
    );
  }

  function update<K extends keyof EditForm>(k: K, v: EditForm[K]) {
    setForm((p) => (p ? { ...p, [k]: v } : p));
  }

  async function handleSave() {
    if (!client || !form) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const mrrNum = form.mrr.trim() ? Number(form.mrr) : null;
    const { data, error: e } = await supabase
      .from("cc_clients")
      .update({
        name: form.name.trim(),
        company: form.company.trim() || null,
        contact_name: form.contact_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        status: form.status,
        tier: form.tier.trim() || null,
        mrr: mrrNum !== null && Number.isFinite(mrrNum) ? mrrNum : null,
        start_date: form.start_date || null,
        notes: form.notes.trim() || null,
        health: form.health,
        ghl_location_id: form.ghl_location_id.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", client.id)
      .select("*")
      .single();
    setSaving(false);
    if (e) { setError(e.message); return; }
    if (data) onUpdated(data as CcClient);
    onOpenChange(false);
    toast.success("Client saved");
  }

  async function handleDelete() {
    if (!client) return;
    if (!window.confirm(`Delete "${client.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    const supabase = createClient();
    const { error: e } = await supabase.from("cc_clients").delete().eq("id", client.id);
    setDeleting(false);
    if (e) { toast.error(e.message); return; }
    onDeleted(client.id);
    onOpenChange(false);
    toast.success("Client deleted");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-[color:var(--color-brand-slate)] flex items-center justify-center text-sm font-semibold ring-1 ring-[color:var(--color-brand-fog)] shrink-0">
              {getInitials(client.name)}
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate">{client.name}</SheetTitle>
              {client.company && <SheetDescription className="truncate">{client.company}</SheetDescription>}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name *</label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Company</label>
              <Input value={form.company} onChange={(e) => update("company", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Contact</label>
              <Input value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Phone</label>
              <Input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={form.status} onValueChange={(v) => typeof v === "string" && update("status", v as CcClientStatus)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Health</label>
              <Select value={form.health} onValueChange={(v) => typeof v === "string" && update("health", v as CcClientHealth)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{HEALTH_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Tier</label>
              <Input value={form.tier} onChange={(e) => update("tier", e.target.value)} placeholder="OS Lite/Full" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">MRR ($)</label>
              <Input type="number" value={form.mrr} onChange={(e) => update("mrr", e.target.value)} className="tabular-nums" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Start Date</label>
            <Input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">GHL Location ID</label>
            <Input value={form.ghl_location_id} onChange={(e) => update("ghl_location_id", e.target.value)} className="font-mono text-xs" placeholder="e.g. BQVtBsjTF39gR4hxwayL" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} className="min-h-24" />
          </div>
          {client.brain_path && (
            <div className="rounded-md border border-[color:var(--color-brand-fog)]/50 bg-[color:var(--color-brand-slate)]/30 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--color-brand-aqua)]">
                <Brain className="size-3.5 shrink-0" /> Second Brain
              </div>
              <p className="text-xs text-muted-foreground">AI can search this client&apos;s docs at:</p>
              <code className="block text-xs font-mono text-[color:var(--color-brand-electric)] break-all">{client.brain_path}</code>
            </div>
          )}
          {error && <p className="text-xs text-[color:var(--color-brand-danger)]">{error}</p>}
        </div>

        <SheetFooter className="flex-row items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={deleting || saving}
            className="text-[color:var(--color-brand-danger)] hover:text-[color:var(--color-brand-danger)]">
            <Trash2 className="size-4" /> {deleting ? "Deleting…" : "Delete"}
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
export function ClientsView({ initialClients }: { initialClients: CcClient[] }) {
  const orgId = useActiveOrgId();
  const [clients, setClients] = useState<CcClient[]>(initialClients);
  const [statusFilter, setStatusFilter] = useState<"all" | CcClientStatus>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("cc-clients-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "cc_clients", filter: `org_id=eq.${orgId}` },
        async () => {
          const { data } = await supabase.from("cc_clients").select("*").eq("org_id", orgId).order("sort_order").order("name");
          if (data) setClients(data as CcClient[]);
        })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [orgId]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? clients : clients.filter((c) => c.status === statusFilter)),
    [clients, statusFilter],
  );
  const totalActiveMrr = useMemo(
    () => clients.filter((c) => c.status === "active").reduce((s, c) => s + (c.mrr ?? 0), 0),
    [clients],
  );
  const selected = clients.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground">
            <span className="tabular-nums font-semibold text-foreground">{filtered.length}</span>{" "}
            {statusFilter === "all" ? "clients" : STATUS_LABELS[statusFilter]}
          </span>
          <span className="text-xs text-muted-foreground border-l border-border pl-3">
            Active MRR:{" "}
            <span className="tabular-nums font-semibold text-[color:var(--color-brand-success)]">{formatMrr(totalActiveMrr)}</span>
          </span>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm"><Plus className="size-4" /> Add Client</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((o) => (
          <button key={o.value} type="button" onClick={() => setStatusFilter(o.value)}
            className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === o.value ? "bg-[color:var(--color-brand-electric)] text-white"
                : "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)] hover:bg-[color:var(--color-brand-fog)]/70")}>
            {o.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex items-center justify-center h-32 text-sm text-muted-foreground">
          {statusFilter === "all" ? "No clients yet — click Add Client to get started." : `No ${STATUS_LABELS[statusFilter as CcClientStatus]} clients.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <button key={client.id} type="button" onClick={() => setSelectedId(client.id)}
              className="text-left rounded-xl" aria-label={`Open ${client.name}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col gap-3 pt-4">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-full bg-[color:var(--color-brand-slate)] flex items-center justify-center text-xs font-semibold ring-1 ring-[color:var(--color-brand-fog)] shrink-0">
                      {getInitials(client.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm leading-snug truncate">{client.name}</p>
                      {client.company && <p className="text-xs text-muted-foreground truncate">{client.company}</p>}
                    </div>
                    <div className={cn("size-2.5 rounded-full shrink-0 mt-1", HEALTH_DOT[client.health])} title={HEALTH_LABEL[client.health]} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[client.status])}>{STATUS_LABELS[client.status]}</span>
                    {client.tier && <span className="text-xs text-muted-foreground truncate">{client.tier}</span>}
                  </div>
                  {client.mrr !== null && client.mrr > 0 && (
                    <p className="text-sm font-semibold tabular-nums text-[color:var(--color-brand-success)]">
                      {formatMrr(client.mrr)}<span className="text-xs font-normal text-muted-foreground ml-1">/mo</span>
                    </p>
                  )}
                  <span className="w-full mt-auto inline-flex items-center justify-center rounded-lg border border-border h-8 text-xs text-muted-foreground">View</span>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <AddClientDialog open={addOpen} onOpenChange={setAddOpen} />
      <ClientDetailSheet
        client={selected}
        open={selected !== null}
        onOpenChange={(o) => { if (!o) setSelectedId(null); }}
        onUpdated={(c) => setClients((p) => p.map((x) => (x.id === c.id ? c : x)))}
        onDeleted={(id) => setClients((p) => p.filter((x) => x.id !== id))}
      />
    </>
  );
}
