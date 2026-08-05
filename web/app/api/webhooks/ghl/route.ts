import { inngest } from '@/lib/inngest'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GHL → Command Center webhook receiver.
 *
 * GoHighLevel workflows (app.getcreait.com, the active sub-account) POST
 * here via their Webhook action whenever something changes: contact
 * created, opportunity stage moved, appointment booked, payment received.
 *
 * We deliberately do NOT map payload fields here. GHL webhook payload
 * shape varies by trigger type and drifts over time. This endpoint is a
 * doorbell: authenticate the sender, extract a best-effort summary for
 * observability, and fire a `ghl/changed` Inngest event. The debounced
 * relay (`ghlChangeRelay`) collapses bursts into a single `cron/ghl-sync`
 * run, which re-reads GHL through the same MCP path the hourly cron uses —
 * one source of truth for how GHL data lands in Supabase.
 *
 * Auth: GHL's basic Webhook action can only set a URL (no headers), so we
 * accept the shared secret as a `?token=` query param, with an
 * `Authorization: Bearer` fallback for the premium Custom Webhook action
 * and curl tests. Fails closed if GHL_WEBHOOK_SECRET is unset.
 */
export async function POST(req: Request) {
  const secret = process.env.GHL_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhooks/ghl] GHL_WEBHOOK_SECRET not configured')
    return jsonError('Webhook not configured', 503)
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const authHeader = req.headers.get('authorization')
  const authed = token === secret || authHeader === `Bearer ${secret}`
  if (!authed) {
    return jsonError('Unauthorized', 401)
  }

  let body: unknown = null
  try {
    body = await req.json()
  } catch {
    // GHL always sends JSON, but a doorbell shouldn't reject an empty body.
  }

  try {
    await inngest.send({ name: 'ghl/changed', data: { summary: summarize(body) } })
  } catch (err) {
    console.error('[webhooks/ghl] inngest send failed:', err)
    // 500 so GHL marks the action failed — the whole point is not to miss
    // changes silently.
    return jsonError('Failed to queue sync', 500)
  }

  return Response.json({ ok: true })
}

/**
 * Best-effort, shape-agnostic description of what changed — shown in the
 * Inngest run logs only. Never throws; unknown payloads summarize to nulls.
 * GHL contact-based triggers flatten contact fields to the top level.
 */
function summarize(body: unknown): {
  type: string | null
  contact: string | null
  email: string | null
} {
  if (!body || typeof body !== 'object') {
    return { type: null, contact: null, email: null }
  }
  const rec = body as Record<string, unknown>
  const str = (v: unknown): string | null =>
    typeof v === 'string' && v.length > 0 ? v : null

  const first = str(rec.first_name) ?? str(rec.firstName)
  const last = str(rec.last_name) ?? str(rec.lastName)
  const name =
    str(rec.full_name) ??
    str(rec.contact_name) ??
    (first || last ? [first, last].filter(Boolean).join(' ') : null)

  return {
    type: str(rec.type) ?? str(rec.event) ?? str(rec.workflow_name) ?? null,
    contact: name,
    email: str(rec.email),
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
