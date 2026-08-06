import { auth } from '@clerk/nextjs/server'
import { convertToModelMessages, stepCountIs } from 'ai'
import type { UIMessage } from 'ai'
import { z } from 'zod'

import {
  assertModelKeyAvailable,
  DEFAULT_MODEL,
  describeFallback,
  streamWithFallback,
} from '@/lib/ai'
import { getActiveOrgId } from '@/lib/active-org'
import { buildSystemPrompt } from '@/lib/context-builder'
import { loadMcpTools } from '@/lib/mcp-client'

export const runtime = 'nodejs'
export const maxDuration = 60

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

    // Unconfigured provider (e.g. no GOOGLE_GENERATIVE_AI_API_KEY) is a setup
    // mistake, not an outage — fail fast with the clear message instead of
    // silently answering as a different model. Providers that ARE configured
    // but broken (no credit, rate limited, revoked key) are handled downstream
    // by the fallback chain.
    try {
      assertModelKeyAvailable(modelId)
    } catch (err) {
      return jsonError(
        err instanceof Error ? err.message : 'Model unavailable',
        400,
      )
    }

    const orgId = await getActiveOrgId()

    const [system, modelMessages, tools] = await Promise.all([
      buildSystemPrompt(orgId, pageContext),
      convertToModelMessages(messages as UIMessage[]),
      loadMcpTools(),
    ])
    const { result, fallback } = streamWithFallback({
      model: modelId,
      system,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(8),
      onFinish: () => {
        if (fallback.fellBack) {
          console.warn(
            `[api/chat] "${fallback.requestedModel}" unavailable — served by ` +
              `"${fallback.servedModel}". ${describeFallback(fallback)}`,
          )
        }
      },
    })

    return result.toUIMessageStreamResponse({
      // Tell the widget which model actually answered so the UI can show it.
      messageMetadata: () => ({
        model: fallback.servedModel ?? fallback.requestedModel,
        requestedModel: fallback.requestedModel,
        fellBack: fallback.fellBack,
      }),
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
