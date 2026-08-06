import { anthropic } from '@ai-sdk/anthropic'
import { openai, createOpenAI } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'
import {
  APICallError,
  LoadAPIKeyError,
  RetryError,
  generateText,
  streamText,
  wrapLanguageModel,
} from 'ai'
import type { LanguageModelMiddleware, ToolSet } from 'ai'

/**
 * OpenRouter: OpenAI-compatible. We reuse `@ai-sdk/openai`'s `createOpenAI`
 * with the OpenRouter base URL. No extra package install needed.
 */
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  // OpenRouter analytics — surfaces in their dashboard if you set HTTP-Referer + X-Title
  headers: {
    'HTTP-Referer': 'https://cc.getcreait.com',
    'X-Title': 'CREAIT Command Center',
  },
})

/**
 * `@ai-sdk/openai` v3 defaults `openai(id)` to the **Responses API**
 * (`POST /responses`). OpenRouter's first-class surface is
 * `POST /chat/completions`, which is what every OSS model there supports
 * (including tool calling on the `:free` tier). Always build OpenRouter
 * models with `.chat(...)` so we hit the right endpoint.
 */
const openrouterChat = (modelId: string) => openrouter.chat(modelId)

/**
 * Model registry for the CREAIT Command Center.
 *
 * Keys are the IDs surfaced to the UI and stored in user prefs. Values are
 * AI SDK v6 LanguageModel instances.
 *
 * Frontier tier (direct providers — billed individually):
 *   anthropic, openai, google
 *
 * OSS / cheap tier (via OpenRouter — one bill, 200+ models, ~10× cheaper):
 *   moonshotai/kimi-k2  — Kimi K2 (frontier-class, very low cost)
 *   deepseek/deepseek-v3.1 — DeepSeek (best per-dollar reasoning)
 *   meta-llama/llama-3.3-70b — Llama 3.3 70B (open, fast)
 *   google/gemini-2.5-flash — Gemini Flash (cheap + multimodal)
 */
export const MODEL_MAP = {
  // Anthropic frontier
  'claude-sonnet-4-6': anthropic('claude-sonnet-4-6'),
  'claude-opus-4-7': anthropic('claude-opus-4-7'),
  'claude-haiku-4-5': anthropic('claude-haiku-4-5'),
  // OpenAI
  'gpt-5': openai('gpt-5'),
  // Google
  'gemini-3-pro': google('gemini-3-pro-preview'),
  // OpenRouter — OSS + multi-provider cheap tier
  'openrouter/kimi-k2': openrouterChat('moonshotai/kimi-k2'),
  'openrouter/deepseek-v3': openrouterChat('deepseek/deepseek-chat-v3-0324'),
  'openrouter/llama-3.3-70b': openrouterChat('meta-llama/llama-3.3-70b-instruct'),
  // gemini-2.0-flash-001 was delisted from OpenRouter; 2.5-flash is the stable successor
  'openrouter/gemini-flash': openrouterChat('google/gemini-2.5-flash'),
  // :free tier — works even with $0 OpenRouter credits (rate-limited ~50 req/day)
  'openrouter/nemotron-free': openrouterChat('nvidia/nemotron-3-ultra-550b-a55b:free'),
} as const

export type ModelId = keyof typeof MODEL_MAP

export const DEFAULT_MODEL: ModelId = 'claude-sonnet-4-6'

/**
 * The rung that is always tried last. It runs on OpenRouter's `:free` tier,
 * so it keeps working with a $0 balance on every paid provider.
 */
export const LAST_RESORT_MODEL: ModelId = 'openrouter/nemotron-free'

type Provider = 'anthropic' | 'openai' | 'google' | 'openrouter'

const MODEL_PROVIDER: Record<ModelId, Provider> = {
  'claude-sonnet-4-6': 'anthropic',
  'claude-opus-4-7': 'anthropic',
  'claude-haiku-4-5': 'anthropic',
  'gpt-5': 'openai',
  'gemini-3-pro': 'google',
  'openrouter/kimi-k2': 'openrouter',
  'openrouter/deepseek-v3': 'openrouter',
  'openrouter/llama-3.3-70b': 'openrouter',
  'openrouter/gemini-flash': 'openrouter',
  'openrouter/nemotron-free': 'openrouter',
}

const PROVIDER_ENV_VAR: Record<Provider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
}

const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  openrouter: 'OpenRouter',
}

/** Friendly labels for the UI model selector. */
export const MODEL_LABELS: Record<ModelId, string> = {
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-opus-4-7': 'Claude Opus 4.7',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'gpt-5': 'GPT-5',
  'gemini-3-pro': 'Gemini 3 Pro',
  'openrouter/kimi-k2': 'Kimi K2 (OpenRouter)',
  'openrouter/deepseek-v3': 'DeepSeek V3 (OpenRouter)',
  'openrouter/llama-3.3-70b': 'Llama 3.3 70B (OpenRouter)',
  'openrouter/gemini-flash': 'Gemini Flash (OpenRouter)',
  'openrouter/nemotron-free': 'Nemotron Ultra 550B (Free)',
}

/**
 * A cheaper model from the *same* provider, tried when the primary fails in a
 * way that is specific to that one model (rate limit, model not found). It is
 * deliberately skipped for provider-wide failures (billing, auth) because those
 * kill every model behind the same key.
 */
const CHEAPER_SIBLING: Partial<Record<ModelId, ModelId>> = {
  'claude-opus-4-7': 'claude-sonnet-4-6',
  'claude-sonnet-4-6': 'claude-haiku-4-5',
  'openrouter/kimi-k2': 'openrouter/gemini-flash',
  'openrouter/deepseek-v3': 'openrouter/gemini-flash',
  'openrouter/llama-3.3-70b': 'openrouter/gemini-flash',
}

/**
 * Resolve a model ID (or unknown string) to a concrete AI SDK model.
 * Falls back to `DEFAULT_MODEL` for unknown or empty inputs.
 */
export function resolveModel(id: string | undefined) {
  const key = (id ?? DEFAULT_MODEL) as ModelId
  return MODEL_MAP[key] ?? MODEL_MAP[DEFAULT_MODEL]
}

/** Return true if `id` is a known model in the registry. */
export function isKnownModel(id: string | undefined): id is ModelId {
  return typeof id === 'string' && id in MODEL_MAP
}

/** Normalise an arbitrary string to a known model id. */
export function normalizeModelId(id: string | undefined): ModelId {
  return isKnownModel(id) ? id : DEFAULT_MODEL
}

/** True when the env var backing `id`'s provider is actually populated. */
export function hasProviderKey(id: ModelId): boolean {
  const value = process.env[PROVIDER_ENV_VAR[MODEL_PROVIDER[id]]]
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Throw a descriptive Error if the env var required for the provider behind
 * `id` is missing. Use this in route handlers to surface a clean 400 instead
 * of a cryptic provider-side error.
 */
export function assertModelKeyAvailable(id: string | undefined): void {
  const key = normalizeModelId(id)
  const provider = MODEL_PROVIDER[key]
  const envVar = PROVIDER_ENV_VAR[provider]
  const value = process.env[envVar]
  if (!value || value.trim().length === 0) {
    throw new Error(
      `${PROVIDER_LABEL[provider]} API key is missing — set ${envVar} to use model "${key}".`,
    )
  }
}

// ---------------------------------------------------------------------------
// Resilient generation — automatic provider fallback
// ---------------------------------------------------------------------------

/*
 * Why this exists
 * ---------------
 * Every AI feature in the Command Center died the day the Anthropic balance hit
 * $0: Anthropic answers with HTTP 400 + "Your credit balance is too low to
 * access the Anthropic API." That is a provider-availability failure wearing a
 * 400, so status codes alone are not enough to classify it.
 *
 * The fallback lives at the *model* layer (a `wrapLanguageModel` middleware),
 * not at the call sites. Anything that hands the wrapped model to
 * `generateText` / `streamText` — including every Inngest job that goes through
 * `runSkill` — inherits the behaviour without changing its own code, and it
 * also covers each step of a multi-step tool loop.
 */

/** Why a rung was abandoned. `null` means "not worth switching for". */
export type ProviderFailureKind =
  | 'billing'
  | 'auth'
  | 'rate-limit'
  | 'not-found'
  | 'unavailable'

/** Failures that take down every model behind the same API key. */
const PROVIDER_WIDE: ReadonlySet<ProviderFailureKind> = new Set<ProviderFailureKind>([
  'billing',
  'auth',
])

export interface FallbackAttempt {
  model: ModelId
  provider: Provider
  /** `'skipped'` when we never issued a request (no key / provider already dead). */
  outcome: 'failed' | 'skipped'
  kind: ProviderFailureKind | 'no-api-key' | 'provider-down'
  status?: number
  message: string
}

export interface FallbackReport {
  requestedModel: ModelId
  /** Every rung, in the order they would be tried. */
  chain: ModelId[]
  /** Populated as soon as a rung answers. `null` until then. */
  servedModel: ModelId | null
  /** True when `servedModel` is not `requestedModel`. */
  fellBack: boolean
  attempts: FallbackAttempt[]
}

export interface ResilientModel {
  /** Hand this to `generateText` / `streamText` as `model`. */
  model: ReturnType<typeof wrapLanguageModel>
  /** Mutated in place as the call proceeds. Read it after the call settles. */
  report: FallbackReport
}

type ModelV3 = Parameters<typeof wrapLanguageModel>[0]['model']
type WrapGenerate = NonNullable<LanguageModelMiddleware['wrapGenerate']>
type WrapStream = NonNullable<LanguageModelMiddleware['wrapStream']>
type ModelGenerateResult = Awaited<ReturnType<WrapGenerate>>
type ModelStreamResult = Awaited<ReturnType<WrapStream>>
type ModelStreamPart =
  ModelStreamResult['stream'] extends ReadableStream<infer PART> ? PART : never

/** Stream parts that arrive before any real content and are safe to buffer. */
const STREAM_PREAMBLE: ReadonlySet<string> = new Set(['stream-start', 'response-metadata'])

// --- error classification ---------------------------------------------------

const BILLING_PATTERNS = [
  /credit balance is too low/i,
  /insufficient[_\s-]*(quota|credits?|funds|balance)/i,
  /exceeded your current quota/i,
  /payment required/i,
  /billing[_\s-]*(hard[_\s-]*limit|not[_\s-]*active)/i,
  /add (more )?credits/i,
  /plans? (&|and) billing/i,
]

const AUTH_PATTERNS = [
  /invalid[_\s-]*api[_\s-]*key/i,
  /incorrect api key/i,
  /no auth credentials/i,
  /authentication[_\s-]*(error|failed)/i,
  /unauthorized/i,
  /permission[_\s-]*denied/i,
  /api key (is )?(missing|not (set|configured))/i,
]

const RATE_LIMIT_PATTERNS = [/rate[_\s-]*limit/i, /too many requests/i, /overloaded/i]

const NOT_FOUND_PATTERNS = [
  /model[^.]{0,40}not[_\s-]*found/i,
  /no endpoints found/i,
  /unknown model/i,
  /is not a valid model/i,
  /does not exist or you do not have access/i,
]

const UNAVAILABLE_PATTERNS = [
  /service[_\s-]*unavailable/i,
  /bad gateway/i,
  /gateway timeout/i,
  /upstream error/i,
  /resource[_\s-]*exhausted/i,
]

/** Unwrap RetryError / `cause` chains so we classify the real provider error. */
function unwrapError(err: unknown, depth = 0): unknown[] {
  if (err == null || depth > 4) return []
  const out: unknown[] = [err]
  if (RetryError.isInstance(err)) {
    out.push(...unwrapError(err.lastError, depth + 1))
    for (const inner of err.errors ?? []) out.push(...unwrapError(inner, depth + 1))
  }
  if (err instanceof Error && err.cause != null && err.cause !== err) {
    out.push(...unwrapError(err.cause, depth + 1))
  }
  return out
}

function errorText(err: unknown): string {
  const parts: string[] = []
  if (err instanceof Error) {
    parts.push(err.message)
  } else if (typeof err === 'string') {
    parts.push(err)
  } else if (err != null) {
    // Providers can surface a failure as a plain object inside an SSE `error`
    // frame — stringify it so the pattern matching below still sees the text.
    try {
      parts.push(JSON.stringify(err))
    } catch {
      /* circular payload — nothing useful to match on */
    }
  }
  if (APICallError.isInstance(err)) {
    if (err.responseBody) parts.push(err.responseBody)
    if (err.data != null) {
      try {
        parts.push(JSON.stringify(err.data))
      } catch {
        /* non-serialisable provider payload — message alone is enough */
      }
    }
  }
  return parts.join(' | ')
}

function matches(patterns: RegExp[], text: string): boolean {
  return patterns.some((p) => p.test(text))
}

/**
 * Decide whether `err` is a provider-availability failure that another model
 * could plausibly survive.
 *
 * Returns `null` for genuine request/content errors (malformed prompt, schema
 * violation, content filter) — retrying those elsewhere just burns money and
 * hides a real bug.
 */
export function classifyProviderFailure(err: unknown): ProviderFailureKind | null {
  for (const candidate of unwrapError(err)) {
    if (LoadAPIKeyError.isInstance(candidate)) return 'auth'

    const text = errorText(candidate)
    const status = APICallError.isInstance(candidate) ? candidate.statusCode : undefined

    // Status codes first — unambiguous when present.
    if (status === 402) return 'billing'
    if (status === 401 || status === 403) return 'auth'
    if (status === 429) return 'rate-limit'
    if (status === 404) return 'not-found'
    if (typeof status === 'number' && status >= 500) return 'unavailable'

    // Anthropic reports a dead balance as HTTP 400 `invalid_request_error`, so
    // the body text is the only signal. Same for several OpenAI quota errors.
    if (matches(BILLING_PATTERNS, text)) return 'billing'
    if (matches(AUTH_PATTERNS, text)) return 'auth'
    if (matches(RATE_LIMIT_PATTERNS, text)) return 'rate-limit'
    if (matches(NOT_FOUND_PATTERNS, text)) return 'not-found'
    if (matches(UNAVAILABLE_PATTERNS, text)) return 'unavailable'
  }
  return null
}

function statusOf(err: unknown): number | undefined {
  for (const candidate of unwrapError(err)) {
    if (APICallError.isInstance(candidate) && typeof candidate.statusCode === 'number') {
      return candidate.statusCode
    }
  }
  return undefined
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown provider error'
  }
}

// --- chain construction -----------------------------------------------------

/**
 * Build the ordered list of models to try for `requested`.
 *
 *   requested → cheaper same-provider sibling (if any) → LAST_RESORT_MODEL
 *
 * The last-resort rung is always present and always attempted; the sibling rung
 * is skipped at runtime when the failure was provider-wide.
 */
export function buildFallbackChain(requested: string | undefined): ModelId[] {
  const head = normalizeModelId(requested)
  const chain: ModelId[] = [head]

  const sibling = CHEAPER_SIBLING[head]
  if (sibling && !chain.includes(sibling)) chain.push(sibling)

  if (!chain.includes(LAST_RESORT_MODEL)) chain.push(LAST_RESORT_MODEL)

  return chain
}

function createReport(requested: string | undefined): FallbackReport {
  const requestedModel = normalizeModelId(requested)
  return {
    requestedModel,
    chain: buildFallbackChain(requestedModel),
    servedModel: null,
    fellBack: false,
    attempts: [],
  }
}

/** Human-readable summary — used in logs and in the final thrown error. */
export function describeFallback(report: FallbackReport): string {
  const tried = report.attempts
    .map((a) => {
      const status = a.status ? ` ${a.status}` : ''
      return `${a.model} (${a.outcome}: ${a.kind}${status})`
    })
    .join(', ')
  return tried.length > 0 ? tried : '(no attempts recorded)'
}

// --- the middleware ---------------------------------------------------------

interface ChainState {
  report: FallbackReport
  /** Models that already failed during this call — never retried. */
  deadModels: Set<ModelId>
  /** Providers proven dead (billing/auth) during this call. */
  deadProviders: Set<Provider>
}

class AllModelsFailedError extends Error {
  constructor(report: FallbackReport, lastError: unknown) {
    super(
      `All models failed for "${report.requestedModel}". Tried: ${describeFallback(report)}. ` +
        `Last error: ${messageOf(lastError)}`,
      { cause: lastError },
    )
    this.name = 'AllModelsFailedError'
  }
}

/**
 * Walk the chain, invoking `run` on each viable rung until one succeeds.
 *
 * Each model is attempted at most once per call (`deadModels`), so this can
 * never loop. The original error is preserved: a non-switch-worthy failure is
 * rethrown untouched, and a total wipeout throws with `cause` set to the last
 * provider error.
 */
async function runChain<T>(
  state: ChainState,
  run: (rung: { id: ModelId; model: ModelV3; index: number }) => Promise<T>,
): Promise<T> {
  const { report } = state
  let lastError: unknown = null

  for (let index = 0; index < report.chain.length; index++) {
    const id = report.chain[index]
    const provider = MODEL_PROVIDER[id]
    const isLastResort = index === report.chain.length - 1

    if (state.deadModels.has(id)) continue

    if (!hasProviderKey(id)) {
      state.deadModels.add(id)
      report.attempts.push({
        model: id,
        provider,
        outcome: 'skipped',
        kind: 'no-api-key',
        message: `${PROVIDER_ENV_VAR[provider]} is not set`,
      })
      continue
    }

    // A provider that just answered "no credit" / "bad key" will answer the
    // same for its other models. Skip them — except the last-resort rung, which
    // is always attempted.
    if (!isLastResort && state.deadProviders.has(provider)) {
      state.deadModels.add(id)
      report.attempts.push({
        model: id,
        provider,
        outcome: 'skipped',
        kind: 'provider-down',
        message: `${PROVIDER_LABEL[provider]} already failed on this request`,
      })
      continue
    }

    try {
      const value = await run({ id, model: MODEL_MAP[id], index })
      report.servedModel = id
      report.fellBack = id !== report.requestedModel
      if (report.fellBack) {
        console.warn(
          `[ai] fallback: "${report.requestedModel}" unavailable, served by "${id}". ` +
            `Attempts: ${describeFallback(report)}`,
        )
      }
      return value
    } catch (err) {
      const kind = classifyProviderFailure(err)
      if (kind === null) {
        // Genuine request/content error — switching models would not help.
        throw err
      }
      lastError = err
      state.deadModels.add(id)
      if (PROVIDER_WIDE.has(kind)) state.deadProviders.add(provider)
      report.attempts.push({
        model: id,
        provider,
        outcome: 'failed',
        kind,
        status: statusOf(err),
        message: messageOf(err),
      })
    }
  }

  const failure = new AllModelsFailedError(report, lastError)
  console.error(`[ai] ${failure.message}`)
  throw failure
}

/**
 * Buffer the head of a provider stream so an immediate failure can still be
 * retried on the next rung.
 *
 * `doStream()` rejects for ordinary non-2xx responses, but OpenAI-compatible
 * gateways (OpenRouter included) sometimes answer HTTP 200 and put the failure
 * in the first SSE frame. We read until the first content part: an `error`
 * before any content means the rung is dead, anything else commits the rung and
 * is replayed to the caller.
 */
async function guardStreamStart(
  result: ModelStreamResult,
): Promise<{ ok: true; result: ModelStreamResult } | { ok: false; error: unknown }> {
  const reader = result.stream.getReader()
  const buffered: ModelStreamPart[] = []

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value.type === 'error') {
        await reader.cancel().catch(() => undefined)
        return { ok: false, error: (value as { error?: unknown }).error ?? value }
      }
      buffered.push(value)
      if (!STREAM_PREAMBLE.has(value.type)) break
    }
  } catch (err) {
    await reader.cancel().catch(() => undefined)
    return { ok: false, error: err }
  }

  const stream = new ReadableStream<ModelStreamPart>({
    start(controller) {
      for (const part of buffered) controller.enqueue(part)
    },
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        return
      }
      controller.enqueue(value)
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => undefined)
    },
  })

  return { ok: true, result: { ...result, stream } }
}

function fallbackMiddleware(state: ChainState): LanguageModelMiddleware {
  const callPrimary = <T>(
    index: number,
    primary: () => PromiseLike<T>,
    other: () => PromiseLike<T>,
  ): Promise<T> => Promise.resolve(index === 0 ? primary() : other())

  return {
    specificationVersion: 'v3',

    wrapGenerate: ({ doGenerate, params }) =>
      runChain<ModelGenerateResult>(state, ({ model, index }) =>
        callPrimary(index, doGenerate, () => model.doGenerate(params)),
      ),

    wrapStream: ({ doStream, params }) =>
      runChain<ModelStreamResult>(state, async ({ model, index }) => {
        const raw = await callPrimary(index, doStream, () =>
          model.doStream(params),
        )
        const guarded = await guardStreamStart(raw)
        if (!guarded.ok) throw guarded.error
        return guarded.result
      }),
  }
}

/**
 * Wrap `requestedModel` in the fallback chain.
 *
 * The returned `model` is a normal AI SDK v6 `LanguageModel` — pass it straight
 * to `generateText` / `streamText`. `report` is mutated in place; read
 * `report.servedModel` once the call (or the stream) has started.
 */
export function createFallbackModel(requestedModel?: string): ResilientModel {
  const report = createReport(requestedModel)
  const state: ChainState = {
    report,
    deadModels: new Set<ModelId>(),
    deadProviders: new Set<Provider>(),
  }

  const model = wrapLanguageModel({
    model: MODEL_MAP[report.requestedModel] as ModelV3,
    middleware: fallbackMiddleware(state),
    providerId: 'creait-fallback',
    modelId: report.requestedModel,
  })

  return { model, report }
}

type GenerateTextOptions<TOOLS extends ToolSet> = Parameters<typeof generateText<TOOLS>>[0]
type StreamTextOptions<TOOLS extends ToolSet> = Parameters<typeof streamText<TOOLS>>[0]

/** `model` becomes a plain model id string; everything else is `generateText`'s. */
export type GenerateWithFallbackOptions<TOOLS extends ToolSet> = Omit<
  GenerateTextOptions<TOOLS>,
  'model'
> & { model?: string }

export type StreamWithFallbackOptions<TOOLS extends ToolSet> = Omit<
  StreamTextOptions<TOOLS>,
  'model'
> & { model?: string }

export interface GenerateWithFallbackResult<TOOLS extends ToolSet> {
  result: Awaited<ReturnType<typeof generateText<TOOLS>>>
  /** The model that actually produced the text. */
  servedModel: ModelId
  requestedModel: ModelId
  fellBack: boolean
  fallback: FallbackReport
}

export interface StreamWithFallbackResult<TOOLS extends ToolSet> {
  result: ReturnType<typeof streamText<TOOLS>>
  requestedModel: ModelId
  /** Mutated once the stream commits to a rung — `servedModel` is null before. */
  fallback: FallbackReport
}

/**
 * `generateText` that degrades to a working model instead of throwing when the
 * requested provider is out of credit, rate limited, unauthorised or missing
 * the model.
 */
export async function generateWithFallback<TOOLS extends ToolSet>(
  options: GenerateWithFallbackOptions<TOOLS>,
): Promise<GenerateWithFallbackResult<TOOLS>> {
  const { model: requestedModel, ...rest } = options
  const { model, report } = createFallbackModel(requestedModel)

  const result = await generateText<TOOLS>({
    ...(rest as GenerateTextOptions<TOOLS>),
    model,
  })

  return {
    result,
    servedModel: report.servedModel ?? report.requestedModel,
    requestedModel: report.requestedModel,
    fellBack: report.fellBack,
    fallback: report,
  }
}

/**
 * `streamText` with the same fallback chain. Synchronous, like `streamText` —
 * the rung is chosen when the stream starts, so read `fallback.servedModel`
 * from `onFinish` (or after the response is consumed), not immediately.
 */
export function streamWithFallback<TOOLS extends ToolSet>(
  options: StreamWithFallbackOptions<TOOLS>,
): StreamWithFallbackResult<TOOLS> {
  const { model: requestedModel, ...rest } = options
  const { model, report } = createFallbackModel(requestedModel)

  const result = streamText<TOOLS>({
    ...(rest as StreamTextOptions<TOOLS>),
    model,
  })

  return { result, requestedModel: report.requestedModel, fallback: report }
}
