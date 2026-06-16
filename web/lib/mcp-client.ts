import 'server-only'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { dynamicTool, jsonSchema, type Tool } from 'ai'

/**
 * MCP tool loader for the CREAIT Command Center.
 *
 * Connects to the in-house MCP server (deployed at $MCP_URL) using the
 * Streamable HTTP transport, lists available tools, and wraps each one as an
 * AI SDK v6 `dynamicTool` so it can be passed to `generateText({ tools })`.
 *
 * Resilient by design — if the MCP server is unreachable, we log a warning
 * and return an empty toolset so skill runs (and chat streams) continue with
 * model-only capability. The wrapped tool list is cached in module scope for
 * 60 seconds to avoid hammering the upstream during bursts.
 */

const CACHE_TTL_MS = 60_000

type CachedTools = {
  tools: Record<string, Tool>
  fetchedAt: number
}

let cache: CachedTools | null = null

interface McpToolListItem {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

/**
 * Return a record of tools indexed by tool name, ready to spread into
 * `generateText({ tools })` or `streamText({ tools })`. Returns `{}` on any
 * connection / RPC failure.
 */
export async function loadMcpTools(): Promise<Record<string, Tool>> {
  const url = process.env.MCP_URL
  const token = process.env.MCP_TOKEN

  if (!url || !token) {
    // Silent in the no-config case — MCP is optional infrastructure.
    return {}
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.tools
  }

  try {
    const tools = await fetchAndWrapTools(url, token)
    cache = { tools, fetchedAt: Date.now() }
    return tools
  } catch (err) {
    console.warn(
      '[mcp-client] failed to load tools, proceeding without MCP:',
      err instanceof Error ? err.message : err,
    )
    // Cache the empty result briefly too so we don't retry on every request
    // during an outage.
    cache = { tools: {}, fetchedAt: Date.now() }
    return {}
  }
}

/**
 * Clear the cached tool list. Useful for tests or after a known MCP redeploy.
 */
export function clearMcpToolCache(): void {
  cache = null
}

/**
 * Call a single MCP tool by name with arguments and return the RAW MCP result
 * (the `{ content: [...], isError?: boolean }` envelope as returned by the
 * tool's `execute`). Returns `null` only when the tool can't be invoked at all
 * — i.e. the MCP server is unreachable, the tool isn't registered, or the
 * invocation threw. A tool that ran but reported a logical failure still
 * resolves to its result object with `isError: true`; callers should inspect
 * the envelope (see `mcpResultIsError` / `extractMcpJson`).
 */
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown | null> {
  const tools = await loadMcpTools()
  const tool = tools[name]
  if (!tool) {
    console.warn(`[mcp-client] tool "${name}" not available`)
    return null
  }
  const execute = tool.execute
  if (typeof execute !== 'function') {
    console.warn(`[mcp-client] tool "${name}" has no execute function`)
    return null
  }
  try {
    // dynamicTool's execute has signature `(input, options) => result`. We pass
    // a minimal options object since we don't need toolCallId / messages here.
    const result = await execute(args, {
      toolCallId: `direct-${Date.now()}`,
      messages: [],
    } as never)
    return result
  } catch (err) {
    console.error(`[mcp-client] tool "${name}" threw:`, err)
    return null
  }
}

/**
 * Returns true when an MCP result envelope reported a logical failure
 * (`isError: true`). A `null` result (tool not invokable) is also treated as
 * an error so callers can branch on a single condition.
 */
export function mcpResultIsError(result: unknown): boolean {
  if (result == null) return true
  if (typeof result !== 'object') return false
  return (result as { isError?: boolean }).isError === true
}

/**
 * MCP tool calls return `{ content: [{ type: 'text', text: '...' }] }` by
 * spec. Parse the first text part as JSON (falling back to the raw string),
 * or use the structured `structuredContent` field when present. Returns `null`
 * when nothing parseable is found.
 */
export function extractMcpJson(result: unknown): unknown {
  if (result == null || typeof result !== 'object') return null
  const obj = result as Record<string, unknown>
  if (obj.structuredContent && typeof obj.structuredContent === 'object') {
    return obj.structuredContent
  }
  const content = obj.content
  if (Array.isArray(content)) {
    for (const part of content) {
      if (
        part &&
        typeof part === 'object' &&
        (part as { type?: string }).type === 'text' &&
        typeof (part as { text?: string }).text === 'string'
      ) {
        const text = (part as { text: string }).text
        try {
          return JSON.parse(text)
        } catch {
          return text
        }
      }
    }
  }
  return null
}

async function fetchAndWrapTools(
  url: string,
  token: string,
): Promise<Record<string, Tool>> {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const client = new Client(
    { name: 'creait-cc', version: '0.1.0' },
    { capabilities: {} },
  )

  await client.connect(transport)

  try {
    const listed = await client.listTools()
    const items = (listed?.tools ?? []) as McpToolListItem[]

    const wrapped: Record<string, Tool> = {}
    for (const item of items) {
      if (!item?.name) continue
      wrapped[item.name] = wrapMcpTool(item, () => connectFresh(url, token))
    }

    // Close the listing connection — each tool execution opens its own.
    // (HTTP connections are cheap; we don't share state across calls.)
    await safeClose(client)

    return wrapped
  } catch (err) {
    await safeClose(client)
    throw err
  }
}

/**
 * Wrap a single MCP tool descriptor as an AI SDK dynamicTool. Each invocation
 * opens a fresh connection — simpler than juggling a long-lived client across
 * concurrent skill runs.
 */
function wrapMcpTool(
  item: McpToolListItem,
  newClient: () => Promise<Client>,
): Tool {
  const inputSchemaJson = (item.inputSchema ?? {
    type: 'object',
    properties: {},
  }) as Record<string, unknown>

  return dynamicTool({
    description: item.description ?? `MCP tool: ${item.name}`,
    inputSchema: jsonSchema(inputSchemaJson as Parameters<typeof jsonSchema>[0]),
    execute: async (input: unknown) => {
      const client = await newClient()
      try {
        const result = await client.callTool({
          name: item.name,
          arguments: (input ?? {}) as Record<string, unknown>,
        })
        return result
      } finally {
        await safeClose(client)
      }
    },
  })
}

async function connectFresh(url: string, token: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
  const client = new Client(
    { name: 'creait-cc', version: '0.1.0' },
    { capabilities: {} },
  )
  await client.connect(transport)
  return client
}

async function safeClose(client: Client): Promise<void> {
  try {
    await client.close()
  } catch {
    // ignore close errors
  }
}
