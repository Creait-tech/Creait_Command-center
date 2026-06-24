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
 * Gmail send path. Uses the per-org refresh token stored in `cc_oauth_tokens`
 * (connected via /api/auth/google/start) to mint a short-lived access token,
 * then POSTs an RFC 2822 message to the Gmail API users.messages.send endpoint.
 *
 * Never throws — always resolves to a SendResult so the route can surface a
 * structured outcome (needsSetup, send-failed detail, or ok).
 */
async function sendGmail(
  message: Message,
  replyText: string,
): Promise<SendResult> {
  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

    // 1. OAuth app credentials must be configured.
    if (!clientId || !clientSecret) {
      return {
        ok: false,
        needsSetup: 'gmail',
        message:
          'Gmail send requires Google OAuth — configure GOOGLE_OAUTH_CLIENT_ID/SECRET',
      }
    }

    // 2. The org must have connected a Gmail account (refresh token on file).
    const supabase = createServiceClient()
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('cc_oauth_tokens')
      .select('refresh_token,email')
      .eq('org_id', message.org_id)
      .eq('provider', 'google')
      .maybeSingle()

    if (tokenErr || !tokenRow || !tokenRow.refresh_token) {
      return {
        ok: false,
        needsSetup: 'gmail',
        message:
          'Gmail not connected — connect it in Settings → Integrations',
      }
    }

    // 3. Exchange the refresh token for a fresh access token.
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenRow.refresh_token,
        grant_type: 'refresh_token',
      }).toString(),
    })

    if (!tokenRes.ok) {
      return {
        ok: false,
        message: 'Gmail auth refresh failed — reconnect Gmail in Settings',
      }
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string }
    const accessToken = tokenJson.access_token
    if (!accessToken) {
      return {
        ok: false,
        message: 'Gmail auth refresh failed — reconnect Gmail in Settings',
      }
    }

    // 4. Determine the recipient.
    const recipient = message.contact_handle
    if (!recipient || !recipient.includes('@')) {
      return { ok: false, message: 'No email address on this contact' }
    }

    // 5. Build the RFC 2822 message.
    const fromEmail = tokenRow.email
    const subject = buildReplySubject(message.subject)

    const headers: string[] = []
    if (fromEmail) headers.push(`From: ${fromEmail}`)
    headers.push(`To: ${recipient}`)
    headers.push(`Subject: ${subject}`)
    headers.push('Content-Type: text/plain; charset="UTF-8"')
    headers.push('MIME-Version: 1.0')
    if (message.source_id) {
      // Best-effort threading on the Gmail side.
      headers.push(`In-Reply-To: ${message.source_id}`)
      headers.push(`References: ${message.source_id}`)
    }

    const rfc2822 = `${headers.join('\r\n')}\r\n\r\n${replyText}`
    const raw = base64UrlEncode(rfc2822)

    // 6. Send via Gmail API.
    const body: { raw: string; threadId?: string } = { raw }
    if (message.thread_id) body.threadId = message.thread_id

    const sendRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )

    if (sendRes.ok) {
      return { ok: true, channel: 'gmail' }
    }

    // 7. Parse and surface the error detail.
    const detail = await extractGmailError(sendRes)
    return { ok: false, message: `Gmail send failed: ${detail}` }
  } catch (err) {
    return {
      ok: false,
      message: `Gmail send failed: ${
        err instanceof Error ? err.message : 'unexpected error'
      }`,
    }
  }
}

/**
 * Build a "Re:"-prefixed reply subject without doubling the prefix.
 */
function buildReplySubject(subject: string | null): string {
  if (!subject) return 'Re: your message'
  return /^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`
}

/**
 * Base64url-encode a UTF-8 string for the Gmail API `raw` field
 * (base64 → +→- /→_ → strip padding).
 */
function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Pull a human-readable detail out of a failed Gmail API response.
 */
async function extractGmailError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as {
      error?: { message?: string } | string
    }
    if (json && typeof json.error === 'object' && json.error?.message) {
      return json.error.message
    }
    if (typeof json.error === 'string') return json.error
    return `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
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
