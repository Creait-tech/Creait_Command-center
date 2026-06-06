import { inngest } from '@/lib/inngest'
import { loadMcpTools } from '@/lib/mcp-client'
import { runSkill } from '@/lib/skills-engine'
import { createServiceClient } from '@/lib/supabase/server'

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
    return { runId: result.runId, outputLength: result.output.length }
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
 * Goal-check — placeholder cron route (no scheduled trigger of its own yet).
 * Currently only fires via the manual cron endpoint. Updates KPI snapshots
 * and surfaces drift; full implementation lands in Phase 3.
 */
export const goalCheck = inngest.createFunction(
  {
    id: 'goal-check',
    name: 'Goal Check',
    triggers: [{ event: 'cron/goal-check' }],
  },
  async ({ step }) => {
    await step.run('noop', () => ({ note: 'goal-check stub' }))
    return { ok: true, note: 'Phase 3 will implement goal drift detection.' }
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
// Registered functions
// ---------------------------------------------------------------------------

export const functions = [
  dailyBriefing,
  commsSweep,
  weeklySummary,
  goalCheck,
  ghlSync,
]
