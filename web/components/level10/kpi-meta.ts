import type { Kpi, KpiSource } from "@/lib/supabase/types";

// =============================================================================
// Shared KPI presentation rules.
//
// Lives apart from `scoreboard.tsx` so the scoreboard and the create/edit
// dialog agree on how a value renders and on who owns a given number. Kept
// free of React and of any server-only import so both can use it.
// =============================================================================

/**
 * `kpis.unit` is free text in the database, but only three values change how a
 * number renders. Anything else is appended as a suffix; null renders bare.
 * The unit picker offers exactly this set so an operator can't pick a unit the
 * card doesn't know how to draw.
 */
export function formatKpiValue(value: number, unit: string | null): string {
  if (unit === "USD" || unit === "$") {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  if (unit === "%") {
    return `${value.toLocaleString("en-US")}%`;
  }
  if (unit) {
    return `${value.toLocaleString("en-US")} ${unit}`;
  }
  return value.toLocaleString("en-US");
}

export function formatTarget(target: number | null, unit: string | null): string {
  if (target == null) return "";
  return formatKpiValue(target, unit);
}

export interface UnitOption {
  /** Stored in `kpis.unit`. `null` means "no unit — render a bare number". */
  value: string | null;
  label: string;
  /** Live example so the picker shows the formatting, not just the name. */
  preview: string;
}

/**
 * Every unit `formatKpiValue` treats specially, plus the two shapes already in
 * the seeded data ("count", none). `$` is accepted by the formatter as a
 * synonym for USD but isn't offered — one canonical spelling avoids two
 * currency KPIs that look identical but sort/compare as different units.
 */
export const UNIT_OPTIONS: UnitOption[] = [
  { value: null, label: "None — plain number", preview: "1,485" },
  { value: "USD", label: "Currency (USD)", preview: "$1,485" },
  { value: "%", label: "Percent", preview: "12%" },
  { value: "count", label: "Count", preview: "1,485 count" },
];

/** Sentinel used only inside the unit picker; never written to the database. */
export const CUSTOM_UNIT = "__custom__";
/** Sentinel for the null unit — Base UI Select needs a string value. */
export const NO_UNIT = "__none__";

export interface SourceOption {
  value: KpiSource;
  label: string;
  hint: string;
}

export const SOURCE_OPTIONS: SourceOption[] = [
  {
    value: "manual",
    label: "Manual",
    hint: "You type this number in the Level 10. Nothing overwrites it.",
  },
  {
    value: "ghl",
    label: "GoHighLevel",
    hint: "Pulled from GHL by the hourly sync — a typed value gets replaced.",
  },
  {
    value: "stripe",
    label: "Stripe",
    hint: "Reserved. No Stripe sync runs yet, so this stays a typed number.",
  },
  {
    value: "google",
    label: "Google",
    hint: "Reserved. No Google sync runs yet, so this stays a typed number.",
  },
  {
    value: "other",
    label: "Other",
    hint: "Fed by a process outside this app. Nothing here overwrites it.",
  },
];

/**
 * The KPI names the hourly GHL sync writes.
 *
 * Load-bearing subtlety: `ghlSync` in `lib/inngest-functions.ts` finds rows
 * with `.eq('name', name)` — it matches on **name, not on `source`**. So this
 * list, not the `source` column, is what actually decides whether a number
 * gets overwritten. A `source = 'ghl'` KPI whose name isn't here never syncs;
 * a `source = 'manual'` KPI named "MRR" is overwritten anyway.
 *
 * Duplicated rather than imported because that module pulls in the Inngest
 * server client and can't be loaded in a browser bundle. Keep it in step with
 * the `updates` array there — same arrangement as `meetings.meeting_type` and
 * `lib/meeting-agendas.ts`. Matching is exact and case-sensitive, as in the
 * query.
 */
export const GHL_SYNCED_KPI_NAMES = [
  "MRR",
  "Active Deals",
  "Conversations 7d",
  "New Contacts 7d",
  "Open Pipeline Value",
] as const;

export function isGhlSyncedName(name: string): boolean {
  return (GHL_SYNCED_KPI_NAMES as readonly string[]).includes(name.trim());
}

/**
 * Who actually writes this KPI's value.
 *
 * - `manual`   — you own it; nothing overwrites it.
 * - `synced`   — the hourly GHL sync writes it. Typing here is temporary.
 * - `declared` — the row claims an automated source, but no job writes this
 *                name. The value is whatever was last typed, and the "last
 *                synced" stamp will never advance.
 * - `shadowed` — the row says manual, but the GHL sync writes this name. The
 *                most dangerous case: it looks hand-owned and isn't.
 */
export type KpiWriteMode = "manual" | "synced" | "declared" | "shadowed";

export function kpiWriteMode(kpi: Pick<Kpi, "name" | "source">): KpiWriteMode {
  const syncedName = isGhlSyncedName(kpi.name);
  if (kpi.source === "manual") return syncedName ? "shadowed" : "manual";
  if (kpi.source === "ghl") return syncedName ? "synced" : "declared";
  return "declared";
}

export interface WriteModeCopy {
  /** Short label for the card badge. */
  badge: string;
  /** Sentence shown on hover and inside the edit form. */
  detail: string;
  /** Warning shown when the operator is about to type a value by hand. */
  editWarning: string | null;
  /** Whether the badge should read as an alert rather than plain metadata. */
  tone: "neutral" | "auto" | "warn";
}

export function writeModeCopy(
  mode: KpiWriteMode,
  source: KpiSource
): WriteModeCopy {
  switch (mode) {
    case "manual":
      return {
        badge: "Manual",
        detail:
          "You own this number. Nothing overwrites it — it stays as typed until someone changes it.",
        editWarning: null,
        tone: "neutral",
      };
    case "synced":
      return {
        badge: "Auto · GHL",
        detail:
          "The hourly GoHighLevel sync writes this number. Editing it by hand is temporary.",
        editWarning:
          "This KPI is written by the hourly GoHighLevel sync — your number will be replaced on the next run. To keep a typed value, edit the KPI and set its source to Manual (and rename it, since the sync matches on name).",
        tone: "auto",
      };
    case "declared":
      return {
        badge: `${sourceLabel(source)} · not syncing`,
        detail: `This KPI is marked "${sourceLabel(
          source
        )}", but no background job writes a KPI with this name. The value is whatever was last typed, and the sync stamp will never advance.`,
        editWarning:
          "No sync feeds this KPI despite its source, so your value will stick — but the card will keep reporting a stale sync stamp. Set the source to Manual to make that honest.",
        tone: "warn",
      };
    case "shadowed":
      return {
        badge: "Manual · overwritten",
        detail:
          "This KPI is marked Manual, but the hourly GoHighLevel sync matches KPIs by name and writes this one. It is not hand-owned.",
        editWarning:
          "Despite the Manual source, the hourly GoHighLevel sync matches on name and writes this KPI — your number will be replaced. Rename it if you want to own the value.",
        tone: "warn",
      };
  }
}

export function sourceLabel(source: KpiSource): string {
  return SOURCE_OPTIONS.find((o) => o.value === source)?.label ?? source;
}
