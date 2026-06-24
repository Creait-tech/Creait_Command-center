import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { getActiveOrgId } from "@/lib/active-org";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Only NEXT_PUBLIC_* env vars are safe to surface in a server component
  // result to a client (these are public by construction).
  // The webhook URL is derived from the request host; we use NEXT_PUBLIC for the readai pieces.
  const readaiSecret = process.env.READAI_WEBHOOK_SECRET ?? "";
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Integration setup, webhook credentials, and system info.
        </p>
      </div>
      <IntegrationsPanel
        readaiSecret={readaiSecret}
        mcpUrl={mcpUrl}
        gmailConnectedEmail={gmailConnectedEmail}
      />
    </div>
  );
}
