"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { RockCard } from "./rock-card";
import { AddRockDialog } from "./add-rock-dialog";
import { asAuthoredRows, type AuthoredRock, type Person } from "@/lib/authorship";
import type {
  RockMilestone,
  RockStatusUpdate,
} from "@/lib/supabase/types";

interface Props {
  initialRocks: AuthoredRock[];
  milestones: RockMilestone[];
  statusUpdates: RockStatusUpdate[];
  members: Person[];
  currentQuarter: string;
}

export function RocksView({
  initialRocks,
  milestones: initialMilestones,
  statusUpdates: initialStatus,
  members,
  currentQuarter,
}: Props) {
  const orgId = useActiveOrgId();
  const [rocks, setRocks] = useState<AuthoredRock[]>(initialRocks);
  const [milestones, setMilestones] = useState<RockMilestone[]>(initialMilestones);
  const [statusUpdates, setStatusUpdates] = useState<RockStatusUpdate[]>(initialStatus);
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
  const [addOpen, setAddOpen] = useState(false);

  // Available quarters: current + any quarter that has Rocks
  const quarters = useMemo(() => {
    const set = new Set<string>([currentQuarter]);
    for (const r of rocks) set.add(r.quarter);
    return Array.from(set).sort().reverse();
  }, [rocks, currentQuarter]);

  const visibleRocks = useMemo(
    () => rocks.filter((r) => r.quarter === selectedQuarter),
    [rocks, selectedQuarter],
  );

  const companyRocks = visibleRocks.filter((r) => r.rock_type === "company");
  const individualRocks = visibleRocks.filter((r) => r.rock_type !== "company");

  // Latest status per rock
  const latestStatusByRock = useMemo(() => {
    const map = new Map<string, RockStatusUpdate>();
    for (const s of statusUpdates) {
      if (!map.has(s.rock_id)) map.set(s.rock_id, s);
    }
    return map;
  }, [statusUpdates]);

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("rocks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cc_rocks", filter: `org_id=eq.${orgId}` },
        async () => {
          const { data } = await supabase
            .from("cc_rocks")
            .select("*")
            .eq("org_id", orgId)
            .order("sort_order");
          if (data) setRocks(asAuthoredRows<AuthoredRock>(data));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cc_rock_milestones" },
        async () => {
          const { data } = await supabase
            .from("cc_rock_milestones")
            .select("*")
            .order("sort_order");
          if (data) setMilestones(data as RockMilestone[]);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cc_rock_status_updates" },
        (payload) =>
          setStatusUpdates((p) => [payload.new as RockStatusUpdate, ...p]),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [orgId]);

  function handleRockUpdated(updated: AuthoredRock) {
    setRocks((p) => p.map((r) => (r.id === updated.id ? updated : r)));
  }

  function handleRockCreated(created: AuthoredRock) {
    setRocks((p) => [...p.filter((r) => r.id !== created.id), created]);
    setSelectedQuarter(created.quarter);
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Quarter:</span>
          <Select value={selectedQuarter} onValueChange={(v) => typeof v === "string" && setSelectedQuarter(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quarters.map((q) => (
                <SelectItem key={q} value={q}>{q}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-2">
            {visibleRocks.length} rock{visibleRocks.length === 1 ? "" : "s"}
            {visibleRocks.length > 7 && <span className="text-[color:var(--color-brand-warning)] ml-1">(EOS says max 7)</span>}
          </span>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add Rock
        </Button>
      </div>

      {visibleRocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] p-12 text-center">
          <p className="text-sm font-medium">No rocks for {selectedQuarter} yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            EOS rule: 3-7 quarterly priorities. SMART. One owner each. Click "Add Rock" to set your first one.
          </p>
        </div>
      ) : (
        <>
          {companyRocks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-brand-mist)]">
                Company Rocks · {companyRocks.length}
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {companyRocks.map((rock) => (
                  <RockCard
                    key={rock.id}
                    rock={rock}
                    milestones={milestones.filter((m) => m.rock_id === rock.id)}
                    latestStatus={latestStatusByRock.get(rock.id) ?? null}
                    members={members}
                    onUpdated={handleRockUpdated}
                  />
                ))}
              </div>
            </section>
          )}
          {individualRocks.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-brand-mist)]">
                Individual Rocks · {individualRocks.length}
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {individualRocks.map((rock) => (
                  <RockCard
                    key={rock.id}
                    rock={rock}
                    milestones={milestones.filter((m) => m.rock_id === rock.id)}
                    latestStatus={latestStatusByRock.get(rock.id) ?? null}
                    members={members}
                    onUpdated={handleRockUpdated}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <AddRockDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultQuarter={selectedQuarter}
        members={members}
        onCreated={handleRockCreated}
      />
    </>
  );
}
