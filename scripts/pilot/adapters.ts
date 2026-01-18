/**
 * Pilot Adapters
 * 
 * Convert pilot configuration to specialist role configs.
 */

import type { SpecialistRoleConfig } from '../../server/ai/pilotRuntime';

/**
 * Convert pilot stack config to SpecialistRoleConfig
 * 
 * Note: maxTokens and temperature are passed via input.context
 * since they're not in the SpecialistRoleConfig interface.
 */
export function toRoleConfig(
  modelId: string,
  provider: string,
  lane: string,
  opts?: { timeoutMs?: number; costCapUsd?: number }
): SpecialistRoleConfig {
  return {
    transport: 'aiml',
    model: modelId, // e.g., "openai/gpt-4o-2024-08-06" or "anthropic/claude-3-5-sonnet-20240620"
    capabilities: [
      // Observability/policy markers
      `lane:${lane}`,
      `provider:${provider}`,
      'json_strict',
      'zod_validated',
    ],
    timeoutMs: opts?.timeoutMs,
    costCapUsd: opts?.costCapUsd,
  };
}
