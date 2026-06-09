"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  TeamMember,
  TeamSeat,
  SeatAssignment,
  GwcRating,
} from "@/lib/supabase/types";

interface Props {
  members: TeamMember[];
  seats: TeamSeat[];
  assignments: SeatAssignment[];
}

const GWC_DOT: Record<GwcRating, string> = {
  plus: "bg-[color:var(--color-brand-success)]",
  plus_minus: "bg-[color:var(--color-brand-warning)]",
  minus: "bg-[color:var(--color-brand-danger)]",
  unknown: "bg-[color:var(--color-brand-fog)]",
};

const GWC_VALUE: Record<GwcRating, number> = {
  plus: 1,
  plus_minus: 0.5,
  minus: 0,
  unknown: -1,
};

function GwcDots({ a }: { a: SeatAssignment }) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn("size-2 rounded-full", GWC_DOT[a.gwc_get])} title={`Get it: ${a.gwc_get}`} />
      <span className={cn("size-2 rounded-full", GWC_DOT[a.gwc_want])} title={`Want it: ${a.gwc_want}`} />
      <span className={cn("size-2 rounded-full", GWC_DOT[a.gwc_capacity])} title={`Capacity: ${a.gwc_capacity}`} />
    </div>
  );
}

function isConcern(a: SeatAssignment): boolean {
  return a.gwc_get === "minus" || a.gwc_want === "minus" || a.gwc_capacity === "minus";
}

function isUnknown(a: SeatAssignment): boolean {
  return a.gwc_get === "unknown" || a.gwc_want === "unknown" || a.gwc_capacity === "unknown";
}

export function PeopleAnalyzer({ members, seats, assignments }: Props) {
  const stats = useMemo(() => {
    const total = assignments.length;
    const concerns = assignments.filter(isConcern);
    const unknowns = assignments.filter(isUnknown);
    const allGreen = total - concerns.length - unknowns.length;
    const score = total === 0 ? 0 : Math.round(
      (assignments.reduce((s, a) => {
        const g = GWC_VALUE[a.gwc_get] === -1 ? 0 : GWC_VALUE[a.gwc_get];
        const w = GWC_VALUE[a.gwc_want] === -1 ? 0 : GWC_VALUE[a.gwc_want];
        const c = GWC_VALUE[a.gwc_capacity] === -1 ? 0 : GWC_VALUE[a.gwc_capacity];
        return s + (g + w + c) / 3;
      }, 0) / total) * 100,
    );
    return { total, concerns, unknowns, allGreen, score };
  }, [assignments]);

  const personRows = useMemo(() => {
    return members.map((m) => {
      const memberAssignments = assignments.filter((a) => a.member_id === m.id);
      return {
        member: m,
        assignments: memberAssignments,
        concernCount: memberAssignments.filter(isConcern).length,
        unknownCount: memberAssignments.filter(isUnknown).length,
      };
    }).sort((a, b) => b.assignments.length - a.assignments.length);
  }, [members, assignments]);

  if (assignments.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-2">
          <p className="text-sm font-medium">No GWC data yet</p>
          <p className="text-xs text-muted-foreground">
            Assign people to seats (above) and rate G/W/C to populate this report.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        {/* Summary bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Right Person, Right Seat</p>
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              stats.score >= 80 ? "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]" :
              stats.score >= 60 ? "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)]" :
              "bg-[color:var(--color-brand-danger)]/20 text-[color:var(--color-brand-danger)]",
            )}>
              GWC score: {stats.score}%
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded border border-border bg-[color:var(--color-brand-slate)]/30 px-2 py-1.5">
              <p className="text-[color:var(--color-brand-success)] font-semibold">{stats.allGreen}</p>
              <p className="text-muted-foreground">All-green seats</p>
            </div>
            <div className="rounded border border-border bg-[color:var(--color-brand-slate)]/30 px-2 py-1.5">
              <p className="text-[color:var(--color-brand-warning)] font-semibold">{stats.unknowns.length}</p>
              <p className="text-muted-foreground">Need rating</p>
            </div>
            <div className="rounded border border-border bg-[color:var(--color-brand-slate)]/30 px-2 py-1.5">
              <p className="text-[color:var(--color-brand-danger)] font-semibold">{stats.concerns.length}</p>
              <p className="text-muted-foreground">Conversations needed</p>
            </div>
          </div>
          {stats.concerns.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              EOS rule: any "−" rating ⇒ have the conversation. Common path: 3 chances over a quarter to move to "+" or change seat.
            </p>
          )}
        </div>

        {/* Heatmap matrix */}
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Matrix</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Person</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Seats</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">G W C per seat</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Flags</th>
                </tr>
              </thead>
              <tbody>
                {personRows.map(({ member, assignments: ma, concernCount, unknownCount }) => (
                  <tr key={member.id} className="border-b border-border last:border-0">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <span className="size-6 rounded-full bg-[color:var(--color-brand-slate)] flex items-center justify-center text-[10px] font-medium">
                          {member.full_name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="font-medium">{member.full_name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex flex-col gap-0.5">
                        {ma.length === 0 ? (
                          <span className="text-muted-foreground italic">No seat</span>
                        ) : (
                          ma.map((a) => {
                            const s = seats.find((x) => x.id === a.seat_id);
                            return (
                              <span key={a.id} className="text-muted-foreground">
                                {s?.title ?? "?"}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex flex-col gap-1">
                        {ma.map((a) => <GwcDots key={a.id} a={a} />)}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right">
                      {concernCount > 0 && (
                        <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-[color:var(--color-brand-danger)]/15 text-[color:var(--color-brand-danger)] mr-1">
                          {concernCount} talk
                        </span>
                      )}
                      {unknownCount > 0 && (
                        <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-[color:var(--color-brand-warning)]/15 text-[color:var(--color-brand-warning)]">
                          {unknownCount} ?
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[color:var(--color-brand-success)]" /> +</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[color:var(--color-brand-warning)]" /> ±</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[color:var(--color-brand-danger)]" /> −</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[color:var(--color-brand-fog)]" /> not rated</span>
            <span className="ml-auto">G=Get it · W=Want it · C=Capacity</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
