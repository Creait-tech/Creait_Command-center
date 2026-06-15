import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

import { getActiveOrgId } from '@/lib/active-org'
import { runSkill } from '@/lib/skills-engine'

export const runtime = 'nodejs'
export const maxDuration = 300

const bodySchema = z.object({
  skillId: z.string().uuid('skillId must be a UUID'),
  input: z.record(z.string(), z.unknown()).optional(),
})

/**
 * POST /api/skills/run — manually invoke a stored skill.
 *
 * Body: `{ skillId: uuid, input?: object }`
 *
 * Returns: `{ runId, output }` on success. The full run history is also
 * persisted to the `run_history` table for inspection from the /agents page.
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

    const { skillId, input } = parsed.data
    const orgId = await getActiveOrgId()

    const result = await runSkill(skillId, input ?? {}, {
      orgId,
      triggeredBy: userId,
      trigger: 'manual',
    })

    return Response.json({ runId: result.runId, output: result.output })
  } catch (err) {
    console.error('[api/skills/run] error:', err)
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
