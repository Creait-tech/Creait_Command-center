"use client";

import * as React from "react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { ChatWidgetHost } from "@/components/dashboard/chat-widget-host";
import { CommandPalette } from "@/components/dashboard/command-palette";

type DashboardShellProps = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <div className="hidden w-60 shrink-0 md:flex md:flex-col">
        <Sidebar />
      </div>

      {/* Mobile sidebar (Sheet drawer) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-60 max-w-none border-r border-border bg-brand-ink p-0"
          showCloseButton={false}
        >
          <Sidebar onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMobileMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>

      <ChatWidgetHost />
      <CommandPalette />
    </div>
  );
}
