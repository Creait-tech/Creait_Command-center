"use client";

/**
 * Present mode — the screen-share deck for the results session.
 *
 * Six full-screen frames the facilitator steps through at the moments the
 * Facilitator Guide marks for a reveal: where the score sits on the ladder,
 * the three pillars, the owner's own words against the evidence, what the
 * findings are worth, the next ninety days. Each is one idea and one exhibit,
 * so it can be put on screen for a minute and taken off again — a pattern
 * interrupt, not a slideshow.
 *
 * Every number here is the report's number: the page that renders this deck
 * builds the data with the same computeScores / widenOpportunities /
 * portfolioTotals calls the Executive Blueprint uses, so nothing on screen can
 * disagree with the document that follows. A draft engagement says so on every
 * frame.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from "lucide-react";

import { BANDS } from "@/lib/assessment-instrument";
import { cn } from "@/lib/utils";

export interface PresentPillar {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  scored: number;
  thin: boolean;
}

export interface PresentOpportunity {
  title: string;
  low: number | null;
  expected: number | null;
  high: number | null;
}

export interface PresentData {
  id: string;
  company: string;
  client: string;
  date: string;
  isPractice: boolean;
  isDraft: boolean;
  resolved: number;
  score: number | null;
  band: string | null;
  pillars: PresentPillar[];
  ownerBelief: string | null;
  constraint: string | null;
  constraintCost: string | null;
  opportunities: PresentOpportunity[];
  portfolioExpected: number;
  portfolioLow: number;
  portfolioHigh: number;
  overlapFactor: number;
  plan: string[];
}

const INK = "#f1f5f9";
const MUTED = "#94a3b8";
const ELECTRIC = "#3b82f6";
const GLOW = "#60a5fa";
const RAIL = "#1a2235";

/** Five band steps of one hue, dark to bright, so the ladder reads in one glance. */
const BAND_FILL = ["#1e3a8a", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa"];

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(Math.round((n / 1_000_000) * 10) / 10).toLocaleString("en-US")}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000).toLocaleString("en-US")}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function moneyExact(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

// ── Exhibits ────────────────────────────────────────────────────────────────

export function ScoreLadder({ score }: { score: number | null }) {
  const W = 1000;
  const H = 150;
  const seg = W / BANDS.length;
  const activeIdx =
    score === null ? -1 : Math.max(0, BANDS.findIndex((b) => score <= b.max));
  const x = score === null ? 0 : (Math.min(100, Math.max(0, score)) / 100) * W;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full"
      role="img"
      aria-label={
        score === null
          ? "The five maturity bands, no score yet"
          : `CREAiT Score ${score} of 100, in the ${BANDS[activeIdx].label} band`
      }
    >
      {BANDS.map((band, i) => {
        const active = i === activeIdx;
        return (
          <g key={band.label}>
            <rect
              x={i * seg + 2}
              y={54}
              width={seg - 4}
              height={active ? 34 : 22}
              rx={4}
              fill={BAND_FILL[i]}
              opacity={activeIdx === -1 || active ? 1 : 0.45}
            />
            <text
              x={i * seg + seg / 2}
              y={118}
              textAnchor="middle"
              fontSize={active ? 22 : 18}
              fontWeight={active ? 700 : 500}
              fill={active ? INK : MUTED}
            >
              {band.label}
            </text>
            <text
              x={i * seg + seg / 2}
              y={142}
              textAnchor="middle"
              fontSize={14}
              fill={MUTED}
            >
              {i === 0 ? 0 : BANDS[i - 1].max + 1}–{band.max}
            </text>
          </g>
        );
      })}
      {score !== null && (
        <g>
          <line x1={x} x2={x} y1={30} y2={96} stroke={INK} strokeWidth={3} />
          <circle cx={x} cy={26} r={9} fill={INK} />
          <circle cx={x} cy={26} r={4} fill={ELECTRIC} />
        </g>
      )}
    </svg>
  );
}

export function PillarBarsDark({ pillars }: { pillars: PresentPillar[] }) {
  const W = 1000;
  const ROW = 96;
  const LABEL = 300;
  const TRACK = W - LABEL - 90;
  const H = pillars.length * ROW;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full"
      role="img"
      aria-label={pillars
        .map((p) =>
          p.thin || p.score === null
            ? `${p.label}: insufficient data, ${p.scored} of 10 examined`
            : `${p.label}: ${p.score} of 100`
        )
        .join(". ")}
    >
      {pillars.map((p, i) => {
        const y = i * ROW + 20;
        const readable = !p.thin && p.score !== null;
        const w = readable ? (Math.min(100, p.score!) / 100) * TRACK : 0;
        return (
          <g key={p.key}>
            <text x={0} y={y + 30} fontSize={26} fontWeight={600} fill={INK}>
              {p.label}
            </text>
            <text x={0} y={y + 56} fontSize={15} fill={MUTED}>
              {Math.round(p.weight * 100)}% of the score · {p.scored} of 10 examined
            </text>
            <rect x={LABEL} y={y + 14} width={TRACK} height={26} rx={6} fill={RAIL} />
            {readable ? (
              <rect x={LABEL} y={y + 14} width={w} height={26} rx={6} fill={ELECTRIC} />
            ) : (
              <text
                x={LABEL + 12}
                y={y + 33}
                fontSize={15}
                fill={MUTED}
                fontStyle="italic"
              >
                not enough examined to state a number
              </text>
            )}
            <text
              x={LABEL + TRACK + 16}
              y={y + 36}
              fontSize={34}
              fontWeight={700}
              fill={readable ? INK : MUTED}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {readable ? p.score : "—"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function RangeBars({ rows }: { rows: PresentOpportunity[] }) {
  const W = 1000;
  const ROW = 78;
  const LABEL = 380;
  const TRACK = W - LABEL - 110;
  const H = rows.length * ROW;
  const max = Math.max(1, ...rows.map((r) => r.high ?? r.expected ?? 0));
  const x = (v: number) => LABEL + (Math.max(0, v) / max) * TRACK;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full"
      role="img"
      aria-label={rows
        .map((r) => `${r.title}: ${money(r.low)} to ${money(r.high)}, expected ${money(r.expected)}`)
        .join(". ")}
    >
      {rows.map((r, i) => {
        const y = i * ROW + 14;
        const lo = r.low ?? r.expected ?? 0;
        const hi = r.high ?? r.expected ?? 0;
        const ex = r.expected ?? lo;
        return (
          <g key={`${i}-${r.title}`}>
            <text x={0} y={y + 26} fontSize={20} fontWeight={500} fill={INK}>
              {r.title.length > 42 ? `${r.title.slice(0, 41)}…` : r.title}
            </text>
            <rect x={LABEL} y={y + 12} width={TRACK} height={22} rx={5} fill={RAIL} />
            <rect
              x={x(lo)}
              y={y + 12}
              width={Math.max(4, x(hi) - x(lo))}
              height={22}
              rx={5}
              fill={ELECTRIC}
              opacity={0.45}
            />
            <rect x={x(ex) - 3} y={y + 6} width={6} height={34} rx={2} fill={GLOW} />
            <text
              x={LABEL + TRACK + 14}
              y={y + 30}
              fontSize={24}
              fontWeight={700}
              fill={INK}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {money(ex)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function PlanTimeline({ items }: { items: string[] }) {
  const shown = items.slice(0, 3);
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {shown.map((item, i) => (
        <div
          key={`${i}-${item}`}
          className="relative rounded-2xl bg-[color:var(--color-brand-slate)]/70 p-7 ring-1 ring-inset ring-white/10"
        >
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-brand-aqua)]">
            Days {i * 30 + 1}–{(i + 1) * 30}
          </p>
          <p className="mt-3 text-[24px] font-medium leading-snug text-white">
            {item}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Frames ──────────────────────────────────────────────────────────────────

function Frame({
  kicker,
  title,
  children,
  footnote,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
  footnote?: string;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1180px] flex-col justify-center gap-8 px-10 py-16">
      <div>
        <p className="text-[14px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-brand-electric-glow)]">
          {kicker}
        </p>
        <h2 className="mt-2 text-[clamp(30px,4.2vw,52px)] font-bold leading-[1.05] tracking-tight text-white [text-wrap:balance]">
          {title}
        </h2>
      </div>
      <div>{children}</div>
      {footnote && (
        <p className="max-w-[80ch] text-[15px] leading-relaxed text-[color:var(--color-brand-mist)]">
          {footnote}
        </p>
      )}
    </div>
  );
}

/** Exported so a script can render every frame, not only the one on screen. */
export function buildFrames(d: PresentData): Array<{ id: string; label: string; node: ReactNode }> {
  const included = d.opportunities.slice(0, 6);
  const frames = [
    {
      id: "cover",
      label: "Cover",
      node: (
        <div className="mx-auto flex h-full w-full max-w-[1180px] flex-col justify-center px-10 py-16">
          <p className="text-[15px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-brand-electric-glow)]">
            CREAiT Growth &amp; AI Diagnostic
          </p>
          <h1 className="mt-4 text-[clamp(44px,6.5vw,88px)] font-bold leading-[0.98] tracking-tight text-white [text-wrap:balance]">
            {d.company}
          </h1>
          <p className="mt-6 text-[clamp(18px,2vw,26px)] text-[color:var(--color-brand-mist)]">
            Results session with {d.client} · {d.date}
          </p>
        </div>
      ),
    },
    {
      id: "score",
      label: "Where you are",
      node: (
        <Frame
          kicker="Where you are"
          title={
            d.score === null
              ? "The score is not stated yet"
              : `${d.band} — ${d.score} of 100`
          }
          footnote={`Scored from ${d.resolved} of 30 indicators. The bands run Reactive, Stabilizing, Building, Scaling, Self-Running; the score is where the evidence puts the business today, not a grade.`}
        >
          <div className="flex flex-wrap items-end gap-10">
            <div>
              <span
                className="block text-[clamp(96px,14vw,180px)] font-extrabold leading-none tracking-tight text-white"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {d.score ?? "—"}
              </span>
              <span className="mt-1 block text-[16px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-brand-mist)]">
                CREAiT Score
              </span>
            </div>
            <div className="min-w-0 flex-1 basis-[520px]">
              <ScoreLadder score={d.score} />
            </div>
          </div>
        </Frame>
      ),
    },
    {
      id: "pillars",
      label: "Three pillars",
      node: (
        <Frame
          kicker="Three pillars"
          title="Profit, Systems and Leverage — each one on its own"
          footnote="A pillar with fewer than four of its ten indicators examined is shown as insufficient data and carries no weight in the score. Nothing here is averaged away."
        >
          <PillarBarsDark pillars={d.pillars} />
        </Frame>
      ),
    },
    {
      id: "mirror",
      label: "Your words",
      node: (
        <Frame
          kicker="The mirror"
          title="What you told us, and what the evidence says"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-[color:var(--color-brand-slate)]/70 p-8 ring-1 ring-inset ring-white/10">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-brand-mist)]">
                You said the bottleneck was
              </p>
              <p className="mt-4 text-[clamp(22px,2.4vw,32px)] font-medium leading-snug text-white">
                {d.ownerBelief ? `“${d.ownerBelief}”` : "— not captured —"}
              </p>
            </div>
            <div className="rounded-2xl bg-[color:var(--color-brand-electric)]/12 p-8 ring-1 ring-inset ring-[color:var(--color-brand-electric)]/40">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-brand-electric-glow)]">
                The evidence points at
              </p>
              <p className="mt-4 text-[clamp(22px,2.4vw,32px)] font-medium leading-snug text-white">
                {d.constraint ?? "— not named yet —"}
              </p>
              {d.constraintCost && (
                <p className="mt-5 text-[17px] leading-relaxed text-[color:var(--color-brand-mist)]">
                  What it costs a year: {d.constraintCost}
                </p>
              )}
            </div>
          </div>
        </Frame>
      ),
    },
    {
      id: "worth",
      label: "What it's worth",
      node: (
        <Frame
          kicker="What the findings are worth"
          title={
            d.portfolioExpected > 0
              ? `${moneyExact(d.portfolioExpected)} a year, expected`
              : "No priced finding yet"
          }
          footnote={
            included.length > 1
              ? `Ranges, not points: the bar is low to high, the marker is expected. The total is overlap-adjusted at ${Math.round(d.overlapFactor * 100)}% because findings share the same customers and hours — the raw sum is never the number. Range on the total: ${money(d.portfolioLow)} to ${money(d.portfolioHigh)}.`
              : undefined
          }
        >
          {included.length > 0 ? (
            <RangeBars rows={included} />
          ) : (
            <p className="text-[20px] text-[color:var(--color-brand-mist)]">
              Price the findings in the workbench and this frame fills in.
            </p>
          )}
        </Frame>
      ),
    },
    {
      id: "plan",
      label: "Next 90 days",
      node: (
        <Frame
          kicker="The next ninety days"
          title={d.plan.length > 0 ? "Three things, in order" : "The plan is still being written"}
          footnote={
            d.plan.length > 3
              ? `${d.plan.length - 3} more after these. First things first.`
              : undefined
          }
        >
          {d.plan.length > 0 ? (
            <PlanTimeline items={d.plan} />
          ) : (
            <p className="text-[20px] text-[color:var(--color-brand-mist)]">
              Add the 90-day priorities in the workbench.
            </p>
          )}
        </Frame>
      ),
    },
  ];
  return frames;
}

// ── The deck ────────────────────────────────────────────────────────────────

export function PresentDeck({ data }: { data: PresentData }) {
  const frames = buildFrames(data);
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const last = frames.length - 1;

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(last, Math.max(0, i + delta))),
    [last]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") {
        setIndex(0);
      } else if (e.key === "End") {
        setIndex(last);
      } else if (e.key.toLowerCase() === "f") {
        void toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, last]);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* the browser said no — the deck still works in a window */
    }
  }

  const frame = frames[index];

  return (
    <div
      className="relative flex h-dvh w-full flex-col overflow-hidden bg-[color:var(--color-brand-ink)] text-white"
      style={{ colorScheme: "dark" }}
    >
      {data.isPractice && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
        >
          <span className="rotate-[-24deg] select-none text-[12rem] font-black tracking-widest text-[color:var(--color-brand-violet)]/10">
            PRACTICE
          </span>
        </div>
      )}

      {/* Top bar: back, draft state, frame name, fullscreen. Fades in fullscreen. */}
      <header
        className={cn(
          "relative z-20 flex items-center justify-between gap-4 px-6 py-3 text-[13px] text-[color:var(--color-brand-mist)] transition-opacity",
          fullscreen && "opacity-40 hover:opacity-100"
        )}
      >
        <Link
          href={`/assessments/${data.id}?step=review`}
          className="inline-flex items-center gap-1.5 hover:text-white"
        >
          <ArrowLeft className="size-3.5" /> Workbench
        </Link>
        <div className="flex items-center gap-3">
          {data.isDraft && (
            <span className="rounded-full bg-[color:var(--color-brand-warning)]/15 px-2.5 py-1 text-[12px] font-semibold text-[color:var(--color-brand-warning)]">
              Draft — {data.resolved} of 30 resolved
            </span>
          )}
          <span>
            {index + 1} / {frames.length} · {frame.label}
          </span>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-white/10 hover:text-white"
            title="Fullscreen (F)"
          >
            {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            {fullscreen ? "Exit" : "Fullscreen"}
          </button>
        </div>
      </header>

      {/* The frame. Click the right two-thirds to advance, the left third to go back. */}
      <main className="relative z-10 min-h-0 flex-1">
        <div key={frame.id} className="h-full animate-in fade-in duration-300">
          {frame.node}
        </div>
        <button
          type="button"
          aria-label="Previous"
          onClick={() => go(-1)}
          className="absolute inset-y-0 left-0 w-1/3 cursor-w-resize opacity-0"
        />
        <button
          type="button"
          aria-label="Next"
          onClick={() => go(1)}
          className="absolute inset-y-0 right-0 w-2/3 cursor-e-resize opacity-0"
        />
      </main>

      {/* Bottom rail: frame dots and arrows. */}
      <footer className="relative z-20 flex items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-[color:var(--color-brand-mist)] hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          <ChevronLeft className="size-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          {frames.map((f, i) => (
            <button
              key={f.id}
              type="button"
              aria-label={`Go to ${f.label}`}
              aria-current={i === index ? "step" : undefined}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index
                  ? "w-8 bg-[color:var(--color-brand-electric-glow)]"
                  : "w-3 bg-white/25 hover:bg-white/50"
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index === last}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-[color:var(--color-brand-mist)] hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          Next <ChevronRight className="size-4" />
        </button>
      </footer>

      <span className="sr-only" aria-live="polite">
        {`Frame ${index + 1} of ${frames.length}: ${frame.label}`}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-4 left-1/2 z-20 hidden -translate-x-1/2 text-[11px] text-white/25 md:block"
        style={{ marginBottom: 36 }}
      >
        ← → or space · F fullscreen
      </span>
    </div>
  );
}
