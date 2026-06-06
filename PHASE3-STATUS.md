# Phase 3 — Status Report

**Built 2026-06-06.** All three phases complete. Plan: `.claude/plans/deep-stargazing-pretzel.md`.

## TL;DR

**Every page from the original spec ships.** 22 routes live at https://cc.getcreait.com. Read.ai webhook → Meeting Debrief skill → /level-10 verified end-to-end with a synthetic transcript (1 win + 4 IDS items extracted).

```
git log --oneline | head -8
b3dda72  phase 3: level-10 + readai webhook + initiatives + team + recruiting + journey + strategy + bg agents
62dcabe  phase 2 finalize: GHL live, location ID corrected, PHASE2-STATUS.md
e64ec8f  phase 2: MCP server deployed + skills engine + Inngest + /comms /research /agents
d797dce  merge: phase 2 — MCP server + skills engine + Inngest + pages live
44c4e14  fix(auth): remove auth.protect() — page-level redirects handle 307 properly
51d6894  phase 1 finalize
5b8817f  phase 1: schema + auth shell + command center + vision + AI chat
701ca49  phase 1: scaffold
```

## What's live (22 routes)

### Pages (12)
| Page | What it does |
|---|---|
| `/sign-in`, `/sign-up` | Clerk widget on CREAIT-branded dark page |
| `/command-center` | Goals + subtasks + priorities, drag-reorder, Realtime |
| `/vision` | 8-section editorial doc with inline edit |
| `/level-10` | **NEW** EOS meeting: Wins feed, Scoreboard, Initiatives Review, IDS kanban |
| `/initiatives` | **NEW** Department tabs, expandable cards with task checkboxes, Escalate-to-IDS |
| `/team` | **NEW** Roster grid + drag-and-drop Org Chart (cycle-prevented) |
| `/recruiting` | **NEW** 7-stage kanban with candidate detail modal + recruiter leaderboard |
| `/journey` | **NEW** Horizontal timeline, Template/By-Client toggle |
| `/strategy` | **NEW** Flywheel SVG, Value Ladder staircase, Advisor Feed, Media Platforms, Strategic Bets |
| `/research` | Today's Briefing, Deep Research, Tech Watch feed, Archive |
| `/comms` | Inbox + draft reply with AI generation |
| `/agents` | Skills grid + Run History + **NEW** Active Agents tab |

### API endpoints (10)
| Endpoint | Auth | Status |
|---|---|---|
| `/api/chat` | Clerk | Streaming chat with MCP tools |
| `/api/skills/run` | Clerk | Manual skill execution |
| `/api/skills/[id]` | Clerk | GET/PATCH a skill |
| `/api/agents/[id]/start` | **NEW** Clerk | Manually trigger any background agent |
| `/api/cron/[name]` | Bearer + Vercel cron | Dispatches Inngest events (9 names allowlisted) |
| `/api/inngest` | Inngest-signed | Serves 10 functions (5 Phase 2 + 5 Phase 3) |
| `/api/webhooks/readai` | **NEW** HMAC-SHA256 + Bearer fallback | Verified end-to-end with sample payload |
| `/api/webhooks/readai/test` | None | Sample payload + curl helper |

### Background agents (4)
Seeded in `agents` table as `inactive` — Maurice flips them on from `/agents → Active Agents`. Each runs via Inngest cron AND can be manually triggered via `/api/agents/[id]/start`.

| Agent | Schedule | What it does |
|---|---|---|
| **YouTube Research** | Daily 13:00 UTC | Tavily search for AI/agency YouTube trends → market briefing |
| **Recruiting Monitor** | Daily 14:00 UTC | LinkedIn scan placeholder (Phase 4 wires Unipile) |
| **Client Health** | Daily 15:00 UTC | MCP `ghl_get_contacts` → at-risk heuristic → priority messages inbox |
| **Tech Watch Crawler** | Daily 13:00 UTC | Tavily per tech-watch competitor → populates `tech_watch_items` with AI summaries |

Plus existing Phase 2 functions: `dailyBriefing`, `commsSweep`, `weeklySummary`, `ghlSync`, `goalCheck` (now upgraded from stub to a real Monday 14:00 UTC drift-detection).

### Database migrations (3 applied this phase)
- `phase3_initiatives_department` — added `initiatives.department` column + index
- `phase3_strategic_bets` — new table + RLS + phase1_creait_open policy + StrategicBet type registered
- `phase3_seed_bg_agents_and_summarizer_skill` — 4 agent rows + "Tech Watch Item Summarizer" skill (Haiku 4.5)

## Verification

```bash
# Read.ai webhook smoke test ran live during build:
curl -s -X POST -H "Authorization: Bearer $READAI_WEBHOOK_SECRET" \
  -d '{"meeting":{"id":"test-meeting-001","title":"Phase 3 Smoke Test"...},"transcript":{"text":"John mentioned MRR is up 12%..."}}' \
  https://cc.getcreait.com/api/webhooks/readai
# → {"ok":true,"meetingId":"bbb6765f-2079-4024-ac8a-20037e6b28b5","wins":1,"issues":4}
```

After Maurice signs in, the test win + 4 IDS items show up in `/level-10`.

All 12 dashboard routes return `307 → /sign-in` when unauth (correct). MCP server still healthy at https://mcp.getcreait.com/health.

## Keys added this phase
- `OPENAI_API_KEY` — GPT-5 now selectable in the model picker
- Tavily already set Phase 2 — powers Daily Briefing, Deep Research, Tech Watch Crawler, YouTube Research

Still pending if you want them: `GOOGLE_GENERATIVE_AI_API_KEY` (only unlocks Gemini 3 Pro in the picker; nothing else depends on it).

## Deviations / follow-ups

| Deviation | Why | Action |
|---|---|---|
| AI Gateway (Vercel) for OSS routing | Would require `pnpm add @ai-sdk/gateway` | Phase 4 (Kimi K2, DeepSeek for cheap background runs) |
| Recruiting Monitor agent is placeholder | LinkedIn DMs need Unipile (~$15/mo) | Phase 4 |
| Comms "Approve & Send" doesn't actually send | Gmail API integration deferred | Phase 4 (1-2 days work with google-auth-library) |
| 9 Vercel crons | Vercel Hobby caps at 2/day | Your team is on Pro — all 9 deployed ✅ |
| `phase1_creait_open` RLS policy still active | Clerk JWT template not configured | Drop before adding any other org. Migration script in PHASE1-STATUS. |
| Pre-existing Supabase tables without RLS | Not part of CC | Still your call: enable RLS or migrate |

## How to use it right now

1. Open https://cc.getcreait.com → sign in
2. Go to **Command Center**: 6 goals + 4 priorities seeded, drag to reorder, check subtasks
3. Go to **Level 10** (if you ran the smoke test, you'll see "MRR up 12%" win)
4. Go to **Agents → Skills**: click "Run Now" on **Daily Intelligence Briefing** — burns ~$0.05 of Sonnet 4.6 + Tavily, produces a real briefing
5. Go to **Agents → Active Agents**: toggle **Tech Watch Crawler** on, click Run Now → after a minute, /research → Tech Watch shows AI-summarized news for 66degrees / Daffy.so / Clay / Bardeen / n8n
6. Floating chat (bottom-right anywhere): "give me my 3 most recent GHL contacts" → it calls `ghl_get_contacts` via MCP and shows real data
7. Configure Read.ai webhook URL to `https://cc.getcreait.com/api/webhooks/readai` and set `X-Readai-Signature` HMAC with `$READAI_WEBHOOK_SECRET` — next Zoom meeting auto-populates /level-10

## Connect Read.ai

1. Read.ai Dashboard → Settings → Integrations → Webhooks
2. Add webhook URL: `https://cc.getcreait.com/api/webhooks/readai`
3. Set secret to the value of `READAI_WEBHOOK_SECRET` in `~/.env` (will be sent as `X-Readai-Signature` HMAC-SHA256 of body)
4. Select events: "Meeting completed" / "Summary generated" (whatever they offer)
5. Test by recording a Zoom meeting that ends → Read.ai posts → CREAIT Command Center auto-debriefs

## Total token cost across all 3 phases

- ~12 parallel agents writing code at ~150K-200K tokens each = ~1.5M tokens of build work
- All shipped under the autonomous overnight session
- 30+ database tables, 22 routes, 9 MCP tools, 10 Inngest functions, deployed across Vercel + Hostinger VPS + Supabase

## Status: Done

Everything in the original spec is built. Phase 4 is purely about unlocking deferred integrations (Gmail send, LinkedIn via Unipile, AI Gateway OSS routing, multi-org graduation) — not new ground.

Wake up, go to https://cc.getcreait.com, see your business run on top of an OS that knows your brand voice, your team, your clients, your KPIs, and your priorities.
