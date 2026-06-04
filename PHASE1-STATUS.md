# Phase 1 — Status Report

**Built overnight 2026-06-04 → 2026-06-05.** Plan: `.claude/plans/deep-stargazing-pretzel.md`.

## TL;DR

Phase 1 shipped to `main`. Local build + typecheck green. Supabase schema applied and seeded with real CREAIT data. Dev server boots, sign-in renders, protected routes redirect correctly. **Not yet deployed to Vercel — needs DNS + a 5-minute Vercel link step (Phase 0 leftovers).**

```
git log --oneline
5b8817f phase 1: schema + auth shell + command center + vision + AI chat
701ca49 phase 1: scaffold Next.js 15 + shadcn + CREAIT brand + MCP stub
```

## What runs right now

```bash
cd ~/code/Creait_Command-center/web
pnpm dev    # http://localhost:3000
```

You'll see:
1. `/` redirects to `/sign-in`
2. `/sign-in` renders the CREAIT-branded Clerk widget on dark theme
3. After sign-in (you'll need to create an account on the Clerk test instance), `/command-center` renders 4 priorities + 3 timeframe columns with the seeded goals
4. `/vision` shows the editorial document populated from the CREAIT soul file
5. Floating chat widget on every page; pick a model; chat with page-aware context (Anthropic works; OpenAI/Google will 400 cleanly until those keys are added)

## Supabase project: `choxhzsfmiftdaanrkpa`

**Applied migrations:**
- `phase1_init_schema` — 25 tables, 14 indexes, 8 realtime publications, RLS enabled on all, strict `org_isolation` policy via JWT claim
- `phase1_creait_open_access` — TEMPORARY permissive policy `phase1_creait_open` on every table that allows access where `org_id = 'creait'`. **This bypasses Clerk JWT for now.**

**Seeded data:**
| Table | Rows | Notes |
|---|---|---|
| `goals` | 6 | Across week/month/quarter from 90-day plan |
| `company_priorities` | 4 | "Hit $6K MRR" etc. |
| `team_members` | 4 | Maurice (admin), John, Jaylyn, Ashaela |
| `kpis` | 5 | MRR, Active Deals, Conversations 7d, Calls Booked 7d, New Contacts 7d (all 0 until GHL sync) |
| `skills` | 8 | Spec's 8 default skills with Sonnet 4.6 / Opus 4.7 model IDs |
| `competitors` | 5 | 66degrees, Daffy.so, Clay, Bardeen, n8n (all `watch_type=tech_watch`) |
| `journey_milestones` | 7 | Intake → 90d review |
| `strategy` | 1 | Pulled from `~/Desktop/.../hermes-agents-souls/creait-SOUL.md` |

## ⚠️ Security items to address before adding any other org

1. **`phase1_creait_open` policy must be dropped before adding Trembly Bald, WLF, etc.** It allows anon-key access to all `creait` rows. To remove:
   ```sql
   DO $$ DECLARE t TEXT;
   BEGIN FOR t IN SELECT tablename FROM pg_policies WHERE policyname='phase1_creait_open' LOOP
     EXECUTE format('DROP POLICY phase1_creait_open ON %I', t); END LOOP; END $$;
   ```
   Then configure Clerk JWT template `supabase` to inject `org_id` claim, and create a Supabase server client that passes the Clerk session token to enforce the strict `org_isolation` policy.

2. **Pre-existing Supabase tables without RLS** (not part of this project):
   `agent_goals`, `agent_registry`, `agent_tasks`, `agent_comments`, `agent_documents`, `agent_activity_logs` — these belong to another app on the same Supabase project and have RLS DISABLED. Anyone with the anon key can read/write all their rows. This is a pre-existing issue, separate from Command Center, but you should fix it. Either enable RLS with proper policies on each, or move them to a different Supabase project.

## Phase 0 items still pending (block production deploy)

| Item | What's needed |
|---|---|
| **DNS records (Hostinger)** | A `mcp.getcreait.com → 2.24.116.77` · CNAME `cc.getcreait.com → cname.vercel-dns.com` |
| **Clerk dashboard** | Enable Organizations on app `app_3EeuMhAyKWRXwdaeOld6d5cBU0e`, create "CREAIT" org, invite the 3 co-owners, create JWT template named `supabase` with `org_id` claim |
| **API keys** | `OPENAI_API_KEY` (you said you have it — wasn't pasted), `GOOGLE_GENERATIVE_AI_API_KEY` (aistudio.google.com), `TAVILY_API_KEY` (app.tavily.com), `GETCREAIT_PIT` (your GHL PIT — memory has the value format) |
| **Vercel project link** | `cd web && vercel link` (interactive — pick team `creaits-projects`, name `creait-cc`), then `vercel env pull` and `vercel --prod` |
| **Vercel domain** | `vercel domains add cc.getcreait.com` after DNS propagates |
| **Rotate secrets in transcript** | The Anthropic, Clerk test, Inngest, and Supabase keys were pasted in chat — rotate them in their respective dashboards before going to prod |

## Deviations from the plan (locked at planning time, deviated during build)

| Plan said | Built | Reason |
|---|---|---|
| Next.js 14 | Next.js 16.2.7 | `create-next-app@latest` pulled current stable. Codebase has `AGENTS.md` warning about Next 16 breaking changes; we adapted. |
| `middleware.ts` | `proxy.ts` | Next 16 renamed the convention. Clerk supports both; we use the new name to silence build warnings. |
| `parent_goal_id` on goals (for "ladders up to" tag) | Not in schema | Agent A omitted it. Easy to add via follow-up migration if you want the ladder feature. |
| `useChat` from `ai/react` | Hand-rolled SSE reader in `<ChatPanel />` | `@ai-sdk/react` not auto-installed; Agent D wrote a thin streaming client. Swap for `useChat` later by adding `pnpm add @ai-sdk/react`. |
| AI SDK v4 `toDataStreamResponse()` + `maxSteps` | AI SDK v6 `toUIMessageStreamResponse()` + `stopWhen: stepCountIs(5)` | The installed AI SDK is v6, API surface changed. |
| Strategy has `tagline` column | No tagline column | Agent A modeled it via `brand_positioning`. Wordmark page hardcodes "Stop Losing Customers. Start Growing." until you wire it. |
| `goals.completion_percent`, `subtasks.is_complete`, `priorities.label` | `goals.progress`, `subtasks.done`, `priorities.title` | Agent A used cleaner names. Field-name reconciliation done across all Agent C files. |

## What Phase 2 will add (per plan)

- Second Brain + GHL MCP server (Docker → VPS at `mcp.getcreait.com`)
- `/lib/skills-engine.ts` + `/api/skills/run` + Inngest events for the 8 seeded skills
- `/comms` page + Draft Reply skill
- `/research` page (Today's Briefing + Deep Research tabs)
- `/agents` page (Skills tab + Run History)
- 4 of the 5 cron jobs

## Files of interest (start here when reviewing)

- Plan: `.claude/plans/deep-stargazing-pretzel.md`
- Schema: `web/supabase/migrations/0001_init.sql`
- Seed: `web/scripts/seed-creait.ts`
- Auth: `web/proxy.ts`, `web/app/layout.tsx`, `web/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- Dashboard shell: `web/app/(dashboard)/layout.tsx`, `web/components/dashboard/`
- Command Center: `web/app/(dashboard)/command-center/page.tsx`, `web/components/command-center/`
- Vision: `web/app/(dashboard)/vision/page.tsx`, `web/components/vision/vision-document.tsx`
- AI: `web/lib/ai.ts`, `web/lib/context-builder.ts`, `web/app/api/chat/route.ts`, `web/components/dashboard/chat-panel.tsx`
- MCP stub: `mcp/src/server.ts`, `mcp/Dockerfile`
- Infra: `infra/docker-compose.yml`, `infra/README.md`

## When you're ready for Phase 2

Say "start Phase 2" and I dispatch 5 parallel agents per the plan. We'll deploy the MCP server to your VPS first thing.
