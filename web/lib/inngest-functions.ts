import { inngest } from '@/lib/inngest'
import { callMcpTool, extractMcpJson, mcpResultIsError } from '@/lib/mcp-client'
import { runSkill } from '@/lib/skills-engine'
import { createServiceClient } from '@/lib/supabase/server'
import { tavilySearch, type TavilyResult } from '@/lib/tavily'
import { sendEmail, markdownToEmailHtml } from '@/lib/email'
import { CREAIT_ORG_ID } from '@/lib/active-org'
import type { MessageDirection, MessageSource } from '@/lib/supabase/types'

/**
 * Inngest functions for the CREAIT Command Center.
 *
 * Each scheduled function:
 *   - Has an Inngest-native cron trigger (single source of truth for "the
 *     job ran at this time").
 *   - Also accepts an `event: 'cron/<name>'` trigger so the Vercel cron
 *     route (`/api/cron/[name]`) can fire the same job. This gives us a
 *     manual escape hatch + lets Vercel's UTC cron config back up
 *     Inngest's scheduler.
 *
 * Background jobs have no Clerk session, so they run against the primary
 * CREAIT workspace by its stable Clerk org id.
 */

// TODO: per-org Inngest events (fan out one job per org for true multi-tenant)
const ORG_ID = CREAIT_ORG_ID

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a skill id by its canonical `name` for the current org. Returns
 * `null` if the skill isn't seeded yet so the function can skip cleanly
 * instead of erroring.
 */
async function getSkillId(name: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('skills')
    .select('id')
    .eq('org_id', ORG_ID)
    .eq('name', name)
    .maybeSingle()
  if (error) {
    console.error(`[inngest] getSkillId("${name}") failed:`, error.message)
    return null
  }
  return (data?.id as string | undefined) ?? null
}


/**
 * Snapshot every KPI for an org into `cc_kpi_history` so trend charts have a
 * time-series to draw. Reads the current `kpis` rows and inserts one history
 * row per KPI with its current value. Covers manually-edited KPIs (which never
 * flow through ghlSync) so their history accumulates too.
 *
 * Best-effort — logs and returns a count rather than throwing, so a history
 * failure never breaks the sync that produced the values.
 */
export async function snapshotKpis(orgId: string): Promise<{ inserted: number }> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('kpis')
      .select('id, value')
      .eq('org_id', orgId)
    if (error) {
      console.error('[inngest] snapshotKpis read failed:', error.message)
      return { inserted: 0 }
    }
    const rows = (data ?? [])
      .filter(
        (k): k is { id: string; value: number } =>
          typeof k.id === 'string' &&
          typeof k.value === 'number' &&
          !Number.isNaN(k.value),
      )
      .map((k) => ({ kpi_id: k.id, org_id: orgId, value: k.value }))
    if (rows.length === 0) return { inserted: 0 }
    const { error: insertError } = await supabase
      .from('cc_kpi_history')
      .insert(rows)
    if (insertError) {
      console.error('[inngest] snapshotKpis insert failed:', insertError.message)
      return { inserted: 0 }
    }

    await maintainWeeklyScorecard(orgId, rows)
    return { inserted: rows.length }
  } catch (err) {
    console.error('[inngest] snapshotKpis threw:', err)
    return { inserted: 0 }
  }
}


/**
 * Keep the weekly scorecard current.
 *
 * `cc_kpi_history` is an hourly snapshot; the Level 10 scorecard reads one
 * number per KPI per week. Without this, the grid would only ever hold the
 * weeks that were backfilled once and every future column would be blank.
 *
 * The hard rule is that a human correction wins. An operator who fixes last
 * week's "100 emails" to 80 must see 80 stay at 80 — a number that reverts an
 * hour later is worse than no correction at all, because the team acts on it
 * in the meeting. So rows the sync owns (`source='sync'`) are refreshed with
 * the week's latest reading, and rows a person typed (`source='manual'`) are
 * left alone forever.
 *
 * Best-effort: a scorecard write must never fail the sync that produced the
 * numbers.
 */
async function maintainWeeklyScorecard(
  orgId: string,
  rows: Array<{ kpi_id: string; org_id: string; value: number }>,
): Promise<void> {
  if (rows.length === 0) return
  try {
    const supabase = createServiceClient()

    // Monday of the current week in the company's timezone. Week boundaries
    // are a local-calendar idea; bucketing by UTC would move Sunday evening
    // entries into the following week for an Atlanta team.
    const nowEastern = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
    )
    const dayOffset = (nowEastern.getDay() + 6) % 7 // Monday = 0
    nowEastern.setDate(nowEastern.getDate() - dayOffset)
    const weekStart = nowEastern.toISOString().slice(0, 10)

    const kpiIds = rows.map((r) => r.kpi_id)
    const { data: existing, error: readError } = await supabase
      .from('cc_kpi_weekly')
      .select('kpi_id, source')
      .eq('org_id', orgId)
      .eq('week_start', weekStart)
      .in('kpi_id', kpiIds)

    if (readError) {
      console.error(
        '[inngest] weekly scorecard read failed:',
        readError.message,
      )
      return
    }

    const humanOwned = new Set(
      ((existing as Array<{ kpi_id: string; source: string }> | null) ?? [])
        .filter((r) => r.source === 'manual')
        .map((r) => r.kpi_id),
    )

    const writable = rows
      .filter((r) => !humanOwned.has(r.kpi_id))
      .map((r) => ({
        org_id: orgId,
        kpi_id: r.kpi_id,
        week_start: weekStart,
        value: r.value,
        source: 'sync' as const,
        updated_at: new Date().toISOString(),
      }))

    if (writable.length === 0) return

    const { error: upsertError } = await supabase
      .from('cc_kpi_weekly')
      .upsert(writable, { onConflict: 'kpi_id,week_start' })
    if (upsertError) {
      console.error(
        '[inngest] weekly scorecard upsert failed:',
        upsertError.message,
      )
    }
  } catch (err) {
    console.error('[inngest] maintainWeeklyScorecard threw:', err)
  }
}

// ---------------------------------------------------------------------------
// Scheduled skill runs
// ---------------------------------------------------------------------------

/**
 * Daily intelligence briefing — 7am ET every day. Pulls overnight news,
 * client signal, competitor moves, and writes to research_briefings via the
 * skill prompt.
 */
export const dailyBriefing = inngest.createFunction(
  {
    id: 'daily-briefing',
    name: 'Daily Intelligence Briefing',
    triggers: [
      { cron: 'TZ=America/New_York 0 7 * * *' },
      { event: 'cron/daily-briefing' },
    ],
  },
  async ({ step }) => {
    const skillId = await step.run('lookup-skill', () =>
      getSkillId('Daily Briefing'),
    )
    if (!skillId) {
      return { skipped: 'Daily Briefing skill not seeded' }
    }
    const result = await step.run('run-skill', () =>
      runSkill(
        skillId,
        { date: new Date().toISOString().slice(0, 10) },
        {
          orgId: ORG_ID,
          triggeredBy: 'cron:daily-briefing',
          trigger: 'cron',
        },
      ),
    )

    // Email Maurice the briefing if RESEND is wired and DAILY_BRIEFING_TO is set.
    const emailRes = await step.run('email-briefing', async () => {
      const to = process.env.DAILY_BRIEFING_TO ?? process.env.MAURICE_EMAIL
      if (!to) return { skipped: 'DAILY_BRIEFING_TO not set' }
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#0a0e1a;color:#f1f5f9">
          <h1 style="color:#3b82f6;font-size:22px;margin:0 0 8px 0">CREAIT Daily Briefing</h1>
          <p style="color:#94a3b8;font-size:13px;margin:0 0 24px 0">${today}</p>
          <div style="color:#f1f5f9;font-size:14px">${markdownToEmailHtml(result.output)}</div>
          <hr style="border:none;border-top:1px solid #2a3447;margin:24px 0">
          <p style="color:#94a3b8;font-size:11px">
            Full dashboard: <a href="https://cc.getcreait.com/command-center" style="color:#3b82f6">cc.getcreait.com</a>
          </p>
        </div>
      `
      return sendEmail({ to, subject: `CREAIT Briefing — ${today}`, html })
    })

    return { runId: result.runId, outputLength: result.output.length, email: emailRes }
  },
)

// ---------------------------------------------------------------------------
// Comms ingestion (GHL conversations → messages)
// ---------------------------------------------------------------------------

/**
 * Conversations are fetched newest-first, so this is "the N most recently
 * active conversations", not "the first N GHL happens to return". At a 15-min
 * cadence 200 is far more than a quarter-hour of real activity across an
 * account with ~2.1k conversations.
 */
const COMMS_INGEST_FETCH_LIMIT = 200

/**
 * How far back a conversation's last message may be and still be ingested.
 * Bounds the first run: without it the initial sweep would backfill months of
 * dormant threads into the inbox as if they were new.
 */
const COMMS_INGEST_LOOKBACK_DAYS = 30

/** GHL email bodies carry entire quoted threads. Store a readable slice. */
const COMMS_INGEST_MAX_BODY_CHARS = 4000

/** The GHL channels the Comms Hub can both display and reply through. */
type GhlMessageSource = Extract<MessageSource, 'ghl_sms' | 'ghl_email' | 'ghl_dm'>

/**
 * `lastMessageType` → `messages.source`. Only conversational channels earn a
 * row: TYPE_CALL / TYPE_NO_SHOW / TYPE_ACTIVITY_* carry no repliable text and
 * would be inbox noise (16 of the first 100 conversations in the live account
 * are TYPE_NO_SHOW with an empty body).
 */
const GHL_TYPE_TO_SOURCE: Record<string, GhlMessageSource> = {
  TYPE_SMS: 'ghl_sms',
  TYPE_CUSTOM_SMS: 'ghl_sms',
  TYPE_CUSTOM_PROVIDER_SMS: 'ghl_sms',
  TYPE_EMAIL: 'ghl_email',
  TYPE_CUSTOM_EMAIL: 'ghl_email',
  TYPE_CUSTOM_PROVIDER_EMAIL: 'ghl_email',
  TYPE_WHATSAPP: 'ghl_dm',
  TYPE_FACEBOOK: 'ghl_dm',
  TYPE_INSTAGRAM: 'ghl_dm',
  TYPE_GMB: 'ghl_dm',
  TYPE_LIVE_CHAT: 'ghl_dm',
  TYPE_WEBCHAT: 'ghl_dm',
}

/** A GHL conversation mapped onto the `messages` shape, pre-scoring. */
interface CommsCandidate {
  source: GhlMessageSource
  source_id: string
  thread_id: string
  contact_name: string | null
  contact_handle: string | null
  direction: MessageDirection
  body: string
  received_at: string
  received_ms: number
  unread_count: number
}

/**
 * Comms ingest — every 15 minutes. Pulls the most recently active GHL
 * conversations through the MCP server and upserts them into `messages` so
 * the Comms Hub is an actual inbox rather than a bot-alert log.
 *
 * Idempotency (the whole point): every row is keyed on a deterministic
 * `source_id` of `ghl:<conversationId>:<lastMessageDate-epoch-ms>`. The same
 * conversation state always produces the same key, so re-running — on the
 * cron, on a webhook relay, or manually via /api/cron/comms-ingest — inserts
 * nothing new. A blind insert here is what previously flooded this table.
 *
 * Scope caveat: `ghl_get_conversations` returns conversation-level rows whose
 * body is the *last message* preview, not the full thread. One inbox item per
 * conversation-state is therefore the ceiling of what's ingestable today; a
 * per-conversation message-fetch MCP tool would raise it.
 */
export const commsIngest = inngest.createFunction(
  {
    id: 'comms-ingest',
    name: 'Comms Ingest (GHL)',
    // Cron and event triggers can fire together. Serializing runs keeps the
    // read-then-insert dedupe below from racing itself.
    concurrency: { limit: 1 },
    triggers: [
      { cron: 'TZ=America/New_York */15 * * * *' },
      { event: 'cron/comms-ingest' },
    ],
  },
  async ({ event, step }) => {
    const overrides = (event?.data ?? {}) as {
      limit?: unknown
      lookbackDays?: unknown
    }
    const fetchLimit = positiveInt(overrides.limit) ?? COMMS_INGEST_FETCH_LIMIT
    const lookbackDays =
      positiveInt(overrides.lookbackDays) ?? COMMS_INGEST_LOOKBACK_DAYS

    const fetched = await step.run('fetch-ghl-conversations', async () => {
      const result = await callMcpTool('ghl_get_conversations', {
        limit: fetchLimit,
      })
      if (mcpResultIsError(result)) {
        console.error(
          '[inngest] comms-ingest: ghl_get_conversations failed:',
          JSON.stringify(extractMcpJson(result))?.slice(0, 300),
        )
        return { candidates: [] as CommsCandidate[], total: null, truncated: false, seen: 0 }
      }

      const { items, total, truncated } = parseMcpList(result)
      const cutoffMs = Date.now() - lookbackDays * 86_400_000
      const candidates: CommsCandidate[] = []
      for (const item of items) {
        const candidate = mapGhlConversation(item, cutoffMs)
        if (candidate) candidates.push(candidate)
      }
      return { candidates, total, truncated, seen: items.length }
    })

    if (fetched.candidates.length === 0) {
      return {
        ok: true,
        fetched: fetched.seen,
        ingestable: 0,
        inserted: 0,
        total: fetched.total,
      }
    }

    const written = await step.run('insert-new-messages', async () => {
      const supabase = createServiceClient()

      // Collapse duplicates inside the batch first (two conversations cannot
      // share a key, but a defensive Map keeps the `.in()` list clean).
      const byKey = new Map<string, CommsCandidate>()
      for (const c of fetched.candidates) byKey.set(c.source_id, c)
      const keys = [...byKey.keys()]

      const { data: existing, error: existingErr } = await supabase
        .from('messages')
        .select('source_id')
        .eq('org_id', ORG_ID)
        .in('source_id', keys)

      if (existingErr) {
        // Fail closed. Inserting without knowing what's already there is how
        // this table ended up with 580 duplicate rows.
        console.error(
          '[inngest] comms-ingest dedupe lookup failed:',
          existingErr.message,
        )
        return { inserted: 0, insertedInbound: 0, skippedExisting: 0 }
      }

      const known = new Set(
        ((existing as Array<{ source_id: string | null }> | null) ?? [])
          .map((row) => row.source_id)
          .filter((id): id is string => Boolean(id)),
      )

      const fresh = [...byKey.values()].filter((c) => !known.has(c.source_id))
      if (fresh.length === 0) {
        return { inserted: 0, insertedInbound: 0, skippedExisting: known.size }
      }

      const clientIdentifiers = await loadClientIdentifiers(ORG_ID)
      const now = Date.now()
      const rows = fresh.map((c) => {
        const isInbound = c.direction === 'inbound'
        return {
          org_id: ORG_ID,
          source: c.source,
          source_id: c.source_id,
          thread_id: c.thread_id,
          contact_name: c.contact_name,
          contact_handle: c.contact_handle,
          direction: c.direction,
          subject: null,
          body: c.body,
          // Only inbound messages get to demand attention. Messages the team
          // already sent are filed as answered so they never show up as work.
          status: isInbound ? ('unread' as const) : ('replied' as const),
          replied_at: isInbound ? null : c.received_at,
          priority_score: commsPriorityScore(c, clientIdentifiers, now),
          received_at: c.received_at,
        }
      })

      const { error } = await supabase.from('messages').insert(rows)
      if (error) {
        console.error('[inngest] comms-ingest insert failed:', error.message)
        return { inserted: 0, insertedInbound: 0, skippedExisting: known.size }
      }
      return {
        inserted: rows.length,
        insertedInbound: rows.filter((r) => r.direction === 'inbound').length,
        skippedExisting: known.size,
      }
    })

    // Ordering: drafting only makes sense once real messages exist, so ingest
    // chains straight into the sweep when it actually landed something new.
    // The 2-hourly `comms-sweep` cron stays as the backstop.
    if (written.insertedInbound > 0) {
      await step.sendEvent('trigger-comms-sweep', {
        name: 'cron/comms-sweep',
        data: { triggeredBy: 'comms-ingest', inbound: written.insertedInbound },
      })
    }

    return {
      ok: true,
      fetched: fetched.seen,
      conversationsTotal: fetched.total,
      truncated: fetched.truncated,
      ingestable: fetched.candidates.length,
      ...written,
    }
  },
)

/**
 * Map one GHL conversation summary onto the `messages` shape. Returns `null`
 * for anything that shouldn't become an inbox item: a non-conversational
 * channel, an empty body, an unusable timestamp, or a last message older than
 * the lookback window.
 */
function mapGhlConversation(
  raw: Record<string, unknown>,
  cutoffMs: number,
): CommsCandidate | null {
  const conversationId = str(raw.id)
  if (!conversationId) return null

  const source = ghlSourceFromType(raw.lastMessageType)
  if (!source) return null

  const receivedMs = toEpochMs(raw.lastMessageDate)
  if (receivedMs === null || receivedMs < cutoffMs) return null

  const body = normalizeBody(raw.lastMessageBody)
  if (!body) return null

  const email = str(raw.email)
  const phone = str(raw.phone)
  const contactHandle = email ?? phone

  return {
    source,
    // Deterministic key: same conversation + same last-message timestamp =>
    // same id, so repeated runs are no-ops and a genuinely new message (which
    // moves lastMessageDate) becomes a new inbox item.
    source_id: `ghl:${conversationId}:${receivedMs}`,
    // The send route replies with `thread_id ?? source_id` as the GHL
    // conversation id, so this must be the bare conversation id.
    thread_id: conversationId,
    contact_name: str(raw.contactName) ?? str(raw.fullName) ?? contactHandle,
    contact_handle: contactHandle,
    direction: ghlDirection(raw),
    body,
    received_at: new Date(receivedMs).toISOString(),
    received_ms: receivedMs,
    unread_count: Math.max(0, Math.trunc(Number(raw.unreadCount ?? 0)) || 0),
  }
}

/** `lastMessageType` → source, with a suffix fallback for custom providers. */
function ghlSourceFromType(value: unknown): GhlMessageSource | null {
  const type = str(value)?.toUpperCase()
  if (!type) return null
  const mapped = GHL_TYPE_TO_SOURCE[type]
  if (mapped) return mapped
  // GHL adds custom-provider variants over time (TYPE_CUSTOM_PROVIDER_*).
  if (type.includes('SMS')) return 'ghl_sms'
  if (type.includes('EMAIL')) return 'ghl_email'
  return null
}

/**
 * Direction of the conversation's last message. GHL reports it explicitly on
 * `lastMessageDirection`; the `unreadCount` fallback only exists so ingestion
 * degrades instead of breaking if the field ever goes missing (GHL only
 * increments unread for inbound messages). The fallback's failure mode is
 * deliberately the safe one: an ambiguous message is filed as outbound, which
 * means it never fabricates work — it can only fail to demand it.
 */
function ghlDirection(raw: Record<string, unknown>): MessageDirection {
  const explicit = (
    str(raw.lastMessageDirection) ??
    str(raw.direction) ??
    ''
  ).toLowerCase()
  if (explicit === 'inbound' || explicit === 'outbound') return explicit
  return Number(raw.unreadCount ?? 0) > 0 ? 'inbound' : 'outbound'
}

/**
 * Priority score, 0–100. Deliberately a readable sum rather than a model call
 * — an operator has to be able to look at a 95 and know why it's a 95.
 *
 *   30  baseline (it's a real client message)
 *  +25  inbound (a human still owes a reply)
 *  +25  arrived in the last 2h  |  +15 last 24h  |  +5 last 7d
 *  +15  the contact is an active client in cc_clients
 *   +5  3 or more unread messages piled up in the thread
 */
function commsPriorityScore(
  candidate: CommsCandidate,
  clientIdentifiers: Set<string>,
  nowMs: number,
): number {
  let score = 30
  if (candidate.direction === 'inbound') score += 25

  const ageMs = nowMs - candidate.received_ms
  if (ageMs < 2 * 3_600_000) score += 25
  else if (ageMs < 86_400_000) score += 15
  else if (ageMs < 7 * 86_400_000) score += 5

  if (isKnownClient(candidate, clientIdentifiers)) score += 15
  if (candidate.unread_count >= 3) score += 5

  return Math.max(0, Math.min(100, score))
}

function isKnownClient(
  candidate: CommsCandidate,
  identifiers: Set<string>,
): boolean {
  if (identifiers.size === 0) return false
  for (const value of [candidate.contact_name, candidate.contact_handle]) {
    for (const token of identityTokens(value)) {
      if (identifiers.has(token)) return true
    }
  }
  return false
}

/**
 * Normalized match tokens for a name / email / phone. Phones reduce to their
 * last 10 digits so `+14045551234` and `(404) 555-1234` collide.
 */
function identityTokens(value: string | null): string[] {
  if (!value) return []
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return []
  const tokens = [trimmed]
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length >= 10) tokens.push(digits.slice(-10))
  return tokens
}

/** Match tokens for every active client, used to boost their messages. */
async function loadClientIdentifiers(orgId: string): Promise<Set<string>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('cc_clients')
    .select('name, contact_name, email, phone')
    .eq('org_id', orgId)
    .eq('status', 'active')
  if (error) {
    console.error('[inngest] comms-ingest client lookup failed:', error.message)
    return new Set()
  }
  const identifiers = new Set<string>()
  for (const row of (data ?? []) as Array<Record<string, string | null>>) {
    for (const field of ['name', 'contact_name', 'email', 'phone'] as const) {
      for (const token of identityTokens(row[field] ?? null)) {
        identifiers.add(token)
      }
    }
  }
  return identifiers
}

/**
 * Collapse GHL's message body into something storable: strip non-breaking
 * spaces, cap runaway blank lines, and truncate the quoted-thread tail.
 */
function normalizeBody(value: unknown): string | null {
  const raw = str(value)
  if (!raw) return null
  const cleaned = raw
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!cleaned) return null
  return cleaned.length > COMMS_INGEST_MAX_BODY_CHARS
    ? `${cleaned.slice(0, COMMS_INGEST_MAX_BODY_CHARS)}…`
    : cleaned
}

/** GHL timestamps are epoch millis; accept ISO strings defensively. */
function toEpochMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return Math.trunc(numeric)
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

/** Non-empty trimmed string, or null. */
function str(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function positiveInt(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

/**
 * Comms sweep — every 2 hours during waking hours. Pulls the top 5
 * unreplied messages and drafts replies via the "Draft Reply" skill. Each
 * message gets its own skill run.
 *
 * Runs after `commsIngest`, which chains into this function whenever it lands
 * new inbound mail so drafts are written against real client messages.
 */
export const commsSweep = inngest.createFunction(
  {
    id: 'comms-sweep',
    name: 'Comms Sweep',
    triggers: [
      { cron: 'TZ=America/New_York 0 */2 * * *' },
      { event: 'cron/comms-sweep' },
    ],
  },
  async ({ step }) => {
    const skillId = await step.run('lookup-skill', () =>
      getSkillId('Draft Reply'),
    )
    if (!skillId) {
      return { skipped: 'Draft Reply skill not seeded' }
    }

    const messages = await step.run('fetch-unreplied', async () => {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from('messages')
        .select('id, source, contact_name, subject, body, received_at')
        .eq('org_id', ORG_ID)
        .eq('direction', 'inbound')
        .neq('status', 'replied')
        .neq('status', 'archived')
        .is('draft_reply', null)
        .order('priority_score', { ascending: false })
        .order('received_at', { ascending: false })
        .limit(5)
      if (error) {
        console.error('[inngest] fetch-unreplied failed:', error.message)
        return []
      }
      return data ?? []
    })

    const runs: Array<{ messageId: string; runId: string }> = []
    for (const msg of messages) {
      const result = await step.run(`draft-${msg.id}`, () =>
        runSkill(
          skillId,
          {
            message_id: msg.id,
            source: msg.source,
            contact_name: msg.contact_name,
            subject: msg.subject,
            body: msg.body,
            received_at: msg.received_at,
          },
          {
            orgId: ORG_ID,
            triggeredBy: 'cron:comms-sweep',
            trigger: 'cron',
          },
        ),
      )

      // Persist the draft onto the message row so the /comms page sees it.
      await step.run(`persist-draft-${msg.id}`, async () => {
        const supabase = createServiceClient()
        const { error } = await supabase
          .from('messages')
          .update({ draft_reply: result.output })
          .eq('id', msg.id)
        if (error) {
          console.error('[inngest] persist-draft failed:', error.message)
        }
      })

      runs.push({ messageId: msg.id as string, runId: result.runId })
    }

    return { drafted: runs.length, runs }
  },
)

/**
 * Weekly company summary — Friday 5pm ET. Rolls up the week's wins, IDS
 * items, KPIs, and meetings into a summary document.
 */
export const weeklySummary = inngest.createFunction(
  {
    id: 'weekly-summary',
    name: 'Weekly Company Summary',
    triggers: [
      { cron: 'TZ=America/New_York 0 17 * * 5' },
      { event: 'cron/weekly-summary' },
    ],
  },
  async ({ step }) => {
    const skillId = await step.run('lookup-skill', () =>
      getSkillId('Weekly Summary'),
    )
    if (!skillId) {
      return { skipped: 'Weekly Summary skill not seeded' }
    }
    const today = new Date().toISOString().slice(0, 10)
    const result = await step.run('run-skill', () =>
      runSkill(
        skillId,
        { week_ending: today },
        {
          orgId: ORG_ID,
          triggeredBy: 'cron:weekly-summary',
          trigger: 'cron',
        },
      ),
    )
    return { runId: result.runId, outputLength: result.output.length }
  },
)

/**
 * Goal-check — Monday 9am ET. Surfaces goal drift: any active goal with
 * a due_date in the next 14 days where progress is below the linear-pace
 * threshold. Writes a digest message into the comms inbox so Maurice sees
 * it during his Monday review.
 *
 * Full goal-drift heuristics (subtask completion velocity, missed dates)
 * land iteratively — this is the v1 nudge.
 */
export const goalCheck = inngest.createFunction(
  {
    id: 'goal-check',
    name: 'Goal Check',
    triggers: [
      { cron: 'TZ=America/New_York 0 9 * * 1' },
      { event: 'cron/goal-check' },
    ],
  },
  async ({ step }) => {
    const drifting = await step.run('detect-drift', async () => {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from('goals')
        .select('id, title, progress, due_date, timeframe')
        .eq('org_id', ORG_ID)
        .eq('status', 'active')
      if (error) {
        console.error('[inngest] goal-check fetch failed:', error.message)
        return []
      }
      const now = Date.now()
      const at_risk: Array<{ id: string; title: string; reason: string }> = []
      for (const g of data ?? []) {
        const due = g.due_date ? new Date(g.due_date).getTime() : null
        const progress = typeof g.progress === 'number' ? g.progress : 0
        if (due && due - now < 14 * 86_400_000 && progress < 70) {
          at_risk.push({
            id: g.id as string,
            title: g.title as string,
            reason: `${progress}% complete, due in ${Math.max(0, Math.floor((due - now) / 86_400_000))}d`,
          })
        }
      }
      return at_risk
    })

    if (drifting.length === 0) {
      return { ok: true, drifting: 0 }
    }

    await step.run('write-digest-message', async () => {
      const supabase = createServiceClient()
      const body = [
        'Goal-check flagged the following at-risk goals this week:',
        ...drifting.map((d) => `• ${d.title} — ${d.reason}`),
      ].join('\n')
      const { error } = await supabase.from('messages').insert({
        org_id: ORG_ID,
        source: 'other',
        direction: 'inbound',
        subject: `Goal drift: ${drifting.length} at-risk goal${drifting.length === 1 ? '' : 's'}`,
        body,
        status: 'unread',
        priority_score: 80,
        contact_name: 'Goal Check Agent',
      })
      if (error) {
        console.error('[inngest] goal-check insert failed:', error.message)
      }
    })

    return { ok: true, drifting: drifting.length }
  },
)

// ---------------------------------------------------------------------------
// GHL sync (does NOT run as a skill — direct MCP tool calls)
// ---------------------------------------------------------------------------

/**
 * GHL sync — hourly. Pulls contact/opportunity/conversation counts from
 * GoHighLevel via the MCP server and updates the matching `kpis` rows by
 * name. If MCP isn't available, the run is a no-op.
 *
 * KPI names (must match seeded rows):
 *   - "MRR" -- sum of `mrr` across active clients (never pipeline value)
 *   - "Sales Pipeline Deals" -- open opportunities in SALES_PIPELINE_IDS
 *   - "Sales Pipeline Value" -- their summed monetaryValue
 *   - "Conversations 7d" -- count of conversations in the last 7 days
 *   - "Calls Booked 7d" -- opportunities that reached the Call Booked stage
 *   - "New Contacts 7d" -- count of contacts created in the last 7 days
 */
export const ghlSync = inngest.createFunction(
  {
    id: 'ghl-sync',
    name: 'GHL Sync',
    triggers: [
      { cron: 'TZ=America/New_York 0 * * * *' },
      { event: 'cron/ghl-sync' },
    ],
  },
  async ({ step }) => {
    const updates = await step.run('fetch-ghl-metrics', async () => {
      const sevenDaysAgoMs = Date.now() - 7 * 86_400_000

      // The MCP GHL getters paginate internally now, so `limit` is "how much
      // history to walk", not "all GHL will give us". None of them takes a
      // server-side date filter, so a rolling-window KPI has to be counted
      // from the rows themselves — see countWithinWindow.
      const CONTACTS_SCAN = 1_000
      const CONVERSATIONS_SCAN = 500
      const OPPORTUNITIES_SCAN = 2_000

      const [contactsRes, opportunitiesRes, conversationsRes, mrr] =
        await Promise.all([
          callMcpTool('ghl_get_contacts', { limit: CONTACTS_SCAN }),
          callMcpTool('ghl_get_opportunities', { limit: OPPORTUNITIES_SCAN }),
          callMcpTool('ghl_get_conversations', { limit: CONVERSATIONS_SCAN }),
          mrrFromActiveClients(ORG_ID),
        ])

      // An MCP call that failed (server unreachable, GHL 401/500, 60s timeout)
      // resolves to null or to an `isError` envelope. Parsed naively that is
      // an empty list with no `total`, which countWithinWindow reads as "the
      // whole population, exactly zero rows" — and the scoreboard shows 0 new
      // contacts and $0 pipeline for as long as the outage lasts. A failed
      // read is not a measurement: skip the write and keep the last value.
      const failed = (name: string, res: unknown): boolean => {
        if (!mcpResultIsError(res)) return false
        console.warn(
          `[inngest] ghl-sync: ${name} failed — leaving its KPIs untouched this run`,
        )
        return true
      }
      const contactsFailed = failed('ghl_get_contacts', contactsRes)
      const conversationsFailed = failed('ghl_get_conversations', conversationsRes)
      const opportunitiesFailed = failed('ghl_get_opportunities', opportunitiesRes)

      const contacts = contactsFailed
        ? { count: 0, exact: false }
        : countWithinWindow(contactsRes, 'dateAdded', sevenDaysAgoMs)
      const conversations = conversationsFailed
        ? { count: 0, exact: false }
        : countWithinWindow(conversationsRes, 'lastMessageDate', sevenDaysAgoMs)
      const deals = opportunitiesFailed
        ? { activeDeals: 0, openPipelineValue: 0, exact: false }
        : summarizeOpportunities(opportunitiesRes)

      for (const [name, exact, failed] of [
        ['New Contacts 7d', contacts.exact, contactsFailed],
        ['Conversations 7d', conversations.exact, conversationsFailed],
        ['Sales Pipeline Deals', deals.exact, opportunitiesFailed],
      ] as const) {
        if (!exact && !failed) {
          console.warn(
            `[inngest] "${name}" could not be measured exactly from the scanned page range — the true number is higher. Skipping the write rather than reporting a floor as a total.`,
          )
        }
      }

      return [
        // A floor is not a measurement. Writing one would put a number on the
        // scoreboard that cannot be compared to its target.
        { name: 'New Contacts 7d', value: contacts.exact ? contacts.count : null },
        {
          name: 'Conversations 7d',
          value: conversations.exact ? conversations.count : null,
        },
        {
          name: 'Sales Pipeline Deals',
          value: deals.exact ? deals.activeDeals : null,
        },
        {
          name: 'Sales Pipeline Value',
          value: deals.exact ? deals.openPipelineValue : null,
        },
        { name: 'MRR', value: mrr },
      ]
    })

    const applied = await step.run('apply-kpi-updates', async () => {
      const supabase = createServiceClient()
      const nowIso = new Date().toISOString()
      const results: Array<{ name: string; updated: boolean }> = []
      for (const { name, value } of updates) {
        if (typeof value !== 'number' || Number.isNaN(value)) {
          results.push({ name, updated: false })
          continue
        }
        const { data: updatedRow, error } = await supabase
          .from('kpis')
          .update({ value, last_synced_at: nowIso })
          .eq('org_id', ORG_ID)
          .eq('name', name)
          .select('id')
          .maybeSingle()
        if (error) {
          console.error(
            `[inngest] kpi update for "${name}" failed:`,
            error.message,
          )
          results.push({ name, updated: false })
          continue
        }

        // History is written once per run by the snapshot step below, which
        // covers every KPI (synced and manual). Inserting a point here as well
        // doubled every GHL-synced KPI's history.
        results.push({ name, updated: Boolean(updatedRow?.id) })
      }
      return results
    })

    // Also snapshot the full KPI set so manually-updated KPIs (which never
    // flow through the GHL update loop above) accrue history too.
    const snapshot = await step.run('snapshot-kpis', () => snapshotKpis(ORG_ID))

    return { applied, snapshot }
  },
)

// ---------------------------------------------------------------------------
// MCP result parsing helpers
// ---------------------------------------------------------------------------

/**
 * Normalized view of a GHL MCP list result.
 *
 * The getters return `{ total, count, truncated, items }` — `total` is GHL's
 * exact population count and `truncated` means the walk stopped short of it.
 * A bare array is still accepted so a lagging MCP deploy degrades instead of
 * breaking.
 */
function parseMcpList(result: unknown): {
  items: Array<Record<string, unknown>>
  total: number | null
  truncated: boolean
} {
  const parsed = extractMcpJson(result)
  const items = pickArray(parsed).filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === 'object' && !Array.isArray(row),
  )

  let total: number | null = null
  let truncated = false
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    if (typeof obj.total === 'number') total = obj.total
    truncated = obj.truncated === true
  }
  // Holding fewer rows than the population is truncation whether or not the
  // server labelled it as such.
  if (!truncated && total !== null && items.length < total) truncated = true

  return { items, total, truncated }
}

/**
 * Count rows whose `field` timestamp falls at or after `sinceMs`.
 *
 * No GHL getter takes a date filter, so rolling-window KPIs are counted from
 * the returned rows. Rows come back newest-first, so the count is exact as
 * soon as the walk has stepped past the window — i.e. once at least one row
 * older than the cutoff appears. If every row scanned is still inside the
 * window we only hold a floor, and floors never reach the scoreboard.
 */
function countWithinWindow(
  result: unknown,
  field: string,
  sinceMs: number,
): { count: number; exact: boolean } {
  const { items, total, truncated } = parseMcpList(result)
  let count = 0
  let sawOlder = false
  for (const item of items) {
    const ts = toEpochMs(item[field])
    if (ts === null) continue
    if (ts >= sinceMs) count++
    else sawOlder = true
  }
  // Holding the whole population makes the count exact regardless of ordering.
  const complete = !truncated && (total === null || items.length >= total)
  return { count, exact: sawOlder || complete }
}

/** Pull the row array out of whichever shape the MCP tool returned. */
function pickArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    for (const key of ['items', 'contacts', 'opportunities', 'conversations']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[]
    }
  }
  return []
}

/**
 * The pipelines that represent deals CREAIT is actually working.
 *
 * Without this, "Active Deals" counted every opportunity the account has ever
 * held — 1,253 of them, against a target of 20 — and "Open Pipeline Value"
 * summed to $20.1M against a $150K target. Both numbers were accurate and
 * neither meant anything, because 1,242 of those opportunities sit in
 * `zz Archived · General Opportunities` and four deals in `Datacenter` carry
 * $15M between them.
 *
 * An explicit allow-list rather than a "not archived" name test: a pipeline
 * belongs on the scoreboard because someone decided it does, not because of
 * how it happens to be named today. Add an id here to include it.
 */
const SALES_PIPELINE_IDS: readonly string[] = [
  '7Sc2j1zwFJzgA3rH4NJe', // CREAiT Sales Pipeline (Contacted -> Won, 7 stages)
]

/**
 * Open-deal rollups, scoped to SALES_PIPELINE_IDS. `exact` is false when the
 * scan didn't reach GHL's full opportunity population — the rollups are
 * computed over fetched rows, so a short walk yields a floor.
 *
 * The MCP tool's own `openCount`/`openValue` are deliberately NOT used here:
 * they describe every pipeline in the location, which is the number this
 * scoping exists to stop reporting.
 */
function summarizeOpportunities(result: unknown): {
  activeDeals: number
  openPipelineValue: number
  exact: boolean
} {
  const { items, total, truncated } = parseMcpList(result)

  let deals = 0
  let value = 0
  for (const item of items) {
    const pipelineId = String(item.pipelineId ?? '')
    if (!SALES_PIPELINE_IDS.includes(pipelineId)) continue
    const status = String(item.status ?? '').toLowerCase()
    const isOpen =
      status !== 'won' && status !== 'lost' && status !== 'abandoned'
    if (!isOpen) continue
    deals++
    // Only open deals count toward pipeline. Summing won and lost as well is
    // what produced a $5,015,685 "MRR" — the all-time gross of every
    // opportunity the account has ever held.
    const amount = Number(item.monetaryValue ?? item.value ?? 0)
    if (Number.isFinite(amount)) value += amount
  }

  const exact = !truncated && (total === null || items.length >= total)
  return {
    activeDeals: deals,
    openPipelineValue: Number(value.toFixed(2)),
    exact,
  }
}

/**
 * True monthly recurring revenue — the sum of `mrr` across active clients.
 * Pipeline value is not MRR: one is a forecast of deals that may never close,
 * the other is money that arrives every month whether anyone sells anything.
 */
async function mrrFromActiveClients(orgId: string): Promise<number | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('cc_clients')
    .select('mrr')
    .eq('org_id', orgId)
    .eq('status', 'active')
  if (error) {
    console.error('[inngest] mrr from cc_clients failed:', error.message)
    return null
  }
  const total = (data ?? []).reduce(
    (sum, row) => sum + Number((row as { mrr: number | null }).mrr ?? 0),
    0,
  )
  return Number(total.toFixed(2))
}

// ---------------------------------------------------------------------------
// Agent bookkeeping
// ---------------------------------------------------------------------------

/**
 * Bump `agents.last_run_at` (and a forward-looking `next_run_at` estimate)
 * after a background agent completes. Looked up by the canonical agent name
 * so we don't have to plumb agent ids through every Inngest function.
 *
 * Best-effort — never throws (these crons must not fail just because the
 * dashboard couldn't update).
 */
async function bumpAgentRun(agentName: string, nextRunHours = 24): Promise<void> {
  try {
    const supabase = createServiceClient()
    const now = new Date()
    const nextRun = new Date(now.getTime() + nextRunHours * 60 * 60 * 1000)
    const { error } = await supabase
      .from('agents')
      .update({
        last_run_at: now.toISOString(),
        next_run_at: nextRun.toISOString(),
      })
      .eq('org_id', ORG_ID)
      .eq('name', agentName)
    if (error) {
      console.error(`[inngest] bumpAgentRun(${agentName}) failed:`, error.message)
    }
  } catch (err) {
    console.error(`[inngest] bumpAgentRun(${agentName}) threw:`, err)
  }
}

// ---------------------------------------------------------------------------
// Long-running background agents (Phase 3)
// ---------------------------------------------------------------------------

/**
 * YouTube Research Agent — daily 8am ET. Scans for trending YouTube videos
 * in CREAIT's industry niche via Tavily and writes the top 5 hits into a
 * single `research_briefings` row for review on the /research page.
 *
 * Skipped if `TAVILY_API_KEY` is missing.
 */
export const youtubeResearch = inngest.createFunction(
  {
    id: 'youtube-research',
    name: 'YouTube Research Agent',
    triggers: [
      { cron: 'TZ=America/New_York 0 8 * * *' },
      { event: 'cron/youtube-research' },
    ],
  },
  async ({ step }) => {
    if (!process.env.TAVILY_API_KEY) {
      console.warn('[inngest] youtube-research skipped — TAVILY_API_KEY missing')
      await bumpAgentRun('YouTube Research Agent')
      return { skipped: 'TAVILY_API_KEY missing' }
    }

    const search = await step.run('tavily-youtube-search', async () => {
      const response = await tavilySearch(
        'AI consulting OR GoHighLevel OR agency operations YouTube videos this week',
        { max_results: 5, include_domains: ['youtube.com', 'youtu.be'] },
      )
      return response.results
    })

    if (search.length === 0) {
      await bumpAgentRun('YouTube Research Agent')
      return { ok: true, inserted: 0 }
    }

    const briefingId = await step.run('write-briefing', async () => {
      const supabase = createServiceClient()
      const today = new Date().toISOString().slice(0, 10)
      const content = [
        `# YouTube Trends — ${today}`,
        '',
        'Top videos from this week in AI consulting, GoHighLevel, and agency operations:',
        '',
        ...search.map((r, i) => {
          const lines = [`### ${i + 1}. ${r.title}`, `[${r.url}](${r.url})`]
          if (r.content) lines.push('', r.content.slice(0, 400))
          return lines.join('\n')
        }),
      ].join('\n')

      const { data, error } = await supabase
        .from('research_briefings')
        .insert({
          org_id: ORG_ID,
          title: `YouTube Trends — ${today}`,
          briefing_type: 'market',
          content,
          sources: search.map((r) => ({ url: r.url, title: r.title })) as never,
          generated_by: 'youtube-research-agent',
          briefing_date: today,
        })
        .select('id')
        .single()

      if (error) {
        console.error('[inngest] youtube-research insert failed:', error.message)
        return null
      }
      return (data?.id as string | undefined) ?? null
    })

    await bumpAgentRun('YouTube Research Agent')
    return { ok: true, inserted: search.length, briefingId }
  },
)

/**
 * Recruiting Monitor Agent — daily 9am ET. Placeholder: LinkedIn candidate
 * sourcing needs the Unipile MCP server which lands in Phase 4. For now we
 * just log a run so the dashboard shows the agent ticking, with a note about
 * what's still needed.
 */
export const recruitingMonitor = inngest.createFunction(
  {
    id: 'recruiting-monitor',
    name: 'Recruiting Monitor Agent',
    triggers: [
      { cron: 'TZ=America/New_York 0 9 * * *' },
      { event: 'cron/recruiting-monitor' },
    ],
  },
  async ({ step }) => {
    await step.run('record-placeholder-run', async () => {
      const supabase = createServiceClient()
      const { error } = await supabase.from('run_history').insert({
        org_id: ORG_ID,
        trigger: 'agent',
        model: null,
        input: { agent: 'recruiting-monitor' } as never,
        output: {
          text: 'Recruiting Monitor placeholder run. Awaiting Unipile MCP integration in Phase 4 — currently no LinkedIn data source is wired up.',
        } as never,
        status: 'succeeded',
        duration_ms: 0,
        completed_at: new Date().toISOString(),
      })
      if (error) {
        console.error('[inngest] recruiting-monitor insert failed:', error.message)
      }
    })

    await bumpAgentRun('Recruiting Monitor Agent')
    return { ok: true, note: 'Phase 4: wire Unipile MCP for LinkedIn sourcing' }
  },
)

/**
 * Client Health Agent — daily 10am ET. Pulls GHL contacts via MCP and flags
 * any whose `dateAdded` is older than 30 days into the comms inbox as a
 * lightweight "we haven't heard from this client" signal. Real engagement
 * scoring (last_inbound_at, stalled milestones, declining activity) ships
 * once we have more contact-level signal flowing.
 */
export const clientHealth = inngest.createFunction(
  {
    id: 'client-health',
    name: 'Client Health Agent',
    triggers: [
      { cron: 'TZ=America/New_York 0 10 * * *' },
      { event: 'cron/client-health' },
    ],
  },
  async ({ step }) => {
    const flagged = await step.run('fetch-stale-clients', async () => {
      const contactsRes = await callMcpTool('ghl_get_contacts', { limit: 100 })
      const parsed = extractMcpJson(contactsRes)
      let items: Array<Record<string, unknown>> = []
      if (Array.isArray(parsed)) {
        items = parsed as Array<Record<string, unknown>>
      } else if (parsed && typeof parsed === 'object') {
        const candidate = (parsed as { contacts?: unknown }).contacts
        if (Array.isArray(candidate)) {
          items = candidate as Array<Record<string, unknown>>
        }
      }

      const cutoff = Date.now() - 30 * 86_400_000
      const stale: Array<{ name: string; reason: string }> = []
      for (const item of items) {
        const dateAddedRaw = item.dateAdded ?? item.date_added
        if (typeof dateAddedRaw !== 'string') continue
        const dateAdded = new Date(dateAddedRaw).getTime()
        if (!Number.isFinite(dateAdded) || dateAdded > cutoff) continue
        const name =
          (item.contactName as string | undefined) ||
          [item.firstName, item.lastName].filter(Boolean).join(' ').trim() ||
          (item.email as string | undefined) ||
          'Unknown contact'
        const daysSince = Math.floor((Date.now() - dateAdded) / 86_400_000)
        stale.push({
          name,
          reason: `no_recent_activity_${daysSince}d`,
        })
      }
      return stale.slice(0, 10)
    })

    if (flagged.length === 0) {
      await bumpAgentRun('Client Health Agent')
      return { ok: true, flagged: 0 }
    }

    await step.run('insert-flags', async () => {
      const supabase = createServiceClient()

      // One open alert per contact — not one per run. This job runs daily, so
      // a blind insert re-flags the same stale contacts every day and buries
      // real client messages in the Comms hub. Key on a deterministic
      // source_id and skip contacts that already have an unresolved flag;
      // once the operator reads/archives it, a later run can flag again.
      const sourceIds = flagged.map((f) => `client-health:${f.name}`)
      const { data: existing, error: existingErr } = await supabase
        .from('messages')
        .select('source_id')
        .eq('org_id', ORG_ID)
        .in('source_id', sourceIds)
        .eq('status', 'unread')

      if (existingErr) {
        console.error(
          '[inngest] client-health dedupe lookup failed:',
          existingErr.message,
        )
        return
      }

      const alreadyFlagged = new Set(
        ((existing as Array<{ source_id: string | null }> | null) ?? [])
          .map((row) => row.source_id)
          .filter((id): id is string => Boolean(id)),
      )

      const rows = flagged
        .filter((f) => !alreadyFlagged.has(`client-health:${f.name}`))
        .map((f) => ({
          org_id: ORG_ID,
          source: 'other' as const,
          source_id: `client-health:${f.name}`,
          direction: 'inbound' as const,
          contact_name: 'Client Health Agent',
          subject: `Client health: ${f.name}`,
          body: `Client health agent flagged ${f.name}: ${f.reason}`,
          status: 'unread' as const,
          priority_score: 70,
        }))

      if (rows.length === 0) return

      const { error } = await supabase.from('messages').insert(rows)
      if (error) {
        console.error('[inngest] client-health insert failed:', error.message)
      }
    })

    await bumpAgentRun('Client Health Agent')
    return { ok: true, flagged: flagged.length }
  },
)

/**
 * Tech Watch Crawler — daily 8am ET. For each `competitors` row with
 * `watch_type = 'tech_watch'`, runs a Tavily search and inserts up to 5
 * fresh `tech_watch_items` rows per company per day. Items dedupe loosely
 * by source_url so we don't re-insert identical articles on subsequent runs.
 *
 * Skipped cleanly if `TAVILY_API_KEY` isn't set.
 */
export const techWatchCrawler = inngest.createFunction(
  {
    id: 'tech-watch-crawl',
    name: 'Tech Watch Crawler',
    triggers: [
      { cron: 'TZ=America/New_York 0 8 * * *' },
      { event: 'cron/tech-watch-crawl' },
    ],
  },
  async ({ step }) => {
    if (!process.env.TAVILY_API_KEY) {
      console.warn('[inngest] tech-watch-crawl skipped — TAVILY_API_KEY missing')
      await bumpAgentRun('Tech Watch Crawler')
      return { skipped: 'TAVILY_API_KEY missing' }
    }

    const companies = await step.run('fetch-tech-watch-companies', async () => {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from('competitors')
        .select('id, name, url')
        .eq('org_id', ORG_ID)
        .eq('watch_type', 'tech_watch')
      if (error) {
        console.error('[inngest] tech-watch fetch failed:', error.message)
        return []
      }
      return data ?? []
    })

    if (companies.length === 0) {
      await bumpAgentRun('Tech Watch Crawler')
      return { ok: true, companies: 0, inserted: 0 }
    }

    const perCompany: Array<{ name: string; inserted: number }> = []

    for (const company of companies) {
      const companyName = company.name as string
      const companyId = company.id as string

      const results = await step.run(`tavily-${companyId}`, async () => {
        try {
          const response = await tavilySearch(
            `${companyName} news OR blog OR hiring this week`,
            { max_results: 5 },
          )
          return response.results
        } catch (err) {
          console.error(`[inngest] tech-watch tavily for ${companyName} failed:`, err)
          return [] as TavilyResult[]
        }
      })

      const inserted = await step.run(`insert-${companyId}`, async () => {
        if (results.length === 0) return 0
        const supabase = createServiceClient()

        // Pre-filter against URLs we've seen in the last 14 days so we don't
        // pollute the feed with duplicates on consecutive runs.
        const sinceIso = new Date(
          Date.now() - 14 * 86_400_000,
        ).toISOString()
        const { data: existing } = await supabase
          .from('tech_watch_items')
          .select('source_url')
          .eq('org_id', ORG_ID)
          .eq('competitor_id', companyId)
          .gte('created_at', sinceIso)
        const seen = new Set(
          ((existing ?? []) as Array<{ source_url: string | null }>)
            .map((r) => r.source_url)
            .filter((u): u is string => typeof u === 'string'),
        )

        const rows = results
          .filter((r) => !seen.has(r.url))
          .slice(0, 5)
          .map((r) => ({
            org_id: ORG_ID,
            competitor_id: companyId,
            headline: r.title,
            snippet: r.content ? r.content.slice(0, 600) : null,
            source_url: r.url,
            source_type: classifySource(r.url),
            published_at: r.published_date ?? null,
            ai_summary: null,
          }))

        if (rows.length === 0) return 0
        const { error } = await supabase.from('tech_watch_items').insert(rows)
        if (error) {
          console.error(
            `[inngest] tech-watch insert for ${companyName} failed:`,
            error.message,
          )
          return 0
        }
        return rows.length
      })

      perCompany.push({ name: companyName, inserted })
    }

    await bumpAgentRun('Tech Watch Crawler')
    const total = perCompany.reduce((s, c) => s + c.inserted, 0)
    return { ok: true, companies: companies.length, inserted: total, perCompany }
  },
)

/**
 * Guess `source_type` from a URL host so the Tech Watch UI can color-code
 * cards without an extra LLM call.
 */
function classifySource(url: string): 'news' | 'blog' | 'hiring' | 'social' | 'other' {
  const lower = url.toLowerCase()
  if (
    lower.includes('linkedin.com/jobs') ||
    lower.includes('greenhouse.io') ||
    lower.includes('lever.co') ||
    lower.includes('/careers') ||
    lower.includes('/jobs')
  ) {
    return 'hiring'
  }
  if (
    lower.includes('twitter.com') ||
    lower.includes('x.com') ||
    lower.includes('linkedin.com/posts') ||
    lower.includes('youtube.com') ||
    lower.includes('youtu.be')
  ) {
    return 'social'
  }
  if (lower.includes('/blog') || lower.includes('medium.com') || lower.includes('substack.com')) {
    return 'blog'
  }
  if (
    lower.includes('techcrunch.com') ||
    lower.includes('theinformation.com') ||
    lower.includes('bloomberg.com') ||
    lower.includes('reuters.com') ||
    lower.includes('news')
  ) {
    return 'news'
  }
  return 'other'
}

// ---------------------------------------------------------------------------
// Zoom → War Room sync
// ---------------------------------------------------------------------------

/**
 * Daily pull of Zoom cloud recordings + transcripts into `meetings` (the
 * War Room). No-ops gracefully until the Zoom Server-to-Server OAuth env
 * vars are configured — see lib/zoom-sync.ts.
 */
export const zoomSync = inngest.createFunction(
  {
    id: 'zoom-sync',
    name: 'Zoom Sync',
    triggers: [
      { cron: 'TZ=America/New_York 0 6 * * *' },
      { event: 'cron/zoom-sync' },
    ],
  },
  async ({ step }) => {
    const { zoomConfigured, syncZoomRecordings } = await import('@/lib/zoom-sync')
    if (!zoomConfigured()) {
      return { skipped: 'Zoom S2S env vars not configured' }
    }
    const result = await step.run('sync-zoom-recordings', () =>
      syncZoomRecordings(7),
    )
    // Class attendance reads the meeting record this job just filled in, so
    // chain rather than racing two clocks. The attendance job is idempotent
    // and no-ops on any day without a class, which makes a daily chain free.
    await step.sendEvent('trigger-class-attendance', {
      name: 'cron/zoom-attendance',
      data: { triggeredBy: 'zoom-sync' },
    })
    return result
  },
)

// ---------------------------------------------------------------------------
// AI Tuesday attendance from Zoom
// ---------------------------------------------------------------------------

/**
 * Attendance for the weekly class, taken automatically from Zoom.
 *
 * This is the primary mechanism — the check-off on /tuesday-class is the
 * override for whoever Zoom could not identify. Every registrant who was on
 * the list when the class ran ends up tagged `attended-tuesday` or
 * `missed-tuesday`, which is what lets GHL run two follow-up tracks.
 *
 * Runs Wednesday 7am ET as a backstop and, more importantly, is chained
 * straight off `zoomSync` (6am ET daily) so it can never read the meeting
 * record before that morning's Zoom pull has filled it in.
 *
 * Idempotent by construction: a registrant with an existing row for the
 * session is skipped whole, so a second run writes nothing and tags nobody.
 * If Zoom returns nothing or fails, it tags NOBODY and records why on the
 * session — a hiccup must never mass-tag a full room as no-shows.
 */
export const zoomAttendanceSync = inngest.createFunction(
  {
    id: 'zoom-attendance-sync',
    name: 'AI Tuesday Attendance Sync',
    triggers: [
      { cron: 'TZ=America/New_York 0 7 * * 3' },
      { event: 'cron/zoom-attendance' },
    ],
  },
  async ({ event, step }) => {
    const { zoomConfigured, syncZoomAttendance } = await import('@/lib/zoom-sync')
    if (!zoomConfigured()) {
      return { skipped: 'Zoom S2S env vars not configured' }
    }
    // An explicit date lets a founder backfill one week without waiting for
    // next Tuesday: send `cron/zoom-attendance` with { sessionDate }.
    // The client is untyped, so the cron payload arrives as a union without
    // this field — read it through a narrow cast rather than widening it.
    const data = event.data as { sessionDate?: unknown } | undefined
    const sessionDate =
      typeof data?.sessionDate === 'string' ? data.sessionDate : undefined
    return step.run('sync-zoom-attendance', () => syncZoomAttendance(sessionDate))
  },
)

// ---------------------------------------------------------------------------
// GHL webhook relay
// ---------------------------------------------------------------------------

/**
 * Turns the hourly GHL sync into a near-real-time one.
 *
 * GHL workflows POST to /api/webhooks/ghl whenever something changes
 * (contact created, opportunity moved, payment received, ...). That route
 * fires one `ghl/changed` event per webhook. A busy hour in GHL can mean
 * dozens of webhooks, so this debounces: wait until the events go quiet
 * for 2 minutes, then trigger ONE `cron/ghl-sync` run. The sync logic
 * itself stays in `ghlSync` — single source of truth.
 */
export const ghlChangeRelay = inngest.createFunction(
  {
    id: 'ghl-change-relay',
    name: 'GHL Change Relay',
    debounce: { period: '2m' },
    triggers: [{ event: 'ghl/changed' }],
  },
  async ({ event, step }) => {
    await step.sendEvent('trigger-ghl-sync', {
      name: 'cron/ghl-sync',
      data: { triggeredBy: 'webhook', summary: event.data?.summary ?? null },
    })
    // Conversation activity is a GHL change like any other, so the same
    // doorbell pulls new messages in. `commsIngest` is idempotent, so this is
    // free when the webhook wasn't about a message.
    await step.sendEvent('trigger-comms-ingest', {
      name: 'cron/comms-ingest',
      data: { triggeredBy: 'webhook' },
    })
    return { relayed: true }
  },
)

// ---------------------------------------------------------------------------
// Assessment follow-through → Command Center to-dos
// ---------------------------------------------------------------------------

/**
 * The four moments after a Growth & AI Diagnostic where the next step is
 * easy to forget. Each becomes exactly one to-do per assessment, ever.
 */
type FollowThroughKind = 'intake-3d' | 'intake-7d' | 'day30' | 'day90' | 'credit'

const FOLLOW_THROUGH_KINDS: readonly FollowThroughKind[] = [
  'intake-3d',
  'intake-7d',
  'day30',
  'day90',
  'credit',
]

/** The `description` line that makes a follow-through to-do recognisable. */
const FOLLOW_THROUGH_KEY_PREFIX = 'assessment:'

/** Matches every idempotency key inside a to-do description. */
const FOLLOW_THROUGH_KEY_RE = /assessment:[0-9a-f-]{36}:[a-z0-9-]+/g

/** The Diagnostic fee, credited toward a Build or Advisory inside 60 days. */
const DIAGNOSTIC_CREDIT_LABEL = '$7,500'
const CREDIT_WINDOW_OPENS_DAY = 45
const CREDIT_EXPIRES_DAY = 60

/** Shown as the author on the /todos page, since no person filed these. */
const FOLLOW_THROUGH_AUTHOR = 'Assessment Follow-Through'

interface FollowThroughCandidate {
  orgId: string
  kind: FollowThroughKind
  key: string
  title: string
  description: string
  dueDate: string
}

/** The slice of `cc_assessments` the follow-through rules read. */
interface FollowThroughAssessment {
  id: string
  org_id: string
  company: string | null
  client_name: string
  status: string
  is_practice: boolean
  intake_token: string | null
  intake_submitted_at: string | null
  started_at: string | null
  delivered_at: string | null
  /** What the engagement became (migration 0016); null = not yet. */
  converted_to: 'build' | 'advisory' | null
  outcomes: unknown
  updated_at: string
}

/** Stable per-(assessment, moment) key: `assessment:<uuid>:<kind>`. */
function followThroughKey(assessmentId: string, kind: FollowThroughKind): string {
  return `${FOLLOW_THROUGH_KEY_PREFIX}${assessmentId}:${kind}`
}

/** Today's calendar date in the company's timezone, as YYYY-MM-DD. */
function easternToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

/**
 * Whole days from a DATE column (YYYY-MM-DD) to `today`. Both are calendar
 * dates, so the arithmetic is done at UTC midnight — no DST hour can shift a
 * 30-day review onto day 29.
 */
function daysSinceDate(date: string, today: string): number | null {
  const from = Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
  const to = Date.parse(`${today}T00:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return Math.floor((to - from) / 86_400_000)
}

/** Add whole days to a YYYY-MM-DD date. */
function addDays(date: string, days: number): string {
  const ms = Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10)
}

/** Whole days since a TIMESTAMPTZ value; null when it doesn't parse. */
function daysSinceTimestamp(iso: string | null, nowMs: number): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  return Math.floor((nowMs - ms) / 86_400_000)
}

/** Whether `outcomes.<day>` holds a review (anything non-null counts). */
function hasOutcomeReview(outcomes: unknown, day: 'day30' | 'day90'): boolean {
  if (!outcomes || typeof outcomes !== 'object' || Array.isArray(outcomes)) {
    return false
  }
  const value = (outcomes as Record<string, unknown>)[day]
  return value !== null && value !== undefined
}

/**
 * The name the to-do should use for the engagement: the company, falling back
 * to the owner's name for an assessment filed without one.
 */
function assessmentLabel(row: FollowThroughAssessment): string {
  return row.company?.trim() || row.client_name.trim() || 'Untitled assessment'
}

/**
 * Every follow-through to-do one assessment is due for today, before
 * de-duplication. Pure: the same row and clock always yield the same set.
 *
 * "Converted to a Build or Advisory" is the row's own `converted_to` column
 * (migration 0016), recorded from the workbench's "What happened next" panel
 * once the engagement is delivered. It used to be guessed by matching the
 * assessment's company name against cc_clients; now a null means exactly
 * "nobody has recorded a conversion", and the credit clock runs until someone
 * does.
 */
function followThroughCandidates(
  row: FollowThroughAssessment,
  today: string,
  nowMs: number,
): FollowThroughCandidate[] {
  const out: FollowThroughCandidate[] = []
  const label = assessmentLabel(row)
  const push = (
    kind: FollowThroughKind,
    title: string,
    description: string,
    dueDate: string,
  ) => {
    out.push({
      orgId: row.org_id,
      kind,
      key: followThroughKey(row.id, kind),
      title,
      // The key rides on its own trailing line so the dedupe scan can find it
      // no matter how the human-readable text above it is edited.
      description: `${description}\n\n${followThroughKey(row.id, kind)}`,
      dueDate,
    })
  }

  if (row.status === 'intake' && row.intake_token && !row.intake_submitted_at) {
    // issueIntakeLink writes intake_token + updated_at and leaves started_at
    // alone, so updated_at is the issue time. The owner's in-form autosave
    // also bumps it, which is the right clock for a nudge: an owner who saved
    // yesterday is not ignoring the link, one who hasn't touched it in a week
    // is. (`updated_at` has no trigger — only these explicit writes move it.)
    const days = daysSinceTimestamp(row.updated_at, nowMs)
    if (days !== null && days >= 7) {
      push(
        'intake-7d',
        `Escalate ${label}: intake link still unsubmitted ${days} days — call the owner`,
        `The owner's pre-assessment intake link for ${label} has been open for ${days} days without a submission. A second nudge by message is unlikely to land; call, and if the engagement is dead move it out of Intake or revoke the link.`,
        today,
      )
    } else if (days !== null && days >= 3) {
      push(
        'intake-3d',
        `Nudge ${label}: intake link unsubmitted ${days} days`,
        `The owner's pre-assessment intake link for ${label} was issued ${days} days ago and hasn't been submitted. Send a reminder — the Diagnostic Intensive can't be scheduled until the intake is in.`,
        today,
      )
    }
  }

  if (row.status === 'delivered' && row.delivered_at) {
    const days = daysSinceDate(row.delivered_at, today)
    if (days === null) return out

    if (days >= 30 && !hasOutcomeReview(row.outcomes, 'day30')) {
      push(
        'day30',
        `${label}: run the day-30 review`,
        `${label}'s Diagnostic was delivered on ${row.delivered_at}. Record planned-vs-actual for each 90-day plan item in the assessment's Outcomes tab — this is the only way the instrument learns from its own deliveries.`,
        addDays(row.delivered_at, 30),
      )
    }

    if (days >= 90 && !hasOutcomeReview(row.outcomes, 'day90')) {
      push(
        'day90',
        `${label}: run the day-90 review`,
        `${label}'s Diagnostic was delivered on ${row.delivered_at}. Record the day-90 planned-vs-actual in the assessment's Outcomes tab and close the loop with the owner.`,
        addDays(row.delivered_at, 90),
      )
    }

    if (
      days >= CREDIT_WINDOW_OPENS_DAY &&
      days < CREDIT_EXPIRES_DAY &&
      row.converted_to === null
    ) {
      const daysLeft = CREDIT_EXPIRES_DAY - days
      push(
        'credit',
        `${label}: ${DIAGNOSTIC_CREDIT_LABEL} credit expires in ${daysLeft} days`,
        `${label} was delivered ${days} days ago and no Build or Advisory has been recorded against it. The ${DIAGNOSTIC_CREDIT_LABEL} Diagnostic credit toward the next engagement expires on day ${CREDIT_EXPIRES_DAY} (${addDays(row.delivered_at, CREDIT_EXPIRES_DAY)}). Book the conversion call now — and once it lands, record it under "What happened next" on the engagement so this clock stops.`,
        addDays(row.delivered_at, CREDIT_EXPIRES_DAY),
      )
    }
  }

  return out
}

/**
 * Assessment follow-through — daily 8am ET. Files Command Center to-dos for
 * the moments after a Diagnostic that otherwise depend on someone
 * remembering:
 *
 *   1. Intake link unsubmitted 3+ days (nudge), again at 7+ days (escalate).
 *   2. Day-30 review due and not recorded in `outcomes.day30`.
 *   3. Day-90 review due and not recorded in `outcomes.day90`.
 *   4. Delivered 45–59 days ago with no conversion recorded
 *      (`converted_to` is null) — the $7,500 credit clock.
 *
 * Scans every org (the rules need no per-org config) and skips practice
 * assessments. Idempotent by construction: each to-do carries a stable
 * `assessment:<id>:<kind>` key on the last line of its description, and the
 * job skips any key already present on an open OR completed to-do, so a moment
 * is filed once and ticking it off never invites a repeat. Failing the dedupe
 * lookup files nothing — a blind insert is how other tables ended up with
 * duplicate rows.
 */
export const assessmentFollowThrough = inngest.createFunction(
  {
    id: 'assessment-follow-through',
    name: 'Assessment Follow-Through',
    // Cron and event triggers can fire together. Serializing runs keeps the
    // read-then-insert dedupe below from racing itself.
    concurrency: { limit: 1 },
    triggers: [
      { cron: 'TZ=America/New_York 0 8 * * *' },
      { event: 'cron/assessment-follow-through' },
    ],
  },
  async ({ step }) => {
    const scan = await step.run('scan-assessments', async () => {
      const supabase = createServiceClient()
      const today = easternToday()
      const nowMs = Date.now()

      const { data, error } = await supabase
        .from('cc_assessments')
        .select(
          'id, org_id, company, client_name, status, is_practice, intake_token, intake_submitted_at, started_at, delivered_at, converted_to, outcomes, updated_at',
        )
        .eq('is_practice', false)
        .in('status', ['intake', 'delivered'])
      if (error) {
        console.error(
          '[inngest] assessment-follow-through scan failed:',
          error.message,
        )
        return { scanned: 0, orgs: 0, candidates: [] as FollowThroughCandidate[] }
      }

      const rows = ((data ?? []) as unknown as FollowThroughAssessment[]).filter(
        (row) => !row.is_practice,
      )
      const orgIds = [...new Set(rows.map((row) => row.org_id))]

      const candidates: FollowThroughCandidate[] = []
      for (const row of rows) {
        candidates.push(...followThroughCandidates(row, today, nowMs))
      }

      return { scanned: rows.length, orgs: orgIds.length, candidates }
    })

    const emptyCounts = (): Record<FollowThroughKind, number> => ({
      'intake-3d': 0,
      'intake-7d': 0,
      day30: 0,
      day90: 0,
      credit: 0,
    })

    if (scan.candidates.length === 0) {
      return {
        ok: true,
        scanned: scan.scanned,
        orgs: scan.orgs,
        due: 0,
        filed: emptyCounts(),
        skippedExisting: 0,
      }
    }

    const filed = await step.run('file-todos', async () => {
      const supabase = createServiceClient()
      const counts = emptyCounts()
      let skippedExisting = 0
      let failed = 0

      const byOrg = new Map<string, FollowThroughCandidate[]>()
      for (const candidate of scan.candidates) {
        const list = byOrg.get(candidate.orgId) ?? []
        list.push(candidate)
        byOrg.set(candidate.orgId, list)
      }

      for (const [orgId, candidates] of byOrg) {
        // Open OR done: a completed review to-do must never come back.
        const { data: existing, error: existingError } = await supabase
          .from('cc_todos')
          .select('description')
          .eq('org_id', orgId)
          .like('description', `%${FOLLOW_THROUGH_KEY_PREFIX}%`)
        if (existingError) {
          // Fail closed — see the function comment.
          console.error(
            `[inngest] assessment-follow-through dedupe lookup for ${orgId} failed:`,
            existingError.message,
          )
          failed += candidates.length
          continue
        }

        const known = new Set<string>()
        for (const row of (existing ?? []) as Array<{ description: string | null }>) {
          for (const key of row.description?.match(FOLLOW_THROUGH_KEY_RE) ?? []) {
            known.add(key)
          }
        }

        const fresh = candidates.filter((c) => !known.has(c.key))
        skippedExisting += candidates.length - fresh.length
        if (fresh.length === 0) continue

        const { data: inserted, error: insertError } = await supabase
          .from('cc_todos')
          .insert(
            fresh.map((c) => ({
              org_id: orgId,
              title: c.title,
              description: c.description,
              owner_id: null,
              done: false,
              due_date: c.dueDate,
              meeting_id: null,
              created_by: null,
              created_by_name: FOLLOW_THROUGH_AUTHOR,
            })),
          )
          .select('id')
        if (insertError) {
          console.error(
            `[inngest] assessment-follow-through insert for ${orgId} failed:`,
            insertError.message,
          )
          failed += fresh.length
          continue
        }
        // A service-role insert can't be refused by RLS, but a row count that
        // disagrees with what was sent is still worth surfacing.
        if ((inserted?.length ?? 0) !== fresh.length) {
          console.warn(
            `[inngest] assessment-follow-through: sent ${fresh.length} to-dos for ${orgId}, database reports ${inserted?.length ?? 0}`,
          )
        }
        for (const c of fresh) counts[c.kind] += 1
      }

      return { counts, skippedExisting, failed }
    })

    return {
      ok: filed.failed === 0,
      scanned: scan.scanned,
      orgs: scan.orgs,
      due: scan.candidates.length,
      filed: filed.counts,
      filedTotal: FOLLOW_THROUGH_KINDS.reduce((sum, k) => sum + filed.counts[k], 0),
      skippedExisting: filed.skippedExisting,
      failed: filed.failed,
    }
  },
)

// ---------------------------------------------------------------------------
// Registered functions
// ---------------------------------------------------------------------------

export const functions = [
  dailyBriefing,
  commsIngest,
  commsSweep,
  weeklySummary,
  goalCheck,
  ghlSync,
  ghlChangeRelay,
  zoomSync,
  zoomAttendanceSync,
  youtubeResearch,
  recruitingMonitor,
  clientHealth,
  techWatchCrawler,
  assessmentFollowThrough,
]
