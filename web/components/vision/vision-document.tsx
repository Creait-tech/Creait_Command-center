"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createBrowserClient as createClient } from "@/lib/supabase/client";
import type { Strategy } from "@/lib/supabase/types";

interface VisionDocumentProps {
  strategy: Strategy | null;
}

type EditableField =
  | "mission"
  | "vision"
  | "values"
  | "brand_positioning"
  | "brand_voice"
  | "icp"
  | "value_ladder"
  | "flywheel";

interface SectionConfig {
  field: EditableField;
  title: string;
  placeholder: string;
}

const SECTIONS: SectionConfig[] = [
  { field: "mission", title: "Mission", placeholder: "Why we exist." },
  { field: "vision", title: "Vision", placeholder: "Where we're going." },
  { field: "values", title: "Core Values", placeholder: "One per line or as a paragraph." },
  { field: "brand_positioning", title: "Brand Positioning", placeholder: "How we're different." },
  { field: "brand_voice", title: "Brand Voice", placeholder: "How we sound." },
  { field: "icp", title: "Ideal Customer Profile", placeholder: "Who we serve." },
  { field: "value_ladder", title: "Value Ladder", placeholder: "Tiered offers." },
  { field: "flywheel", title: "Flywheel", placeholder: "The growth loop." },
];

function Section({
  section,
  strategy,
  onSaved,
}: {
  section: SectionConfig;
  strategy: Strategy | null;
  onSaved: (field: EditableField, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function startEdit() {
    setDraft(strategy?.[section.field] ?? "");
    setSaveError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setSaveError(null);
  }

  async function save() {
    if (!strategy) return;
    setSaving(true);
    setSaveError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("strategy")
      .update({
        [section.field]: draft,
        updated_at: new Date().toISOString(),
      })
      .eq("id", strategy.id);

    setSaving(false);

    if (error) {
      setSaveError(error.message);
      return;
    }

    onSaved(section.field, draft);
    setEditing(false);
  }

  const value = strategy?.[section.field];

  return (
    <section className="space-y-3 py-10 border-b border-[color:var(--color-brand-fog)] last:border-none">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">{section.title}</h2>
        {!editing && (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[color:var(--color-brand-electric)] transition-colors"
            aria-label={`Edit ${section.title}`}
          >
            <Pencil className="size-3.5" />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-32 text-sm"
            placeholder={section.placeholder}
            autoFocus
          />
          {saveError && (
            <p className="text-xs text-[color:var(--color-brand-danger)]">{saveError}</p>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              <Check className="size-3.5" />
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={cancel} disabled={saving}>
              <X className="size-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      ) : value ? (
        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-muted-foreground italic">Not set</p>
      )}
    </section>
  );
}

export function VisionDocument({ strategy: initialStrategy }: VisionDocumentProps) {
  const [strategy, setStrategy] = useState<Strategy | null>(initialStrategy);

  function handleSaved(field: EditableField, value: string) {
    setStrategy((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  const tagline = "Stop Losing Customers. Start Growing.";

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-12 space-y-2">
        <h1 className="text-5xl font-bold tracking-tight text-[color:var(--color-brand-electric)]">
          CREAIT
        </h1>
        <p className="text-lg text-muted-foreground">{tagline}</p>
      </div>

      {SECTIONS.map((section) => (
        <Section
          key={section.field}
          section={section}
          strategy={strategy}
          onSaved={handleSaved}
        />
      ))}
    </div>
  );
}
