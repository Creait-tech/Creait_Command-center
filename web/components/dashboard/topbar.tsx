"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu, Command } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/dashboard/notifications-bell";
import { QuickAddButton } from "@/components/dashboard/quick-add-button";

const PAGE_TITLES: Record<string, string> = {
  "/command-center": "Command Center",
  "/level-10": "Level 10 Meeting",
  "/meetings": "Meeting History",
  "/rocks": "Rocks",
  "/todos": "To-Dos",
  "/initiatives": "Initiatives",
  "/team": "Team Scorecard",
  "/recruiting": "Recruiting",
  "/journey": "Client Journey",
  "/strategy": "Strategy",
  "/vision": "Vision",
  "/research": "Research",
  "/comms": "Comms Hub",
  "/agents": "Agent Center",
  "/quarterly": "Quarterly Planning",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const entry = Object.entries(PAGE_TITLES).find(([href]) =>
    pathname.startsWith(`${href}/`)
  );
  if (entry) return entry[1];
  return "CREAIT";
}

type TopbarProps = {
  className?: string;
  onMobileMenuClick?: () => void;
};

export function Topbar({ className, onMobileMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const [mac, setMac] = React.useState(true);

  React.useEffect(() => {
    setMac(typeof navigator !== "undefined" && /Mac/i.test(navigator.platform));
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {onMobileMenuClick && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={onMobileMenuClick}
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>
        )}
        <h1 className="font-heading text-base font-semibold tracking-tight text-foreground">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: mac, ctrlKey: !mac }));
          }}
          className="hidden sm:flex items-center gap-1.5 rounded-md border border-border bg-[color:var(--color-brand-slate)]/40 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-[color:var(--color-brand-electric)] transition-colors"
          aria-label="Open command palette"
        >
          <Command className="size-3" />
          Search
          <kbd className="ml-1 rounded border border-border px-1 text-[10px] font-mono">
            {mac ? "⌘" : "Ctrl"}K
          </kbd>
        </button>
        <QuickAddButton />
        <NotificationsBell />
      </div>
    </header>
  );
}
