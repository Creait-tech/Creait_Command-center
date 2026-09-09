"use client";

/**
 * What the trainee is allowed to read while scoring blind: the intake as the
 * owner typed it, the facilitator's session capture, and the data room. Three
 * tabs, one panel, so the anchors and the evidence sit on the same screen —
 * scoring from memory of a document in another window is how drift starts.
 */

import { useState } from "react";
import { FileText, FolderOpen, NotebookPen } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  INTAKE_QUESTIONS,
  INTAKE_SECTIONS,
  TABLE_ROW_KEY,
  UNKNOWN,
  UNKNOWN_LABEL,
  type IntakeQuestion,
} from "@/lib/assessment-intake";
import { DOCUMENT_KIND_LABELS, formatMoney } from "@/lib/assessment-instrument";
import { ENGINE_METRICS, SESSION_BLOCKS } from "@/lib/assessment-session";
import type { CalibrationMaterials } from "@/lib/calibration";

type Tab = "intake" | "session" | "dataroom";

const TABS: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
  { id: "intake", label: "Intake", icon: FileText },
  { id: "session", label: "Session", icon: NotebookPen },
  { id: "dataroom", label: "Data room", icon: FolderOpen },
];

function cellText(value: unknown): string {
  if (typeof value !== "string") return "";
  const t = value.trim();
  if (!t) return "";
  return t.toLowerCase() === UNKNOWN ? UNKNOWN_LABEL : t;
}

function Answer({ question, value }: { question: IntakeQuestion; value: unknown }) {
  if (Array.isArray(value)) {
    const rows = value.filter(
      (r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r)
    );
    if (rows.length === 0) {
      const strings = value.filter((v): v is string => typeof v === "string");
      return strings.length > 0 ? (
        <p className="text-[12.5px] leading-relaxed text-foreground/90">
          {strings.map(cellText).filter(Boolean).join(" · ")}
        </p>
      ) : null;
    }
    const columns = question.columns ?? [];
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-border/40 align-top">
                {question.rows && (
                  <th className="w-[38%] py-1 pr-3 text-left font-medium text-muted-foreground">
                    {cellText(row[TABLE_ROW_KEY])}
                  </th>
                )}
                {columns.map((c) => (
                  <td key={c.key} className="py-1 pr-3 text-foreground/90">
                    {columns.length > 1 && c.label ? (
                      <span className="mr-1 text-muted-foreground/70">{c.label}:</span>
                    ) : null}
                    {cellText(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const text = cellText(value);
  if (!text) return null;
  return (
    <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/90">
      {text}
    </p>
  );
}

function StructuredIntake({ intake }: { intake: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-5">
      {INTAKE_SECTIONS.map((section) => {
        const questions = INTAKE_QUESTIONS.filter(
          (q) => q.section === section.id && intake[q.id] !== undefined
        );
        if (questions.length === 0) return null;
        return (
          <section key={section.id}>
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-electric)]">
              {section.title}
            </h4>
            <dl className="mt-2 flex flex-col gap-3">
              {questions.map((q) => (
                <div key={q.id}>
                  <dt className="text-[11.5px] font-medium text-muted-foreground">
                    <span className="mr-1.5 font-mono text-[10px] text-muted-foreground/60">
                      {q.id.toUpperCase()}
                    </span>
                    {q.prompt}
                  </dt>
                  <dd className="mt-0.5">
                    <Answer question={q} value={intake[q.id]} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}

/** Just enough markdown for the prose intake exports: headings and bold. */
function ProseIntake({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line, i) => {
        if (!line.trim()) return null;
        if (line.startsWith("## ")) {
          return (
            <h4
              key={i}
              className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-electric)] first:mt-0"
            >
              {line.slice(3)}
            </h4>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <p key={i} className="text-[13px] font-semibold">
              {line.slice(2)}
            </p>
          );
        }
        const parts = line.split("**");
        return (
          <p key={i} className="text-[12.5px] leading-relaxed text-foreground/90">
            {parts.map((part, j) =>
              j % 2 === 1 ? (
                <strong key={j} className="font-semibold text-foreground">
                  {part}
                </strong>
              ) : (
                <span key={j}>{part}</span>
              )
            )}
          </p>
        );
      })}
    </div>
  );
}

function SessionTab({ materials }: { materials: CalibrationMaterials }) {
  const { session, profile } = materials;
  return (
    <div className="flex flex-col gap-5">
      <section>
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-electric)]">
          The business
        </h4>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/90">
          {profile.story}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-3">
          {[
            ["Revenue", formatMoney(profile.revenue)],
            ["Gross margin", profile.grossMarginPct !== null ? `${profile.grossMarginPct}%` : "—"],
            ["Operating profit", formatMoney(profile.operatingProfit)],
            ["Headcount", profile.headcount ?? "—"],
            ["Founded", profile.founded ?? "—"],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-2 border-t border-border/40 py-1">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-electric)]">
          Engine numbers captured live
        </h4>
        <dl className="mt-1.5 flex flex-col">
          {ENGINE_METRICS.map((m) => {
            const v = session.engine[m.key];
            if (!v) return null;
            return (
              <div key={m.key} className="grid grid-cols-[minmax(0,40%)_minmax(0,1fr)] gap-3 border-t border-border/40 py-1.5 text-[12px]">
                <dt className="text-muted-foreground">{m.label}</dt>
                <dd className="whitespace-pre-wrap font-medium">{v}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      {SESSION_BLOCKS.map((b) => {
        const note = session.blockNotes[b.id];
        if (!note) return null;
        return (
          <section key={b.id}>
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-electric)]">
              Block {b.id.slice(1)} · {b.label}
            </h4>
            <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/90">
              {note}
            </p>
          </section>
        );
      })}

      {session.demonstrated.length > 0 && (
        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-electric)]">
            Demonstrated in the room
          </h4>
          <ul className="mt-1.5 flex flex-col gap-1">
            {session.demonstrated.map((d) => (
              <li key={d} className="flex gap-2 text-[12.5px] leading-snug text-foreground/90">
                <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-[color:var(--color-brand-aqua)]" />
                {d}
              </li>
            ))}
          </ul>
        </section>
      )}

      {session.documents_seen.length > 0 && (
        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-electric)]">
            Documents opened
          </h4>
          <ul className="mt-1.5 flex flex-col gap-1">
            {session.documents_seen.map((d) => (
              <li key={d} className="flex gap-2 text-[12.5px] leading-snug text-foreground/90">
                <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-[color:var(--color-brand-success)]" />
                {d}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DataRoomTab({ materials }: { materials: CalibrationMaterials }) {
  const { dataRoom } = materials;
  return (
    <div className="flex flex-col gap-3">
      <p
        className={cn(
          "rounded-lg px-3 py-2 text-[12px] font-medium",
          dataRoom.pnl_on_file
            ? "bg-[color:var(--color-brand-success)]/10 text-[color:var(--color-brand-success)]"
            : "bg-[color:var(--color-brand-warning)]/10 text-[color:var(--color-brand-warning)]"
        )}
      >
        {dataRoom.pnl_on_file
          ? "A real P&L is on file — Profit-pillar figures can be Documented."
          : "No P&L on file — every Profit-pillar figure is the owner's word."}
      </p>
      {dataRoom.documents.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">
          Nothing was received. Everything in this case is Reported unless it was demonstrated in the room.
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {dataRoom.documents.map((d) => (
            <li key={`${d.kind}-${d.name}`} className="flex items-baseline justify-between gap-3 py-1.5 text-[12.5px]">
              <span>
                <span className="font-medium">{d.name}</span>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {DOCUMENT_KIND_LABELS[d.kind as keyof typeof DOCUMENT_KIND_LABELS] ?? d.kind}
                </span>
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {d.received_on ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
        Evidence rule: a figure the owner said is Reported; something you watched happen or opened in the room is Demonstrated; a number read off a document in this list is Documented. The label never changes the score — it widens the financial ranges.
      </p>
    </div>
  );
}

export function CaseMaterials({
  materials,
  className,
}: {
  materials: CalibrationMaterials;
  className?: string;
}) {
  const [tab, setTab] = useState<Tab>("session");
  return (
    <aside className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex rounded-md bg-[color:var(--color-brand-slate)]/60 p-0.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2 py-1.5 text-[12px] font-medium transition-colors duration-150 motion-reduce:transition-none",
              tab === id
                ? "bg-[color:var(--color-brand-fog)] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 xl:max-h-[calc(100vh-14rem)]">
        {tab === "intake" &&
          (materials.intake ? (
            <StructuredIntake intake={materials.intake} />
          ) : materials.intake_markdown ? (
            <ProseIntake text={materials.intake_markdown} />
          ) : (
            <p className="text-[12.5px] text-muted-foreground">No intake on this case.</p>
          ))}
        {tab === "session" && <SessionTab materials={materials} />}
        {tab === "dataroom" && <DataRoomTab materials={materials} />}
      </div>
    </aside>
  );
}
