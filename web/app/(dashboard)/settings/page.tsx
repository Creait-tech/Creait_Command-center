import { IntegrationsPanel } from "@/components/settings/integrations-panel";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  // Only NEXT_PUBLIC_* env vars are safe to surface in a server component
  // result to a client (these are public by construction).
  // The webhook URL is derived from the request host; we use NEXT_PUBLIC for the readai pieces.
  const readaiSecret = process.env.READAI_WEBHOOK_SECRET ?? "";
  const mcpUrl = process.env.MCP_URL ?? "https://mcp.getcreait.com";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Integration setup, webhook credentials, and system info.
        </p>
      </div>
      <IntegrationsPanel readaiSecret={readaiSecret} mcpUrl={mcpUrl} />
    </div>
  );
}
