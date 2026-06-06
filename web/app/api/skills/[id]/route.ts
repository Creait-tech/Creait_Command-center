import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const ORG_ID = 'creait'

const patchSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    system_prompt: z.string().max(50_000).nullable().optional(),
    preferred_model: z.string().min(1).max(100).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

/**
 * GET /api/skills/[id] — fetch a single skill for editing in the UI. Scoped
 * to org 'creait' for Phase 1/2.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) return jsonError('Unauthorized', 401)

    const { id } = await ctx.params
    if (!isUuid(id)) return jsonError('Invalid skill id', 400)

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .eq('id', id)
      .eq('org_id', ORG_ID)
      .maybeSingle()

    if (error) return jsonError(error.message, 500)
    if (!data) return jsonError('Skill not found', 404)

    return Response.json({ skill: data })
  } catch (err) {
    console.error('[api/skills/:id GET] error:', err)
    return jsonError(
      err instanceof Error ? err.message : 'Internal server error',
      500,
    )
  }
}

/**
 * PATCH /api/skills/[id] — partial update for skill metadata. Only the
 * whitelisted fields in `patchSchema` can be modified from the UI; tool /
 * schema configuration is intentionally locked down for now.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) return jsonError('Unauthorized', 401)

    const { id } = await ctx.params
    if (!isUuid(id)) return jsonError('Invalid skill id', 400)

    const json = await req.json().catch(() => null)
    if (!json) return jsonError('Invalid JSON body', 400)

    const parsed = patchSchema.safeParse(json)
    if (!parsed.success) {
      return jsonError(
        `Invalid request: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
        400,
      )
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('skills')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', ORG_ID)
      .select('*')
      .maybeSingle()

    if (error) return jsonError(error.message, 500)
    if (!data) return jsonError('Skill not found', 404)

    return Response.json({ skill: data })
  } catch (err) {
    console.error('[api/skills/:id PATCH] error:', err)
    return jsonError(
      err instanceof Error ? err.message : 'Internal server error',
      500,
    )
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
