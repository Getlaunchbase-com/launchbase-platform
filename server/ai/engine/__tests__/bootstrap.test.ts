/**
 * Bootstrap Tripwire Test — Policy Registration at Server Startup
 * 
 * Ensures policies are registered and available before any engine call.
 * 
 * Invariants:
 * - Server boot → policies available
 * - No runtime FS reads (static bundle only)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { resolvePolicy, registerPolicies, clearPolicyRegistry } from "../policy/policyRegistry";
import { ALL_POLICIES } from "../policy/policyBundle";

describe("Policy Bootstrap — Server Startup", () => {
  // Simulate server startup
  beforeAll(() => {
    clearPolicyRegistry();
    registerPolicies(ALL_POLICIES);
  });

  // ============================================
  // TEST 1: Policies available after bootstrap
  // ============================================

  it("makes policies available after server boot", () => {
    const result = resolvePolicy("launchbase_portal_v1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.policy.policyId).toBe("launchbase_portal_v1");
      expect(result.policy.caps).toBeDefined();
      expect(result.policy.routing).toBeDefined();
    }
  });

  it("makes all bundled policies available", () => {
    const policyIds = ["launchbase_portal_v1", "swarm_premium_v1", "ai_butler_consumer_v1"];

    for (const policyId of policyIds) {
      const result = resolvePolicy(policyId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.policy.policyId).toBe(policyId);
      }
    }
  });

  // ============================================
  // TEST 2: No runtime FS reads (serverless-safe)
  // ============================================

  it("does not require filesystem access after bootstrap", () => {
    // This test verifies that once policies are registered,
    // resolution works without any FS access.
    // The actual FS poisoning test is in policy.test.ts.

    // Multiple resolutions should work without FS
    const result1 = resolvePolicy("launchbase_portal_v1");
    const result2 = resolvePolicy("swarm_premium_v1");
    const result3 = resolvePolicy("ai_butler_consumer_v1");

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    expect(result3.ok).toBe(true);
  });

  // ============================================
  // TEST 3: Bootstrap is idempotent
  // ============================================

  it("allows re-registration without errors", () => {
    // Re-registering should not throw or corrupt state
    expect(() => registerPolicies(ALL_POLICIES)).not.toThrow();

    // Policies should still resolve correctly
    const result = resolvePolicy("launchbase_portal_v1");
    expect(result.ok).toBe(true);
  });
});
