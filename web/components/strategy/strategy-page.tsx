"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FlywheelDiagram } from "./flywheel-diagram";
import { ValueLadder } from "./value-ladder";
import { AdvisorFeed } from "./advisor-feed";
import { MediaPlatforms } from "./media-platforms";
import { StrategicBets } from "./strategic-bets";
import type {
  Strategy,
  MediaPlatform,
  AdvisorInsight,
  StrategicBet,
} from "@/lib/supabase/types";

interface StrategyPageProps {
  strategy: Strategy | null;
  platforms: MediaPlatform[];
  insights: AdvisorInsight[];
  bets: StrategicBet[];
}

const SECTIONS = [
  { id: "flywheel", label: "Flywheel" },
  { id: "value-ladder", label: "Value Ladder" },
  { id: "advisor-insights", label: "Advisor Insights" },
  { id: "media-platforms", label: "Media Platforms" },
  { id: "strategic-bets", label: "Strategic Bets" },
] as const;

function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return "Never";
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function lastUpdated(items: { updated_at?: string; created_at?: string }[]): string {
  if (items.length === 0) return "Never";
  const stamps = items
    .map((i) => i.updated_at ?? i.created_at)
    .filter((s): s is string => Boolean(s))
    .map((s) => new Date(s).getTime())
    .filter((t) => !Number.isNaN(t));
  if (stamps.length === 0) return "Never";
  return formatTimestamp(new Date(Math.max(...stamps)).toISOString());
}

export function StrategyPage({
  strategy,
  platforms: initialPlatforms,
  insights: initialInsights,
  bets: initialBets,
}: StrategyPageProps) {
  const [strategyState, setStrategyState] = useState<Strategy | null>(strategy);
  const [platforms, setPlatforms] =
    useState<MediaPlatform[]>(initialPlatforms);
  const [insights, setInsights] =
    useState<AdvisorInsight[]>(initialInsights);
  const [bets, setBets] = useState<StrategicBet[]>(initialBets);
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);

  const observerRef = useRef<IntersectionObserver | null>(null);

  // Sticky sub-nav active highlighting via IntersectionObserver.
  useEffect(() => {
    const visible = new Map<string, number>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("id");
          if (!id) continue;
          if (entry.isIntersecting) {
            visible.set(id, entry.intersectionRatio);
          } else {
            visible.delete(id);
          }
        }
        let bestId: string | null = null;
        let bestRatio = -1;
        for (const [id, ratio] of visible) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestId) setActiveSection(bestId);
      },
      {
        // Trigger near the top of the viewport so a section becomes active as
        // its header crosses the sub-nav area.
        rootMargin: "-120px 0px -60% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      }
    );

    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  }

  function handleStrategyUpdated(next: Strategy) {
    setStrategyState(next);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Strategy</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The growth engine: flywheel, value ladder, advisor insight log,
          publishing footprint, and the strategic bets we are testing.
        </p>
      </div>

      {/* Sticky sub-nav */}
      <nav
        aria-label="Strategy sections"
        className="sticky top-0 z-20 -mx-6 px-6 py-2 bg-background/85 backdrop-blur border-b border-border"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {SECTIONS.map((s) => {
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                  isActive
                    ? "bg-[color:var(--color-brand-electric)]/15 text-[color:var(--color-brand-electric)] border-[color:var(--color-brand-electric)]/40"
                    : "bg-[color:var(--color-brand-slate)]/40 text-muted-foreground border-transparent hover:text-foreground hover:bg-[color:var(--color-brand-slate)]"
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Section: Flywheel */}
      <section id="flywheel" className="scroll-mt-28">
        <Card className="p-6 gap-4">
          <header className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-2xl font-bold">Flywheel</h2>
            <span className="text-xs text-muted-foreground">
              Last updated: {formatTimestamp(strategyState?.updated_at)}
            </span>
          </header>
          <FlywheelDiagram
            strategy={strategyState}
            onUpdated={handleStrategyUpdated}
          />
        </Card>
      </section>

      {/* Section: Value Ladder */}
      <section id="value-ladder" className="scroll-mt-28">
        <Card className="p-6 gap-4">
          <header className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-2xl font-bold">Value Ladder</h2>
            <span className="text-xs text-muted-foreground">
              Last updated: {formatTimestamp(strategyState?.updated_at)}
            </span>
          </header>
          <ValueLadder
            strategy={strategyState}
            onUpdated={handleStrategyUpdated}
          />
        </Card>
      </section>

      {/* Section: Advisor Insights */}
      <section id="advisor-insights" className="scroll-mt-28">
        <Card className="p-6 gap-4">
          <header className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-2xl font-bold">Advisor Insights</h2>
            <span className="text-xs text-muted-foreground">
              Last updated: {lastUpdated(insights)}
            </span>
          </header>
          <AdvisorFeed insights={insights} onChange={setInsights} />
        </Card>
      </section>

      {/* Section: Media Platforms */}
      <section id="media-platforms" className="scroll-mt-28">
        <Card className="p-6 gap-4">
          <header className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-2xl font-bold">Media Platforms</h2>
            <span className="text-xs text-muted-foreground">
              Last updated: {lastUpdated(platforms)}
            </span>
          </header>
          <MediaPlatforms platforms={platforms} onChange={setPlatforms} />
        </Card>
      </section>

      {/* Section: Strategic Bets */}
      <section id="strategic-bets" className="scroll-mt-28">
        <Card className="p-6 gap-4">
          <header className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-2xl font-bold">Strategic Bets</h2>
            <span className="text-xs text-muted-foreground">
              Last updated: {lastUpdated(bets)}
            </span>
          </header>
          <StrategicBets bets={bets} onChange={setBets} />
        </Card>
      </section>
    </div>
  );
}
