"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startCalibration } from "@/lib/calibration-actions";

/** Opens (or resumes) the signed-in trainee's attempt at a case. */
export function StartCalibrationButton({
  slug,
  variant = "default",
  label = "Score this case blind",
}: {
  slug: string;
  variant?: "default" | "link";
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const res = await startCalibration(slug);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.push(`/assessments/calibration/${slug}?attempt=${res.data!.attemptId}`);
  }

  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        className="text-[12px] font-medium text-[color:var(--color-brand-electric)] transition-colors hover:underline disabled:opacity-60"
      >
        {label}
      </button>
    );
  }
  return (
    <Button onClick={() => void start()} disabled={busy}>
      <Play className="size-4" /> {busy ? "Opening…" : label}
    </Button>
  );
}
