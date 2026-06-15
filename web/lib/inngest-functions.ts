import { inngest } from '@/lib/inngest'
import { loadMcpTools } from '@/lib/mcp-client'
import { runSkill } from '@/lib/skills-engine'
import { createServiceClient } from '@/lib/supabase/server'
import { tavilySearch, type TavilyResult } from '@/lib/tavily'
import { sendEmail, markdownToEmailHtml } from '@/lib/email'

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
 * Phase 1/2 hardcodes org_id = 'creait'. Multi-org lands in Phase 3.
 */

// TODO: per-org Inngest events (background jobs have no Clerk session)
const ORG_ID = 'creait'

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
 * Call a single MCP tool by name with arguments and return the parsed JSON
 * result. Returns `null` if the tool isn't available (MCP server down or the
 * specific tool isn't registered).
 */
async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown | null> {
  const tools = await loadMcpTools()
  const tool = tools[name]
  if (!tool) {
    console.warn(`[inngest] MCP tool "${name}" not available`)
    return null
  }
  const execute = tool.execute
  if (typeof execute !== 'function') {
    console.warn(`[inngest] MCP tool "${name}" has no execute function`)
    return null
  }
  try {
    // dynamicTool's execute has signature `(input, options) => result`
    // We pass an empty options object since we don't need toolCallId etc.
    const result = await execute(args, {
      toolCallId: `cron-${Date.now()}`,
      messages: [],
    } as never)
    return result
  } catch (err) {
    console.error(`[inngest] MCP tool "${name}" threw:`, err)
    return null
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
        <div style="font-family:Inter,system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#0a0e1a;color:#f1f5f9">
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

/**
 * Comms sweep — every 2 hours during waking hours. Pulls the top 5
 * unreplied messages and drafts replies via the "Draft Reply" skill. Each
 * message gets its own skill run.
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
 *   - "MRR" -- sum of monetaryValue across open opportunities
 *   - "Active Deals" -- count of opportunities NOT in won/lost
 *   - "Conversations 7d" -- count of conversations in the last 7 days
 *   - "Calls Booked 7d" -- placeholder; populated when calendar MCP lands
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
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()

      const [contactsRes, opportunitiesRes, conversationsRes] =
        await Promise.all([
          callMcpTool('ghl_get_contacts', {
            createdAfter: sevenDaysAgo,
            limit: 100,
          }),
          callMcpTool('ghl_get_opportunities', { limit: 100 }),
          callMcpTool('ghl_get_conversations', {
            updatedAfter: sevenDaysAgo,
            limit: 100,
          }),
        ])

      const newContacts7d = countItems(contactsRes)
      const { activeDeals, mrr } = summarizeOpportunities(opportunitiesRes)
      const conversations7d = countItems(conversationsRes)

      return [
        { name: 'New Contacts 7d', value: newContacts7d },
        { name: 'Active Deals', value: activeDeals },
        { name: 'MRR', value: mrr },
        { name: 'Conversations 7d', value: conversations7d },
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
        const { error } = await supabase
          .from('kpis')
          .update({ value, last_synced_at: nowIso })
          .eq('org_id', ORG_ID)
          .eq('name', name)
        if (error) {
          console.error(
            `[inngest] kpi update for "${name}" failed:`,
            error.message,
          )
          results.push({ name, updated: false })
        } else {
          results.push({ name, updated: true })
        }
      }
      return results
    })

    return { applied }
  },
)

// ---------------------------------------------------------------------------
// MCP result parsing helpers
// ---------------------------------------------------------------------------

/**
 * MCP tool calls return `{ content: [{type:'text', text:'...'}] }` by spec.
 * We try to parse the first text part as JSON and fall back to the structured
 * `structuredContent` field if present.
 */
function extractMcpJson(result: unknown): unknown {
  if (result == null || typeof result !== 'object') return null
  const obj = result as Record<string, unknown>
  if (obj.structuredContent && typeof obj.structuredContent === 'object') {
    return obj.structuredContent
  }
  const content = obj.content
  if (Array.isArray(content)) {
    for (const part of content) {
      if (
        part &&
        typeof part === 'object' &&
        (part as { type?: string }).type === 'text' &&
        typeof (part as { text?: string }).text === 'string'
      ) {
        const text = (part as { text: string }).text
        try {
          return JSON.parse(text)
        } catch {
          return text
        }
      }
    }
  }
  return null
}

function countItems(result: unknown): number {
  const parsed = extractMcpJson(result)
  if (parsed == null) return 0
  if (Array.isArray(parsed)) return parsed.length
  if (typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    if (typeof obj.total === 'number') return obj.total
    if (typeof obj.count === 'number') return obj.count
    if (Array.isArray(obj.items)) return obj.items.length
    if (Array.isArray(obj.contacts)) return obj.contacts.length
    if (Array.isArray(obj.opportunities)) return obj.opportunities.length
    if (Array.isArray(obj.conversations)) return obj.conversations.length
  }
  return 0
}

function summarizeOpportunities(result: unknown): {
  activeDeals: number
  mrr: number
} {
  const parsed = extractMcpJson(result)
  let items: Array<Record<string, unknown>> = []
  if (Array.isArray(parsed)) {
    items = parsed as Array<Record<string, unknown>>
  } else if (parsed && typeof parsed === 'object') {
    const candidate = (parsed as { opportunities?: unknown }).opportunities
    if (Array.isArray(candidate)) {
      items = candidate as Array<Record<string, unknown>>
    } else if (Array.isArray((parsed as { items?: unknown }).items)) {
      items = (parsed as { items: unknown[] }).items as Array<
        Record<string, unknown>
      >
    }
  }

  let activeDeals = 0
  let mrr = 0
  for (const item of items) {
    const status = String(item.status ?? '').toLowerCase()
    if (status !== 'won' && status !== 'lost' && status !== 'abandoned') {
      activeDeals++
    }
    const value = Number(item.monetaryValue ?? item.value ?? 0)
    if (!Number.isNaN(value)) {
      mrr += value
    }
  }
  return { activeDeals, mrr: Number(mrr.toFixed(2)) }
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
      const rows = flagged.map((f) => ({
        org_id: ORG_ID,
        source: 'other' as const,
        direction: 'inbound' as const,
        contact_name: 'Client Health Agent',
        subject: `Client health: ${f.name}`,
        body: `Client health agent flagged ${f.name}: ${f.reason}`,
        status: 'unread' as const,
        priority_score: 70,
      }))
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
// Registered functions
// ---------------------------------------------------------------------------

export const functions = [
  dailyBriefing,
  commsSweep,
  weeklySummary,
  goalCheck,
  ghlSync,
  youtubeResearch,
  recruitingMonitor,
  clientHealth,
  techWatchCrawler,
]
