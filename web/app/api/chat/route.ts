import { auth } from '@clerk/nextjs/server'
import { convertToModelMessages, streamText, stepCountIs } from 'ai'
import type { UIMessage } from 'ai'
import { z } from 'zod'

import {
  assertModelKeyAvailable,
  DEFAULT_MODEL,
  resolveModel,
} from '@/lib/ai'
import { buildSystemPrompt } from '@/lib/context-builder'

export const runtime = 'nodejs'
export const maxDuration = 60

// Phase 1: single org. Multi-org lands in Phase 3.
const ORG_ID = 'creait'

const bodySchema = z.object({
  // `UIMessage[]` shape from the AI SDK — we trust the structure at runtime
  // and let `convertToModelMessages` do the heavy lifting. We just verify
  // shape enough to fail fast on obvious junk.
  messages: z.array(z.unknown()).min(1),
  model: z.string().optional(),
  pageContext: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const json = await req.json().catch(() => null)
    if (!json) {
      return jsonError('Invalid JSON body', 400)
    }

    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return jsonError(
        `Invalid request body: ${parsed.error.issues
          .map((i) => i.message)
          .join('; ')}`,
        400,
      )
    }

    const { messages, model, pageContext } = parsed.data
    const modelId = model ?? DEFAULT_MODEL

    try {
      assertModelKeyAvailable(modelId)
    } catch (err) {
      return jsonError(
        err instanceof Error ? err.message : 'Model unavailable',
        400,
      )
    }

    const [system, modelMessages] = await Promise.all([
      buildSystemPrompt(ORG_ID, pageContext),
      convertToModelMessages(messages as UIMessage[]),
    ])
    const resolvedModel = resolveModel(modelId)

    const result = streamText({
      model: resolvedModel,
      system,
      messages: modelMessages,
      stopWhen: stepCountIs(5),
    })

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error('[api/chat] stream error', error)
        if (error instanceof Error) return error.message
        if (typeof error === 'string') return error
        return 'An error occurred while streaming the response.'
      },
    })
  } catch (err) {
    console.error('[api/chat] unhandled error', err)
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
