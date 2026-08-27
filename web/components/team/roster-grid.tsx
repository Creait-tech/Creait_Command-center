"use client";

import { useMemo, useState } from "react";
import { Plus, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FeatureEmptyState } from "@/components/empty-states/feature-empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AddMemberDialog } from "./add-member-dialog";
import { MemberDetailSheet } from "./member-detail-sheet";
import { personName, type Person } from "@/lib/authorship";
import type {
  MemberKpi,
  MemberKpiPeriod,
  TeamRole,
  TeamStatus,
} from "@/lib/supabase/types";

const PERIOD_SHORT: Record<MemberKpiPeriod, string> = {
  day: "day",
  week: "wk",
  month: "mo",
  quarter: "qtr",
};

interface RosterGridProps {
  members: Person[];
  kpis: MemberKpi[];
  onMembersChange: (next: Person[]) => void;
  onKpisChange: (next: MemberKpi[]) => void;
}

const ROLE_LABELS: Record<TeamRole, string> = {
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

const ROLE_STYLES: Record<TeamRole, string> = {
  admin:
    "bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)]",
  member:
    "bg-[color:var(--color-brand-aqua)]/15 text-[color:var(--color-brand-aqua)]",
  viewer:
    "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]",
};

const STATUS_LABELS: Record<TeamStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  offboarded: "Offboarded",
};

const STATUS_STYLES: Record<TeamStatus, string> = {
  active:
    "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]",
  inactive:
    "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]",
  offboarded:
    "bg-[color:var(--color-brand-danger)]/20 text-[color:var(--color-brand-danger)]",
};

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function RosterGrid({
  members,
  kpis,
  onMembersChange,
  onKpisChange,
}: RosterGridProps) {
  const [roleFilter, setRoleFilter] = useState<"all" | TeamRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TeamStatus>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      return true;
    });
  }, [members, roleFilter, statusFilter]);

  const kpisByMember = useMemo(() => {
    const map = new Map<string, MemberKpi[]>();
    for (const k of kpis) {
      const list = map.get(k.member_id) ?? [];
      list.push(k);
      map.set(k.member_id, list);
    }
    return map;
  }, [kpis]);

  const selectedMember =
    members.find((m) => m.id === selectedMemberId) ?? null;
  const selectedMemberKpis = selectedMember
    ? (kpisByMember.get(selectedMember.id) ?? [])
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Role</label>
          <Select
            value={roleFilter}
            onValueChange={(v) => typeof v === "string" && setRoleFilter(v as typeof roleFilter)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              typeof v === "string" && setStatusFilter(v as typeof statusFilter)
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="offboarded">Offboarded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto">
          <Button onClick={() => setAddOpen(true)} size="sm">
            <Plus className="size-4" />
            Add Member
          </Button>
        </div>
      </div>

      {kpis.length > 0 && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Scorecard numbers under each name are that person&rsquo;s KPIs for
          their seat on the Accountability Chart. Targets come from the quarter
          plan; values stay at 0 until someone records a real one — a 0 here
          means &ldquo;not measured yet&rdquo;, not &ldquo;did nothing&rdquo;.
          Click a card to edit.
        </p>
      )}

      {filtered.length === 0 ? (
        members.length === 0 ? (
          <FeatureEmptyState
            icon={<Users className="size-5" />}
            title="No one on the roster"
            description="The roster is the people half of the Accountability Chart: who is here, what seat they hold, and the handful of numbers that seat is responsible for each week. Without it the org chart has boxes and the scorecard has no owners."
            useWhen={[
              "Someone joins — founder, contractor or hire — and needs a seat and a number.",
              "You are about to run a Level 10 and every KPI needs a name attached to it.",
              "Someone leaves and their seat needs reassigning rather than quietly disappearing.",
            ]}
            action={{
              label: "Add the first member",
              onClick: () => setAddOpen(true),
              icon: <Plus className="size-3.5" />,
            }}
          />
        ) : (
          <FeatureEmptyState
            compact
            title="No members match the current filters"
            description="Every member is filtered out by the role or status you picked. Reset the filters to see the full roster."
            action={{
              label: "Clear filters",
              onClick: () => {
                setRoleFilter("all");
                setStatusFilter("all");
              },
            }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const memberKpis = (kpisByMember.get(m.id) ?? []).slice(0, 3);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedMemberId(m.id)}
                className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-electric)] rounded-xl"
                aria-label={`Open detail for ${personName(m)}`}
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="size-12 rounded-full bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-paper)] flex items-center justify-center text-sm font-semibold ring-1 ring-[color:var(--color-brand-fog)] shrink-0">
                        {m.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.avatar_url}
                            alt={personName(m)}
                            className="size-full rounded-full object-cover"
                          />
                        ) : (
                          getInitials(personName(m))
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm leading-snug truncate">
                          {personName(m)}
                          {m.pronouns && (
                            <span className="ml-1.5 font-normal text-xs text-muted-foreground">
                              {m.pronouns}
                            </span>
                          )}
                        </p>
                        {m.title && (
                          <p className="text-xs text-muted-foreground truncate">
                            {m.title}
                          </p>
                        )}
                        {m.department && (
                          <p className="text-xs text-muted-foreground truncate">
                            {m.department}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          ROLE_STYLES[m.role]
                        )}
                      >
                        {ROLE_LABELS[m.role]}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_STYLES[m.status]
                        )}
                      >
                        {STATUS_LABELS[m.status]}
                      </span>
                    </div>

                    {memberKpis.length > 0 ? (
                      <ul className="flex flex-col gap-1.5 border-t border-[color:var(--color-brand-fog)]/50 pt-2">
                        {memberKpis.map((k) => {
                          const pct =
                            k.target && k.target > 0
                              ? Math.min(100, Math.round((k.value / k.target) * 100))
                              : null;
                          return (
                            <li
                              key={k.id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="text-muted-foreground truncate">
                                {k.name}
                                <span className="opacity-60">
                                  {" "}
                                  /{PERIOD_SHORT[k.period]}
                                </span>
                              </span>
                              <span className="font-medium tabular-nums">
                                {k.value}
                                {k.unit ?? ""}
                                {k.target ? (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    / {k.target}
                                    {k.unit ?? ""}
                                    {pct !== null && ` (${pct}%)`}
                                  </span>
                                ) : null}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="border-t border-[color:var(--color-brand-fog)]/50 pt-2 text-xs text-muted-foreground">
                        No scorecard KPIs yet — open to add one.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(m) => {
          onMembersChange([...members, m].sort((a, b) =>
            personName(a).localeCompare(personName(b))
          ));
        }}
      />

      <MemberDetailSheet
        member={selectedMember}
        kpis={selectedMemberKpis}
        open={selectedMember !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedMemberId(null);
        }}
        onMemberUpdated={(updated) => {
          onMembersChange(
            members.map((m) => (m.id === updated.id ? updated : m))
          );
        }}
        onKpisUpdated={(memberId, nextForMember) => {
          const other = kpis.filter((k) => k.member_id !== memberId);
          onKpisChange([...other, ...nextForMember]);
        }}
      />
    </div>
  );
}
