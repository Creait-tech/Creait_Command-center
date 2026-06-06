"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RosterGrid } from "./roster-grid";
import { OrgChart } from "./org-chart";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type { TeamMember, MemberKpi } from "@/lib/supabase/types";

const VALID = ["roster", "orgchart"] as const;
type Valid = (typeof VALID)[number];

interface TeamViewProps {
  members: TeamMember[];
  kpis: MemberKpi[];
}

function sortMembers(list: TeamMember[]): TeamMember[] {
  return [...list].sort((a, b) => a.full_name.localeCompare(b.full_name));
}

function TeamViewInner({ members: initialMembers, kpis: initialKpis }: TeamViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("view");
  const active: Valid = (VALID as readonly string[]).includes(raw ?? "")
    ? (raw as Valid)
    : "roster";

  const [members, setMembers] = useState<TeamMember[]>(sortMembers(initialMembers));
  const [kpis, setKpis] = useState<MemberKpi[]>(initialKpis);

  useEffect(() => {
    const supabase = createClient();

    async function refetchMembers() {
      const { data } = await supabase
        .from("team_members")
        .select("*")
        .eq("org_id", "creait")
        .eq("status", "active")
        .order("full_name", { ascending: true });
      if (data) setMembers(sortMembers(data as TeamMember[]));
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
        .order("sort_order", { ascending: true });
      if (data) setKpis(data as MemberKpi[]);
    }

    const membersChannel = supabase
      .channel("team-members-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_members",
          filter: "org_id=eq.creait",
        },
        () => {
          void refetchMembers();
        }
      )
      .subscribe();

    const kpisChannel = supabase
      .channel("member-kpis-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "member_kpis" },
        () => {
          void refetchKpis();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(membersChannel);
      void supabase.removeChannel(kpisChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTab(v: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", v);
    router.replace(`/team?${p.toString()}`, { scroll: false });
  }

  return (
    <Tabs
      value={active}
      onValueChange={(v) => typeof v === "string" && setTab(v)}
      className="w-full"
    >
      <TabsList>
        <TabsTrigger value="roster">Roster</TabsTrigger>
        <TabsTrigger value="orgchart">Org Chart</TabsTrigger>
      </TabsList>
      <TabsContent value="roster" className="mt-4">
        <RosterGrid
          members={members}
          kpis={kpis}
          onMembersChange={setMembers}
          onKpisChange={setKpis}
        />
      </TabsContent>
      <TabsContent value="orgchart" className="mt-4">
        <OrgChart members={members} onMembersChange={setMembers} />
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
