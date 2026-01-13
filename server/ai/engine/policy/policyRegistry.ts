/**
 * Policy Registry — Load and Validate Policies (Zod + Static Imports)
 * 
 * Loads policies from static bundle, validates with Zod, caches deterministically.
 * 
 * RULE: Engine returns stopReason (not throw) if policy resolution fails.
 * 
 * NO FILESYSTEM READS IN PRODUCTION PATH.
 */

import { PolicyV1Schema, type PolicyV1, type PolicyResolutionResult } from "./policyTypes";

// ============================================
// POLICY REGISTRY
// ============================================

const registry = new Map<string, PolicyV1>();

// ============================================
// POLICY REGISTRATION
// ============================================

/**
 * Register policies at boot (static import).
 * 
 * This avoids runtime FS reads and keeps determinism in serverless envs.
 * 
 * @param policies Array of unknown policy objects (will be validated)
 */
export function registerPolicies(policies: unknown[]): void {
  for (const raw of policies) {
    const parsed = PolicyV1Schema.safeParse(raw);
    if (!parsed.success) {
      // Invalid policies won't be registered (silent skip)
      console.warn(`[PolicyRegistry] Skipping invalid policy:`, parsed.error.issues);
      continue;
    }
    registry.set(parsed.data.policyId, parsed.data);
  }
}

// ============================================
// POLICY RESOLUTION
// ============================================

/**
 * Resolve policy by ID
 * 
 * Loads from registry (no FS reads), validates, returns result.
 * 
 * @param policyId Policy identifier (e.g., "launchbase_portal_v1")
 * @returns PolicyResolutionResult (ok + policy, or ok + stopReason)
 */
export function resolvePolicy(policyId: string): PolicyResolutionResult {
  // Check registry
  const policy = registry.get(policyId);
  if (!policy) {
    return { ok: false, stopReason: "policy_not_found" };
  }

  // Policy is already validated during registration
  return { ok: true, policy };
}

/**
 * Clear policy registry (for testing)
 */
export function clearPolicyRegistry(): void {
  registry.clear();
}

/**
 * Get all registered policy IDs (for testing/debugging)
 */
export function getRegisteredPolicyIds(): string[] {
  return Array.from(registry.keys());
}
