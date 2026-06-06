import 'server-only'

import { generateText, stepCountIs } from 'ai'

import { resolveModel, DEFAULT_MODEL } from '@/lib/ai'
import { buildSystemPrompt, type PageContext } from '@/lib/context-builder'
import { loadMcpTools } from '@/lib/mcp-client'
import { createServiceClient } from '@/lib/supabase/server'
import type { RunTrigger, Skill } from '@/lib/supabase/types'

/**
 * Skill execution engine for the CREAIT Command Center.
 *
 * Given a stored skill id + input, this:
 *   1. Loads the skill row (service role — bypasses RLS).
 *   2. Resolves the AI SDK model from `skill.preferred_model`.
 *   3. Composes a system prompt: skill prompt + page-context prompt + input.
 *   4. Loads MCP tools (gracefully empty if MCP is unreachable).
 *   5. Inserts a `run_history` row with status=running.
 *   6. Calls `generateText` with `stopWhen: stepCountIs(15)`.
 *   7. Updates the run row with status, output, tokens, cost, duration.
 *
 * Specific output routing (e.g., a Daily Briefing writing to
 * `research_briefings`) is the responsibility of skill-specific Inngest
 * functions in Phase 3 — Phase 2 just records the full output to
 * `run_history`.
 */

export type SkillTrigger = RunTrigger

export interface RunSkillOptions {
  orgId: string
  triggeredBy: string
  trigger: SkillTrigger
}

export interface RunSkillResult {
  output: string
  runId: string
}

interface CostRate {
  inputPerMillion: number
  outputPerMillion: number
}

/**
 * USD-per-million-tokens for each known model. Conservative published
 * list pricing — used for budget signal, not for billing.
 */
const COST_RATES: Record<string, CostRate> = {
  'claude-sonnet-4-6': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-opus-4-7': { inputPerMillion: 15, outputPerMillion: 75 },
  'claude-haiku-4-5': { inputPerMillion: 0.8, outputPerMillion: 4 },
}

/**
 * Run a stored skill against the given input.
 *
 * Always inserts a `run_history` row, even on early failure, so Maurice can
 * inspect what happened from the /agents page.
 */
export async function runSkill(
  skillId: string,
  input: Record<string, unknown>,
  opts: RunSkillOptions,
): Promise<RunSkillResult> {
  const supabase = createServiceClient()
  const startedAt = Date.now()

  // ---------------------------------------------------------------------------
  // 1. Load the skill
  // ---------------------------------------------------------------------------
  const { data: skillRow, error: skillErr } = await supabase
    .from('skills')
    .select('*')
    .eq('id', skillId)
    .eq('org_id', opts.orgId)
    .maybeSingle()

  if (skillErr) {
    throw new Error(`Failed to load skill ${skillId}: ${skillErr.message}`)
  }
  if (!skillRow) {
    throw new Error(`Skill ${skillId} not found for org ${opts.orgId}`)
  }
  const skill = skillRow as Skill
  if (!skill.enabled) {
    throw new Error(`Skill "${skill.name}" is disabled`)
  }

  const modelId = skill.preferred_model || DEFAULT_MODEL
  const model = resolveModel(modelId)

  // ---------------------------------------------------------------------------
  // 2. Insert a placeholder run row so we can record failures too
  // ---------------------------------------------------------------------------
  const { data: runRow, error: runInsertErr } = await supabase
    .from('run_history')
    .insert({
      org_id: opts.orgId,
      skill_id: skill.id,
      trigger: opts.trigger,
      model: modelId,
      input: input as never,
      status: 'running',
    })
    .select('id')
    .single()

  if (runInsertErr || !runRow) {
    throw new Error(
      `Failed to create run_history row: ${runInsertErr?.message ?? 'unknown error'}`,
    )
  }
  const runId = runRow.id as string

  try {
    // -------------------------------------------------------------------------
    // 3. Compose prompts
    // -------------------------------------------------------------------------
    const pageContext: PageContext = (skill.category ?? 'home') as PageContext
    const pagePrompt = await buildSystemPrompt(opts.orgId, pageContext)
    const skillPrompt = skill.system_prompt?.trim() || `You are the "${skill.name}" skill.`

    const composedSystem = [
      skillPrompt,
      '',
      pagePrompt,
      '',
      '# Input',
      safeStringify(input),
      '',
      `# Triggered by: ${opts.triggeredBy} (${opts.trigger})`,
    ].join('\n')

    // -------------------------------------------------------------------------
    // 4. Load MCP tools (resilient — empty record on failure)
    // -------------------------------------------------------------------------
    const tools = await loadMcpTools()

    // -------------------------------------------------------------------------
    // 5. Call the model
    // -------------------------------------------------------------------------
    const result = await generateText({
      model,
      system: composedSystem,
      prompt: safeStringify(input),
      tools,
      stopWhen: stepCountIs(15),
    })

    // -------------------------------------------------------------------------
    // 6. Persist success
    // -------------------------------------------------------------------------
    const durationMs = Date.now() - startedAt
    const inputTokens = result.usage?.inputTokens ?? null
    const outputTokens = result.usage?.outputTokens ?? null
    const costUsd = estimateCostUsd(modelId, inputTokens, outputTokens)

    await supabase
      .from('run_history')
      .update({
        status: 'succeeded',
        output: { text: result.text } as never,
        duration_ms: durationMs,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)

    return { output: result.text, runId }
  } catch (err) {
    // -------------------------------------------------------------------------
    // 7. Persist failure
    // -------------------------------------------------------------------------
    const durationMs = Date.now() - startedAt
    const message =
      err instanceof Error ? err.message : 'Unknown error during skill run'

    await supabase
      .from('run_history')
      .update({
        status: 'failed',
        error: message,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)

    throw err
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function estimateCostUsd(
  modelId: string,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  const rate = COST_RATES[modelId]
  if (!rate) return null
  const inTok = inputTokens ?? 0
  const outTok = outputTokens ?? 0
  if (inTok === 0 && outTok === 0) return null
  const cost =
    (inTok / 1_000_000) * rate.inputPerMillion +
    (outTok / 1_000_000) * rate.outputPerMillion
  // 6 decimal places to match the NUMERIC(10,6) column.
  return Number(cost.toFixed(6))
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '(unserializable input)'
  }
}
