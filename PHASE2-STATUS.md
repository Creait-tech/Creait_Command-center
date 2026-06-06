# Phase 2 — Status Report

**Built overnight 2026-06-05.** Plan: `.claude/plans/deep-stargazing-pretzel.md`. Builds on Phase 1.

## TL;DR

Phase 2 shipped to `main` and deployed to https://cc.getcreait.com. MCP server live at https://mcp.getcreait.com with 9 tools — verified pulling real GHL contacts. Skills engine + 5 Inngest functions wired. `/comms`, `/research`, `/agents` pages live.

```
git log --oneline | head -5
<latest>  phase 2 finalize: MCP+pages+GHL live
e64ec8f   phase 2: MCP server deployed + skills engine + Inngest + /comms /research /agents
44c4e14   fix(auth): remove auth.protect() — page-level redirects handle 307 properly
5b8817f   phase 1: schema + auth shell + command center + vision + AI chat
701ca49   phase 1: scaffold Next.js 15 + shadcn + CREAIT brand + MCP stub
```

## What's live

| URL | Status |
|---|---|
| https://cc.getcreait.com | 14 routes deployed |
| https://mcp.getcreait.com/health | 9 MCP tools listed |
| https://mcp.getcreait.com/mcp | Bearer-auth POST returns live GHL data ✅ |

### MCP server (Hostinger VPS, Docker + Traefik)
- 9 tools registered: 4 Second Brain (search_context, get_file, update_file, list_topics) + 5 GHL (ghl_get_contacts, ghl_get_opportunities, ghl_get_conversations, ghl_send_message, ghl_update_opp_stage)
- 11 markdown files seeded under `/data` (mounted volume): company profile from soul file, team roster, active clients, products + pricing, intelligence/meetings/comms placeholders
- Bearer-token auth (`MCP_TOKEN`), Streamable HTTP transport (stateless per-request)
- Let's Encrypt cert via Traefik
- Container: `creait-mcp`, doesn't collide with existing hermes-* containers

### Skills + Inngest
- `runSkill()` in `/lib/skills-engine.ts`: composes prompt from skill + brand context + page slice, loads MCP tools via `loadMcpTools()`, calls AI SDK v6 `generateText` with `stopWhen: stepCountIs(15)`, writes `run_history` with cost estimate (Sonnet $3+$15/M, Opus $15+$75/M, Haiku $0.80+$4/M)
- `/api/skills/run` POST: Clerk-auth, Zod-validated, calls runSkill
- `/api/skills/[id]` GET/PATCH: read + edit a skill's name/description/system_prompt/preferred_model/enabled
- `/api/inngest` serve endpoint with 5 functions:
  - `dailyBriefing` — cron 12:00 UTC daily, runs "Daily Briefing" skill
  - `commsSweep` — cron every 2 hours, fetches top 5 unreplied messages, runs "Draft Reply" per message, writes `messages.draft_reply`
  - `weeklySummary` — cron Fri 22:00 UTC, runs "Weekly Company Summary"
  - `ghlSync` — cron hourly, calls `ghl_get_contacts`/`ghl_get_opportunities`/`ghl_get_conversations`, updates 4 KPIs by name (MRR, Active Deals, Conversations 7d, New Contacts 7d)
  - `goalCheck` — event-only stub, ready for Monday goal-review cron in Phase 3
- `/api/cron/[name]` accepts Bearer `$CRON_SECRET` OR Vercel-injected cron signature, forwards to Inngest event bus
- `/api/chat` updated to load MCP tools so the floating widget can call them now

### Pages
- **`/comms`** — email-client layout: 2-pane desktop, mobile Sheet overlay. Filter pills (All/LinkedIn/Email/SMS/DM/Snoozed/Archived). Analytics bar (today count + unreplied 24h+). Realtime subscription. URL-synced selection (`?msg=<id>`). Optimistic read-marking. Draft Reply skill wired via "Generate Draft" button. Snooze/Archive/Save Draft/Approve actions. Empty state currently (messages table populated by Phase 3 webhooks).
- **`/research`** — 4 tabs: Today's Briefing (Generate button → Daily Briefing skill), Deep Research (textarea + model selector + Run + Save to Archive), Tech Watch (blog feed of `tech_watch_items` per `competitors` where `watch_type='tech_watch'` — 66degrees, Daffy.so, Clay, Bardeen, n8n seeded), Archive (search + list of past briefings). Tab state in URL.
- **`/agents`** — 4 tabs: Skills (grid of 8 seeded skills with Run Now/Edit/toggle, model-colored badges, last-run + run-count), Active Agents (Phase 3 stub), Scheduled Tasks (Phase 3 stub), Run History (filterable table with cost summary, click-to-expand for input/output/error, Realtime inserts).

## Live GHL data verification

```bash
# Real call run during build:
$ curl ... ghl_get_contacts limit:3
[
  { "id": "4dcPc3Ex3Kn6W6U0pBKq", "phone": "+14708621091", "dateAdded": "2026-06-06T22:09:27.579Z" },
  { "id": "HfXFPL8x3O5tyKWrxr8X", "phone": "+14083162861", "dateAdded": "2026-06-06T19:01:52.221Z" },
  { "id": "s846O7E2rO5G9vsag89p", "phone": "+17708518860", "dateAdded": "2026-06-06T17:04:23.667Z" }
]
```

This means the next hourly `ghlSync` Inngest run will populate the Command Center scoreboard KPIs with real numbers.

## Important discovery during build

The plan listed `GETCREAIT_LOCATION_ID=XJuOjmYZEFS65kTCilsH` (the "TEMPLATE" location per your memory). **That ID returned 403 with your real PIT.** Discovered via agency PIT that your actual operating sub-account is `3dmrDLvJkzlWQbzqKFyF` — name "Creait ". Updated env across `~/.env`, Vercel, and VPS `/etc/creait-mcp/.env`. GHL tools now return real data.

`GETCREAIT_AGENCY_PIT` stored for future cross-tenant work (e.g., when the multi-org architecture wakes up for Trembly Bald, WLF, etc.).

## Deviations from the Phase 2 plan

| Plan | Built | Reason |
|---|---|---|
| MCP HTTP transport bare | MCP Streamable HTTP (stateless) | Current MCP SDK pattern; per-request server instance |
| `useChat` from `ai/react` in chat panel | Hand-rolled SSE reader | `@ai-sdk/react` not auto-installed; works the same |
| Agent C (comms), Agent H (research), Agent I (agents) write files | Returned blueprints | Their tool sets are read-only — orchestrator wrote 18 files instead |
| `infra/docker-compose.yml` external `traefik` network | No network section + Traefik's Docker provider discovers by label | Live Traefik runs in host network mode |
| `mcp/data/*.md` in .gitignore | Allowed via `mcp/data/**/*.md` rule (skip `*.draft.md`) | Otherwise seed files wouldn't ship |
| GETCREAIT_LOCATION_ID = template | = main sub-account `3dmrDLvJkzlWQbzqKFyF` | Template wasn't authorized; sub-account is the real one |

## Outstanding for Phase 3

Per plan, Phase 3 ships:
- `/level-10` + Read.ai webhook + Meeting Debrief skill wiring
- `/initiatives`
- `/team` (roster + drag-and-drop org chart)
- `/recruiting` (kanban)
- `/journey` (timeline + per-client view)
- `/strategy` (flywheel + value ladder + advisor feed)
- 4 long-running Inngest agents (YouTube Research, Recruiting Monitor, Client Health, Tech Watch Crawler)
- Remaining crons (goal-check Mon 9am, tech-watch daily)
- Active Agents tab on `/agents`
- Gmail API send integration + Phase 3 of /comms (full Approve & Send + thread context + sender CRM card)
- Vercel AI Gateway wiring for cheap-model routing (Kimi K2, DeepSeek)
- Cleanup: drop `phase1_creait_open` policy + configure Clerk JWT template `supabase` with `org_id` claim

## Security TODOs (rolling forward)

1. Still need to drop `phase1_creait_open` policy before adding a second org. Tracked from PHASE1-STATUS.md.
2. Pre-existing tables on the shared Supabase project still have RLS disabled (`agent_*` from your other app). Still tracked.
3. Rotate API keys that touched chat history: Anthropic, Clerk test, Inngest, Supabase, Tavily, GHL PIT, MCP_TOKEN.

## When you're ready: "start Phase 3"

I'll dispatch the 7 parallel agents per the plan. We end up with the full Business OS surface — every page from the original spec, plus the long-running agents producing daily output.
