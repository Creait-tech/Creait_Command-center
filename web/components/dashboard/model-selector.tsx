"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STORAGE_KEY = "creait.model";
const DEFAULT_MODEL = "claude-sonnet-4-6";

export const MODELS = [
  // Frontier (direct providers)
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tier: "frontier" },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7", tier: "frontier" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", tier: "frontier" },
  { id: "gpt-5", label: "GPT-5", tier: "frontier" },
  { id: "gemini-3-pro", label: "Gemini 3 Pro", tier: "frontier" },
  // OSS / cheap tier via OpenRouter — 5-15× cheaper, great for bulk work
  { id: "openrouter/kimi-k2", label: "Kimi K2", tier: "openrouter" },
  { id: "openrouter/deepseek-v3", label: "DeepSeek V3", tier: "openrouter" },
  { id: "openrouter/llama-3.3-70b", label: "Llama 3.3 70B", tier: "openrouter" },
  { id: "openrouter/gemini-flash", label: "Gemini Flash", tier: "openrouter" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

function isValidModel(value: string | null): value is ModelId {
  if (!value) return false;
  return MODELS.some((m) => m.id === value);
}

export function useSelectedModel(): [ModelId, (id: ModelId) => void] {
  const [model, setModel] = React.useState<ModelId>(DEFAULT_MODEL);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isValidModel(stored)) {
        setModel(stored);
      }
    } catch {
      // localStorage unavailable; keep default
    }
  }, []);

  const updateModel = React.useCallback((id: ModelId) => {
    setModel(id);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore persistence failures
    }
  }, []);

  return [model, updateModel];
}

type ModelSelectorProps = {
  className?: string;
  size?: "sm" | "default";
};

export function ModelSelector({ className, size = "sm" }: ModelSelectorProps) {
  const [model, setModel] = useSelectedModel();

  return (
    <Select
      value={model}
      onValueChange={(value) => {
        if (isValidModel(value)) {
          setModel(value);
        }
      }}
    >
      <SelectTrigger size={size} className={className}>
        <SelectValue placeholder="Model" />
      </SelectTrigger>
      <SelectContent>
        {MODELS.filter((m) => m.tier === "frontier").map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.label}
          </SelectItem>
        ))}
        <div className="border-t border-border my-1 mx-2" />
        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          OpenRouter (cheap)
        </div>
        {MODELS.filter((m) => m.tier === "openrouter").map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
