import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'

/**
 * Model registry for the CREAIT Command Center.
 *
 * Keys are the IDs surfaced to the UI and stored in user prefs. Values are
 * AI SDK v6 LanguageModel instances. Add a new model by mapping a stable
 * ID -> provider call here, and the rest of the chat plumbing will pick it up.
 *
 * Google: `gemini-3-pro` aliases to the currently-supported preview variant
 * `gemini-3-pro-preview` so the public ID stays stable as Google promotes it.
 *
 * ---------------------------------------------------------------------------
 * Phase 4 TODO — OSS routing via Vercel AI Gateway
 * ---------------------------------------------------------------------------
 * Once `pnpm add @ai-sdk/gateway` is in, register cheap OSS models so the
 * long-running background agents (Tech Watch Crawler, YouTube Research, etc.)
 * can fan out without burning Anthropic credit. Suggested entries:
 *
 *   import { gateway } from '@ai-sdk/gateway'
 *   'kimi-k2':        gateway('moonshotai/kimi-k2'),
 *   'deepseek-v3':    gateway('deepseek/deepseek-v3'),
 *   'llama-3-3-70b':  gateway('meta/llama-3.3-70b'),
 *
 * Routing rule: if `AI_GATEWAY_API_KEY` is set, prefer the gateway entry;
 * else fall back to the direct provider entries below. Cost rates in
 * skills-engine.ts will need matching rows for these IDs.
 * ---------------------------------------------------------------------------
 */
export const MODEL_MAP = {
  'claude-sonnet-4-6': anthropic('claude-sonnet-4-6'),
  'claude-opus-4-7': anthropic('claude-opus-4-7'),
  'claude-haiku-4-5': anthropic('claude-haiku-4-5'),
  'gpt-5': openai('gpt-5'),
  'gemini-3-pro': google('gemini-3-pro-preview'),
} as const

export type ModelId = keyof typeof MODEL_MAP

export const DEFAULT_MODEL: ModelId = 'claude-sonnet-4-6'

/**
 * Provider routing for each model ID. Used by `assertModelKeyAvailable` to
 * point at the right env var when a key is missing.
 */
const MODEL_PROVIDER: Record<ModelId, 'anthropic' | 'openai' | 'google'> = {
  'claude-sonnet-4-6': 'anthropic',
  'claude-opus-4-7': 'anthropic',
  'claude-haiku-4-5': 'anthropic',
  'gpt-5': 'openai',
  'gemini-3-pro': 'google',
}

const PROVIDER_ENV_VAR: Record<'anthropic' | 'openai' | 'google', string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
}

const PROVIDER_LABEL: Record<'anthropic' | 'openai' | 'google', string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
}

/**
 * Resolve a model ID (or unknown string) to a concrete AI SDK model.
 * Falls back to `DEFAULT_MODEL` for unknown or empty inputs.
 */
export function resolveModel(id: string | undefined) {
  const key = (id ?? DEFAULT_MODEL) as ModelId
  return MODEL_MAP[key] ?? MODEL_MAP[DEFAULT_MODEL]
}

/**
 * Return true if `id` is a known model in the registry.
 */
export function isKnownModel(id: string | undefined): id is ModelId {
  return typeof id === 'string' && id in MODEL_MAP
}

/**
 * Throw a descriptive Error if the env var required for the provider behind
 * `id` is missing. Use this in route handlers to surface a clean 400 instead
 * of a cryptic provider-side error.
 */
export function assertModelKeyAvailable(id: string | undefined): void {
  const key = isKnownModel(id) ? id : DEFAULT_MODEL
  const provider = MODEL_PROVIDER[key]
  const envVar = PROVIDER_ENV_VAR[provider]
  const value = process.env[envVar]
  if (!value || value.trim().length === 0) {
    throw new Error(
      `${PROVIDER_LABEL[provider]} API key is missing — set ${envVar} to use model "${key}".`,
    )
  }
}
