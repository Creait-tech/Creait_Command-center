"use client";

import { useUser } from "@clerk/nextjs";
import { Plus, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserClient } from "@/lib/supabase/client";
import type { CcChatMessage } from "@/lib/supabase/types";
import { useActiveOrgId } from "@/lib/use-active-org";
import { cn } from "@/lib/utils";

export type ChatPanelProps = {
  pageContext: string;
  model: string;
  /**
   * Conversation being viewed. `null` = a brand-new chat that has not been
   * persisted yet; the first user message creates the row.
   */
  conversationId?: string | null;
  /** Fired once, with the new id, when a brand-new chat gets persisted. */
  onConversationChange?: (id: string) => void;
  /** Lets the parent drop its `conversationId` when "New chat" is clicked. */
  onNewChat?: () => void;
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

type ChatStatus = "ready" | "streaming" | "error";

/** Longest conversation title derived from a first message. */
const TITLE_MAX_LENGTH = 50;

/**
 * Suggested prompt pills shown above the input when the chat is empty.
 * Clicking a pill prefills the input — it does NOT auto-submit (Maurice
 * tweaks before sending).
 */
const SUGGESTED_PROMPTS: Record<string, string[]> = {
  "command-center": [
    "What goals are behind?",
    "Summarize this week",
    "Add a new goal",
  ],
  "level-10": ["What issues are unresolved?", "Draft meeting agenda"],
  comms: ["What should I reply to first?", "Summarize my inbox"],
  research: ["What's new in AI this week?", "Research [topic]"],
};

const DEFAULT_PROMPTS = [
  "Show me my company priorities",
  "What's on my plate today?",
];

export function ChatPanel({
  pageContext,
  model,
  conversationId = null,
  onConversationChange,
  onNewChat,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const orgId = useActiveOrgId();
  const { user } = useUser();
  const userId = user?.id ?? null;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  /**
   * The conversation actually being written to. Mirrors the `conversationId`
   * prop, but is also set locally the moment we create a brand-new row — that
   * lets the loader below tell "the parent picked a different thread" apart
   * from "we just told the parent about the thread we're already streaming
   * into", which must NOT trigger a reload.
   */
  const conversationIdRef = useRef<string | null>(conversationId);

  const prompts = useMemo(
    () => SUGGESTED_PROMPTS[pageContext] ?? DEFAULT_PROMPTS,
    [pageContext],
  );

  // Load a conversation's messages whenever the parent selects a different one.
  useEffect(() => {
    if (conversationId === conversationIdRef.current) return;
    conversationIdRef.current = conversationId;

    abortRef.current?.abort();
    setStatus("ready");
    setErrorMessage(null);

    if (!conversationId) {
      setMessages([]);
      setLoadingHistory(false);
      return;
    }

    let cancelled = false;
    setMessages([]);
    setLoadingHistory(true);

    const supabase = createBrowserClient();
    void supabase
      .from("cc_chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[chat] failed to load conversation", error);
          setLoadingHistory(false);
          return;
        }
        const rows = (data as CcChatMessage[] | null) ?? [];
        setMessages(
          rows.map((row) => ({
            id: row.id,
            role: row.role,
            text: row.content,
          })),
        );
        setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Auto-scroll to bottom on new content.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  // Cancel any in-flight stream when the panel unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === "streaming") return;

      const userMessage: ChatMessage = {
        id: makeId(),
        role: "user",
        text: trimmed,
      };
      const assistantMessage: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text: "",
      };

      const history = [...messages, userMessage];
      setMessages([...history, assistantMessage]);
      setInput("");
      setStatus("streaming");
      setErrorMessage(null);

      // Persist the user turn (creating the conversation if this is the first
      // message). Every write is best-effort — a Supabase failure logs and the
      // chat carries on unpersisted rather than breaking mid-conversation.
      let activeConversationId = conversationIdRef.current;
      try {
        const supabase = createBrowserClient();

        if (!activeConversationId && userId) {
          const { data, error } = await supabase
            .from("cc_chat_conversations")
            .insert({
              org_id: orgId,
              clerk_user_id: userId,
              title: deriveTitle(trimmed),
              page_context: pageContext,
              model,
            })
            .select("id")
            .single();
          if (error) throw error;
          const created = data as unknown as { id: string } | null;
          if (!created?.id) throw new Error("Conversation insert returned no id");

          activeConversationId = created.id;
          conversationIdRef.current = created.id;
          onConversationChange?.(created.id);
        }

        if (activeConversationId) {
          const { error } = await supabase.from("cc_chat_messages").insert({
            conversation_id: activeConversationId,
            org_id: orgId,
            role: "user",
            content: trimmed,
          });
          if (error) throw error;
        }
      } catch (err) {
        console.error("[chat] failed to persist user message", err);
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: history.map(toUIMessage),
            model,
            pageContext,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await readErrorMessage(res);
          throw new Error(errText);
        }
        if (!res.body) {
          throw new Error("Empty response body");
        }

        const assistantId = assistantMessage.id;
        let finalText = "";
        for await (const delta of readSseTextDeltas(res.body)) {
          finalText += delta;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, text: m.text + delta } : m,
            ),
          );
        }
        setStatus("ready");
        await persistAssistantTurn(activeConversationId, orgId, finalText);
      } catch (err) {
        if (controller.signal.aborted) {
          setStatus("ready");
          return;
        }
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        setErrorMessage(message);
        setStatus("error");
        // Drop the empty assistant placeholder on hard failure.
        setMessages((prev) => prev.filter((m) => m.id !== assistantMessage.id));
      }
    },
    [
      messages,
      model,
      onConversationChange,
      orgId,
      pageContext,
      status,
      userId,
    ],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void sendMessage(input);
    },
    [input, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  const handlePromptClick = useCallback((prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  }, []);

  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    conversationIdRef.current = null;
    setMessages([]);
    setInput("");
    setStatus("ready");
    setErrorMessage(null);
    setLoadingHistory(false);
    onNewChat?.();
  }, [onNewChat]);

  const lastMessage = messages[messages.length - 1];
  const showTypingIndicator =
    status === "streaming" &&
    lastMessage?.role === "assistant" &&
    lastMessage.text === "";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          Chat · {pageContext}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleNewChat}
          disabled={
            messages.length === 0 && status !== "error" && !conversationId
          }
        >
          <Plus />
          New chat
        </Button>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3"
        data-testid="chat-message-list"
      >
        {loadingHistory ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            Loading conversation…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            Ask anything about CREAIT.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {showTypingIndicator && <TypingIndicator />}
          </div>
        )}
      </div>

      {/* Error banner */}
      {status === "error" && errorMessage && (
        <div className="mx-3 mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Suggested prompts (empty state only) */}
      {messages.length === 0 && !loadingHistory && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handlePromptClick(prompt)}
              className="rounded-full border border-border bg-brand-slate/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-brand-slate hover:text-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-border p-2"
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything…"
          rows={1}
          className="min-h-9 max-h-40 resize-none"
          disabled={status === "streaming"}
        />
        <Button
          type="submit"
          size="icon-sm"
          disabled={status === "streaming" || input.trim().length === 0}
          aria-label="Send message"
        >
          <Send />
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
        isUser
          ? "self-end bg-brand-electric/20 text-foreground"
          : "self-start bg-brand-slate text-foreground",
      )}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap">{message.text}</p>
      ) : (
        <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_pre]:my-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.text || " "}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="self-start flex items-center gap-1 rounded-lg bg-brand-slate px-3 py-2">
      <span className="inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:0ms]" />
      <span className="inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
      <span className="inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

/**
 * Conversation title from the first user message: whitespace-collapsed and
 * capped at TITLE_MAX_LENGTH with an ellipsis when it had to be cut.
 */
function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  if (clean.length <= TITLE_MAX_LENGTH) return clean;
  return `${clean.slice(0, TITLE_MAX_LENGTH).trimEnd()}…`;
}

/**
 * Save the completed assistant turn and bump the conversation's recency
 * stamps. Best-effort: failures are logged, never surfaced to the user, and
 * never interrupt the conversation.
 */
async function persistAssistantTurn(
  conversationId: string | null,
  orgId: string,
  text: string,
): Promise<void> {
  if (!conversationId || !text) return;
  try {
    const supabase = createBrowserClient();
    const { error: insertError } = await supabase
      .from("cc_chat_messages")
      .insert({
        conversation_id: conversationId,
        org_id: orgId,
        role: "assistant",
        content: text,
      });
    if (insertError) throw insertError;

    const now = new Date().toISOString();
    // Selected back: a refused UPDATE matches zero rows and reports success.
    const { data: touched, error: updateError } = await supabase
      .from("cc_chat_conversations")
      .update({ last_message_at: now, updated_at: now })
      .eq("id", conversationId)
      .eq("org_id", orgId)
      .select("id");
    if (updateError) throw updateError;
    if (!touched || touched.length === 0) {
      throw new Error("conversation update was rejected (no rows matched)");
    }
  } catch (err) {
    console.error("[chat] failed to persist assistant message", err);
  }
}

/**
 * Convert local ChatMessage to a minimal AI SDK UIMessage shape — the server
 * uses `convertToModelMessages` to translate this to provider format.
 */
function toUIMessage(m: ChatMessage) {
  return {
    id: m.id,
    role: m.role,
    parts: [{ type: "text" as const, text: m.text }],
  };
}

/**
 * Pull a useful error message off a non-2xx fetch response.
 */
async function readErrorMessage(res: Response): Promise<string> {
  try {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = (await res.json()) as { error?: string };
      if (body.error) return body.error;
    } else {
      const text = await res.text();
      if (text) return text;
    }
  } catch {
    // fall through
  }
  return `Request failed (${res.status})`;
}

interface SseChunk {
  type?: string;
  delta?: string;
  errorText?: string;
}

/**
 * Async iterator over text deltas from the AI SDK UI message SSE stream.
 *
 * The server (`toUIMessageStreamResponse`) emits SSE lines of the form:
 *   data: {"type":"text-delta","id":"...","delta":"hi"}
 *   data: [DONE]
 *
 * We parse line-by-line, ignore non-text chunks, and yield the delta text.
 * If the stream emits an `error` chunk, we throw with its message.
 */
async function* readSseTextDeltas(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const rawLine = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const line = rawLine.replace(/\r$/, "").trim();
        if (line.length === 0 || !line.startsWith("data:")) continue;

        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;

        let chunk: SseChunk | null = null;
        try {
          chunk = JSON.parse(payload) as SseChunk;
        } catch {
          continue;
        }
        if (!chunk) continue;
        if (chunk.type === "text-delta" && typeof chunk.delta === "string") {
          yield chunk.delta;
        } else if (chunk.type === "error" && chunk.errorText) {
          throw new Error(chunk.errorText);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
