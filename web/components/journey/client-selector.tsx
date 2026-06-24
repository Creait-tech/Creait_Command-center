"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CcClient } from "@/lib/supabase/types";

interface Props {
  clients: CcClient[];
  value: string | null;
  onChange: (clientId: string) => void;
}

export function ClientSelector({ clients, value, onChange }: Props) {
  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => typeof v === "string" && v && onChange(v)}
    >
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Select a client…" />
      </SelectTrigger>
      <SelectContent>
        {clients.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No clients yet
          </div>
        ) : (
          clients.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
              {c.company && c.company !== c.name ? (
                <span className="text-muted-foreground"> · {c.company}</span>
              ) : null}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
