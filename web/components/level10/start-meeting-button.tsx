"use client";

import { useState } from "react";
import { Play, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RunMeetingModal } from "./run-meeting-modal";
import { MEETING_AGENDAS, MEETING_TYPE_ORDER, type MeetingType } from "@/lib/meeting-agendas";

export function StartMeetingButton() {
  const [open, setOpen] = useState(false);
  const [meetingType, setMeetingType] = useState<MeetingType>("level_10");

  function start(type: MeetingType) {
    setMeetingType(type);
    setOpen(true);
  }

  return (
    <>
      <div className="flex items-stretch">
        <Button onClick={() => start("level_10")} className="rounded-r-none">
          <Play className="size-4" />
          Start Level 10
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button className="rounded-l-none border-l border-l-white/25 px-2" />}
            aria-label="Choose a different meeting type"
          >
            <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {MEETING_TYPE_ORDER.map((type) => {
              const agenda = MEETING_AGENDAS[type];
              return (
                <DropdownMenuItem
                  key={type}
                  onSelect={() => start(type)}
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
      <RunMeetingModal open={open} onOpenChange={setOpen} meetingType={meetingType} />
    </>
  );
}
