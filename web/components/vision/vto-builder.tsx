"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Pencil, Save, X, Mountain, MessageSquareWarning, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import { useActiveOrgId } from "@/lib/use-active-org";
import { cn } from "@/lib/utils";
import type { Strategy, VtoData, Rock, IdsItem } from "@/lib/supabase/types";

interface Props {
  strategy: Strategy | null;
  rocks: Rock[];
  issues: IdsItem[];
  quarter: string;
}

function parseVto(strategy: Strategy | null): VtoData {
  if (!strategy?.vto || typeof strategy.vto !== "object" || Array.isArray(strategy.vto)) return {};
  return strategy.vto as VtoData;
}

export function VtoBuilder({ strategy, rocks, issues, quarter }: Props) {
  const orgId = useActiveOrgId();
  const [vto, setVto] = useState<VtoData>(parseVto(strategy));
  const [strategyId, setStrategyId] = useState<string | null>(strategy?.id ?? null);

  useEffect(() => {
    setVto(parseVto(strategy));
    setStrategyId(strategy?.id ?? null);
  }, [strategy]);

  async function saveField<K extends keyof VtoData>(key: K, value: VtoData[K]) {
    const next = { ...vto, [key]: value };
    setVto(next);
    const supabase = createClient();
    if (strategyId) {
      const { error } = await supabase
        .from("strategy")
        .update({ vto: next, updated_at: new Date().toISOString() })
        .eq("id", strategyId);
      if (error) toast.error(error.message);
    } else {
      const { data, error } = await supabase
        .from("strategy")
        .insert({ org_id: orgId, vto: next })
        .select()
        .single();
      if (error) toast.error(error.message);
      else if (data) setStrategyId((data as { id: string }).id);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Core Values */}
      <Section
        title="Core Values"
        subtitle="3-7 attributes you'd hire/fire on."
      >
        <ListEditor
          values={vto.core_values ?? []}
          onChange={(v) => saveField("core_values", v)}
          placeholder="Direct, operator-mode"
        />
      </Section>

      {/* Core Focus */}
      <Section
        title="Core Focus"
        subtitle="Purpose (why we exist) + Niche (what we do that no one else does)."
      >
        <LabeledTextarea
          label="Purpose / Cause / Passion"
          value={vto.core_focus?.purpose ?? ""}
          onSave={(v) => saveField("core_focus", { ...vto.core_focus, purpose: v })}
          placeholder="Why we get out of bed each day."
        />
        <LabeledTextarea
          label="Our Niche"
          value={vto.core_focus?.niche ?? ""}
          onSave={(v) => saveField("core_focus", { ...vto.core_focus, niche: v })}
          placeholder="What we do better than anyone else."
        />
      </Section>

      {/* 10-Year Target */}
      <Section
        title="10-Year Target"
        subtitle="The BHAG. One inspiring measurable goal 10 years out."
      >
        <InlineTextarea
          value={vto.ten_year_target ?? ""}
          onSave={(v) => saveField("ten_year_target", v)}
          placeholder="e.g. $50M ARR servicing 5,000 service businesses across 10 verticals"
        />
      </Section>

      {/* Marketing Strategy */}
      <Section
        title="Marketing Strategy"
        subtitle="4 elements: Target Market, Three Uniques, Proven Process, Guarantee."
      >
        <LabeledTextarea
          label="Target Market (The List)"
          value={vto.marketing_strategy?.target_market ?? ""}
          onSave={(v) => saveField("marketing_strategy", { ...vto.marketing_strategy, target_market: v })}
          placeholder="Demographic + psychographic of ideal customer."
        />
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Three Uniques (≤ 3)</p>
          <ListEditor
            values={vto.marketing_strategy?.three_uniques ?? []}
            onChange={(v) => saveField("marketing_strategy", { ...vto.marketing_strategy, three_uniques: v.slice(0, 3) })}
            placeholder="What 3 things together make us different"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Proven Process (3-7 steps)</p>
          <ListEditor
            values={vto.marketing_strategy?.proven_process ?? []}
            onChange={(v) => saveField("marketing_strategy", { ...vto.marketing_strategy, proven_process: v.slice(0, 7) })}
            placeholder="Step 1 — Discover…"
          />
        </div>
        <LabeledTextarea
          label="Guarantee"
          value={vto.marketing_strategy?.guarantee ?? ""}
          onSave={(v) => saveField("marketing_strategy", { ...vto.marketing_strategy, guarantee: v })}
          placeholder="The promise that reduces buyer risk."
        />
      </Section>

      {/* 3-Year Picture */}
      <Section
        title="3-Year Picture"
        subtitle={`What does December 31, ${new Date().getFullYear() + 3} look like? Present tense, vivid.`}
      >
        <InlineTextarea
          value={vto.three_year_picture ?? ""}
          onSave={(v) => saveField("three_year_picture", v)}
          placeholder="Revenue, headcount, culture, market position, milestones — as if it's happening now."
          minHeight="min-h-32"
        />
      </Section>

      {/* 1-Year Plan */}
      <Section
        title="1-Year Plan"
        subtitle="3-7 annual goals: revenue target + profit target + key strategic initiatives."
      >
        <InlineTextarea
          value={vto.one_year_plan ?? ""}
          onSave={(v) => saveField("one_year_plan", v)}
          placeholder="By Dec 31: revenue $X, profit $Y, ship Z product, hit headcount of N."
          minHeight="min-h-32"
        />
      </Section>

      {/* Rocks rollup (read-only) */}
      <Section
        title={`Quarterly Rocks · ${quarter}`}
        subtitle="3-7 priorities this quarter. Edit on /rocks."
      >
        {rocks.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No rocks set for {quarter} yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {rocks.map((r) => (
              <li key={r.id} className="text-sm flex items-start gap-2">
                <Mountain className="size-3.5 mt-0.5 text-[color:var(--color-brand-aqua)] shrink-0" />
                <span>{r.title}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/rocks" className="text-xs text-[color:var(--color-brand-electric)] hover:underline flex items-center gap-1 mt-3">
          Manage Rocks <ArrowRight className="size-3" />
        </Link>
      </Section>

      {/* Issues rollup (read-only) */}
      <Section
        title="Long-Term Issues"
        subtitle="Bigger problems/opportunities to address in Quarterly Planning. Edit on /level-10."
      >
        {issues.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No long-term issues parked.</p>
        ) : (
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {issues.map((i) => (
              <li key={i.id} className="text-sm flex items-start gap-2">
                <MessageSquareWarning className="size-3.5 mt-0.5 text-[color:var(--color-brand-warning)] shrink-0" />
                <span>{i.title}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/level-10?tab=ids" className="text-xs text-[color:var(--color-brand-electric)] hover:underline flex items-center gap-1 mt-3">
          Manage Issues <ArrowRight className="size-3" />
        </Link>
      </Section>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function InlineTextarea({
  value,
  onSave,
  placeholder,
  minHeight = "min-h-20",
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  minHeight?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "w-full text-left text-sm rounded-md p-2 -m-2 hover:bg-[color:var(--color-brand-slate)]/30 transition-colors",
          minHeight,
          !value && "italic text-muted-foreground",
        )}
      >
        {value || placeholder || "Click to edit…"}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className={cn("text-sm", minHeight)}
        placeholder={placeholder}
        autoFocus
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => { onSave(draft); setEditing(false); }}>
          <Save className="size-3" />
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setDraft(value); setEditing(false); }}>
          <X className="size-3" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

function LabeledTextarea({ label, value, onSave, placeholder }: { label: string; value: string; onSave: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <InlineTextarea value={value} onSave={onSave} placeholder={placeholder} />
    </div>
  );
}

function ListEditor({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [newItem, setNewItem] = useState("");

  function add() {
    if (!newItem.trim()) return;
    onChange([...values, newItem.trim()]);
    setNewItem("");
  }

  function remove(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  function update(idx: number, v: string) {
    onChange(values.map((x, i) => (i === idx ? v : x)));
  }

  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <ul className="space-y-1.5">
          {values.map((v, i) => (
            <li key={i} className="flex items-center gap-2">
              <Input
                value={v}
                onChange={(e) => update(i, e.target.value)}
                onBlur={() => onChange([...values])}
                className="text-sm h-8"
              />
              <Button variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove">
                <X className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? "Add item…"}
          className="text-sm h-8"
        />
        <Button size="sm" variant="outline" onClick={add} disabled={!newItem.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
