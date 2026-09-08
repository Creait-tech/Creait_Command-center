import type { Metadata } from "next";

import { IntakeForm } from "@/components/intake/intake-form";
import {
  INTAKE_INTRO,
  INTAKE_TITLE,
  parseIntake,
} from "@/lib/assessment-intake";
import { findOpenIntake } from "@/lib/intake-server";

/**
 * The owner's pre-assessment intake, at /intake/<token>.
 *
 * PUBLIC BY CONSTRUCTION — the same contract as /tuesday. Nothing in this
 * subtree calls `auth()`, which is the only thing that makes a route in this
 * app redirect to /sign-in (see app/(dashboard)/layout.tsx). `proxy.ts` runs
 * clerkMiddleware without `auth.protect()`, so there is no middleware matcher
 * to add `/intake(.*)` to — the absence of an auth call IS the public route
 * list. Do not add an auth call here, and do not move this file under
 * (dashboard).
 *
 * The token is the whole authorisation: an unguessable UUID, matched against a
 * single row that must still be in status 'intake' with nothing submitted. It
 * is checked on the render AND again inside every write (lib/intake-actions),
 * because a page left open in a tab proves nothing about the row an hour
 * later. A closed, unknown, malformed or already-submitted link all produce
 * exactly the same page, so this route can never be used to find out whether a
 * given token exists.
 *
 * Nothing about the engagement reaches the browser except the company name the
 * owner already knows they are filling this in for: no score, no findings, no
 * ids, no org.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${INTAKE_TITLE} — CREAiT`,
  description:
    "The preparation for your CREAiT Growth & AI Diagnostic. About 45–60 minutes; every answer saves as you type.",
  // A tokenised, client-specific page has no business in an index.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The app shell is hard-committed to dark (`<html class="dark">`). This is a
 * client-facing document, so the subtree pins its own scheme — the same
 * technique the Executive Blueprint and /tuesday use, for the same reason.
 *
 * Static string; no user data ever flows into it.
 */
const INTAKE_CSS = `
  html:has(.intake-root) {
    color-scheme: light;
    background: #eef1f5;
  }
  html:has(.intake-root) body {
    background: #eef1f5;
    color: #111827;
  }

  .intake-root {
    --ci-ink: #111827;
    --ci-muted: #5b6675;
    --ci-line: #e4e9f0;
    --ci-rule: #94a3b8;
    --ci-accent: #0284c7;
    --ci-blue: #0369a1;
    --ci-tint: #f4fafd;
    --ci-tint-line: #bcd9ea;
    --ci-danger: #b91c1c;
    --ci-ok: #047857;

    background: #eef1f5;
    color: var(--ci-ink);
    min-height: 100vh;
    padding: 24px 12px 64px;
    font-family: var(--font-inter), Inter, -apple-system, "Segoe UI", sans-serif;
    font-size: 16px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  @media (min-width: 768px) {
    .intake-root { padding: 56px 24px 96px; }
  }

  .ci-sheet {
    max-width: 52rem;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid var(--ci-line);
    padding: 24px 18px 40px;
    box-shadow:
      0 1px 2px rgba(17, 24, 39, 0.05),
      0 14px 36px -14px rgba(17, 24, 39, 0.18);
    overflow-wrap: anywhere;
  }
  @media (min-width: 768px) {
    .ci-sheet { padding: 44px 52px 64px; }
  }

  .ci-letterhead {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px 20px;
    flex-wrap: wrap;
    border-bottom: 2px solid var(--ci-ink);
    padding-bottom: 10px;
  }
  .ci-wordmark { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
  .ci-mono, .ci-caps {
    font-family: var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace;
    color: var(--ci-muted);
    font-variant-numeric: tabular-nums;
  }
  .ci-mono { font-size: 11px; letter-spacing: 0.05em; }
  .ci-caps { font-size: 10.5px; letter-spacing: 0.09em; text-transform: uppercase; }

  .ci-title {
    margin-top: 26px;
    font-size: clamp(1.6rem, 5.2vw, 2.25rem);
    line-height: 1.12;
    font-weight: 700;
    letter-spacing: -0.03em;
    text-wrap: balance;
  }
  .ci-for { margin-top: 8px; font-size: 15px; color: var(--ci-muted); }
  .ci-lede { margin-top: 18px; max-width: 36em; }
  .ci-lede p + p { margin-top: 12px; }
  .ci-p { margin-top: 12px; max-width: 38em; }
  .ci-fineprint { margin-top: 14px; font-size: 13px; color: var(--ci-muted); }

  /* Progress — the only feedback this page gives. */
  .ci-progress {
    position: sticky;
    top: 0;
    z-index: 2;
    margin-top: 26px;
    padding: 12px 0 10px;
    background: #ffffff;
    border-top: 1px solid var(--ci-line);
    border-bottom: 1px solid var(--ci-line);
  }
  .ci-progress-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }
  .ci-progress-count { font-size: 13px; font-weight: 600; }
  .ci-save { margin-left: auto; font-size: 12px; color: var(--ci-muted); }
  .ci-save-saved { color: var(--ci-ok); }
  .ci-save-error { color: var(--ci-danger); }
  .ci-progress-bars {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 6px 16px;
    margin-top: 9px;
    list-style: none;
    padding: 0;
  }
  .ci-progress-link {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 8px;
    text-decoration: none;
    color: inherit;
  }
  .ci-progress-label { font-size: 11.5px; color: var(--ci-muted); }
  .ci-progress-n {
    font-size: 11px;
    color: var(--ci-muted);
    font-variant-numeric: tabular-nums;
  }
  .ci-progress-track {
    grid-column: 1 / -1;
    height: 3px;
    background: var(--ci-line);
    border-radius: 2px;
    overflow: hidden;
  }
  .ci-progress-fill {
    display: block;
    height: 100%;
    background: var(--ci-accent);
    transition: width 220ms ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .ci-progress-fill { transition: none; }
  }

  /* Sections & questions */
  .ci-section { margin-top: 38px; }
  .ci-h2 {
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.015em;
    border-bottom: 1px solid var(--ci-ink);
    padding-bottom: 6px;
  }
  .ci-section-blurb {
    margin-top: 10px;
    font-size: 14px;
    color: var(--ci-muted);
    max-width: 40em;
  }
  .ci-skip {
    margin-top: 14px;
    padding: 12px 14px;
    background: var(--ci-tint);
    border: 1px solid var(--ci-tint-line);
    font-size: 13.5px;
    color: var(--ci-muted);
  }
  .ci-questions { list-style: none; padding: 0; margin: 8px 0 0; }

  .ci-q { padding: 18px 0; border-bottom: 1px solid var(--ci-line); }
  .ci-q-missing { border-left: 3px solid var(--ci-danger); padding-left: 12px; }
  .ci-q-head {
    display: grid;
    grid-template-columns: 2.1rem 1fr;
    column-gap: 8px;
    align-items: baseline;
  }
  .ci-q-n {
    font-family: var(--font-geist-mono), ui-monospace, monospace;
    font-size: 11px;
    color: var(--ci-muted);
    font-variant-numeric: tabular-nums;
  }
  .ci-q-prompt { font-size: 1rem; font-weight: 600; line-height: 1.35; }
  .ci-q-help {
    margin-top: 5px;
    font-size: 13px;
    color: var(--ci-muted);
    max-width: 44em;
  }
  .ci-req { color: var(--ci-danger); }
  .ci-q-body { margin: 10px 0 0 2.1rem; }
  .ci-unknown {
    margin: 10px 0 0 2.1rem;
    font-size: 12px;
    color: var(--ci-muted);
    background: none;
    border: 1px solid var(--ci-line);
    padding: 4px 10px;
    cursor: pointer;
  }
  .ci-unknown:hover { border-color: var(--ci-rule); color: var(--ci-ink); }
  .ci-unknown-on {
    border-color: var(--ci-tint-line);
    background: var(--ci-tint);
    color: var(--ci-blue);
  }
  .ci-unknown-state {
    font-size: 14px;
    color: var(--ci-blue);
    background: var(--ci-tint);
    border: 1px solid var(--ci-tint-line);
    padding: 8px 12px;
  }

  /* Controls — ruled lines, not boxes. */
  .ci-input, .ci-textarea, .ci-select {
    width: 100%;
    font: inherit;
    color: inherit;
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--ci-rule);
    padding: 6px 2px;
  }
  .ci-textarea {
    border: 1px solid var(--ci-line);
    padding: 8px 10px;
    resize: vertical;
  }
  .ci-select { border-bottom: 1px solid var(--ci-rule); padding: 6px 2px; }
  .ci-input:focus-visible, .ci-textarea:focus-visible, .ci-select:focus-visible {
    outline: 2px solid var(--ci-accent);
    outline-offset: 2px;
  }
  .ci-input-num { font-variant-numeric: tabular-nums; }
  .ci-scalar { display: inline-flex; align-items: baseline; gap: 6px; max-width: 16rem; }
  .ci-affix { color: var(--ci-muted); font-size: 14px; }

  .ci-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 4px 18px;
  }
  .ci-option {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 14.5px;
    padding: 3px 0;
    cursor: pointer;
  }
  .ci-option input { margin-top: 4px; accent-color: var(--ci-accent); }

  /* Grids */
  .ci-grid { display: flex; flex-direction: column; gap: 8px; }
  .ci-grid-row {
    display: grid;
    grid-template-columns: minmax(9rem, 15rem) 1fr;
    gap: 4px 14px;
    align-items: baseline;
  }
  @media (max-width: 640px) {
    .ci-grid-row { grid-template-columns: 1fr; }
  }
  .ci-grid-label { font-size: 13.5px; color: var(--ci-muted); }
  .ci-grid-cells {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 6px 12px;
    align-items: baseline;
  }
  .ci-grid-cells .ci-wide { grid-column: span 2; }
  .ci-grid-head {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 6px 12px;
  }
  .ci-grid-h { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ci-muted); }
  .ci-grid-row-free { grid-template-columns: 1fr; }

  /* Submit */
  .ci-submit-block { border-top: 2px solid var(--ci-ink); padding-top: 18px; }
  .ci-submit {
    margin-top: 16px;
    font: inherit;
    font-weight: 600;
    color: #ffffff;
    background: var(--ci-blue);
    border: 0;
    padding: 12px 22px;
    cursor: pointer;
  }
  .ci-submit:hover { background: #075985; }
  .ci-submit:disabled { opacity: 0.6; cursor: default; }
  .ci-alert {
    margin-top: 14px;
    padding: 10px 12px;
    font-size: 13.5px;
    color: var(--ci-danger);
    border: 1px solid currentColor;
  }
  .ci-linkbtn {
    font: inherit;
    color: var(--ci-blue);
    background: none;
    border: 0;
    padding: 0;
    text-decoration: underline;
    cursor: pointer;
  }
  .ci-done { margin-top: 34px; }
  .ci-colophon {
    margin-top: 46px;
    padding-top: 12px;
    border-top: 1px solid var(--ci-line);
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
`;

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="intake-root">
      {/* href + precedence makes React hoist this into <head>, so a cold phone
          never flashes the app shell's dark background before the sheet. */}
      <style href="intake-sheet" precedence="high">
        {INTAKE_CSS}
      </style>
      <main className="ci-sheet">
        <header className="ci-letterhead">
          <p className="ci-wordmark">CREAiT</p>
          <p className="ci-mono">Growth &amp; AI Diagnostic</p>
        </header>
        {children}
        <footer className="ci-colophon">
          <p className="ci-mono">CREAiT · Atlanta</p>
          <p className="ci-mono">Pre-assessment intake</p>
        </footer>
      </main>
    </div>
  );
}

export default async function IntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const open = await findOpenIntake(token);

  if (!open) {
    return (
      <Sheet>
        <h1 className="ci-title">This link is closed</h1>
        <p className="ci-p">
          Either your answers are already in, or your advisor has moved the
          engagement on. Nothing is lost — reply to the email that brought you
          here and they&apos;ll send a fresh link if you still need one.
        </p>
      </Sheet>
    );
  }

  const heading = open.company?.trim() || open.client_name;

  return (
    <Sheet>
      <h1 className="ci-title">{INTAKE_TITLE}</h1>
      <p className="ci-for">Prepared for {heading}</p>
      <div className="ci-lede">
        {INTAKE_INTRO.map((line) => (
          <p key={line.slice(0, 24)}>{line}</p>
        ))}
      </div>

      <IntakeForm token={token} initialAnswers={parseIntake(open.intake)} />
    </Sheet>
  );
}
