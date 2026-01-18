/**
 * Timeout Ladder + Fallback Retry Logic
 * 
 * Implements automatic model fallback on timeout/provider failures
 * to ensure run reliability without blocking the pipeline.
 * 
 * Ladder order:
 * 1. gpt-5.2-pro (180s timeout)
 * 2. gpt-5.2 (150s timeout)
 * 3. gpt-4o-2024-08-06 (90s timeout)
 * 
 * Retry rules:
 * - Max 2 retries per specialist (3 attempts total)
 * - Retry only on: timeout, provider_failed, invalid_json
 * - Do NOT retry on: Zod validation failures, "ok" with bad output
 * - Budget safety: auto-escalate if single run exceeds $2
 */

export interface ModelLadderConfig {
  model: string;
  timeoutMs: number;
}

export interface RetryMetadata {
  attemptCount: number;
  attemptModels: string[];
  finalModelUsed: string;
  finalTimeoutMs: number;
  totalCost: number;
}

/**
 * Model ladder for designer roles
 * Premium-first with automatic fallback
 */
export const DESIGNER_MODEL_LADDER: ModelLadderConfig[] = [
  { model: "openai/gpt-5.2-pro", timeoutMs: 180000 },
  { model: "openai/gpt-5.2", timeoutMs: 150000 },
  { model: "openai/gpt-4o-2024-08-06", timeoutMs: 90000 },
];

/**
 * Model ladder for critic roles
 * Claude Opus is reliable, so single-tier for now
 */
export const CRITIC_MODEL_LADDER: ModelLadderConfig[] = [
  { model: "claude-opus-4-1-20250805", timeoutMs: 90000 },
];

/**
 * Model ladder for selector roles
 * Fast instruct models only (no frontier models)
 * Llama 8B primary, Qwen 7B fallback
 */
export const SELECTOR_MODEL_LADDER: ModelLadderConfig[] = [
  { model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", timeoutMs: 60000 },
  { model: "Qwen/Qwen2.5-7B-Instruct-Turbo", timeoutMs: 60000 },
];

/**
 * Budget safety threshold
 * If a single specialist call exceeds this, auto-escalate
 */
export const BUDGET_SAFETY_THRESHOLD_USD = 2.0;

/**
 * StopReasons that trigger a retry
 */
export const RETRYABLE_STOP_REASONS = new Set([
  "timeout",
  "provider_failed",
  "invalid_json",
]);

/**
 * Get the appropriate model ladder for a role
 */
export function getModelLadderForRole(role: string): ModelLadderConfig[] {
  if (role.includes("critic")) {
    return CRITIC_MODEL_LADDER;
  }
  if (role.includes("selector")) {
    return SELECTOR_MODEL_LADDER;
  }
  return DESIGNER_MODEL_LADDER;
}

/**
 * Check if a stopReason should trigger a retry
 * Role-aware: selector can retry on schema_failed, others cannot
 */
export function shouldRetry(stopReason: string, role?: string): boolean {
  // Global retryable reasons (all roles)
  if (RETRYABLE_STOP_REASONS.has(stopReason)) {
    return true;
  }
  
  // Selector-specific: allow one retry on schema failures
  // (Small models sometimes miscount; retry is cheap and effective)
  if (role && role.includes('selector') && (stopReason === 'schema_failed' || stopReason === 'ajv_failed')) {
    return true;
  }
  
  return false;
}

/**
 * Check if cost exceeds budget safety threshold
 */
export function exceedsBudgetThreshold(costUsd: number): boolean {
  return costUsd > BUDGET_SAFETY_THRESHOLD_USD;
}

/**
 * Get the next model in the ladder
 * Returns null if no more fallbacks available
 */
export function getNextModel(
  currentModel: string,
  ladder: ModelLadderConfig[]
): ModelLadderConfig | null {
  const currentIndex = ladder.findIndex((config) => config.model === currentModel);
  if (currentIndex === -1 || currentIndex === ladder.length - 1) {
    return null;
  }
  return ladder[currentIndex + 1];
}
