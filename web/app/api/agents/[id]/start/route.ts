import { auth } from '@clerk/nextjs/server'

import { getActiveOrgId } from '@/lib/active-org'
import { inngest } from '@/lib/inngest'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Map each known agent name to the canonical cron-event name we dispatch
 * into Inngest. Keeping this explicit (not a slugify) avoids accidentally
 * firing arbitrary events if an agent gets renamed in the DB.
 */
const AGENT_NAME_TO_EVENT: Record<string, string> = {
  'YouTube Research Agent': 'cron/youtube-research',
  'Recruiting Monitor Agent': 'cron/recruiting-monitor',
  'Client Health Agent': 'cron/client-health',
  'Tech Watch Crawler': 'cron/tech-watch-crawl',
}

/**
 * POST /api/agents/[id]/start
 *
 * Manually triggers a background agent by looking up its name and sending
 * the corresponding `cron/*` event to Inngest. Authenticated via Clerk.
 *
 * Returns `{ ok, eventIds, agentName, event }` on success.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return jsonError('Unauthorized', 401)
    }

    const { id } = await ctx.params
    if (!id || typeof id !== 'string') {
      return jsonError('Missing agent id', 400)
    }

    const orgId = await getActiveOrgId()
    const supabase = createServiceClient()
    const { data: agent, error } = await supabase
      .from('agents')
      .select('id, name, status')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle()

    if (error) {
      return jsonError(`Failed to load agent: ${error.message}`, 500)
    }
    if (!agent) {
      return jsonError('Agent not found', 404)
    }

    const agentName = agent.name as string
    const eventName = AGENT_NAME_TO_EVENT[agentName]
    if (!eventName) {
      return jsonError(
        `No Inngest event mapping for agent "${agentName}"`,
        400,
      )
    }

    const result = await inngest.send({
      name: eventName,
      data: { agentId: agent.id, triggeredBy: userId },
    })

    return Response.json({
      ok: true,
      agentName,
      event: eventName,
      eventIds: result.ids,
    })
  } catch (err) {
    console.error('[api/agents/start] error:', err)
    return jsonError(
      err instanceof Error ? err.message : 'Internal server error',
      500,
    )
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
