/**
 * Local harness entry: the real IntakeForm inside the real Sheet markup from
 * app/intake/[token]/page.tsx. Nothing about the DOM the driver targets is
 * re-implemented — the component and the question schema are imported from the
 * repository as-is.
 */
import { createRoot } from "react-dom/client";

import { IntakeForm } from "@/components/intake/intake-form";
import { INTAKE_INTRO, INTAKE_TITLE, parseIntake } from "@/lib/assessment-intake";

declare const window: any;

const token: string = window.__TOKEN__;
const initial = parseIntake(window.__INTAKE__);
const heading: string = window.__COMPANY__;

function App() {
  return (
    <div className="intake-root">
      <main className="ci-sheet">
        <header className="ci-letterhead">
          <p className="ci-wordmark">CREAiT</p>
          <p className="ci-mono">Growth &amp; AI Diagnostic</p>
        </header>
        <h1 className="ci-title">{INTAKE_TITLE}</h1>
        <p className="ci-for">Prepared for {heading}</p>
        <div className="ci-lede">
          {INTAKE_INTRO.map((line) => (
            <p key={line.slice(0, 24)}>{line}</p>
          ))}
        </div>
        <IntakeForm token={token} initialAnswers={initial} />
        <footer className="ci-colophon">
          <p className="ci-mono">CREAiT · Atlanta</p>
          <p className="ci-mono">Pre-assessment intake</p>
        </footer>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
