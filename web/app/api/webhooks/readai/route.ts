import { verifyReadAiSignature } from '@/lib/readai-signature'
import { runSkill } from '@/lib/skills-engine'
import { createServiceClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

export const runtime = 'nodejs'
export const maxDuration = 120

// TODO: derive org_id from webhook payload once Read.ai supports multi-tenant
const ORG_ID = 'creait'
const SKILL_NAME = 'Meeting Debrief'

/**
 * Read.ai webhook handler.
 *
 * Flow:
 *   1. Read raw body (needed for HMAC verification).
 *   2. Authenticate via `X-Readai-Signature` HMAC or Bearer fallback.
 *   3. Parse + defensively extract meeting fields (payload format may drift).
 *   4. Upsert into `meetings` keyed on (source='readai', source_id).
 *   5. Look up "Meeting Debrief" skill, run it against the transcript.
 *   6. Parse JSON output → fan out into wins, ids_items, and meeting summary.
 *
 * Resilience rules:
 *   - Never 5xx on downstream skill failure — Read.ai retries on 5xx and we
 *     don't want duplicate meeting rows. We log + return 200 with a warning.
 *   - Auth failures return 401 (real auth problem).
 *   - Bad JSON returns 400 (malformed request).
 *   - Storage failures DO return 500 (legitimate retry case).
 */
export async function POST(req: Request) {
  const rawBody = await req.text()

  // ---------------------------------------------------------------------------
  // 1. Authenticate
  // ---------------------------------------------------------------------------
  const secret = process.env.READAI_WEBHOOK_SECRET
  if (!secret) {
    console.error('[readai] READAI_WEBHOOK_SECRET not configured')
    return jsonError('Webhook not configured', 500)
  }

  const signatureHeader = req.headers.get('x-readai-signature')
  const authHeader = req.headers.get('authorization')

  let authed = false
  if (signatureHeader) {
    authed = verifyReadAiSignature(rawBody, signatureHeader, secret)
    if (!authed) {
      console.warn('[readai] HMAC signature mismatch')
    }
  } else if (authHeader === `Bearer ${secret}`) {
    // Fallback for curl tests and any sender that uses bearer auth.
    authed = true
  }

  if (!authed) {
    return jsonError('Unauthorized', 401)
  }

  // ---------------------------------------------------------------------------
  // 2. Parse body
  // ---------------------------------------------------------------------------
  let body: ReadAiPayload
  try {
    body = JSON.parse(rawBody) as ReadAiPayload
  } catch (err) {
    console.error('[readai] invalid JSON body:', err)
    return jsonError('Invalid JSON body', 400)
  }
  if (!body || typeof body !== 'object') {
    return jsonError('Body must be a JSON object', 400)
  }

  // ---------------------------------------------------------------------------
  // 3. Defensive field extraction
  // ---------------------------------------------------------------------------
  const meetingObj = isRecord(body.meeting) ? body.meeting : {}
  const transcriptObj = isRecord(body.transcript) ? body.transcript : {}
  const summaryObj = isRecord(body.summary) ? body.summary : {}

  const meetingTitle =
    asString(meetingObj.title) ?? asString(body.title) ?? 'Untitled Meeting'

  const meetingDate =
    asString(meetingObj.start_time) ??
    asString(body.startTime) ??
    asString(body.scheduled_at) ??
    new Date().toISOString()

  const transcript =
    asString(transcriptObj.text) ??
    (typeof body.transcript === 'string' ? body.transcript : null) ??
    asString(summaryObj.transcript) ??
    ''

  const initialSummary =
    asString(summaryObj.short) ??
    asString(summaryObj.text) ??
    (typeof body.summary === 'string' ? body.summary : null) ??
    null

  const attendees = Array.isArray(body.attendees)
    ? body.attendees
    : Array.isArray(body.participants)
      ? body.participants
      : []

  const recordingUrl =
    asString(body.recording_url) ?? asString(body.recordingUrl) ?? null

  const sourceId = asString(meetingObj.id) ?? asString(body.id) ?? null

  // ---------------------------------------------------------------------------
  // 4. Upsert meeting
  // ---------------------------------------------------------------------------
  const supabase = createServiceClient()

  let meetingId: string | null = null

  if (sourceId) {
    const { data: existing, error: existingErr } = await supabase
      .from('meetings')
      .select('id')
      .eq('org_id', ORG_ID)
      .eq('source', 'readai')
      .eq('source_id', sourceId)
      .maybeSingle()

    if (existingErr) {
      console.error('[readai] lookup existing meeting failed:', existingErr)
      return jsonError(
        `Lookup failed: ${existingErr.message}`,
        500,
      )
    }
    if (existing) {
      meetingId = existing.id as string
    }
  }

  if (meetingId) {
    const { error: updateErr } = await supabase
      .from('meetings')
      .update({
        title: meetingTitle,
        meeting_type: 'level_10',
        scheduled_at: meetingDate,
        transcript,
        summary: initialSummary,
        attendees: attendees as Json,
        source: 'readai',
        source_id: sourceId,
        recording_url: recordingUrl,
      })
      .eq('id', meetingId)

    if (updateErr) {
      console.error('[readai] meeting update failed:', updateErr)
      return jsonError(`Meeting update failed: ${updateErr.message}`, 500)
    }
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from('meetings')
      .insert({
        org_id: ORG_ID,
        title: meetingTitle,
        meeting_type: 'level_10',
        scheduled_at: meetingDate,
        transcript,
        summary: initialSummary,
        attendees: attendees as Json,
        source: 'readai',
        source_id: sourceId,
        recording_url: recordingUrl,
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      console.error('[readai] meeting insert failed:', insertErr)
      return jsonError(
        `Meeting insert failed: ${insertErr?.message ?? 'unknown'}`,
        500,
      )
    }
    meetingId = inserted.id as string
  }

  // ---------------------------------------------------------------------------
  // 5. Skip skill if no transcript
  // ---------------------------------------------------------------------------
  if (!transcript || transcript.trim().length === 0) {
    return Response.json({
      ok: true,
      meetingId,
      message: 'meeting persisted, no transcript to debrief',
    })
  }

  // ---------------------------------------------------------------------------
  // 6. Look up Meeting Debrief skill
  // ---------------------------------------------------------------------------
  const { data: skillRow, error: skillErr } = await supabase
    .from('skills')
    .select('id')
    .eq('org_id', ORG_ID)
    .eq('name', SKILL_NAME)
    .maybeSingle()

  if (skillErr) {
    console.error('[readai] skill lookup failed:', skillErr)
    return Response.json({
      ok: true,
      meetingId,
      warning: `skill lookup failed: ${skillErr.message}`,
    })
  }
  if (!skillRow) {
    console.warn(`[readai] "${SKILL_NAME}" skill not seeded`)
    return Response.json({
      ok: true,
      meetingId,
      warning: 'skill not seeded',
    })
  }
  const skillId = skillRow.id as string

  // ---------------------------------------------------------------------------
  // 7. Run debrief skill (do not fail the webhook if this throws)
  // ---------------------------------------------------------------------------
  let skillOutput: string | null = null
  try {
    const result = await runSkill(
      skillId,
      {
        meetingId,
        transcript,
        title: meetingTitle,
        attendees,
      },
      {
        orgId: ORG_ID,
        triggeredBy: 'webhook:readai',
        trigger: 'webhook',
      },
    )
    skillOutput = result.output
  } catch (err) {
    console.error('[readai] debrief skill run failed:', err)
    return Response.json({
      ok: true,
      meetingId,
      warning: 'debrief failed',
      error: err instanceof Error ? err.message : 'unknown',
    })
  }

  // ---------------------------------------------------------------------------
  // 8. Parse skill output (defensive — model may produce slightly off JSON)
  // ---------------------------------------------------------------------------
  const parsed = parseDebriefOutput(skillOutput)

  // ---------------------------------------------------------------------------
  // 9. Update meeting summary if the skill produced one
  // ---------------------------------------------------------------------------
  let composedSummary = parsed.summary || initialSummary || ''
  if (parsed.decisions.length > 0) {
    const decisionBlock = parsed.decisions.map((d) => `- ${d}`).join('\n')
    composedSummary =
      composedSummary && composedSummary.trim().length > 0
        ? `${composedSummary}\n\n**Decisions:**\n${decisionBlock}`
        : `**Decisions:**\n${decisionBlock}`
  }

  if (composedSummary && composedSummary.length > 0) {
    const { error: summaryErr } = await supabase
      .from('meetings')
      .update({ summary: composedSummary })
      .eq('id', meetingId)

    if (summaryErr) {
      console.error('[readai] summary update failed:', summaryErr)
    }
  }

  // ---------------------------------------------------------------------------
  // 10. Insert wins
  // ---------------------------------------------------------------------------
  const today = new Date().toISOString().slice(0, 10)
  let winsInserted = 0
  if (parsed.wins.length > 0) {
    const rows = parsed.wins
      .map((title) => title.trim())
      .filter((title) => title.length > 0)
      .map((title) => ({
        org_id: ORG_ID,
        meeting_id: meetingId,
        title,
        win_date: today,
      }))

    if (rows.length > 0) {
      const { error: winsErr } = await supabase.from('wins').insert(rows)
      if (winsErr) {
        console.error('[readai] wins insert failed:', winsErr)
      } else {
        winsInserted = rows.length
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 11. Insert IDS items (issues, action items, decisions)
  // ---------------------------------------------------------------------------
  const idsRows: Array<{
    org_id: string
    meeting_id: string | null
    title: string
    description: string | null
    status: 'open' | 'solved'
    priority: number
  }> = []

  for (const issue of parsed.issues) {
    const title = issue.trim()
    if (title.length === 0) continue
    idsRows.push({
      org_id: ORG_ID,
      meeting_id: meetingId,
      title,
      description: null,
      status: 'open',
      priority: 5,
    })
  }

  for (const action of parsed.actionItems) {
    const baseTitle = action.title?.trim()
    if (!baseTitle) continue
    const ownerSuffix = action.owner ? ` (@${action.owner})` : ''
    const dueSuffix = action.dueDate ? ` [due ${action.dueDate}]` : ''
    idsRows.push({
      org_id: ORG_ID,
      meeting_id: meetingId,
      title: `ACTION: ${baseTitle}${ownerSuffix}${dueSuffix}`,
      description: null,
      status: 'open',
      priority: 5,
    })
  }

  for (const decision of parsed.decisions) {
    const title = decision.trim()
    if (title.length === 0) continue
    idsRows.push({
      org_id: ORG_ID,
      meeting_id: meetingId,
      title: `DECISION: ${title}`,
      description: null,
      status: 'solved',
      priority: 5,
    })
  }

  let idsInserted = 0
  if (idsRows.length > 0) {
    const { error: idsErr } = await supabase.from('ids_items').insert(idsRows)
    if (idsErr) {
      console.error('[readai] ids_items insert failed:', idsErr)
    } else {
      idsInserted = idsRows.length
    }
  }

  return Response.json({
    ok: true,
    meetingId,
    wins: winsInserted,
    issues: idsInserted,
  })
}

// =============================================================================
// helpers
// =============================================================================

// The Read.ai webhook payload format is not formally documented (and likely
// to change), so we type it loosely and extract fields defensively.
type ReadAiPayload = Record<string, unknown> & {
  meeting?: Record<string, unknown>
  transcript?: unknown
  summary?: unknown
  attendees?: unknown
  participants?: unknown
}

interface DebriefOutput {
  summary: string
  wins: string[]
  actionItems: Array<{
    title?: string
    owner?: string | null
    dueDate?: string | null
  }>
  issues: string[]
  decisions: string[]
}

function parseDebriefOutput(raw: string | null): DebriefOutput {
  const empty: DebriefOutput = {
    summary: '',
    wins: [],
    actionItems: [],
    issues: [],
    decisions: [],
  }
  if (!raw) return empty

  // The model is prompted to return JSON, but may wrap it in code fences or
  // include preamble. Try strict JSON first, then a fenced-block fallback.
  let parsed: unknown = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    const fenced = extractJsonFromText(raw)
    if (fenced) {
      try {
        parsed = JSON.parse(fenced)
      } catch {
        parsed = null
      }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return empty
  }
  const obj = parsed as Record<string, unknown>

  return {
    summary: asString(obj.summary) ?? '',
    wins: toStringArray(obj.wins),
    actionItems: toActionArray(obj.actionItems ?? obj.action_items),
    issues: toStringArray(obj.issues),
    decisions: toStringArray(obj.decisions),
  }
}

function extractJsonFromText(text: string): string | null {
  // Look for ```json ... ``` or ``` ... ``` fences first.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim()
  }
  // Fall back to the first balanced { ... } block.
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    return text.slice(start, end + 1)
  }
  return null
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => (typeof v === 'string' ? v : asString(v)))
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
}

function toActionArray(value: unknown): DebriefOutput['actionItems'] {
  if (!Array.isArray(value)) return []
  const out: DebriefOutput['actionItems'] = []
  for (const item of value) {
    if (typeof item === 'string') {
      out.push({ title: item })
      continue
    }
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>
      const title =
        asString(obj.title) ??
        asString(obj.task) ??
        asString(obj.description) ??
        null
      if (!title) continue
      out.push({
        title,
        owner:
          asString(obj.owner) ??
          asString(obj.assignee) ??
          asString(obj.who) ??
          null,
        dueDate:
          asString(obj.dueDate) ??
          asString(obj.due_date) ??
          asString(obj.due) ??
          null,
      })
    }
  }
  return out
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return null
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
