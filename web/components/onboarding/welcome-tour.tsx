"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * First-login tour. Shows once per user (flag lives in Clerk
 * `unsafeMetadata.ccTourDone`, so it follows them across devices), teaches
 * the Command Center in plain terms, and gets out of the way.
 *
 * Replay: visit any page with `?tour=1` — that overrides the flag for the
 * session so the tour can be re-run without touching metadata.
 */

type Step = {
  title: string;
  eyebrow: string;
  body: React.ReactNode;
};

const STEPS: Step[] = [
  {
    eyebrow: "Welcome",
    title: "This is the CREAiT Command Center.",
    body: (
      <>
        <p>
          One system: the <strong>scoreboard</strong>, the{" "}
          <strong>meeting room</strong>, and the <strong>to-do list</strong>,
          all in one place.
        </p>
        <p>
          The rule is simple: <strong>if work happened and it&apos;s not in
          here, it didn&apos;t happen.</strong>
        </p>
        <p className="text-muted-foreground">This tour takes two minutes.</p>
      </>
    ),
  },
  {
    eyebrow: "Command Center page",
    title: "The scoreboard never lies.",
    body: (
      <>
        <p>
          The <strong>Command Center</strong> page shows our real numbers,
          pulled straight from GHL automatically — within minutes of anything
          changing. Nobody copies numbers by hand, and nobody argues with
          feelings. We argue with the board.
        </p>
        <p>
          Two words to know: <strong>MRR</strong> is money that repeats every
          month without a new sale. <strong>The Floor</strong> is $67,000 a
          month — the number where all four founders are safe.
        </p>
      </>
    ),
  },
  {
    eyebrow: "Rocks page",
    title: "A Rock is a 90-day goal with one owner.",
    body: (
      <>
        <p>
          We carry a handful of Rocks each quarter — the few things that must
          get done. Every Rock has exactly <strong>one owner</strong>. Find
          yours on the <strong>Rocks</strong> page.
        </p>
        <p>
          Green means on track. Red means{" "}
          <strong>say something at Monday&apos;s meeting</strong> — Rocks never
          slip quietly.
        </p>
      </>
    ),
  },
  {
    eyebrow: "To-Dos & Issues",
    title: "Promises and problems both get written down.",
    body: (
      <>
        <p>
          A <strong>To-Do</strong> is a 7-day promise, usually made in a
          meeting. It gets done before the next one.
        </p>
        <p>
          An <strong>Issue</strong> is anything in the way — a problem, an
          idea, a decision we need to make. When in doubt,{" "}
          <strong>add it to Issues</strong>. That&apos;s not complaining;
          that&apos;s how things get fixed around here.
        </p>
      </>
    ),
  },
  {
    eyebrow: "Level 10 page",
    title: "Monday, 9:00 — the meeting runs itself.",
    body: (
      <>
        <p>
          Every Monday we run our team meeting inside this app. Same agenda
          every week: the numbers, the Rocks, the wins — then we pick the top
          Issues and <strong>solve them</strong>.
        </p>
        <p>
          Go to <strong>Level 10 → Start Meeting</strong> and the app walks
          the agenda with a timer. It ends with fresh To-Dos and a score out
          of ten.
        </p>
      </>
    ),
  },
  {
    eyebrow: "Your first week",
    title: "Four small things, then you're in.",
    body: (
      <>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Find your name on a Rock.</li>
          <li>Add at least one Issue you can see coming.</li>
          <li>Check your number on the scoreboard.</li>
          <li>Show up Monday at 9:00 — the meeting runs here.</li>
        </ol>
        <p className="text-muted-foreground">
          That&apos;s the whole system. See you on the board.
        </p>
      </>
    ),
  },
];

export function WelcomeTour() {
  const { user, isLoaded } = useUser();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const forced =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("tour") === "1";
    const done = user.unsafeMetadata?.ccTourDone === true;
    if (forced || !done) {
      setStep(0);
      setOpen(true);
    }
  }, [isLoaded, user]);

  async function finish() {
    setOpen(false);
    if (!user || user.unsafeMetadata?.ccTourDone === true) return;
    try {
      await user.update({
        unsafeMetadata: { ...user.unsafeMetadata, ccTourDone: true },
      });
    } catch (err) {
      // Non-fatal: worst case the tour shows again next login.
      console.error("[welcome-tour] failed to persist tour flag:", err);
    }
  }

  if (!isLoaded || !user) return null;

  const current = STEPS[step] ?? STEPS[0];
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : finish())}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {current.eyebrow}
          </p>
          <DialogTitle className="text-xl">{current.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Command Center welcome tour, step {step + 1} of {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm leading-relaxed">{current.body}</div>

        <div className="flex items-center gap-1.5 pt-1" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          {step === 0 ? (
            <Button variant="ghost" size="sm" onClick={finish}>
              Skip — I know it
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
          )}
          {isLast ? (
            <Button size="sm" onClick={finish}>
              Let&apos;s work
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            >
              {step === 0 ? "Show me" : "Next"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
