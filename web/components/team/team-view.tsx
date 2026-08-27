"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RosterGrid } from "./roster-grid";
import { OrgChart } from "./org-chart";
import { SeatsBoard } from "./seats-board";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { asAuthoredRows, personName, type Person } from "@/lib/authorship";
import type {
  MemberKpi,
  TeamSeat,
  SeatAssignment,
} from "@/lib/supabase/types";

const VALID = ["roster", "orgchart", "accountability"] as const;
type Valid = (typeof VALID)[number];

interface TeamViewProps {
  members: Person[];
  kpis: MemberKpi[];
  seats: TeamSeat[];
  assignments: SeatAssignment[];
  orgId: string;
}

function sortMembers(list: Person[]): Person[] {
  // Sorted by the name people actually see, so the roster order matches the
  // labels rather than the underlying roster names.
  return [...list].sort((a, b) => personName(a).localeCompare(personName(b)));
}

function TeamViewInner({
  members: initialMembers,
  kpis: initialKpis,
  seats: initialSeats,
  assignments: initialAssignments,
  orgId,
}: TeamViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("view");
  const active: Valid = (VALID as readonly string[]).includes(raw ?? "")
    ? (raw as Valid)
    : "roster";

  const [members, setMembers] = useState<Person[]>(sortMembers(initialMembers));
  const [kpis, setKpis] = useState<MemberKpi[]>(initialKpis);
  const [seats, setSeats] = useState<TeamSeat[]>(initialSeats);
  const [assignments, setAssignments] = useState<SeatAssignment[]>(initialAssignments);

  useEffect(() => {
    const supabase = createClient();

    async function refetchMembers() {
      const { data } = await supabase
        .from("team_members")
        .select("*")
        .eq("org_id", orgId)
        .eq("status", "active")
        .order("full_name", { ascending: true });
      if (data) setMembers(sortMembers(asAuthoredRows<Person>(data)));
    }

    async function refetchKpis() {
      const ids = members.map((m) => m.id);
      if (ids.length === 0) {
        setKpis([]);
        return;
      }
      const { data } = await supabase
        .from("member_kpis")
        .select("*")
        .in("member_id", ids)
        .order("sort_order");
      if (data) setKpis(data as MemberKpi[]);
    }

    async function refetchSeats() {
      const { data } = await supabase
        .from("cc_team_seats")
        .select("*")
        .eq("org_id", orgId)
        .order("sort_order");
      if (data) setSeats(data as TeamSeat[]);
    }

    async function refetchAssignments() {
      const { data } = await supabase
        .from("cc_seat_assignments")
        .select("*");
      if (data) setAssignments(data as SeatAssignment[]);
    }

    const membersChannel = supabase
      .channel("team-members-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members", filter: `org_id=eq.${orgId}` }, refetchMembers)
      .subscribe();
    const kpisChannel = supabase
      .channel("member-kpis-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "member_kpis" }, () => { void refetchKpis(); })
      .subscribe();
    const seatsChannel = supabase
      .channel("cc-team-seats-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "cc_team_seats", filter: `org_id=eq.${orgId}` }, refetchSeats)
      .subscribe();
    const assignmentsChannel = supabase
      .channel("cc-seat-assignments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "cc_seat_assignments" }, refetchAssignments)
      .subscribe();

    return () => {
      void supabase.removeChannel(membersChannel);
      void supabase.removeChannel(kpisChannel);
      void supabase.removeChannel(seatsChannel);
      void supabase.removeChannel(assignmentsChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTab(v: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", v);
    router.replace(`/team?${p.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={active} onValueChange={(v) => typeof v === "string" && setTab(v)} className="w-full">
      <TabsList>
        <TabsTrigger value="roster">Roster</TabsTrigger>
        <TabsTrigger value="orgchart">Org Chart</TabsTrigger>
        <TabsTrigger value="accountability">Accountability Chart (EOS)</TabsTrigger>
      </TabsList>
      <TabsContent value="roster" className="mt-4">
        <RosterGrid members={members} kpis={kpis} onMembersChange={setMembers} onKpisChange={setKpis} />
      </TabsContent>
      <TabsContent value="orgchart" className="mt-4">
        <OrgChart members={members} onMembersChange={setMembers} />
      </TabsContent>
      <TabsContent value="accountability" className="mt-4">
        <SeatsBoard members={members} seats={seats} assignments={assignments} />
      </TabsContent>
    </Tabs>
  );
}

export function TeamView(props: TeamViewProps) {
  return (
    <Suspense fallback={null}>
      <TeamViewInner {...props} />
    </Suspense>
  );
}
