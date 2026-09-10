"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { History, MessageSquare, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ModelSelector,
  useSelectedModel,
} from "@/components/dashboard/model-selector";
import { ChatPanel } from "@/components/dashboard/chat-panel";
import { createBrowserClient } from "@/lib/supabase/client";
import type { CcChatConversation } from "@/lib/supabase/types";
import { useActiveOrgId } from "@/lib/use-active-org";

/** How many past conversations the History list shows. */
const HISTORY_LIMIT = 25;

function derivePageContext(pathname: string): string {
  if (!pathname || pathname === "/") return "home";
  return pathname.replace(/^\/+/, "").split("/")[0] || "home";
}

export function ChatWidgetHost() {
  const [open, setOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string | null>(
    null,
  );
  const pathname = usePathname();
  // Single owner of the model selection — passed down to both the selector
  // and the chat panel so the dropdown choice actually reaches the request.
  const [model, setModel] = useSelectedModel();
  const pageContext = derivePageContext(pathname);

  const handleSelectConversation = React.useCallback((id: string) => {
    setConversationId(id);
    setHistoryOpen(false);
  }, []);

  const handleDeletedConversation = React.useCallback((id: string) => {
    // The thread on screen just went away — fall back to a fresh chat.
    setConversationId((current) => (current === id ? null : current));
  }, []);

  const handleNewChat = React.useCallback(() => {
    setConversationId(null);
    setHistoryOpen(false);
  }, []);

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
      <header className="flex h-12 items-center justify-between gap-2 border-b border-border bg-sidebar px-3">
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
            aria-label="Chat history"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((prev) => !prev)}
          >
            <History className="size-4" />
          </Button>
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

      <div className="relative flex-1 overflow-hidden">
        <ChatPanel
          pageContext={pageContext}
          model={model}
          conversationId={conversationId}
          onConversationChange={setConversationId}
          onNewChat={handleNewChat}
        />
        {historyOpen && (
          <ChatHistoryList
            activeConversationId={conversationId}
            onSelect={handleSelectConversation}
            onDeleted={handleDeletedConversation}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History list
// ---------------------------------------------------------------------------

type ChatHistoryListProps = {
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
};

/**
 * Overlay listing this user's recent conversations in this org. Mounted only
 * while open, so it re-queries on every open and never shows a stale list.
 */
function ChatHistoryList({
  activeConversationId,
  onSelect,
  onDeleted,
  onClose,
}: ChatHistoryListProps) {
  const orgId = useActiveOrgId();
  const { user } = useUser();
  const userId = user?.id ?? null;

  const [conversations, setConversations] = React.useState<
    CcChatConversation[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const supabase = createBrowserClient();
    void supabase
      .from("cc_chat_conversations")
      .select("*")
      .eq("org_id", orgId)
      .eq("clerk_user_id", userId)
      .order("last_message_at", { ascending: false })
      .limit(HISTORY_LIMIT)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[chat] failed to load history", error);
          setConversations([]);
          setLoading(false);
          return;
        }
        setConversations((data as CcChatConversation[] | null) ?? []);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orgId, userId]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      setConfirmingId(null);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      onDeleted(id);
      try {
        const supabase = createBrowserClient();
        // Messages cascade via the FK. The row is selected back because a
        // DELETE that RLS refuses matches zero rows and still reports success.
        const { data, error } = await supabase
          .from("cc_chat_conversations")
          .delete()
          .eq("id", id)
          .eq("org_id", orgId)
          .select("id");
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("delete was rejected (no rows matched)");
      } catch (err) {
        console.error("[chat] failed to delete conversation", err);
      }
    },
    [onDeleted, orgId],
  );

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          Recent chats
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close chat history"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading history…
          </p>
        ) : conversations.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No saved conversations yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {conversations.map((conversation) => (
              <li
                key={conversation.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-1 transition-colors hover:bg-brand-slate/60",
                  conversation.id === activeConversationId &&
                    "bg-brand-slate/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className="min-w-0 flex-1 rounded-md px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span className="block truncate text-sm text-foreground">
                    {conversation.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {relativeTime(conversation.last_message_at)}
                  </span>
                </button>

                {confirmingId === conversation.id ? (
                  <span className="flex shrink-0 items-center gap-1 pr-1">
                    <Button
                      type="button"
                      variant="destructive"
                      size="xs"
                      onClick={() => void handleDelete(conversation.id)}
                    >
                      Delete
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setConfirmingId(null)}
                    >
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete conversation ${conversation.title}`}
                    onClick={() => setConfirmingId(conversation.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Compact "3m ago" style stamp, falling back to a date past a month.
 * Only ever runs client-side (the list mounts on click), so there is no
 * hydration mismatch risk from reading the clock.
 */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
