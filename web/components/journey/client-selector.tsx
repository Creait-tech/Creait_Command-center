"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Phase 3 placeholder roster — Phase 4 will pull from GHL contacts.
const PLACEHOLDER_CLIENTS = [
  "Asia (QWN)",
  "Coop (AITP)",
  "Dustin (Phillip Grandison)",
  "Rad Media Studios",
  "Sabrina",
  "Thomas (Adult Game Night)",
] as const;

interface Props {
  value: string | null;
  onChange: (clientName: string) => void;
}

export function ClientSelector({ value, onChange }: Props) {
  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => typeof v === "string" && v && onChange(v)}
    >
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select a client…" />
      </SelectTrigger>
      <SelectContent>
        {PLACEHOLDER_CLIENTS.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
