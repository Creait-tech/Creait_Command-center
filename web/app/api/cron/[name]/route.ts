import { inngest } from '@/lib/inngest'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Allowed cron names — mapped to Inngest `cron/<name>` events. Adding a new
 * cron means:
 *   1. Add an entry here.
 *   2. Add the matching `{ event: 'cron/<name>' }` trigger in
 *      `inngest-functions.ts`.
 *   3. Add the path + UTC schedule to `vercel.json`.
 */
const ALLOWED_NAMES = new Set([
  'daily-briefing',
  'comms-sweep',
  'goal-check',
  'weekly-summary',
  'ghl-sync',
  'zoom-sync',
  // Phase 3 long-running agents
  'youtube-research',
  'recruiting-monitor',
  'client-health',
  'tech-watch-crawl',
])

/**
 * GET /api/cron/[name]
 *
 * Authenticates via either:
 *   - `Authorization: Bearer ${CRON_SECRET}` (manual trigger / smoke tests)
 *   - `x-vercel-cron-signature` header (set automatically by Vercel Cron)
 *
 * On success, sends an `cron/<name>` event to Inngest. The actual work runs
 * in the corresponding Inngest function so retries + observability live in
 * one place.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params

  if (!ALLOWED_NAMES.has(name)) {
    return jsonError(`Unknown cron name: ${name}`, 404)
  }

  if (!isAuthorized(req)) {
    return jsonError('Unauthorized', 401)
  }

  try {
    await inngest.send({ name: `cron/${name}`, data: {} })
    return Response.json({ ok: true, sent: name })
  } catch (err) {
    console.error(`[api/cron/${name}] inngest send failed:`, err)
    return jsonError(
      err instanceof Error ? err.message : 'Failed to dispatch cron event',
      500,
    )
  }
}

// Vercel Cron can use POST too in some configurations — accept both.
export const POST = GET

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (secret && authHeader === `Bearer ${secret}`) {
    return true
  }
  // Vercel Cron sets this header on every scheduled invocation.
  if (req.headers.get('x-vercel-cron-signature')) {
    return true
  }
  // Vercel Cron also sets x-vercel-cron with a truthy value on hobby-managed
  // crons — accept that as a fallback signal.
  if (req.headers.get('x-vercel-cron')) {
    return true
  }
  return false
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
