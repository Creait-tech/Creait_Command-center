# CREAiT Command Center

Internal business OS for CREAIT (AI consulting agency, Atlanta — 4 co-founders: Maurice Grant, John McGhee, Ashaela Bowen, Jaylyn Maddox). This is the company's system of record: EOS-style meetings, Rocks, To-Dos, Issues, a GHL-fed scoreboard, and the War Room (searchable memory of every meeting).

**Live:** cc.getcreait.com (production, `main` auto-deploys via Vercel Git integration — project `creait-cc`, Root Directory = `web`). Companion MCP server at mcp.getcreait.com (Hostinger VPS, separate deploy, 25 tools).

## Architecture

- `web/` — Next.js (App Router) + Clerk (Organizations; org `org_3Ef1YcutwEZFZHEMLwhF57jbEEh` = CREAIT, all four founders are org:admin) + Supabase Postgres (project `choxhzsfmiftdaanrkpa`, RLS keyed on Clerk org_id claim) + Inngest (crons + events) + Tailwind + Base UI.
- `mcp/` — the MCP server source (deployed separately to the VPS).
- Key routes: `/command-center` (scoreboard), `/level-10` (EOS meeting runner, 8 meeting types), `/war-room` (transcript search), `/meetings`, `/rocks`, `/todos`, `/clients`, `/agents`.
- Background jobs live in `web/lib/inngest-functions.ts`; each has BOTH a cron trigger and a `cron/<name>` event trigger fired by `GET /api/cron/[name]` (auth: `Bearer CRON_SECRET` or Vercel cron headers).

## Data flows (all verified working)

1. **GHL → scoreboard (near-real-time):** GHL workflow "Command Center Sync" (5 triggers) POSTs to `/api/webhooks/ghl?token=GHL_WEBHOOK_SECRET` → fires `ghl/changed` → `ghlChangeRelay` (2-min debounce) → `cron/ghl-sync` → KPIs. Hourly cron is the backstop. GHL location: `3dmrDLvJkzlWQbzqKFyF` (app.getcreait.com).
2. **Zoom → War Room (daily 6am ET):** `zoomSync` in `lib/zoom-sync.ts` pulls cloud recordings via Server-to-Server OAuth (`ZOOM_ACCOUNT_ID/ZOOM_S2S_CLIENT_ID/ZOOM_S2S_CLIENT_SECRET`), converts VTT transcripts, upserts into `meetings` keyed on `(source='zoom', source_id=uuid)`. Idempotent — only fills gaps.
3. **Read.ai webhook** (`/api/webhooks/readai`) exists but Read.ai has only ever delivered once; Zoom sync supersedes it.
4. **First-login onboarding:** `components/onboarding/welcome-tour.tsx`, flag in Clerk `unsafeMetadata.ccTourDone`, replay with `?tour=1`.

## Hard-won gotchas — read before coding

- **Inngest functions are NOT auto-registered on deploy.** After adding/changing a function: `curl -X PUT https://cc.getcreait.com/api/inngest`. Forgetting this = events silently do nothing.
- **This repo uses Base UI, not Radix.** No `asChild`; use the `render={<Component/>}` prop (see `components/ui/dialog.tsx`).
- **PostgREST `.or()` filter strings use `*` as the ilike wildcard**, not `%` (see `war-room/page.tsx`).
- **`meetings.meeting_type` has a CHECK constraint** — the value list must stay in sync with `web/lib/meeting-agendas.ts` (8 EOS types + legacy values; migration `0002_meeting_types.sql`).
- The Next.js version here has breaking changes vs training data — read `web/AGENTS.md` and `node_modules/next/dist/docs/` before assuming APIs.
- **GHL MCP tools now paginate** (fixed 2026-08-06). `ghl_get_contacts`, `ghl_get_opportunities`, and `ghl_get_conversations` return `{ total, count, truncated, items[] }` — `total` is GHL's exact count, `items` is capped by the call's `limit`, and `truncated` says whether you're seeing everything. `ghl_get_opportunities` also returns `openCount`/`openValue` so every consumer shares one definition of "open". Read `total` for counts; never treat `items.length` as a population. (Real scale: ~8k contacts, ~1.2k opportunities, ~2.1k conversations — the old 100-cap was silently reporting floors as totals onto the scoreboard.)
- `updated_at` columns have no triggers — don't trust them; `cc_kpi_history.recorded_at` is the reliable sync evidence.
- A pre-existing React #418 hydration warning fires once per page on every route — cosmetic, known, unrelated to new work.

## Secrets

`web/.env.local` (never committed) mirrors Vercel env: Supabase (URL + service role), Clerk, Inngest (event + signing keys), `CRON_SECRET`, `GHL_WEBHOOK_SECRET`, `GETCREAIT_PIT`/`GETCREAIT_LOCATION_ID`, Zoom S2S trio, Anthropic/OpenAI/Resend/Tavily. On a new machine, copy it securely from Maurice's Mac or read values from Vercel → Settings → Environment Variables. Most work doesn't need a local run — push to `main` deploys.

## Business context (why things are the way they are)

CREAIT's H2 2026 plan: revenue floor $67K/mo (each founder draws $10K), reached via a single offer ladder — free Tuesday class → $1,500 Constraint Session → $7,500 Growth & AI Diagnostic (max 4/mo capacity) → Builds $4.5–14K → **Advisory $2.5–3.5K/mo (the floor comes from retainers stacking)** → $297/mo volume lane + Telarus residuals. Current real MRR: $1,485. The one rule: nothing off-ladder gets built or sold before January.

Team docs live in the Google Drive folder "CREAiT Team Library" and as claude.ai artifacts (Game Plan, Client Map, Offer Docs, Conversation Engine, H2 Operating Plan, One System) — the START HERE doc in Drive links everything.

## Conventions

- Conventional commits (`feat:`, `fix:` …), no AI attribution lines.
- Never work directly against production data without checking; Supabase service role bypasses RLS.
- When adding a cron: entry in `ALLOWED_NAMES` (`app/api/cron/[name]/route.ts`) + `triggers` in the function + register with Inngest after deploy.
