import 'server-only'

/**
 * Minimal Tavily search client used by the long-running background agents
 * (Tech Watch Crawler + YouTube Research Agent). Tavily's REST API is
 * trivial enough that a direct `fetch` is preferable to pulling in another
 * SDK — keeps the dependency surface flat and lets us stay on edge runtimes
 * later if we choose.
 *
 * Throws a descriptive error if `TAVILY_API_KEY` is missing so callers can
 * surface a clear "configure this env var" message instead of a cryptic 401.
 */

export interface TavilyResult {
  title: string
  url: string
  content: string
  published_date?: string
  score?: number
}

export interface TavilyResponse {
  results: TavilyResult[]
  answer?: string
  query?: string
}

export interface TavilySearchOptions {
  /** Max results to return (Tavily caps this at 20). */
  max_results?: number
  /** Search depth — `basic` is faster + cheaper, `advanced` runs deeper. */
  search_depth?: 'basic' | 'advanced'
  /** Optional include/exclude domain filters. */
  include_domains?: string[]
  exclude_domains?: string[]
}

/**
 * Run a Tavily web search. Returns an empty `results` array on parse errors
 * but throws on network / auth failures so the caller can decide whether to
 * retry or skip.
 */
export async function tavilySearch(
  query: string,
  opts: TavilySearchOptions = {},
): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      'TAVILY_API_KEY is not configured — set it to enable web research agents.',
    )
  }

  const body = {
    api_key: apiKey,
    query,
    max_results: opts.max_results ?? 5,
    search_depth: opts.search_depth ?? 'basic',
    include_raw_content: false,
    include_answer: false,
    ...(opts.include_domains ? { include_domains: opts.include_domains } : {}),
    ...(opts.exclude_domains ? { exclude_domains: opts.exclude_domains } : {}),
  }

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    // Tavily occasionally takes >10s; give it room but cap so we don't hang
    // an Inngest step indefinitely.
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Tavily search failed (${res.status}): ${text.slice(0, 200) || res.statusText}`,
    )
  }

  const json = (await res.json().catch(() => null)) as
    | { results?: unknown; answer?: string; query?: string }
    | null

  if (!json || !Array.isArray(json.results)) {
    return { results: [] }
  }

  const results: TavilyResult[] = []
  for (const r of json.results) {
    if (!r || typeof r !== 'object') continue
    const row = r as Record<string, unknown>
    if (typeof row.url !== 'string' || typeof row.title !== 'string') continue
    results.push({
      title: row.title,
      url: row.url,
      content: typeof row.content === 'string' ? row.content : '',
      published_date:
        typeof row.published_date === 'string' ? row.published_date : undefined,
      score: typeof row.score === 'number' ? row.score : undefined,
    })
  }

  return {
    results,
    answer: typeof json.answer === 'string' ? json.answer : undefined,
    query: typeof json.query === 'string' ? json.query : undefined,
  }
}
