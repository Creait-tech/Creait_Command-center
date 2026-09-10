"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  applyTheme,
  getThemeChoiceServerSnapshot,
  getThemeChoiceSnapshot,
  resolveTheme,
  storeThemeChoice,
  subscribeThemeChoice,
  type ThemeChoice,
} from "@/lib/theme";

const OPTIONS: Array<{ value: ThemeChoice; label: string; icon: typeof Sun; hint: string }> = [
  { value: "light", label: "Light", icon: Sun, hint: "Always light" },
  { value: "dark", label: "Dark", icon: Moon, hint: "Always dark" },
  { value: "system", label: "System", icon: Monitor, hint: "Follow this device" },
];

/**
 * Light / dark / system, per person, per browser.
 *
 * The choice is read with `useSyncExternalStore` rather than copied into state
 * in an effect: `localStorage` is an external store, the server has no way to
 * know what this browser chose, and this is the hook built for exactly that —
 * it renders the neutral server snapshot through hydration and swaps to the
 * real value in the same commit.
 */
export function ThemeToggle() {
  const choice = useSyncExternalStore(
    subscribeThemeChoice,
    getThemeChoiceSnapshot,
    getThemeChoiceServerSnapshot,
  );

  // "System" has to keep tracking: the OS flips at sunset and the app should
  // follow without a reload. An explicit choice ignores the OS entirely.
  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(resolveTheme("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  const active = OPTIONS.find((o) => o.value === choice) ?? OPTIONS[1];
  const Icon = active.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" />}
        aria-label={`Theme: ${active.label}`}
      >
        <Icon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {OPTIONS.map((o) => {
          const OptionIcon = o.icon;
          const selected = o.value === choice;
          return (
            <DropdownMenuItem
              key={o.value}
              onClick={() => storeThemeChoice(o.value)}
              className={cn("gap-2", selected && "text-[color:var(--color-brand-electric)]")}
            >
              <OptionIcon className="size-4" />
              <span className="flex-1">{o.label}</span>
              <span className="text-[10px] text-muted-foreground">{o.hint}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
