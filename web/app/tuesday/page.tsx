import type { Metadata } from "next";

import { RegistrationForm } from "@/components/tuesday/registration-form";
import {
  CLASS_FACTS,
  formatClassDate,
  nextClassDate,
} from "@/lib/tuesday-class";

/**
 * AI Tuesday — the public registration page.
 *
 * PUBLIC BY CONSTRUCTION. Nothing in this subtree calls `auth()`, which is the
 * only thing that makes any other route in this app redirect to /sign-in
 * (see app/(dashboard)/layout.tsx). `proxy.ts` runs clerkMiddleware without
 * `auth.protect()`, so there is no middleware matcher to add to — but do not
 * add an auth call here, and do not move this file under (dashboard).
 *
 * ── DIRECTION CONTRACT (seed 9e248f7e) ──────────────────────────────────────
 * THESIS: A registration page whose form is not bolted onto marketing — the
 *   page IS one working sheet, and the form is its second half. Refuses the
 *   split-hero-with-signup-card the category always ships.
 * OWN-WORLD: The Executive Blueprint's light print system, inherited: a white
 *   sheet on a #eef1f5 desk, ink #111827, muted #5b6675, hairline #e4e9f0,
 *   accent #0284c7, tint panel #f4fafd. Ruled entry lines are the recurring
 *   material; every list is a hairline-separated row, never a card.
 * STORY: The visitor meets three questions about their own business, cannot
 *   fill in the blanks, recognizes the gap is expensive, learns the class is a
 *   free 90-minute working session, and fills in the blanks they can.
 * FIRST VIEWPORT: Letterhead rule, then the headline, then the lede, then the
 *   three numbered questions as ruled blanks that draw themselves in. The
 *   primary action sits below on purpose — the blanks are the hook, and a form
 *   above them would answer a question nobody has asked yet.
 * FORM: The worksheet. Candidate 6 of the grounded structural list; surface
 *   concept seed key 9e248f7e.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 *   finish review, the verdict, and DESIGN.md.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Tuesday — CREAiT Live",
  description:
    "A free weekly working session for owner-led businesses. 90 minutes, Tuesdays at 6:00 PM Eastern, on Zoom. Each week we take one part of a business apart and put it back together.",
  openGraph: {
    title: "AI Tuesday — CREAiT Live",
    description:
      "Free weekly working session for owner-led businesses. Tuesdays, 6:00 PM Eastern, 90 minutes, on Zoom.",
    type: "website",
  },
};

/**
 * The app shell is hard-committed to dark (`<html class="dark">` plus
 * `color-scheme: dark` in globals.css). This is the first thing a cold
 * prospect sees, and it belongs to the client-facing light world, so the whole
 * subtree pins its own scheme — the same technique the Executive Blueprint
 * uses for exactly the same reason.
 *
 * Static string; no user data ever flows into it.
 */
const TUESDAY_CSS = `
  html:has(.tuesday-root) {
    color-scheme: light;
    background: #eef1f5;
  }
  html:has(.tuesday-root) body {
    background: #eef1f5;
    color: #111827;
  }

  .tuesday-root {
    /* Accent split on purpose: #0284c7 is the sheet's accent for rules and
       marks, but only reaches 4.09:1 on white, so anything that is TEXT uses
       the deeper #0369a1 (5.9:1). */
    --tc-ink: #111827;
    --tc-muted: #5b6675;
    --tc-line: #e4e9f0;
    --tc-rule: #94a3b8;
    --tc-input-rule: #64748b;
    --tc-accent: #0284c7;
    --tc-blue: #0369a1;
    --tc-blue-deep: #075985;
    --tc-tint: #f4fafd;
    --tc-tint-line: #bcd9ea;
    --tc-danger: #b91c1c;

    background: #eef1f5;
    color: var(--tc-ink);
    min-height: 100vh;
    padding: 28px 12px 56px;
    font-family: var(--font-inter), Inter, -apple-system, "Segoe UI", sans-serif;
    font-size: 16px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  @media (min-width: 768px) {
    .tuesday-root { padding: 64px 24px 96px; }
  }

  .tc-sheet {
    max-width: 46rem;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid var(--tc-line);
    padding: 26px 20px 40px;
    /* Real depth: offset plus blur, never a zero-offset halo. */
    box-shadow:
      0 1px 2px rgba(17, 24, 39, 0.05),
      0 14px 36px -14px rgba(17, 24, 39, 0.18);
    overflow-wrap: anywhere;
  }
  @media (min-width: 768px) {
    .tc-sheet { padding: 46px 56px 64px; }
  }

  /* Letterhead */
  .tc-letterhead {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px 20px;
    flex-wrap: wrap;
    border-bottom: 2px solid var(--tc-ink);
    padding-bottom: 10px;
  }
  .tc-wordmark {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  /* Deliberately NOT uppercased: the brand is "CREAiT" with a lowercase i,
     and text-transform silently destroys it. Only tc-caps uppercases, and it
     is used exclusively on short field names that contain no brand name. */
  .tc-mono {
    font-family: var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace;
    font-size: 11px;
    letter-spacing: 0.05em;
    color: var(--tc-muted);
    font-variant-numeric: tabular-nums;
  }
  .tc-caps {
    font-family: var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace;
    font-size: 10.5px;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--tc-muted);
    font-variant-numeric: tabular-nums;
  }

  /* Opening */
  .tc-title {
    margin-top: 30px;
    font-size: clamp(1.75rem, 6.4vw, 2.75rem);
    line-height: 1.09;
    font-weight: 700;
    letter-spacing: -0.03em;
    text-wrap: balance;
  }
  .tc-lede {
    margin-top: 20px;
    font-size: clamp(1.0625rem, 2.3vw, 1.1875rem);
    line-height: 1.6;
    max-width: 34em;
  }

  /* The three blanks — the page's signature */
  .tc-blanks {
    margin-top: 26px;
    border-top: 1px solid var(--tc-line);
  }
  /* Grid, not flex: with flex-wrap the short third question kept its number
     inline while the two long ones pushed theirs onto a line of their own, so
     the column of numbers came apart. A grid pins the number column and lands
     every answer rule in the same place. */
  .tc-blank {
    display: grid;
    grid-template-columns: 1.6rem 1fr;
    column-gap: 8px;
    row-gap: 9px;
    align-items: baseline;
    padding: 15px 0;
    border-bottom: 1px solid var(--tc-line);
  }
  .tc-blank-n {
    font-family: var(--font-geist-mono), ui-monospace, monospace;
    font-size: 11px;
    color: var(--tc-muted);
    font-variant-numeric: tabular-nums;
  }
  .tc-blank-q {
    font-size: 1rem;
    line-height: 1.45;
    font-weight: 500;
  }
  .tc-blank-rule {
    grid-column: 2 / -1;
    height: 0;
    border-bottom: 1.5px solid var(--tc-rule);
    transform-origin: left center;
  }
  @media (min-width: 600px) {
    /* The answer column: every rule starts at the same x, so the three
       unanswerable questions read as one form rather than three sentences. */
    .tc-blank {
      grid-template-columns: 1.6rem 21rem 1fr;
      column-gap: 16px;
      row-gap: 0;
    }
    .tc-blank-rule {
      grid-column: 3;
      align-self: end;
      margin-bottom: 4px;
    }
  }
  .tc-aside {
    margin-top: 20px;
    font-size: 1rem;
    line-height: 1.68;
    color: var(--tc-muted);
    max-width: 36em;
  }
  .tc-aside strong { color: var(--tc-ink); font-weight: 600; }

  /* Sections */
  .tc-section { margin-top: 46px; }
  @media (min-width: 768px) { .tc-section { margin-top: 62px; } }

  .tc-h2 {
    font-size: clamp(1.125rem, 2.7vw, 1.4375rem);
    font-weight: 700;
    letter-spacing: -0.018em;
    line-height: 1.25;
  }
  .tc-p {
    margin-top: 14px;
    font-size: 1rem;
    line-height: 1.68;
    color: var(--tc-muted);
    max-width: 36em;
  }
  .tc-p strong { color: var(--tc-ink); font-weight: 600; }

  /* Ruled rows — the alternative to cards */
  .tc-rows {
    margin-top: 22px;
    border-top: 1px solid var(--tc-line);
  }
  .tc-rows-tight { margin-top: 26px; }
  .tc-row {
    display: grid;
    gap: 4px;
    padding: 15px 0;
    border-bottom: 1px solid var(--tc-line);
  }
  @media (min-width: 640px) {
    .tc-row {
      grid-template-columns: 15rem 1fr;
      gap: 24px;
      align-items: baseline;
    }
  }
  .tc-row-k { font-weight: 600; font-size: 0.9375rem; line-height: 1.45; }
  .tc-row-v {
    font-size: 0.9375rem;
    line-height: 1.62;
    color: var(--tc-muted);
  }

  /* Facts panel */
  .tc-facts {
    margin-top: 24px;
    background: var(--tc-tint);
    border: 1px solid var(--tc-tint-line);
    padding: 18px;
    display: grid;
    gap: 15px;
  }
  @media (min-width: 560px) {
    .tc-facts {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px 32px;
      padding: 22px 24px;
    }
  }
  .tc-fact-v {
    font-size: 1rem;
    font-weight: 600;
    margin-top: 4px;
    line-height: 1.35;
  }

  /* Form */
  .tc-form {
    margin-top: 26px;
    display: grid;
    gap: 22px;
  }
  @media (min-width: 640px) {
    .tc-form {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 26px 28px;
    }
    .tc-field-wide { grid-column: 1 / -1; }
  }

  .tc-label {
    display: block;
    font-family: var(--font-geist-mono), ui-monospace, monospace;
    font-size: 10.5px;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--tc-muted);
    line-height: 1.5;
  }
  /* The annoyance field asks a real question, so it gets a real question's
     typography. Uppercase mono is a field NAME; a sentence set in it is a
     wall nobody reads, and this is the one answer the class is built on. */
  .tc-label-q {
    display: block;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.45;
    color: var(--tc-ink);
    letter-spacing: -0.006em;
  }
  .tc-req { color: var(--tc-blue); }

  .tc-input {
    display: block;
    width: 100%;
    margin-top: 7px;
    font: inherit;
    /* 16px minimum: anything smaller makes iOS Safari zoom on focus, and this
       page is filled in on phones more often than not. */
    font-size: 16px;
    color: var(--tc-ink);
    background: transparent;
    border: 0;
    border-bottom: 1.5px solid var(--tc-input-rule);
    border-radius: 0;
    padding: 10px 2px;
    min-height: 46px;
    transition: border-color 140ms ease, background-color 140ms ease;
  }
  .tc-input:hover { border-bottom-color: var(--tc-ink); }
  .tc-input:focus {
    border-bottom-color: var(--tc-accent);
    border-bottom-width: 2px;
    background: var(--tc-tint);
  }
  .tc-input-error { border-bottom-color: var(--tc-danger); }

  .tc-textarea {
    display: block;
    width: 100%;
    margin-top: 7px;
    font: inherit;
    font-size: 16px;
    /* The ruled answer box: line-height and the gradient period are the same
       number, so text sits ON the rules like a real worksheet. */
    line-height: 32px;
    color: var(--tc-ink);
    border: 1px solid var(--tc-input-rule);
    border-radius: 2px;
    padding: 0 12px 8px;
    min-height: 136px;
    resize: vertical;
    background-color: #ffffff;
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 31px,
      var(--tc-line) 31px,
      var(--tc-line) 32px
    );
    background-attachment: local;
    transition: border-color 140ms ease;
  }
  .tc-textarea:focus { border-color: var(--tc-accent); }

  .tc-hint {
    margin-top: 9px;
    font-size: 0.8125rem;
    line-height: 1.55;
    color: var(--tc-muted);
  }
  .tc-error {
    margin-top: 7px;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--tc-danger);
    font-weight: 500;
  }
  .tc-form-error {
    grid-column: 1 / -1;
    border: 1px solid #f1c9c9;
    background: #fdf5f5;
    color: #8f2020;
    padding: 12px 14px;
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .tc-honeypot {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .tc-submit-row { margin-top: 2px; }
  .tc-submit {
    display: block;
    width: 100%;
    background: var(--tc-blue);
    color: #ffffff;
    border: 0;
    border-radius: 3px;
    font: inherit;
    font-size: 1rem;
    font-weight: 600;
    padding: 15px 30px;
    min-height: 52px;
    box-shadow:
      0 1px 2px rgba(3, 105, 161, 0.28),
      0 8px 18px -10px rgba(3, 105, 161, 0.55);
    transition: background-color 140ms ease, transform 120ms ease;
  }
  @media (min-width: 640px) { .tc-submit { width: auto; } }
  .tc-submit:hover:not(:disabled) { background: var(--tc-blue-deep); }
  .tc-submit:active:not(:disabled) { transform: translateY(1px); }
  .tc-submit:disabled {
    background: #6b93ad;
    box-shadow: none;
    cursor: progress;
  }
  .tc-fineprint {
    margin-top: 14px;
    font-size: 0.8125rem;
    line-height: 1.6;
    color: var(--tc-muted);
    max-width: 40em;
  }

  /* Thank-you state */
  .tc-thanks { margin-top: 26px; }
  .tc-thanks-title {
    font-size: clamp(1.375rem, 4vw, 1.875rem);
    font-weight: 700;
    letter-spacing: -0.022em;
    line-height: 1.2;
    text-wrap: balance;
  }
  .tc-warn {
    margin-top: 18px;
    border: 1px solid #e6d2a8;
    background: #fdf9f0;
    color: #6b4e12;
    padding: 14px 16px;
    font-size: 0.9375rem;
    line-height: 1.6;
  }
  .tc-next {
    margin-top: 34px;
    background: var(--tc-tint);
    border: 1px solid var(--tc-tint-line);
    padding: 22px 20px;
  }
  @media (min-width: 640px) { .tc-next { padding: 26px; } }
  .tc-next-title {
    font-size: 1.0625rem;
    font-weight: 700;
    letter-spacing: -0.012em;
    line-height: 1.35;
  }
  .tc-next-body {
    margin-top: 10px;
    font-size: 0.9375rem;
    line-height: 1.65;
    color: var(--tc-muted);
    max-width: 36em;
  }
  .tc-next-link,
  .tc-link {
    color: var(--tc-blue);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-thickness: 1px;
  }
  .tc-next-link {
    display: inline-block;
    margin-top: 14px;
    font-size: 0.9375rem;
  }
  .tc-next-link:hover,
  .tc-link:hover { color: var(--tc-blue-deep); }

  /* Colophon */
  .tc-colophon {
    margin-top: 44px;
    padding-top: 16px;
    border-top: 1px solid var(--tc-line);
    display: flex;
    justify-content: space-between;
    gap: 10px 20px;
    flex-wrap: wrap;
  }

  /* Motion: one authored moment.
     The three rules draw themselves left to right, staggered. The resting
     state is the finished sheet — the keyframe supplies only a "from" — so
     reduced-motion users and any engine that drops the animation still see
     three complete rules rather than three gaps. */
  @media (prefers-reduced-motion: no-preference) {
    .tc-blank-rule {
      animation: tc-draw 760ms cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: var(--d, 0ms);
    }
    @keyframes tc-draw {
      from { transform: scaleX(0); }
    }
  }
`;

const QUESTIONS = [
  "How many inquiries came in last month?",
  "What happens to the ones that go quiet?",
  "What's your close rate?",
];

const TEARDOWN = [
  {
    k: "Where revenue leaks",
    v: "The places money is already being lost — slow follow-up, quotes nobody chased, work you're underpricing without realizing it.",
  },
  {
    k: "What breaks without you",
    v: "Every step that only happens because you remembered it. That list is the ceiling on the business, and it's usually longer than owners expect.",
  },
  {
    k: "What a machine should handle",
    v: "Which parts of the work should be automated — and, just as often, which parts honestly shouldn't be.",
  },
];

export default function TuesdayPage() {
  const nextLabel = formatClassDate(nextClassDate());

  return (
    <div className="tuesday-root" data-impeccable-seed="9e248f7e">
      <style>{TUESDAY_CSS}</style>

      <main className="tc-sheet">
        <header className="tc-letterhead">
          <p className="tc-wordmark">CREAiT</p>
          <p className="tc-mono">Next session · {nextLabel}</p>
        </header>

        <h1 className="tc-title">
          AI Tuesday — 90 minutes on the systems behind a smoother business
        </h1>

        <p className="tc-lede">
          Most business owners can&apos;t answer three questions about their own
          business.
        </p>

        <section className="tc-blanks" aria-label="Three questions">
          {QUESTIONS.map((q, i) => (
            <div className="tc-blank" key={q}>
              <span className="tc-blank-n" aria-hidden="true">
                {i + 1}.
              </span>
              <span className="tc-blank-q">{q}</span>
              <span
                className="tc-blank-rule"
                aria-hidden="true"
                style={{ "--d": `${140 + i * 130}ms` } as React.CSSProperties}
              />
            </div>
          ))}
        </section>

        <p className="tc-aside">
          That&apos;s not a criticism — almost nobody can.{" "}
          <strong>
            But the gap between those answers and what you&apos;re currently
            guessing is usually the most expensive thing in the business.
          </strong>
        </p>

        <section className="tc-section">
          <h2 className="tc-h2">What this actually is</h2>
          <p className="tc-p">
            A free weekly working session for owner-led businesses. Ninety
            minutes. No pitch deck, no theory, no jargon. Each week we take one
            part of a business apart and put it back together:
          </p>
          <div className="tc-rows">
            {TEARDOWN.map((row) => (
              <div className="tc-row" key={row.k}>
                <div className="tc-row-k">{row.k}</div>
                <div className="tc-row-v">{row.v}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="tc-section">
          <h2 className="tc-h2">When and where</h2>
          <div className="tc-facts">
            <div>
              <p className="tc-caps">When</p>
              <p className="tc-fact-v">
                {CLASS_FACTS.day}, {CLASS_FACTS.startTime}
              </p>
            </div>
            <div>
              <p className="tc-caps">How long</p>
              <p className="tc-fact-v">{CLASS_FACTS.durationMinutes} minutes</p>
            </div>
            <div>
              <p className="tc-caps">Where</p>
              <p className="tc-fact-v">On {CLASS_FACTS.platform}</p>
            </div>
            <div>
              <p className="tc-caps">Cost</p>
              <p className="tc-fact-v">{CLASS_FACTS.price}</p>
            </div>
          </div>
          <p className="tc-p">
            Register once and you&apos;re on the list for good — we&apos;ll send
            you the link every week.
          </p>
        </section>

        {/* The heading belongs to the form, not to this section: once someone
            has registered it has to stop promising blanks to fill in, and only
            the form knows that has happened. */}
        <section className="tc-section">
          <RegistrationForm nextClassLabel={nextLabel} />
        </section>

        <footer className="tc-colophon">
          <p className="tc-mono">CREAiT · Atlanta</p>
          <p className="tc-mono">{CLASS_FACTS.name}</p>
        </footer>
      </main>
    </div>
  );
}
