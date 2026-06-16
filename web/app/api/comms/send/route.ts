import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

import { getActiveOrgId } from '@/lib/active-org'
import { callMcpTool, extractMcpJson, mcpResultIsError } from '@/lib/mcp-client'
import { createServiceClient } from '@/lib/supabase/server'
import type { Message, MessageSource } from '@/lib/supabase/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const bodySchema = z.object({
  messageId: z.string().uuid('messageId must be a UUID'),
  replyText: z.string().min(1, 'replyText is required'),
})

/**
 * Map a GHL-sourced message to the channel type the `ghl_send_message` MCP
 * tool expects (`'SMS' | 'Email' | 'WhatsApp'`). DMs route to WhatsApp, which
 * is GHL's conversational channel for direct messages.
 */
const GHL_TYPE_BY_SOURCE: Partial<
  Record<MessageSource, 'SMS' | 'Email' | 'WhatsApp'>
> = {
  ghl_sms: 'SMS',
  ghl_email: 'Email',
  ghl_dm: 'WhatsApp',
}

type SendResult =
  | { ok: true; channel: MessageSource }
  | { ok: false; needsSetup?: 'gmail' | 'linkedin'; message: string }

/**
 * POST /api/comms/send — actually deliver an approved reply, routing by the
 * message's `source`.
 *
 * Body: `{ messageId: uuid, replyText: string }`
 *
 * Response shapes:
 *   - `{ ok: true, channel }`                 — sent successfully
 *   - `{ ok: false, needsSetup, message }`    — known-not-configured channel
 *   - `{ ok: false, message }`                — no send path / send failed
 *
 * All responses use HTTP 200 except auth (401), bad input (400), and missing
 * message (404). A `needsSetup` state is intentionally NOT an HTTP error — it's
 * a known gap the UI surfaces as an amber notice.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return jsonError('Unauthorized', 401)
    }

    const json = await req.json().catch(() => null)
    if (!json) {
      return jsonError('Invalid JSON body', 400)
    }

    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return jsonError(
        `Invalid request: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
        400,
      )
    }

    const { messageId, replyText } = parsed.data
    const orgId = await getActiveOrgId()
    const supabase = createServiceClient()

    // -------------------------------------------------------------------------
    // Look up the message (scoped to the active org)
    // -------------------------------------------------------------------------
    const { data: messageRow, error: lookupErr } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (lookupErr) {
      return jsonError(`Failed to load message: ${lookupErr.message}`, 500)
    }
    if (!messageRow) {
      return jsonError('Message not found', 404)
    }
    const message = messageRow as Message

    // -------------------------------------------------------------------------
    // Route by source
    // -------------------------------------------------------------------------
    const result = await routeSend(message, replyText)

    // On a real send, mark the message replied and log the run.
    if (result.ok) {
      const now = new Date().toISOString()
      const { error: updateErr } = await supabase
        .from('messages')
        .update({
          status: 'replied',
          replied_at: now,
          draft_reply: replyText,
          updated_at: now,
        })
        .eq('id', message.id)
        .eq('org_id', orgId)

      if (updateErr) {
        // The message went out but we couldn't record it — surface as an error
        // so the operator knows the DB is out of sync with the channel.
        return jsonError(
          `Sent via ${result.channel} but failed to update message: ${updateErr.message}`,
          500,
        )
      }

      await logSend(orgId, message, result.channel, replyText)
    }

    return Response.json(result)
  } catch (err) {
    console.error('[api/comms/send] error:', err)
    return jsonError(
      err instanceof Error ? err.message : 'Internal server error',
      500,
    )
  }
}

/**
 * Dispatch the reply to the right channel based on `message.source`.
 */
async function routeSend(
  message: Message,
  replyText: string,
): Promise<SendResult> {
  switch (message.source) {
    case 'ghl_sms':
    case 'ghl_email':
    case 'ghl_dm':
      return sendViaGhl(message, replyText)

    case 'gmail':
      return sendGmail(message, replyText)

    case 'linkedin':
      return {
        ok: false,
        needsSetup: 'linkedin',
        message: 'LinkedIn DMs require Unipile — deferred to Phase 4',
      }

    case 'other':
    default:
      return { ok: false, message: 'No send channel for source=other' }
  }
}

/**
 * Send through the in-house MCP server's `ghl_send_message` tool.
 *
 * The tool's input schema (mcp/src/tools/ghl.ts) is:
 *   { conversationId: string, type: 'SMS' | 'Email' | 'WhatsApp', message: string }
 *
 * GHL groups messages by conversation, so the conversation id is the
 * message's `thread_id`; we fall back to `source_id` if a thread id wasn't
 * captured at ingest time.
 */
async function sendViaGhl(
  message: Message,
  replyText: string,
): Promise<SendResult> {
  const type = GHL_TYPE_BY_SOURCE[message.source]
  if (!type) {
    return { ok: false, message: `Unsupported GHL source: ${message.source}` }
  }

  const conversationId = message.thread_id ?? message.source_id
  if (!conversationId) {
    return {
      ok: false,
      message:
        'Cannot send: message has no GHL conversation id (thread_id/source_id)',
    }
  }

  const raw = await callMcpTool('ghl_send_message', {
    conversationId,
    type,
    message: replyText,
  })

  if (mcpResultIsError(raw)) {
    const detail = extractMcpJson(raw)
    const detailMessage =
      detail && typeof detail === 'object' && 'message' in detail
        ? String((detail as { message?: unknown }).message)
        : raw == null
          ? 'GHL send tool unavailable (MCP server unreachable or not configured)'
          : 'GHL send failed'
    return { ok: false, message: detailMessage }
  }

  return { ok: true, channel: message.source }
}

/**
 * Gmail send path. Google OAuth isn't configured yet, so this returns a
 * structured `needsSetup` state instead of failing. Once
 * GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are provided, replace
 * the guard below with a real Gmail API send (users.messages.send) and the
 * surrounding route already records the reply on success.
 */
async function sendGmail(
  message: Message,
  replyText: string,
): Promise<SendResult> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      needsSetup: 'gmail',
      message:
        'Gmail send requires Google OAuth — configure GOOGLE_OAUTH_CLIENT_ID/SECRET',
    }
  }

  // Creds exist — fail loudly rather than silently no-op'ing. The Gmail API
  // wiring (token exchange + users.messages.send) lands when OAuth is set up.
  throw new Error(
    `Gmail send not implemented: OAuth credentials are present but the ` +
      `Gmail API send path has not been wired yet ` +
      `(message=${message.id}, replyLength=${replyText.length}).`,
  )
}

/**
 * Best-effort audit row in `run_history`. A logging failure must never block a
 * successful send, so errors here are swallowed (logged to the server only).
 */
async function logSend(
  orgId: string,
  message: Message,
  channel: MessageSource,
  replyText: string,
): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('run_history').insert({
      org_id: orgId,
      trigger: 'chat',
      model: null,
      input: { messageId: message.id, source: message.source } as never,
      output: {
        text: `Sent reply via ${channel} to ${message.contact_handle ?? message.contact_name ?? 'unknown'}`,
        replyLength: replyText.length,
      } as never,
      status: 'succeeded',
      completed_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[api/comms/send] run_history log failed:', err)
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
