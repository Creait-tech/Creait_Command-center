import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { MeetingAgendasPanel } from "@/components/settings/meeting-agendas-panel";
import { ProfileCard } from "@/components/settings/profile-card";
import { TeamPanel } from "@/components/settings/team-panel";
import { fetchRoster } from "./invite-actions";
import { loadStoredAgendas } from "@/components/meeting-agendas/agenda-source";
import { auth } from "@clerk/nextjs/server";

import { getActiveOrgId } from "@/lib/active-org";
import { getMyProfile } from "@/lib/profile-actions";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Only NEXT_PUBLIC_* env vars are safe to surface in a server component
  // result to a client. The Read.ai signing secret never crosses to the
  // browser — the panel only learns whether one is configured.
  const readaiConfigured = Boolean(process.env.READAI_WEBHOOK_SECRET);
  const mcpUrl = process.env.MCP_URL ?? "https://mcp.getcreait.com";

  // Gmail connection status — service client only, and we deliberately select
  // ONLY non-sensitive fields (never refresh_token) so nothing secret crosses
  // into the client component.
  let gmailConnectedEmail: string | null = null;
  try {
    const orgId = await getActiveOrgId();
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("cc_oauth_tokens")
      .select("email, updated_at")
      .eq("org_id", orgId)
      .eq("provider", "google")
      .maybeSingle();
    if (data) {
      gmailConnectedEmail = data.email ?? "(connected account)";
    }
  } catch {
    // If the lookup fails, treat Gmail as not connected — the panel still
    // renders a "Connect Gmail" action.
    gmailConnectedEmail = null;
  }

  // The caller's own roster record, resolved from the Clerk session. A failed
  // lookup renders the card in its "nothing linked" state rather than blocking
  // the rest of Settings.
  const profile = await getMyProfile();
  const member = profile.ok ? profile.data.member : null;
  const fallbackName = profile.ok ? profile.data.fallbackName : null;

  // The eight EOS agendas — the org's saved versions where they exist, the code
  // defaults where they don't. Loaded server-side so the editor opens on real
  // values rather than flashing the standard first.
  const agendas = await loadStoredAgendas();

  // The roster, plus whether this viewer may invite. Clerk's org role is the
  // authority; the action re-checks it server-side, so this only decides
  // whether the form is worth rendering.
  const { orgRole } = await auth();
  const rosterResult = await fetchRoster();
  const roster = rosterResult.ok ? rosterResult.data : [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your profile, meeting agendas, integration setup, webhook credentials, and system info.
        </p>
      </div>
      <ProfileCard member={member} fallbackName={fallbackName} />
      <TeamPanel roster={roster} isAdmin={orgRole === "org:admin"} />
      <MeetingAgendasPanel agendas={agendas} />
      <IntegrationsPanel
        readaiConfigured={readaiConfigured}
        mcpUrl={mcpUrl}
        gmailConnectedEmail={gmailConnectedEmail}
      />
    </div>
  );
}
