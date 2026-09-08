"use client";

import { useState } from "react";
import { Play, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RunMeetingModal } from "./run-meeting-modal";
import { MEETING_AGENDAS, type MeetingType } from "@/lib/meeting-agendas";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import type { AuthoredIdsItem, AuthoredRock, Person } from "@/lib/authorship";
import type { KpiRow } from "./kpi-meta";
import type { CcKpiWeekly } from "./weekly-types";
import type { KpiHistory, RockMilestone, RockStatusUpdate } from "@/lib/supabase/types";

export interface MeetingWorkspaceData {
  kpis: KpiRow[];
  kpiWeekly: CcKpiWeekly[];
  kpiHistory: KpiHistory[];
  weekStarts: string[];
  people: Person[];
  rocks: AuthoredRock[];
  rockMilestones: RockMilestone[];
  rockStatusUpdates: RockStatusUpdate[];
  idsItems: AuthoredIdsItem[];
  currentQuarter: string;
}

interface StartMeetingButtonProps {
  workspace: MeetingWorkspaceData;
}

// The Team Meetings surface is deliberately EOS-only. Calls with recordings,
// prospects, customers, and ad-hoc discussions belong to the War Room instead.
const TEAM_MEETING_TYPES: MeetingType[] = ["level_10", "quarterly", "annual", "huddle"];

export function StartMeetingButton({ workspace }: StartMeetingButtonProps) {
  const orgId = useActiveOrgId();
  const [open, setOpen] = useState(false);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [meetingType, setMeetingType] = useState<MeetingType>("level_10");
  const [starting, setStarting] = useState(false);

  async function start(type: MeetingType) {
    const agenda = MEETING_AGENDAS[type];
    setStarting(true);
    const now = new Date();
    const { data, error } = await createClient()
      .from("meetings")
      .insert({
        org_id: orgId,
        title: `${agenda.titlePrefix} — ${now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
        meeting_type: agenda.type,
        scheduled_at: now.toISOString(),
        source: "manual",
      })
      .select("id")
      .single();
    setStarting(false);
    if (error || !data) {
      toast.error(`Couldn't start meeting: ${error?.message ?? "No meeting record returned"}`);
      return;
    }
    setMeetingType(type);
    setMeetingId(data.id);
    setOpen(true);
    toast.success(`${agenda.label} started — ${agenda.sections[0].label} first.`);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setMeetingId(null);
  }

  return (
    <>
      <div className="flex items-stretch">
        <Button onClick={() => void start("level_10")} disabled={starting} className="rounded-r-none">
          <Play className="size-4" />
          {starting ? "Starting…" : "Start Level 10"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button className="rounded-l-none border-l border-l-white/25 px-2" />}
            aria-label="Choose a different meeting type"
          >
            <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {TEAM_MEETING_TYPES.map((type) => {
              const agenda = MEETING_AGENDAS[type];
              return (
                <DropdownMenuItem
                  key={type}
                  onSelect={() => void start(type)}
                  className="flex flex-col items-start gap-0.5 py-2"
                >
                  <span className="text-sm font-medium">{agenda.label}</span>
                  <span className="text-xs text-muted-foreground">{agenda.cadence}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && meetingId && (
        <RunMeetingModal
          open={open}
          onOpenChange={handleOpenChange}
          meetingId={meetingId}
          meetingType={meetingType}
          workspace={workspace}
        />
      )}
    </>
  );
}
