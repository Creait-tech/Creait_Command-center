import 'server-only'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Page contexts the chat widget can be opened in. Drives which slice of
 * org data we fetch and embed in the system prompt.
 */
export type PageContext =
  | 'command-center'
  | 'level-10'
  | 'comms'
  | 'research'
  | 'agents'
  | (string & {})

const HARDCODED_BRAND_VOICE = `Tagline: "Stop Losing Customers. Start Growing."
SAY: outcomes, plain English, fear of loss, time freedom, simplicity.
NEVER SAY: "All-in-One", CRM, API, webhooks, pipeline, funnel builder, smart automations.
Sound like a sharp ops lead. Bullets beat paragraphs. Numbers first, then context.`

interface StrategyRow {
  mission?: string | null
  vision?: string | null
  brand_positioning?: string | null
  icp?: string | null
}

interface PageDataResult {
  description: string
  data: unknown
}

/**
 * Build the full system prompt for `/api/chat` given the active org and the
 * page the widget was opened on. Pulls strategy from Supabase + a small slice
 * of page-relevant data, then assembles a structured prompt with hard brand
 * voice rules at the top.
 *
 * Server-only: requires the Supabase service role.
 */
export async function buildSystemPrompt(
  orgId: string,
  pageContext: string,
): Promise<string> {
  const supabase = createServiceClient()

  const [strategy, pageData] = await Promise.all([
    fetchStrategy(supabase, orgId),
    fetchPageData(supabase, orgId, pageContext),
  ])

  const brandVoice =
    (strategy?.brand_positioning && strategy.brand_positioning.trim()) ||
    HARDCODED_BRAND_VOICE

  const companyContext = renderCompanyContext(strategy)
  const pageBlock = renderPageBlock(pageContext, pageData)

  return [
    'You are the AI operating system for CREAIT (Maurice Grant\'s AI consulting agency).',
    'You have full context on this business and can call tools to retrieve more.',
    "Never say you don't have access to data — query tools to find it.",
    '',
    '# Brand voice rules (HARD — never violate)',
    brandVoice,
    '',
    '# Company context',
    companyContext,
    '',
    `# Current page: ${pageContext}`,
    '# Current page data:',
    pageBlock,
    '',
    'When taking actions, confirm what you did and where the output went.',
  ].join('\n')
}

function renderCompanyContext(strategy: StrategyRow | null): string {
  if (!strategy) {
    return '(no strategy row found — seed the `strategy` table with the CREAIT soul)'
  }
  const lines: string[] = []
  if (strategy.mission) lines.push(`Mission: ${strategy.mission}`)
  if (strategy.vision) lines.push(`Vision: ${strategy.vision}`)
  if (strategy.icp) lines.push(`ICP: ${strategy.icp}`)
  if (lines.length === 0) {
    return '(strategy row present but mission/vision/icp are empty)'
  }
  return lines.join('\n')
}

function renderPageBlock(
  pageContext: string,
  pageData: PageDataResult | null,
): string {
  if (!pageData) {
    return `(no page-specific data for "${pageContext}")`
  }
  return `${pageData.description}\n${safeStringify(pageData.data)}`
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '(unserializable)'
  }
}

// ---------------------------------------------------------------------------
// Supabase fetchers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchStrategy(supabase: any, orgId: string): Promise<StrategyRow | null> {
  try {
    const { data, error } = await supabase
      .from('strategy')
      .select('mission, vision, brand_positioning, icp')
      .eq('org_id', orgId)
      .maybeSingle()
    if (error) {
      console.error('[context-builder] fetchStrategy error', error)
      return null
    }
    return (data as StrategyRow | null) ?? null
  } catch (err) {
    console.error('[context-builder] fetchStrategy threw', err)
    return null
  }
}

async function fetchPageData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  pageContext: string,
): Promise<PageDataResult | null> {
  try {
    switch (pageContext) {
      case 'command-center':
        return await fetchCommandCenterData(supabase, orgId)
      case 'level-10':
        return await fetchLevel10Data(supabase, orgId)
      case 'comms':
        return await fetchCommsData(supabase, orgId)
      case 'research':
        return await fetchResearchData(supabase, orgId)
      case 'agents':
        return await fetchAgentsData(supabase, orgId)
      default:
        return null
    }
  } catch (err) {
    console.error(`[context-builder] fetchPageData(${pageContext}) threw`, err)
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchCommandCenterData(supabase: any, orgId: string): Promise<PageDataResult> {
  const [goals, priorities] = await Promise.all([
    supabase
      .from('goals')
      .select('*')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(10),
    supabase
      .from('company_priorities')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])
  return {
    description: 'Recent goals and company priorities:',
    data: {
      goals: goals.data ?? [],
      company_priorities: priorities.data ?? [],
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchLevel10Data(supabase: any, orgId: string): Promise<PageDataResult> {
  const [meeting, idsItems, kpis] = await Promise.all([
    supabase
      .from('meetings')
      .select('*')
      .eq('org_id', orgId)
      .order('meeting_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ids_items')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('kpis')
      .select('*')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(20),
  ])
  return {
    description: 'Most recent meeting, open IDS items, current KPIs:',
    data: {
      latest_meeting: meeting.data ?? null,
      open_ids_items: idsItems.data ?? [],
      kpis: kpis.data ?? [],
    },
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchCommsData(supabase: any, orgId: string): Promise<PageDataResult> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('org_id', orgId)
    .eq('replied', false)
    .order('received_at', { ascending: false })
    .limit(10)
  return {
    description: 'Top 10 unreplied messages:',
    data: data ?? [],
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchResearchData(supabase: any, orgId: string): Promise<PageDataResult> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('research_briefings')
    .select('*')
    .eq('org_id', orgId)
    .eq('briefing_date', today)
    .maybeSingle()
  return {
    description: "Today's research briefing:",
    data: data ?? null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAgentsData(supabase: any, orgId: string): Promise<PageDataResult> {
  const { data } = await supabase
    .from('run_history')
    .select('*')
    .eq('org_id', orgId)
    .order('started_at', { ascending: false })
    .limit(15)
  return {
    description: 'Recent agent run history:',
    data: data ?? [],
  }
}
