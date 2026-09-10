"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarClock, Archive, Bot, Sparkles, CheckCheck, Loader } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { cn } from "@/lib/utils";
import type { Message, MessageStatus, MessageSource } from "@/lib/supabase/types";

const SOURCE_LABELS: Record<MessageSource, string> = {
  linkedin: "LinkedIn",
  gmail: "Gmail",
  ghl_email: "GHL Email",
  ghl_sms: "SMS",
  ghl_dm: "GHL DM",
  other: "Other",
};

const SOURCE_COLORS: Record<MessageSource, string> = {
  linkedin: "bg-[color:var(--color-brand-electric)]/10 text-[color:var(--color-brand-electric)]",
  gmail: "bg-[color:var(--color-brand-danger)]/10 text-[color:var(--color-brand-danger)]",
  ghl_email: "bg-[color:var(--color-brand-aqua)]/10 text-[color:var(--color-brand-aqua)]",
  ghl_sms: "bg-[color:var(--color-brand-success)]/10 text-[color:var(--color-brand-success)]",
  ghl_dm: "bg-[color:var(--color-brand-violet)]/10 text-[color:var(--color-brand-violet)]",
  other: "bg-[color:var(--color-brand-fog)]/40 text-[color:var(--color-brand-mist)]",
};

const SNOOZE_OPTIONS = ["1 hour", "4 hours", "Tomorrow 9am", "Next Monday 9am"];

/** Response shapes returned by POST /api/comms/send. */
type SendResponse =
  | { ok: true; channel: MessageSource }
  | { ok: false; needsSetup?: "gmail" | "linkedin"; message: string }
  | { error: string };

export interface DraftReplyPanelProps {
  message: Message;
  onMessageUpdated: (updated: Message) => void;
}

export function DraftReplyPanel({ message, onMessageUpdated }: DraftReplyPanelProps) {
  const orgId = useActiveOrgId();
  const [draftText, setDraftText] = useState(message.draft_reply ?? "");
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [skillId, setSkillId] = useState<string | null>(null);

  useEffect(() => {
    setDraftText(message.draft_reply ?? "");
  }, [message.id, message.draft_reply]);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("skills")
      .select("id")
      .or("name.eq.Draft Message Reply,name.eq.Draft Reply")
      .eq("org_id", orgId)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setSkillId((data[0] as { id: string }).id);
      });
  }, [orgId]);

  const updateStatus = useCallback(
    async (status: MessageStatus, extra: Partial<Message> = {}) => {
      const supabase = createClient();
      const now = new Date().toISOString();
      const update = { status, updated_at: now, ...extra };
      // Select the row back: a refused UPDATE matches zero rows and still
      // reports success.
      const { data, error } = await supabase
        .from("messages")
        .update(update)
        .eq("id", message.id)
        .eq("org_id", orgId)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("The change was rejected");
      onMessageUpdated({ ...message, ...update } as Message);
    },
    [message, onMessageUpdated, orgId],
  );

  async function handleSnooze(label: string) {
    setActionLoading(true);
    try {
      await updateStatus("snoozed");
      toast.success(`Snoozed until ${label}`);
    } catch {
      toast.error("Failed to snooze");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleArchive() {
    setActionLoading(true);
    try {
      await updateStatus("archived");
      toast.success("Archived");
    } catch {
      toast.error("Failed to archive");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleGenerateDraft() {
    if (!skillId) {
      toast.error("Draft Reply skill not found");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/skills/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId, input: { message } }),
      });
      const json = (await res.json()) as { output?: string; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Skill run failed");
      const draft = (json.output ?? "").trim();
      setDraftText(draft);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("messages")
        .update({ draft_reply: draft, updated_at: new Date().toISOString() })
        .eq("id", message.id)
        .eq("org_id", orgId)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("Draft generated but couldn't be saved — the change was rejected");
      onMessageUpdated({ ...message, draft_reply: draft });
      toast.success("Draft generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveDraft() {
    setActionLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("messages")
        .update({ draft_reply: draftText, updated_at: new Date().toISOString() })
        .eq("id", message.id)
        .eq("org_id", orgId)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("Couldn't save the draft — the change was rejected");
      onMessageUpdated({ ...message, draft_reply: draftText });
      toast.success("Draft saved");
    } catch {
      toast.error("Save failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSend() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/comms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id, replyText: draftText }),
      });
      const json = (await res.json()) as SendResponse;

      // Transport-level / validation failures (non-2xx with { error })
      if (!res.ok || "error" in json) {
        const errMessage =
          "error" in json ? json.error : "Failed to send reply";
        toast.error(errMessage);
        return;
      }

      if (json.ok) {
        const now = new Date().toISOString();
        // Reflect the send locally — the server already persisted this.
        onMessageUpdated({
          ...message,
          status: "replied",
          draft_reply: draftText,
          replied_at: now,
          updated_at: now,
        });
        toast.success(`Sent via ${SOURCE_LABELS[json.channel]}`);
        return;
      }

      // ok: false — either a known-not-configured channel or no send path.
      if (json.needsSetup) {
        toast.warning(json.message);
      } else {
        toast.error(json.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="h-14 shrink-0 flex items-center justify-between gap-3 border-b border-border px-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{message.contact_name ?? "Unknown"}</p>
            {message.contact_handle && (
              <p className="text-xs text-muted-foreground truncate">{message.contact_handle}</p>
            )}
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              SOURCE_COLORS[message.source],
            )}
          >
            {SOURCE_LABELS[message.source]}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" size="icon" aria-label="Snooze">
                <CalendarClock className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SNOOZE_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt} onClick={() => handleSnooze(opt)}>
                  {opt}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" aria-label="Archive" disabled={actionLoading} onClick={handleArchive}>
            <Archive className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delegate"
            onClick={() => toast.info("Delegate ships Phase 3")}
          >
            <Bot className="size-4" />
          </Button>
        </div>
      </div>

      {message.subject && (
        <div className="px-4 pt-3">
          <p className="text-sm font-medium">{message.subject}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.body ?? <em className="text-muted-foreground">No content</em>}
        </p>
      </div>

      <div className="shrink-0 border-t border-border px-4 pt-3 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Draft Reply</p>
          {!draftText && !generating && (
            <Button variant="secondary" size="sm" onClick={handleGenerateDraft} disabled={!skillId}>
              <Sparkles className="size-3.5" />
              Generate
            </Button>
          )}
        </div>
        {generating ? (
          <div className="min-h-16 rounded-lg border border-dashed border-[color:var(--color-brand-fog)] flex items-center justify-center text-xs text-muted-foreground gap-2">
            <Loader className="size-3.5 animate-spin" />
            Generating draft…
          </div>
        ) : draftText ? (
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Write your reply…"
            className="min-h-24 resize-none"
          />
        ) : (
          <div className="min-h-16 rounded-lg border border-dashed border-[color:var(--color-brand-fog)] flex items-center justify-center text-xs text-muted-foreground">
            No draft — generate with AI or write manually
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleSaveDraft} disabled={actionLoading || !draftText.trim()}>
            Save Draft
          </Button>
          <Button size="sm" className="flex-1" onClick={handleSend} disabled={actionLoading || !draftText.trim()}>
            <CheckCheck className="size-3.5" />
            Approve & Send
          </Button>
        </div>
      </div>
    </div>
  );
}
