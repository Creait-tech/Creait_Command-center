"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Message, MessageStatus } from "@/lib/supabase/types";
import { MessageRow } from "./message-row";
import { DraftReplyPanel } from "./draft-reply-panel";

type FilterKey = "all" | "linkedin" | "email" | "sms" | "dm" | "snoozed" | "archived";

const FILTER_PILLS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "dm", label: "DM" },
  { key: "snoozed", label: "Snoozed" },
  { key: "archived", label: "Archived" },
];

function applyFilter(messages: Message[], filter: FilterKey): Message[] {
  switch (filter) {
    case "all":
      return messages.filter((m) => m.status !== "snoozed" && m.status !== "archived");
    case "linkedin":
      return messages.filter((m) => m.source === "linkedin");
    case "email":
      return messages.filter((m) => m.source === "gmail" || m.source === "ghl_email");
    case "sms":
      return messages.filter((m) => m.source === "ghl_sms");
    case "dm":
      return messages.filter((m) => m.source === "ghl_dm");
    case "snoozed":
      return messages.filter((m) => m.status === "snoozed");
    case "archived":
      return messages.filter((m) => m.status === "archived");
  }
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function computeAnalytics(messages: Message[]) {
  const todayCount = messages.filter((m) => isToday(m.received_at)).length;
  const now = Date.now();
  const unreplied24h = messages.filter(
    (m) =>
      m.status !== "replied" &&
      m.status !== "archived" &&
      now - new Date(m.received_at).getTime() > 86_400_000,
  ).length;
  return { todayCount, unreplied24h };
}

export interface CommsLayoutProps {
  initialMessages: Message[];
  orgId: string;
}

function CommsLayoutInner({ initialMessages, orgId }: CommsLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedMsgId = searchParams.get("msg");

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    async function refetch() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("org_id", orgId)
        .order("priority_score", { ascending: false })
        .order("received_at", { ascending: false })
        .limit(200);
      if (data) setMessages(data as Message[]);
    }
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `org_id=eq.${orgId}` },
        refetch,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId]);

  const filtered = useMemo(() => applyFilter(messages, filter), [messages, filter]);
  const selectedMessage = useMemo(
    () => messages.find((m) => m.id === selectedMsgId) ?? null,
    [messages, selectedMsgId],
  );
  const analytics = useMemo(() => computeAnalytics(messages), [messages]);

  function selectMessage(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("msg", id);
    else params.delete("msg");
    router.replace(`/comms?${params.toString()}`, { scroll: false });
  }

  async function handleSelectMessage(msg: Message) {
    selectMessage(msg.id);
    if (msg.status === "unread") {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: "read" as MessageStatus } : m)),
      );
      const supabase = createClient();
      await supabase
        .from("messages")
        .update({ status: "read", updated_at: new Date().toISOString() })
        .eq("id", msg.id);
    }
  }

  const handleMessageUpdated = useCallback((updated: Message) => {
    setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }, []);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 text-center p-8">
        <Inbox className="size-10 text-muted-foreground" />
        <p className="text-sm font-medium">No messages yet</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Phase 3 will connect Gmail + GHL conversations. Once webhooks are live, messages appear here automatically.
        </p>
      </div>
    );
  }

  const listPane = (
    <div className="flex flex-col h-full">
      <div className="h-12 shrink-0 flex items-center gap-3 border-b border-border px-3">
        <span className="text-xs text-muted-foreground">
          Today: <span className="font-medium text-foreground">{analytics.todayCount}</span>
        </span>
        <span
          className={cn(
            "text-xs rounded-full px-2 py-0.5 font-medium",
            analytics.unreplied24h > 0
              ? "bg-[color:var(--color-brand-danger)]/10 text-[color:var(--color-brand-danger)]"
              : "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]",
          )}
        >
          Unreplied 24h+: {analytics.unreplied24h}
        </span>
      </div>
      <div className="h-10 shrink-0 flex items-center gap-1.5 border-b border-border px-3 overflow-x-auto">
        {FILTER_PILLS.map((pill) => (
          <button
            key={pill.key}
            type="button"
            onClick={() => setFilter(pill.key)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
              filter === pill.key
                ? "bg-[color:var(--color-brand-electric)] text-white"
                : "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)] hover:bg-[color:var(--color-brand-fog)]",
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
            No messages in this filter
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((msg) => (
              <MessageRow
                key={msg.id}
                message={msg}
                active={msg.id === selectedMsgId}
                onClick={() => handleSelectMessage(msg)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const detailPane = selectedMessage ? (
    <DraftReplyPanel message={selectedMessage} onMessageUpdated={handleMessageUpdated} />
  ) : (
    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-8">
      Select a message to view
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <div
        className={cn(
          "flex-col border-r border-border",
          selectedMsgId && isMobile ? "hidden" : "flex",
          "w-full md:w-[360px] md:flex md:shrink-0",
        )}
      >
        {listPane}
      </div>
      <div className="hidden md:flex flex-1 flex-col overflow-hidden">{detailPane}</div>
      <Sheet
        open={isMobile && !!selectedMessage}
        onOpenChange={(open) => {
          if (!open) selectMessage(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-full p-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>{selectedMessage?.contact_name ?? "Message"}</SheetTitle>
          </SheetHeader>
          {selectedMessage && (
            <DraftReplyPanel message={selectedMessage} onMessageUpdated={handleMessageUpdated} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function CommsLayout(props: CommsLayoutProps) {
  return (
    <Suspense fallback={null}>
      <CommsLayoutInner {...props} />
    </Suspense>
  );
}
