"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  CalendarCheck,
  Target,
  Mountain,
  Users,
  UserPlus,
  Route,
  Compass,
  Eye,
  Search,
  MessageSquare,
  Bot,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModelSelector } from "@/components/dashboard/model-selector";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Business OS",
    items: [
      { href: "/command-center", label: "Command Center", icon: LayoutDashboard },
      { href: "/level-10", label: "Level 10 Meeting", icon: CalendarCheck },
      { href: "/rocks", label: "Rocks (Quarterly)", icon: Mountain },
      { href: "/initiatives", label: "Initiatives", icon: Target },
      { href: "/team", label: "Team Scorecard", icon: Users },
      { href: "/recruiting", label: "Recruiting", icon: UserPlus },
      { href: "/journey", label: "Client Journey", icon: Route },
      { href: "/strategy", label: "Strategy", icon: Compass },
      { href: "/vision", label: "Vision", icon: Eye },
    ],
  },
  {
    title: "Agentic OS",
    items: [
      { href: "/research", label: "Research", icon: Search },
      { href: "/comms", label: "Comms Hub", icon: MessageSquare },
      { href: "/agents", label: "Agent Center", icon: Bot },
    ],
  },
];

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col border-r border-border bg-brand-ink",
        className
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <Image
          src="/logo.svg"
          alt="CREAIT"
          width={32}
          height={32}
          priority
        />
        <span className="font-heading text-base font-semibold tracking-tight text-foreground">
          CREAIT
        </span>
      </div>

      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-6 px-3 py-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-1">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-brand-slate text-brand-paper"
                        : "text-brand-mist hover:bg-brand-slate/50 hover:text-brand-paper"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="flex flex-col gap-2 border-t border-border p-3">
        <ModelSelector className="w-full" />
        <div className="flex items-center gap-2 rounded-md px-1.5 py-1.5">
          <UserButton
            appearance={{
              elements: { userButtonAvatarBox: "size-8" },
            }}
          />
          <span className="text-xs text-muted-foreground">Account</span>
        </div>
      </div>
    </aside>
  );
}
