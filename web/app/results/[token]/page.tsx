import type { Metadata } from "next";

import { ClientResults } from "@/components/assessments/client-results";
import { findClientResults } from "@/lib/client-results-server";

/**
 * The owner's results page, at /results/<token>.
 *
 * PUBLIC BY CONSTRUCTION — the same contract as /intake/<token>: nothing in
 * this subtree calls `auth()`, so the dashboard's redirect never fires, and
 * the token is the whole authorisation. It is matched against a single row
 * that must be delivered; a reopened engagement, a revoked link, a malformed
 * or unknown token all render the same closed page.
 *
 * What reaches the browser is what the client was handed in the room: the
 * score and band, the three pillars, their words against the evidence, the
 * priced findings, the 90-day plan, the check-ins once they are recorded, and
 * a link to the released PDF. No ids, no org, no notes, no scores per
 * indicator.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your results — CREAiT Growth & AI Diagnostic",
  robots: { index: false, follow: false },
};

export default async function ClientResultsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const results = await findClientResults(token);

  if (!results) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[color:var(--color-brand-ink)] px-6 text-white">
        <div className="max-w-md text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[color:var(--color-brand-electric-glow)]">
            CREAiT Growth &amp; AI Diagnostic
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">This link is closed</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--color-brand-mist)]">
            Results links are issued by your CREAiT advisor and can be closed or
            replaced at any time. If you expected this one to work, ask them for
            a fresh link.
          </p>
        </div>
      </main>
    );
  }

  return <ClientResults data={results} />;
}
