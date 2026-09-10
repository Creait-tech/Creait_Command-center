"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Cast for React-Markdown 10 + React 19 type friction
const MarkdownComponent = Markdown as unknown as React.ComponentType<{
  children: string;
  remarkPlugins?: unknown[];
  components?: Components;
}>;
import { Send, Loader2, Wrench, User, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { WorkspaceProject, WorkspaceMessage, WorkspaceMessageRole } from "@/lib/supabase/types";

interface Props {
  project: WorkspaceProject;
}

interface UiMessage {
  id: string;
  role: WorkspaceMessageRole;
  content: string;
  tool_calls?: unknown;
  pending?: boolean;
}

export function ProjectChat({ project }: Props) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load history when project changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    const supabase = createClient();
    void supabase
      .from("cc_workspace_messages")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true })
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error(error.message);
          setLoading(false);
          return;
        }
        const rows = (data as WorkspaceMessage[] | null) ?? [];
        setMessages(
          rows.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            tool_calls: m.tool_calls ?? undefined,
          })),
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  // Autoscroll to bottom on new message
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");

    const userMsg: UiMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: text,
    };
    const placeholderId = `local-asst-${Date.now()}`;
    const placeholderMsg: UiMessage = {
      id: placeholderId,
      role: "assistant",
      content: "",
      pending: true,
    };
    setMessages((prev) => [...prev, userMsg, placeholderMsg]);

    // Persist user message
    const supabase = createClient();
    await supabase.from("cc_workspace_messages").insert({
      project_id: project.id,
      role: "user",
      content: text,
    });

    // Build payload — full prior turns + new user message
    const priorMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    const allMessages = [...priorMessages, { role: "user", content: text }];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages,
          model: project.preferred_model,
          pageContext: `workspace:${project.name}`,
          systemPrompt: project.system_prompt ?? undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
      }

      // Stream response from AI SDK
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // AI SDK v6 data stream: lines like 0:"text" for text-delta
          for (const line of chunk.split("\n")) {
            if (!line.trim()) continue;
            // Try a few shapes — text-delta JSON, or just append raw chunk
            const m = line.match(/^0:"((?:\\.|[^"\\])*)"$/);
            if (m) {
              try {
                const decoded = JSON.parse(`"${m[1]}"`);
                assistantText += decoded;
              } catch {
                assistantText += m[1];
              }
            } else if (line.startsWith("data: ")) {
              const payload = line.slice(6);
              if (payload === "[DONE]") continue;
              try {
                const obj = JSON.parse(payload);
                if (typeof obj === "string") assistantText += obj;
                else if (typeof obj?.delta === "string") assistantText += obj.delta;
                else if (typeof obj?.content === "string") assistantText += obj.content;
              } catch {
                // not JSON; ignore
              }
            }
            // Live update
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId ? { ...m, content: assistantText, pending: true } : m,
              ),
            );
          }
        }
      }

      // Finalize
      setMessages((prev) =>
        prev.map((m) => (m.id === placeholderId ? { ...m, content: assistantText, pending: false } : m)),
      );

      await supabase.from("cc_workspace_messages").insert({
        project_id: project.id,
        role: "assistant",
        content: assistantText,
        model: project.preferred_model,
      });
      // Bookkeeping touch; selected back because a refused UPDATE matches zero
      // rows and reports success. The reply already rendered, so a rejected
      // touch is logged rather than shown as a failed answer.
      const { data: touched, error: touchError } = await supabase
        .from("cc_workspace_projects")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", project.id)
        .select("id");
      if (touchError || !touched || touched.length === 0) {
        console.error("[workspace] failed to touch project", touchError?.message ?? "no rows matched");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? { ...m, content: `_Error: ${message}_`, pending: false }
            : m,
        ),
      );
      toast.error(message);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, project]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="px-4 py-6 max-w-3xl mx-auto space-y-4">
          {loading ? (
            <div className="text-center text-xs text-muted-foreground py-8">Loading conversation…</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Sparkles className="size-10 mx-auto text-[color:var(--color-brand-electric)]" />
              <p className="text-sm font-medium">Fresh thread in {project.name}</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Ask anything. The AI has tools to read/write your Command Center, query GHL, search your second brain, and remember things across sessions.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                {[
                  "show me my dashboard",
                  "what's overdue?",
                  "draft a reply to my top unanswered message",
                  "remember this for next time:",
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s + " ")}
                    className="text-[11px] text-muted-foreground border border-border rounded-full px-3 py-1 hover:border-[color:var(--color-brand-electric)] hover:text-[color:var(--color-brand-electric)] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border bg-[color:var(--color-brand-ink)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${project.name}…  (Enter to send, Shift+Enter for newline)`}
            className="min-h-12 max-h-48 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || !input.trim()}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-center text-muted-foreground pb-2">
          Model: {project.preferred_model} · Tools: 26 MCP tools available
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "")}>
      {!isUser && (
        <div className="size-7 shrink-0 rounded-full bg-[color:var(--color-brand-electric)]/15 flex items-center justify-center mt-1">
          <Sparkles className="size-3.5 text-[color:var(--color-brand-electric)]" />
        </div>
      )}
      <div
        className={cn(
          "rounded-xl px-4 py-2.5 max-w-[80%]",
          isUser
            ? "bg-[color:var(--color-brand-electric)] text-white"
            : "bg-[color:var(--color-brand-slate)]/60 text-foreground",
        )}
      >
        {message.role === "assistant" && message.pending && !message.content && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
        {message.content && (
          <div className={cn("prose prose-sm max-w-none", !isUser && "prose-invert")}>
            <MarkdownComponent remarkPlugins={[remarkGfm]}>{message.content}</MarkdownComponent>
          </div>
        )}
        {Array.isArray(message.tool_calls) && (message.tool_calls as unknown[]).length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground flex items-center gap-1">
            <Wrench className="size-3" />
            {(message.tool_calls as unknown[]).length} tool
            {(message.tool_calls as unknown[]).length !== 1 ? "s" : ""} called
          </div>
        )}
      </div>
      {isUser && (
        <div className="size-7 shrink-0 rounded-full bg-[color:var(--color-brand-slate)] flex items-center justify-center mt-1">
          <User className="size-3.5 text-[color:var(--color-brand-mist)]" />
        </div>
      )}
    </div>
  );
}
