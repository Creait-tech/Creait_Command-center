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
