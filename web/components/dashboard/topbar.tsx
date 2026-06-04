"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Bell, Menu, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PAGE_TITLES: Record<string, string> = {
  "/command-center": "Command Center",
  "/level-10": "Level 10 Meeting",
  "/initiatives": "Initiatives",
  "/team": "Team Scorecard",
  "/recruiting": "Recruiting",
  "/journey": "Client Journey",
  "/strategy": "Strategy",
  "/vision": "Vision",
  "/research": "Research",
  "/comms": "Comms Hub",
  "/agents": "Agent Center",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Match deepest known prefix
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
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex"
          aria-label="Quick Run"
        >
          <Zap className="size-3.5" />
          Quick Run
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
      </div>
    </header>
  );
}
