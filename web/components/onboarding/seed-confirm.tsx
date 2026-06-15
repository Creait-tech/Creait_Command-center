"use client";

import Link from "next/link";
import { CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  orgSlug: string;
  orgName: string;
  alreadySeeded: boolean;
  seeded: {
    priorities: string;
    kpis: string;
    team: string;
  } | null;
}

export function SeedConfirm({ orgSlug, orgName, alreadySeeded, seeded }: Props) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="size-14 mx-auto rounded-full bg-[color:var(--color-brand-electric)]/15 flex items-center justify-center">
          <Sparkles className="size-7 text-[color:var(--color-brand-electric)]" />
        </div>
        <h1 className="text-2xl font-bold">
          Welcome to <span className="text-[color:var(--color-brand-electric)]">{orgName}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {alreadySeeded
            ? "This workspace is already set up. Jump in."
            : "Your new workspace is ready. We've seeded sensible defaults to get you moving."}
        </p>
      </div>

      {!alreadySeeded && seeded && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Seeded</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[color:var(--color-brand-success)]" />
                <span>Company Priorities</span>
                <span className="ml-auto text-xs text-muted-foreground">{seeded.priorities}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[color:var(--color-brand-success)]" />
                <span>Scoreboard KPIs (placeholders, edit on /level-10)</span>
                <span className="ml-auto text-xs text-muted-foreground">{seeded.kpis}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[color:var(--color-brand-success)]" />
                <span>You as the founder / admin</span>
                <span className="ml-auto text-xs text-muted-foreground">{seeded.team}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Next steps</p>
          <ol className="space-y-2 text-sm">
            <li>
              <strong>1.</strong>{" "}
              <Link href="/vision" className="text-[color:var(--color-brand-electric)] hover:underline">Draft your V/TO</Link>{" "}
              — mission, vision, 10-year target, 3-year picture, 1-year plan.
            </li>
            <li>
              <strong>2.</strong>{" "}
              <Link href="/rocks" className="text-[color:var(--color-brand-electric)] hover:underline">Add 3-7 Rocks</Link>{" "}
              for this quarter. SMART, one owner each.
            </li>
            <li>
              <strong>3.</strong>{" "}
              <Link href="/team" className="text-[color:var(--color-brand-electric)] hover:underline">Define your Accountability Chart</Link>{" "}
              — seats first, people second.
            </li>
            <li>
              <strong>4.</strong>{" "}
              <Link href="/level-10" className="text-[color:var(--color-brand-electric)] hover:underline">Run your first Level 10</Link>{" "}
              — Start Meeting button walks the 90-min EOS agenda.
            </li>
          </ol>
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-3">
        <Link href="/command-center">
          <Button>
            Open {orgName} Command Center
            <ArrowRight className="size-4" />
          </Button>
        </Link>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Workspace slug: <code className="px-1 py-0.5 rounded bg-[color:var(--color-brand-slate)]/40">{orgSlug}</code>
      </p>
    </div>
  );
}
