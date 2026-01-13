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
 * @param opts Options for registration behavior
 * @param opts.strict If true, throw on first invalid policy (default: false)
 */
export function registerPolicies(policies: unknown[], opts?: { strict?: boolean }): void {
  const strict = opts?.strict ?? false;
  
  for (const raw of policies) {
    const parsed = PolicyV1Schema.safeParse(raw);
    if (!parsed.success) {
      if (strict) {
        // Strict mode: throw on first invalid policy
        throw new Error(`[PolicyRegistry] Policy validation failed: ${parsed.error.message}`);
      }
      // Default: skip invalid policies (robust boot)
      console.warn(`[PolicyRegistry] Skipping invalid policy:`, parsed.error.issues);
      continue;
    }
    registry.set(parsed.data.policyId, parsed.data);
  }
}

// ============================================
// INTROSPECTION (TEST-ONLY)
// ============================================

/**
 * Get all registered policy IDs (test-only introspection)
 * 
 * @returns Array of registered policy IDs (sorted)
 */
export function _getRegisteredPolicyIds(): string[] {
  return Array.from(registry.keys()).sort();
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
