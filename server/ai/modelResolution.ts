/**
 * Model Resolution: Alias normalization + deterministic fallback chains
 * 
 * Fixes model registry drift by:
 * 1. Normalizing common model ID aliases
 * 2. Providing per-role fallback chains
 * 3. Logging requested/resolved/fallbackUsed for debugging
 */

// Model ID aliases (normalize common variations)
const MODEL_ALIASES: Record<string, string> = {
  // Claude Sonnet 4 variations
  "claude-sonnet-4": "anthropic/claude-sonnet-4-20250514",
  "sonnet-4": "anthropic/claude-sonnet-4-20250514",
  "sonnet-4.0": "anthropic/claude-sonnet-4-20250514",
  "anthropic/claude-sonnet-4": "anthropic/claude-sonnet-4-20250514",
  
  // GPT-5.2 variations
  "gpt-5.2": "openai/gpt-5-2",
  "gpt-5-2": "openai/gpt-5-2",
  "openai/gpt-5.2": "openai/gpt-5-2",
  
  // GPT-4o variations
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
};

// Per-role fallback chains (in priority order)
const FALLBACK_CHAINS: Record<string, string[]> = {
  // Field General (diagnosis)
  fieldGeneral: [
    "openai/gpt-5-2",
    "openai/gpt-4.1",
    "openai/gpt-4o",
  ],
  
  // Coder (patch generation)
  coder: [
    "openai/gpt-5-2",
    "openai/gpt-4.1",
    "openai/gpt-4o",
  ],
  
  // Reviewer (patch review)
  reviewer: [
    "anthropic/claude-sonnet-4-20250514",
    "openai/gpt-4o-mini",
    "openai/gpt-4.1-mini",
  ],
  
  // Arbiter (decision making)
  arbiter: [
    "openai/gpt-5-2",
    "openai/gpt-4.1",
  ],
};

/**
 * Normalize a model ID using the alias map
 */
export function normalizeModelId(modelId: string): string {
  return MODEL_ALIASES[modelId] ?? modelId;
}

/**
 * Resolve a model ID with fallback chain for a given role
 * 
 * @param role - The agent role (fieldGeneral, coder, reviewer, arbiter)
 * @param requestedModel - The originally requested model ID
 * @param availableModels - Set of available model IDs (from registry)
 * @returns Resolved model info with fallback flag
 */
export function resolveModelWithFallback(
  role: keyof typeof FALLBACK_CHAINS,
  requestedModel: string,
  availableModels: Set<string>
): { modelId: string; fallbackUsed: boolean; attempted: string[] } {
  const normalized = normalizeModelId(requestedModel);
  const attempted: string[] = [normalized];
  
  // Try normalized requested model first
  if (availableModels.has(normalized)) {
    console.log(`[ModelResolution] ${role}: Using requested model ${normalized}`);
    return { modelId: normalized, fallbackUsed: false, attempted };
  }
  
  // Try fallback chain
  const fallbackChain = FALLBACK_CHAINS[role] || [];
  
  for (const fallbackModel of fallbackChain) {
    attempted.push(fallbackModel);
    
    if (availableModels.has(fallbackModel)) {
      console.warn(
        `[ModelResolution] ${role}: Falling back from ${requestedModel} → ${fallbackModel}`
      );
      return { modelId: fallbackModel, fallbackUsed: true, attempted };
    }
  }
  
  // No models available
  throw new Error(
    `[ModelResolution] No available models for role=${role}. ` +
    `Requested: ${requestedModel}, Attempted: ${attempted.join(", ")}`
  );
}

/**
 * Get available models from environment or mock registry
 * (In production, this would query the actual model registry)
 */
export function getAvailableModels(): Set<string> {
  // For now, return a static set of known models
  // TODO: Replace with actual registry query
  return new Set([
    "openai/gpt-5-2",
    "openai/gpt-4.1",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/gpt-4.1-mini",
    "anthropic/claude-sonnet-4-20250514",
  ]);
}
