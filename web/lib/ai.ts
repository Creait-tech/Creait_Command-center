import { anthropic } from '@ai-sdk/anthropic'
import { openai, createOpenAI } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'

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
  'openrouter/kimi-k2': openrouter('moonshotai/kimi-k2'),
  'openrouter/deepseek-v3': openrouter('deepseek/deepseek-chat-v3-0324'),
  'openrouter/llama-3.3-70b': openrouter('meta-llama/llama-3.3-70b-instruct'),
  // gemini-2.0-flash-001 was delisted from OpenRouter; 2.5-flash is the stable successor
  'openrouter/gemini-flash': openrouter('google/gemini-2.5-flash'),
  // :free tier — works even with $0 OpenRouter credits (rate-limited ~50 req/day)
  'openrouter/nemotron-free': openrouter('nvidia/nemotron-3-ultra-550b-a55b:free'),
} as const

export type ModelId = keyof typeof MODEL_MAP

export const DEFAULT_MODEL: ModelId = 'claude-sonnet-4-6'

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
