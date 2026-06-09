"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Mountain,
  MessageCircleQuestion,
  Eye,
  Heart,
  Target,
  Users,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Rock, IdsItem, Strategy } from "@/lib/supabase/types";

interface Props {
  thisQuarter: string;
  previousQuarter: string;
  thisRocks: Rock[];
  previousRocks: Rock[];
  longIssues: IdsItem[];
  strategy: Strategy | null;
}

interface Section {
  key: string;
  label: string;
  budget: string;
  icon: typeof Heart;
  description: string;
}

const SECTIONS: Section[] = [
  { key: "checkin", label: "Personal & Business Check-in", budget: "20 min", icon: Heart, description: "Each leader: 1 best personal news + 1 best business news of the quarter." },
  { key: "review", label: "Previous Quarter Rock Review", budget: "30 min", icon: CheckCircle2, description: "Each Rock: Done or Not Done. Target ≥ 80% completion. If lower, find the patterns." },
  { key: "vto", label: "V/TO Review", budget: "60 min", icon: Eye, description: "Walk Vision, Core Values, Core Focus, 10-Year Target, Marketing Strategy, 3-Year Picture, 1-Year Plan. Update anything stale." },
  { key: "scorecard", label: "EOS Tools Review", budget: "15 min", icon: Target, description: "Quick check on Accountability Chart, Scorecard, Meeting Pulse health." },
  { key: "issues", label: "Long-Term Issues Build & Solve", budget: "60 min", icon: MessageCircleQuestion, description: "Brainstorm 20-50 issues, no censoring. Then prioritize the 3-5 worth solving this quarter." },
  { key: "brainstorm", label: "Rock Brainstorm", budget: "30 min", icon: Lightbulb, description: "List EVERY potential Rock for next quarter. No filters. Get them all out." },
  { key: "narrow", label: "Narrow & SMART", budget: "60 min", icon: Mountain, description: "Keep/Kill/Combine. Land on 3-7 Company Rocks. Make each SMART. Assign one owner per Rock." },
  { key: "individual", label: "Individual Rocks", budget: "45 min", icon: Users, description: "Each leader picks 3-7 personal Rocks that support the Company Rocks." },
];

export function QuarterlyWalker({
  thisQuarter,
  previousQuarter,
  thisRocks,
  previousRocks,
  longIssues,
  strategy,
}: Props) {
  const [activeKey, setActiveKey] = useState("checkin");
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  function markDone(key: string) {
    setCompleted((p) => ({ ...p, [key]: !p[key] }));
  }

  const completedCount = Object.values(completed).filter(Boolean).length;
  const pct = Math.round((completedCount / SECTIONS.length) * 100);

  const prevComplete = previousRocks.filter((r) => r.status === "complete").length;
  const prevTotal = previousRocks.length;
  const prevCompletionPct = prevTotal === 0 ? 0 : Math.round((prevComplete / prevTotal) * 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* Sidebar: section list with progress */}
      <Card className="lg:sticky lg:top-20 h-fit">
        <CardContent className="pt-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{thisQuarter}</p>
            <p className="text-sm font-semibold mt-1">{completedCount}/{SECTIONS.length} sections · {pct}%</p>
          </div>
          <ul className="space-y-0.5">
            {SECTIONS.map((s) => {
              const isActive = activeKey === s.key;
              const isDone = completed[s.key];
              const Icon = s.icon;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => setActiveKey(s.key)}
                    className={cn(
                      "w-full flex items-start gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors",
                      isActive
                        ? "bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)]"
                        : isDone
                        ? "text-[color:var(--color-brand-mist)] line-through"
                        : "hover:bg-[color:var(--color-brand-slate)]/40",
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="size-3.5 mt-0.5 text-[color:var(--color-brand-success)] shrink-0" />
                    ) : (
                      <Icon className="size-3.5 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.label}</p>
                      <p className="text-[10px] opacity-60">{s.budget}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Active section */}
      <div className="space-y-4">
        {SECTIONS.filter((s) => s.key === activeKey).map((s) => (
          <Card key={s.key}>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.budget}</p>
                  <h2 className="text-xl font-bold mt-1">{s.label}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{s.description}</p>
                </div>
                <Button
                  variant={completed[s.key] ? "secondary" : "outline"}
                  onClick={() => markDone(s.key)}
                  size="sm"
                >
                  {completed[s.key] ? <><CheckCircle2 className="size-3.5" /> Done</> : <><Circle className="size-3.5" /> Mark done</>}
                </Button>
              </div>

              {/* Section-specific helpers */}
              {s.key === "review" && (
                <div className="space-y-3 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Previous quarter ({previousQuarter}): {prevTotal} Rocks
                    {prevTotal > 0 && (
                      <span className={cn(
                        "ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        prevCompletionPct >= 80 ? "bg-[color:var(--color-brand-success)]/20 text-[color:var(--color-brand-success)]" :
                        prevCompletionPct >= 50 ? "bg-[color:var(--color-brand-warning)]/20 text-[color:var(--color-brand-warning)]" :
                        "bg-[color:var(--color-brand-danger)]/20 text-[color:var(--color-brand-danger)]",
                      )}>
                        {prevCompletionPct}% complete
                      </span>
                    )}
                  </p>
                  {previousRocks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No Rocks recorded for {previousQuarter}.</p>
                  ) : (
                    <ul className="text-xs space-y-1.5">
                      {previousRocks.map((r) => (
                        <li key={r.id} className="flex items-center gap-2">
                          <span className={cn(
                            "size-2 rounded-full",
                            r.status === "complete" ? "bg-[color:var(--color-brand-success)]" :
                            r.status === "off_track" ? "bg-[color:var(--color-brand-warning)]" :
                            r.status === "incomplete" ? "bg-[color:var(--color-brand-danger)]" :
                            "bg-[color:var(--color-brand-fog)]",
                          )} />
                          <span className="flex-1">{r.title}</span>
                          <span className="text-[10px] uppercase text-muted-foreground">{r.status.replace("_", " ")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {s.key === "vto" && (
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Quick reference:</p>
                  <ul className="text-xs space-y-1">
                    <li>Mission: <span className="text-[color:var(--color-brand-mist)]">{strategy?.mission || "—"}</span></li>
                    <li>Vision: <span className="text-[color:var(--color-brand-mist)]">{strategy?.vision || "—"}</span></li>
                    <li>ICP: <span className="text-[color:var(--color-brand-mist)]">{strategy?.icp || "—"}</span></li>
                  </ul>
                  <Link href="/vision?view=vto" className="text-xs text-[color:var(--color-brand-electric)] hover:underline flex items-center gap-1 pt-1">
                    Open full V/TO Builder <ArrowRight className="size-3" />
                  </Link>
                </div>
              )}

              {s.key === "issues" && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium mb-2">Long-term issues currently parked ({longIssues.length})</p>
                  {longIssues.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">None. Brainstorm now — write everything that's blocking growth.</p>
                  ) : (
                    <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">
                      {longIssues.map((i) => (
                        <li key={i.id} className="flex items-start gap-2">
                          <span className="text-[color:var(--color-brand-warning)] shrink-0">P{i.priority}</span>
                          <span className="text-[color:var(--color-brand-mist)]">{i.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href="/level-10?tab=ids" className="text-xs text-[color:var(--color-brand-electric)] hover:underline flex items-center gap-1 mt-2">
                    Open Long-term Issues <ArrowRight className="size-3" />
                  </Link>
                </div>
              )}

              {s.key === "narrow" && (
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs font-medium">Current {thisQuarter} Rocks ({thisRocks.length})</p>
                  {thisRocks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">None set yet. Add them on /rocks as you finalize.</p>
                  ) : (
                    <ul className="text-xs space-y-1">
                      {thisRocks.map((r) => (
                        <li key={r.id}>{r.title}</li>
                      ))}
                    </ul>
                  )}
                  <Link href="/rocks" className="text-xs text-[color:var(--color-brand-electric)] hover:underline flex items-center gap-1 pt-1">
                    Add Rocks <ArrowRight className="size-3" />
                  </Link>
                </div>
              )}

              {/* Universal: notes capture */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <Textarea
                  value={notes[s.key] ?? ""}
                  onChange={(e) => setNotes((p) => ({ ...p, [s.key]: e.target.value }))}
                  placeholder="Capture decisions, insights, and action items from this section…"
                  className="min-h-20 text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Notes stay in this browser session for now. Copy-paste anything you want to keep into /vision V/TO or /rocks.
                </p>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const idx = SECTIONS.findIndex((x) => x.key === activeKey);
                    if (idx > 0) setActiveKey(SECTIONS[idx - 1].key);
                  }}
                  disabled={SECTIONS[0].key === activeKey}
                >
                  <ChevronRight className="size-3.5 rotate-180" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const idx = SECTIONS.findIndex((x) => x.key === activeKey);
                    if (idx < SECTIONS.length - 1) {
                      setCompleted((p) => ({ ...p, [activeKey]: true }));
                      setActiveKey(SECTIONS[idx + 1].key);
                    }
                  }}
                  disabled={SECTIONS[SECTIONS.length - 1].key === activeKey}
                >
                  Mark done & next
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
