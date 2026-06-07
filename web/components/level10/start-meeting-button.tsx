"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RunMeetingModal } from "./run-meeting-modal";

export function StartMeetingButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Play className="size-4" />
        Start Meeting (90 min L10)
      </Button>
      <RunMeetingModal open={open} onOpenChange={setOpen} />
    </>
  );
}
