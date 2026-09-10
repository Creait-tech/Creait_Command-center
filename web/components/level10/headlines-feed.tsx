"use client";

import { useEffect, useState } from "react";
import { Megaphone, Users, Building2, Globe, Newspaper } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { cn } from "@/lib/utils";
import { AuthorStamp } from "@/components/authorship/author-stamp";
import { MeetingStamp } from "./meeting-titles";
import { asAuthoredRows, type AuthoredHeadline } from "@/lib/authorship";
import { createHeadline } from "@/lib/eos-actions";
import type { HeadlineCategory } from "@/lib/supabase/types";

interface Props {
  initialHeadlines: AuthoredHeadline[];
  /** Inside a meeting: capture against it and show only this meeting's
   *  headlines. Outside: the running list across every meeting. */
  meetingId: string | null;
  /** Rows to show outside a meeting. */
  limit?: number;
}

const CATEGORIES: Array<{ value: HeadlineCategory; label: string; icon: typeof Users }> = [
  { value: "customer", label: "Customer", icon: Building2 },
  { value: "employee", label: "Employee", icon: Users },
  { value: "market", label: "Market", icon: Globe },
  { value: "general", label: "General", icon: Newspaper },
];

function categoryMeta(c: HeadlineCategory) {
  return CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[3];
}

function sort(rows: AuthoredHeadline[]): AuthoredHeadline[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Customer and employee headlines: one-sentence updates, tagged, with the
 * cascade flag for anything the whole company needs to hear. The same
 * component runs the Headlines section of a meeting and the Headlines tab
 * on the Level 10 page, so nothing captured in the room is trapped there.
 */
export function HeadlinesFeed({ initialHeadlines, meetingId, limit = 50 }: Props) {
  const orgId = useActiveOrgId();
  const [headlines, setHeadlines] = useState<AuthoredHeadline[]>(sort(initialHeadlines));
  const [text, setText] = useState("");
  const [category, setCategory] = useState<HeadlineCategory>("customer");
  const [cascade, setCascade] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    async function refetch() {
      let query = supabase.from("cc_headlines").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
      query = meetingId ? query.eq("meeting_id", meetingId) : query.limit(limit);
      const { data } = await query;
      if (data) setHeadlines(sort(asAuthoredRows<AuthoredHeadline>(data)));
    }
    const channel = supabase
      .channel(`headlines-realtime-${meetingId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cc_headlines", filter: `org_id=eq.${orgId}` }, refetch)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, meetingId, limit]);

  async function add() {
    if (!text.trim()) return;
    setSubmitting(true);
    const result = await createHeadline({ text, category, cascade, meetingId });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setHeadlines((prev) => sort([result.data, ...prev.filter((h) => h.id !== result.data.id)]));
    setText("");
    setCascade(false);
    toast.success(cascade ? "Headline captured — marked to cascade" : "Headline captured");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Select value={category} onValueChange={(v) => typeof v === "string" && setCategory(v as HeadlineCategory)}>
          <SelectTrigger className="md:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="flex-1"
          placeholder="One sentence. If it needs discussion, it's an Issue."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void add();
            }
          }}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
          <Checkbox checked={cascade} onCheckedChange={(v) => setCascade(v === true)} />
          Cascade
        </label>
        <Button onClick={() => void add()} disabled={submitting || !text.trim()}>
          Add
        </Button>
      </div>

      {headlines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-brand-fog)] flex flex-col items-center justify-center py-10 text-center">
          <Megaphone className="size-8 text-[color:var(--color-brand-mist)] mb-2" />
          <p className="text-sm font-medium">No headlines yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Customer and employee news in one sentence each. Good, bad, or just worth knowing.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {headlines.map((h) => {
            const meta = categoryMeta(h.category);
            const Icon = meta.icon;
            return (
              <li key={h.id} className="px-3 py-2.5 flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider shrink-0",
                    h.category === "customer" && "bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)]",
                    h.category === "employee" && "bg-[color:var(--color-brand-success)]/15 text-[color:var(--color-brand-success)]",
                    h.category === "market" && "bg-[color:var(--color-brand-warning)]/15 text-[color:var(--color-brand-warning)]",
                    h.category === "general" && "bg-[color:var(--color-brand-slate)] text-[color:var(--color-brand-mist)]",
                  )}
                >
                  <Icon className="size-3" />
                  {meta.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{h.text}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {h.cascade && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--color-brand-warning)]">
                        <Megaphone className="size-3" /> Cascade to the team
                      </span>
                    )}
                    <MeetingStamp meetingId={h.meeting_id} />
                    <AuthorStamp name={h.created_by_name} actorId={h.created_by} at={h.created_at} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
