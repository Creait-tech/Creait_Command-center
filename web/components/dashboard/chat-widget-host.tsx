"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ModelSelector,
  useSelectedModel,
} from "@/components/dashboard/model-selector";
import { ChatPanel } from "@/components/dashboard/chat-panel";

function derivePageContext(pathname: string): string {
  if (!pathname || pathname === "/") return "home";
  return pathname.replace(/^\/+/, "").split("/")[0] || "home";
}

export function ChatWidgetHost() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  // Single owner of the model selection — passed down to both the selector
  // and the chat panel so the dropdown choice actually reaches the request.
  const [model, setModel] = useSelectedModel();
  const pageContext = derivePageContext(pathname);

  if (!open) {
    return (
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open AI Assistant"
        className={cn(
          "fixed bottom-6 right-6 z-40 size-14 rounded-full bg-brand-electric p-0 shadow-xl hover:bg-brand-electric-glow",
          "[&_svg:not([class*='size-'])]:size-6"
        )}
      >
        <MessageSquare className="text-primary-foreground" />
      </Button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="AI Assistant"
      className={cn(
        "fixed z-40 flex flex-col overflow-hidden border border-border bg-card shadow-2xl",
        "inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:w-[400px] sm:rounded-lg"
      )}
    >
      <header className="flex h-12 items-center justify-between gap-2 border-b border-border bg-brand-ink px-3">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="size-4 shrink-0 text-brand-aqua" />
          <span className="truncate font-heading text-sm font-medium text-foreground">
            AI Assistant
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <ModelSelector size="sm" value={model} onValueChange={setModel} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close AI Assistant"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ChatPanel pageContext={pageContext} model={model} />
      </div>
    </div>
  );
}
