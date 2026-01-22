/**
 * Model Chains - Role-aware fallback chains for model selection
 * 
 * Single source of truth for per-role model preferences.
 * Used by withModelFallback() to build candidate lists.
 */

// Per-role fallback chains (in priority order)
// Registry handles both prefixed and unprefixed IDs automatically
function applyEnvOverride(role: string, chain: string[]): string[] {
  const envKey = `SWARM_MODEL_${role.toUpperCase()}_PRIMARY`;
  const override = process.env[envKey];
  if (override && override.trim()) {
    // Keep existing chain as fallbacks (dedupe)
    const rest = chain.filter(m => m !== override.trim());
    return [override.trim(), ...rest];
  }
  return chain;
}

const FALLBACK_CHAINS: Record<string, string[]> = {
  // Field General (diagnosis)
  fieldGeneral: [
    "openai/gpt-5-2",
    "openai/gpt-4o",
    "gpt-4o-mini",
  ],
  
  // Coder (patch generation)
  coder: [
    "openai/gpt-5-2",
    "openai/gpt-4o",
    "claude-sonnet-4-20250514",
    "gpt-4o-mini",
  ],
  
  // Reviewer (patch review)
  reviewer: [
    "claude-sonnet-4-20250514",
    "openai/gpt-4o",
    "gpt-4o-mini",
  ],
  
  // Arbiter (decision making)
  arbiter: [
    "openai/gpt-5-2",
    "openai/gpt-4o",
    "gpt-4o-mini",
  ],
  
  // Generic fallback (when role is unknown)
  generic: [
    "openai/gpt-4o",
    "gpt-4o-mini",
  ],
};

/**
 * Get fallback chain for a given role
 * 
 * @param role - The role name (e.g., "coder", "reviewer", "craft", "critic")
 * @returns Array of model IDs in priority order
 */
export function getFallbackChain(role?: string): string[] {
  if (!role) return FALLBACK_CHAINS.generic;
  
  // Normalize role name (handle variations)
  const normalized = role.toLowerCase().replace(/[_-]/g, "");
  
  // Map specialist names to role types
  const roleMap: Record<string, string> = {
    craft: "coder",
    critic: "reviewer",
    fieldgeneral: "fieldGeneral",
    coder: "coder",
    reviewer: "reviewer",
    arbiter: "arbiter",
  };
  
  const mappedRole = roleMap[normalized];
  return FALLBACK_CHAINS[mappedRole] || FALLBACK_CHAINS.generic;
}

/**
 * Build candidate list from primary model + role fallbacks
 * 
 * @param primaryModel - The requested model
 * @param role - The role name
 * @returns Deduplicated list of candidate models
 */
export function buildCandidates(primaryModel: string, role?: string): string[] {
  const fallbacks = getFallbackChain(role);
  
  // Deduplicate: primary first, then fallbacks (skip if already in list)
  const candidates = [primaryModel];
  for (const model of fallbacks) {
    if (!candidates.includes(model)) {
      candidates.push(model);
    }
  }
  
  return candidates;
}
