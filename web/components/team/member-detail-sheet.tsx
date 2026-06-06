"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInitials } from "./roster-grid";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type {
  TeamMember,
  MemberKpi,
  TeamRole,
  TeamStatus,
  MemberKpiPeriod,
} from "@/lib/supabase/types";

interface MemberDetailSheetProps {
  member: TeamMember | null;
  kpis: MemberKpi[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberUpdated: (next: TeamMember) => void;
  onKpisUpdated: (memberId: string, next: MemberKpi[]) => void;
}

interface EditableMember {
  title: string;
  department: string;
  role: TeamRole;
  status: TeamStatus;
  bio: string;
}

interface EditableKpi {
  id: string; // local id; matches db id when persisted, prefixed "new-" otherwise
  dbId: string | null;
  name: string;
  value: string;
  target: string;
  unit: string;
  period: MemberKpiPeriod;
  sort_order: number;
  deleted: boolean;
}

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const STATUS_OPTIONS: { value: TeamStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "offboarded", label: "Offboarded" },
];

const PERIOD_OPTIONS: { value: MemberKpiPeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
];

function memberToEditable(m: TeamMember): EditableMember {
  return {
    title: m.title ?? "",
    department: m.department ?? "",
    role: m.role,
    status: m.status,
    bio: m.bio ?? "",
  };
}

function kpisToEditable(list: MemberKpi[]): EditableKpi[] {
  return list.map((k) => ({
    id: k.id,
    dbId: k.id,
    name: k.name,
    value: String(k.value),
    target: k.target === null ? "" : String(k.target),
    unit: k.unit ?? "",
    period: k.period,
    sort_order: k.sort_order,
    deleted: false,
  }));
}

let tempIdCounter = 0;
function nextTempId(): string {
  tempIdCounter += 1;
  return `new-${tempIdCounter}`;
}

export function MemberDetailSheet({
  member,
  kpis,
  open,
  onOpenChange,
  onMemberUpdated,
  onKpisUpdated,
}: MemberDetailSheetProps) {
  const [form, setForm] = useState<EditableMember | null>(
    member ? memberToEditable(member) : null
  );
  const [editKpis, setEditKpis] = useState<EditableKpi[]>(
    kpisToEditable(kpis)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state whenever the member shown in the sheet changes.
  useEffect(() => {
    setForm(member ? memberToEditable(member) : null);
    setEditKpis(kpisToEditable(kpis));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id]);

  if (!member || !form) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md" />
      </Sheet>
    );
  }

  function update<K extends keyof EditableMember>(
    key: K,
    value: EditableMember[K]
  ) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function addKpi() {
    setEditKpis((prev) => [
      ...prev,
      {
        id: nextTempId(),
        dbId: null,
        name: "",
        value: "0",
        target: "",
        unit: "",
        period: "week",
        sort_order: prev.length,
        deleted: false,
      },
    ]);
  }

  function updateKpi(id: string, patch: Partial<EditableKpi>) {
    setEditKpis((prev) =>
      prev.map((k) => (k.id === id ? { ...k, ...patch } : k))
    );
  }

  function removeKpi(id: string) {
    setEditKpis((prev) =>
      prev
        .map((k) => (k.id === id ? { ...k, deleted: true } : k))
        // Drop fresh-and-deleted rows entirely
        .filter((k) => !(k.deleted && k.dbId === null))
    );
  }

  async function handleSave() {
    if (!member || !form) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();

    // 1) Update the team_members row
    const memberPatch: Partial<TeamMember> = {
      title: form.title.trim() || null,
      department: form.department.trim() || null,
      role: form.role,
      status: form.status,
      bio: form.bio.trim() || null,
    };

    const { data: memberData, error: memberErr } = await supabase
      .from("team_members")
      .update(memberPatch)
      .eq("id", member.id)
      .select("*")
      .single();

    if (memberErr) {
      setSaving(false);
      setError(memberErr.message);
      return;
    }

    // 2) Persist KPI changes
    const toDelete = editKpis.filter((k) => k.deleted && k.dbId !== null);
    const toInsert = editKpis.filter((k) => !k.deleted && k.dbId === null);
    const toUpdate = editKpis.filter((k) => !k.deleted && k.dbId !== null);

    // Deletes
    for (const k of toDelete) {
      if (!k.dbId) continue;
      const { error: delErr } = await supabase
        .from("member_kpis")
        .delete()
        .eq("id", k.dbId);
      if (delErr) {
        setSaving(false);
        setError(delErr.message);
        return;
      }
    }

    // Updates
    for (const k of toUpdate) {
      if (!k.dbId) continue;
      const valueNum = Number(k.value);
      const targetNum = k.target.trim() === "" ? null : Number(k.target);
      const { error: updErr } = await supabase
        .from("member_kpis")
        .update({
          name: k.name.trim(),
          value: Number.isFinite(valueNum) ? valueNum : 0,
          target:
            targetNum === null || !Number.isFinite(targetNum) ? null : targetNum,
          unit: k.unit.trim() || null,
          period: k.period,
          sort_order: k.sort_order,
        })
        .eq("id", k.dbId);
      if (updErr) {
        setSaving(false);
        setError(updErr.message);
        return;
      }
    }

    // Inserts
    if (toInsert.length > 0) {
      const rows = toInsert.map((k) => {
        const valueNum = Number(k.value);
        const targetNum = k.target.trim() === "" ? null : Number(k.target);
        return {
          member_id: member.id,
          name: k.name.trim() || "Untitled",
          value: Number.isFinite(valueNum) ? valueNum : 0,
          target:
            targetNum === null || !Number.isFinite(targetNum)
              ? null
              : targetNum,
          unit: k.unit.trim() || null,
          period: k.period,
          sort_order: k.sort_order,
        };
      });
      const { error: insErr } = await supabase.from("member_kpis").insert(rows);
      if (insErr) {
        setSaving(false);
        setError(insErr.message);
        return;
      }
    }

    // Refresh local state from server for KPIs to pick up new ids
    const { data: refreshed } = await supabase
      .from("member_kpis")
      .select("*")
      .eq("member_id", member.id)
      .order("sort_order", { ascending: true });

    setSaving(false);

    if (memberData) {
      onMemberUpdated(memberData as TeamMember);
    }
    if (refreshed) {
      onKpisUpdated(member.id, refreshed as MemberKpi[]);
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-paper)] flex items-center justify-center text-sm font-semibold ring-1 ring-[color:var(--color-brand-fog)] shrink-0">
              {member.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.avatar_url}
                  alt={member.full_name}
                  className="size-full rounded-full object-cover"
                />
              ) : (
                getInitials(member.full_name)
              )}
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate">{member.full_name}</SheetTitle>
              {member.email && (
                <SheetDescription className="truncate">
                  {member.email}
                </SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-4">
            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="ms-title"
              >
                Title
              </label>
              <Input
                id="ms-title"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="ms-dept"
              >
                Department
              </label>
              <Input
                id="ms-dept"
                value={form.department}
                onChange={(e) => update("department", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Role
                </label>
                <Select
                  value={form.role}
                  onValueChange={(v) =>
                    typeof v === "string" && update("role", v as TeamRole)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Status
                </label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    typeof v === "string" && update("status", v as TeamStatus)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="ms-bio"
              >
                Bio / Notes
              </label>
              <Textarea
                id="ms-bio"
                value={form.bio}
                onChange={(e) => update("bio", e.target.value)}
                className="min-h-24"
                placeholder="Short bio or working notes…"
              />
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">KPIs</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addKpi}
                >
                  <Plus className="size-3.5" />
                  Add KPI
                </Button>
              </div>

              {editKpis.filter((k) => !k.deleted).length === 0 && (
                <p className="text-xs text-muted-foreground">No KPIs yet.</p>
              )}

              <ul className="space-y-3">
                {editKpis
                  .filter((k) => !k.deleted)
                  .map((k) => (
                    <li
                      key={k.id}
                      className="rounded-md border border-[color:var(--color-brand-fog)]/50 p-3 space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <Input
                          value={k.name}
                          placeholder="KPI name"
                          onChange={(e) =>
                            updateKpi(k.id, { name: e.target.value })
                          }
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeKpi(k.id)}
                          aria-label="Remove KPI"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-0.5">
                          <label className="text-[10px] uppercase text-muted-foreground">
                            Value
                          </label>
                          <Input
                            type="number"
                            value={k.value}
                            onChange={(e) =>
                              updateKpi(k.id, { value: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[10px] uppercase text-muted-foreground">
                            Target
                          </label>
                          <Input
                            type="number"
                            value={k.target}
                            onChange={(e) =>
                              updateKpi(k.id, { target: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[10px] uppercase text-muted-foreground">
                            Unit
                          </label>
                          <Input
                            value={k.unit}
                            placeholder="$, %, …"
                            onChange={(e) =>
                              updateKpi(k.id, { unit: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[10px] uppercase text-muted-foreground">
                          Period
                        </label>
                        <Select
                          value={k.period}
                          onValueChange={(v) =>
                            typeof v === "string" &&
                            updateKpi(k.id, { period: v as MemberKpiPeriod })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PERIOD_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>

            {error && (
              <p className="text-xs text-[color:var(--color-brand-danger)]">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-border p-4 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
