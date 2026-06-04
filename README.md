# CREAIT Command Center

Internal Business OS + Agentic OS for CREAIT.

> **Status: Phase 1 in progress.** See `.claude/plans/deep-stargazing-pretzel.md` for the full implementation plan.

## Layout

```
/web    Next.js 15 app (Vercel → cc.getcreait.com)
/mcp    Second Brain + GHL MCP server (Hostinger VPS → mcp.getcreait.com)
/infra  docker-compose + Traefik labels for the MCP deploy
```

## Stack

- Next.js 15 (App Router, RSC) · TypeScript · Tailwind v4 · shadcn/ui (Tailwind v4 mode)
- Auth: Clerk (Organizations enabled, org seed: "CREAIT")
- DB: Supabase Postgres + Realtime + Storage, RLS by `org_id`
- AI: Vercel AI SDK (Anthropic Sonnet 4.6 default, Opus 4.7 for heavy reasoning, OpenAI GPT-5, Google Gemini 3 Pro)
- Background jobs: Inngest (durable functions, cron, retries)
- MCP: Second Brain (markdown) + GHL custom tools combined into one Node server
- Meeting transcripts: Read.ai webhook
- Web search: Tavily MCP

## Quickstart

```bash
# From repo root
cd web
cp ../.env.example .env.local   # fill in values (see Phase 0 in the plan)
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Phase 1 scope

Deployable artifact:
- Clerk sign-in works on `cc.getcreait.com`
- Sidebar + topbar + floating chat widget
- `/command-center` page: goals, subtasks, drag-reorder, realtime sync
- `/vision` page: inline-editable document
- `/api/chat` streaming with page context (no tool calls yet)

Phase 2 adds Skills + MCP + Comms + Research. Phase 3 adds remaining pages + Read.ai webhook + long-running agents.

## Deviations from the spec

| Spec | Reality | Reason |
|---|---|---|
| Next.js 14 | Next.js 15 | Current stable; better RSC; no migration debt |
| HubSpot MCP | Custom GHL tools | Maurice runs GHL, not HubSpot |
| Fathom webhook | Read.ai webhook | Zoom + Read.ai is the actual recorder/transcriber stack |
| BullMQ + Upstash Redis | Inngest | Serverless durable functions; no Redis to manage |
| Composio | Direct Gmail API; LinkedIn deferred to Phase 3 | Composio is overkill for our 2 needs |
| Railway-hosted MCP | Hostinger VPS (existing) | Already paid for, Docker+Traefik installed |
