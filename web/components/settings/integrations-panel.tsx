"use client";

import { useState } from "react";
import { Copy, Check, Video, Database, Bot, MessageSquare, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  readaiSecret: string;
  mcpUrl: string;
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Copy ${label ?? "value"}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label ?? "Copied"}`);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy");
        }
      }}
    >
      {copied ? <Check className="size-3.5 text-[color:var(--color-brand-success)]" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function MaskedField({ label, value, masked = true }: { label: string; value: string; masked?: boolean }) {
  const [revealed, setRevealed] = useState(!masked);
  const display = revealed ? value : value.length > 8 ? `${value.slice(0, 4)}…${value.slice(-4)}` : "•••••";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {masked && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="text-[11px] text-[color:var(--color-brand-electric)] hover:underline"
          >
            {revealed ? "Hide" : "Reveal"}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 bg-[color:var(--color-brand-slate)]/40 border border-border rounded px-2 py-1.5">
        <code className="flex-1 text-xs font-mono break-all">{display}</code>
        {value && <CopyButton value={value} label={label} />}
      </div>
    </div>
  );
}

export function IntegrationsPanel({ readaiSecret, mcpUrl }: Props) {
  const readaiUrl = "https://cc.getcreait.com/api/webhooks/readai";
  const testCurl = `curl -X POST -H "Authorization: Bearer ${readaiSecret || "<READAI_WEBHOOK_SECRET>"}" -H "Content-Type: application/json" -d '{"meeting":{"id":"test-001","title":"Test from curl","start_time":"${new Date().toISOString()}"},"transcript":{"text":"Maurice mentioned MRR is up 12%. John raised concern about Asia QWN delivery."}}' ${readaiUrl}`;

  return (
    <div className="space-y-6">
      {/* Read.ai */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg bg-[color:var(--color-brand-electric)]/15 flex items-center justify-center shrink-0">
              <Video className="size-4 text-[color:var(--color-brand-electric)]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Read.ai (Zoom meeting summaries)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                When Read.ai finishes processing a Zoom call, it POSTs the transcript here.
                We run Meeting Debrief (Opus 4.7), extract wins/issues/action items, and populate /level-10.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MaskedField label="Webhook URL (paste in Read.ai)" value={readaiUrl} masked={false} />
            <MaskedField label="X-Readai-Signature secret (HMAC-SHA256 of body)" value={readaiSecret} masked />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Test it now — send a fake payload</label>
            <div className="bg-[color:var(--color-brand-slate)]/40 border border-border rounded p-2 flex items-start gap-2">
              <code className="flex-1 text-[10px] font-mono break-all whitespace-pre-wrap">{testCurl}</code>
              <CopyButton value={testCurl} label="Test command" />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Run this in Terminal. Returns <code className="text-[color:var(--color-brand-success)]">{`{"ok":true,...}`}</code> with the meeting id + extracted counts.
            </p>
          </div>

          <div className="rounded-md border border-[color:var(--color-brand-electric)]/30 bg-[color:var(--color-brand-electric)]/5 p-3 text-xs">
            <p className="font-medium text-[color:var(--color-brand-electric)] mb-1">Setup in Read.ai (~60 seconds)</p>
            <ol className="space-y-0.5 text-muted-foreground list-decimal list-inside">
              <li>Open Read.ai dashboard → Settings → Integrations → Webhooks</li>
              <li>Add a new webhook, paste the URL above</li>
              <li>Set the secret to the value above (used for HMAC signing)</li>
              <li>Select event: "Meeting completed" / "Summary generated"</li>
              <li>Save. Next Zoom meeting auto-debriefs into /level-10.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* MCP server */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg bg-[color:var(--color-brand-aqua)]/15 flex items-center justify-center shrink-0">
              <Database className="size-4 text-[color:var(--color-brand-aqua)]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">MCP Server (Second Brain + GHL)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hostinger VPS container (Docker + Traefik). Powers the chat widget and Skills engine.
              </p>
            </div>
          </div>
          <MaskedField label="Public URL" value={mcpUrl} masked={false} />
          <div className="rounded-md border border-border bg-[color:var(--color-brand-slate)]/30 p-3 text-xs space-y-1">
            <p><strong>9 tools live:</strong> search_context, get_file, update_file, list_topics, ghl_get_contacts, ghl_get_opportunities, ghl_get_conversations, ghl_send_message, ghl_update_opp_stage</p>
            <p className="text-muted-foreground">Health check: <a href={`${mcpUrl}/health`} target="_blank" rel="noreferrer noopener" className="text-[color:var(--color-brand-electric)] hover:underline">{mcpUrl}/health</a></p>
          </div>
        </CardContent>
      </Card>

      {/* Background agents */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg bg-[color:var(--color-brand-violet)]/15 flex items-center justify-center shrink-0">
              <Bot className="size-4 text-[color:var(--color-brand-violet)]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Background Agents (Inngest)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                4 long-running agents seeded. Manage on /agents → Active Agents.
              </p>
            </div>
          </div>
          <ul className="text-xs space-y-1 text-muted-foreground">
            <li>• <strong className="text-foreground">Daily Briefing</strong> — 7am ET, Tavily-powered industry scan</li>
            <li>• <strong className="text-foreground">Comms Sweep</strong> — every 2 hours, drafts replies to top unreplied messages</li>
            <li>• <strong className="text-foreground">GHL Sync</strong> — hourly, refreshes KPI scoreboard from GHL contacts/opps/convos</li>
            <li>• <strong className="text-foreground">Tech Watch Crawler</strong> — daily, scans tracked companies for news/hiring</li>
            <li>• <strong className="text-foreground">Weekly Summary</strong> — Fri 5pm ET, generates the week's wrap</li>
          </ul>
        </CardContent>
      </Card>

      {/* Phase 4 / not yet integrated */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg bg-[color:var(--color-brand-warning)]/15 flex items-center justify-center shrink-0">
              <AlertCircle className="size-4 text-[color:var(--color-brand-warning)]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Not yet integrated</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Designed and scaffolded; needs a small unlock. Say the word and I ship.
              </p>
            </div>
          </div>
          <ul className="text-xs space-y-2">
            <li className="flex items-start gap-2">
              <MessageSquare className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <strong className="text-foreground">Gmail send</strong> from /comms (Approve & Send button) — needs Google OAuth flow + google-auth-library config.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <MessageSquare className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <strong className="text-foreground">LinkedIn DMs</strong> via Unipile (~$15/mo) — fully wires the Comms inbox loop.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Bot className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <strong className="text-foreground">Vercel AI Gateway</strong> for OSS routing (Kimi K2, DeepSeek) — cheap-model fallback for background agents. Adds <code>@ai-sdk/gateway</code> package.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <strong className="text-foreground">Multi-org graduation</strong> — drop <code>phase1_creait_open</code> policy + configure Clerk JWT template <code>supabase</code> with <code>org_id</code> claim. Required before adding Trembly / WLF / Peachy Kicks.
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
