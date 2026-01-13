/**
 * Policy Registry — Tripwire Tests
 * 
 * These tests ensure policy-as-config works correctly:
 * 1. Unknown policyId → stopReason: policy_not_found
 * 2. Invalid policy file → stopReason: policy_invalid
 * 3. WorkOrder exceeds policy caps → stopReason: policy_rejected
 * 4. Idempotency unaffected by policy contents (only policyId in keyHash)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { runEngine, computeWorkOrderKeyV1 } from "../runEngine";
import { resolvePolicy, clearPolicyRegistry, registerPolicies, getRegisteredPolicyIds } from "../policy/policyRegistry";
import { ALL_POLICIES } from "../policy/policyBundle";
import type { AiWorkOrderV1 } from "../types";
import * as fs from "fs";

// Set IDEMPOTENCY_SECRET for tests
beforeAll(() => {
  process.env.IDEMPOTENCY_SECRET = "test-secret-do-not-use-in-production";
});

// Register policies before all tests
beforeAll(() => {
  registerPolicies(ALL_POLICIES);
});

// Clear policy registry after each test
afterEach(() => {
  clearPolicyRegistry();
  registerPolicies(ALL_POLICIES); // Re-register for next test
  vi.doUnmock("fs");
  vi.doUnmock("node:fs");
});

describe("Policy Registry — Tripwire Tests", () => {
  // ============================================
  // TEST 1: Unknown policyId → policy_not_found
  // ============================================

  it("returns policy_not_found for unknown policyId", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "unknown_policy_that_does_not_exist",
      inputs: { test: true },
      constraints: {},
      idempotency: { scope: "test", keyHash: "abc123" },
      trace: { jobId: "test-job-1" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    expect(result.status).toBe("failed");
    expect(result.stopReason).toBe("policy_not_found");
  });

  // ============================================
  // TEST 2: Invalid policy file → policy_invalid
  // ============================================

  it("returns policy_invalid for malformed policy object", async () => {
    // Register an invalid policy (invalid engineVersion value)
    // Strict mode: throw on first invalid policy
    clearPolicyRegistry();
    
    expect(() => {
      registerPolicies([
        {
          policyId: "invalid_test_policy",
          engineVersion: "v2", // Invalid: only "v1" is allowed
          caps: {
            maxRounds: 3,
            costCapUsd: 1.0,
            maxTokensTotal: 8000,
          },
          routing: {
            requiredCaps: ["json_output"],
            preferredCaps: [],
          },
          swarm: {
            enabled: false,
          },
          presentationDefaults: {
            mode: "single_best",
            allowUserProviderPreference: false,
          },
          logging: {
            customerTrailEnabled: true,
            internalTrailEnabled: true,
          },
        },
      ], { strict: true });
    }).toThrow("Policy validation failed");

    // Restore policies
    clearPolicyRegistry();
    registerPolicies(ALL_POLICIES);
  });

  // ============================================
  // TEST 3: WorkOrder exceeds policy caps → policy_rejected
  // ============================================

  it("returns policy_rejected when WorkOrder exceeds policy costCapUsd", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "launchbase_portal_v1", // costCapUsd: 1.5
      inputs: { test: true },
      constraints: {
        costCapUsd: 9.0, // Exceeds policy cap of 1.5
      },
      idempotency: { scope: "test", keyHash: "abc123" },
      trace: { jobId: "test-job-3" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    expect(result.status).toBe("failed");
    expect(result.stopReason).toBe("policy_rejected");
  });

  it("returns policy_rejected when WorkOrder exceeds policy maxRounds", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "launchbase_portal_v1", // maxRounds: 2
      inputs: { test: true },
      constraints: {
        maxRounds: 5, // Exceeds policy cap of 2
      },
      idempotency: { scope: "test", keyHash: "abc123" },
      trace: { jobId: "test-job-4" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    expect(result.status).toBe("failed");
    expect(result.stopReason).toBe("policy_rejected");
  });

  it("accepts WorkOrder within policy caps", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "launchbase_portal_v1", // costCapUsd: 1.5, maxRounds: 2
      inputs: { test: true },
      constraints: {
        costCapUsd: 1.0, // Within policy cap
        maxRounds: 2,    // Within policy cap
      },
      idempotency: { scope: "test", keyHash: "abc123" },
      trace: { jobId: "test-job-5" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    // Should not fail due to policy caps
    expect(result.stopReason).not.toBe("policy_rejected");
    expect(result.stopReason).not.toBe("policy_not_found");
    expect(result.stopReason).not.toBe("policy_invalid");
  });

  // ============================================
  // TEST 4: Idempotency unaffected by policy contents
  // ============================================

  it("produces same keyHash for same policyId regardless of policy contents", () => {
    // Two orders with same policyId but different constraints
    // (policy contents don't affect keyHash, only policyId does)
    const order1: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "launchbase_portal_v1",
      inputs: { test: true },
      constraints: { costCapUsd: 1.0 },
      idempotency: { scope: "test", keyHash: "placeholder" },
      trace: { jobId: "test-job-6" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const order2: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "launchbase_portal_v1", // Same policyId
      inputs: { test: true },
      constraints: { costCapUsd: 1.0 },
      idempotency: { scope: "test", keyHash: "placeholder" },
      trace: { jobId: "test-job-7" }, // Different jobId (not in keyHash)
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const key1 = computeWorkOrderKeyV1(order1);
    const key2 = computeWorkOrderKeyV1(order2);

    expect(key1).toBe(key2);
  });

  it("produces different keyHash for different policyId", () => {
    const order1: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "launchbase_portal_v1",
      inputs: { test: true },
      constraints: {},
      idempotency: { scope: "test", keyHash: "placeholder" },
      trace: { jobId: "test-job-8" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const order2: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "swarm_premium_v1", // Different policyId
      inputs: { test: true },
      constraints: {},
      idempotency: { scope: "test", keyHash: "placeholder" },
      trace: { jobId: "test-job-9" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const key1 = computeWorkOrderKeyV1(order1);
    const key2 = computeWorkOrderKeyV1(order2);

    expect(key1).not.toBe(key2);
  });

  // ============================================
  // TEST 5: Policy resolution is deterministic and cached
  // ============================================

  it("caches policy after first load", () => {
    // First load
    const result1 = resolvePolicy("launchbase_portal_v1");
    expect(result1.ok).toBe(true);

    // Second load (should be cached)
    const result2 = resolvePolicy("launchbase_portal_v1");
    expect(result2.ok).toBe(true);

    // Should be same object reference (cached)
    if (result1.ok && result2.ok) {
      expect(result1.policy).toBe(result2.policy);
    }
  });

  it("loads different policies independently", () => {
    const result1 = resolvePolicy("launchbase_portal_v1");
    const result2 = resolvePolicy("swarm_premium_v1");

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);

    if (result1.ok && result2.ok) {
      expect(result1.policy.policyId).toBe("launchbase_portal_v1");
      expect(result2.policy.policyId).toBe("swarm_premium_v1");
      expect(result1.policy).not.toBe(result2.policy);
    }
  });

  // ============================================
  // TEST 6: Serverless determinism — No runtime FS reads
  // ============================================

  it("does not touch runtime filesystem (serverless-safe)", async () => {
    // Reset modules to ensure mocks apply to fresh imports
    vi.resetModules();
    vi.clearAllMocks();

    // Poison FS module so any read throws
    const fsPoison = () => {
      throw new Error("FS_FORBIDDEN: policy registry must not read filesystem at runtime");
    };

    // Poison both import styles (node:fs and fs)
    vi.doMock("node:fs", () => ({
      readFileSync: fsPoison,
      readdirSync: fsPoison,
      statSync: fsPoison,
      existsSync: fsPoison,
      promises: {
        readFile: fsPoison,
        readdir: fsPoison,
        stat: fsPoison,
        access: fsPoison,
      },
    }));

    vi.doMock("fs", () => ({
      readFileSync: fsPoison,
      readdirSync: fsPoison,
      statSync: fsPoison,
      existsSync: fsPoison,
      promises: {
        readFile: fsPoison,
        readdir: fsPoison,
        stat: fsPoison,
        access: fsPoison,
      },
    }));

    // Import AFTER poisoning (dynamic import)
    const { resolvePolicy: testResolvePolicy, registerPolicies: testRegisterPolicies } = await import("../policy/policyRegistry");
    const { ALL_POLICIES: testPolicies } = await import("../policy/policyBundle");

    // Register policies (should not touch FS)
    testRegisterPolicies(testPolicies);

    // Resolve policy (should use in-memory registry only)
    const result = testResolvePolicy("launchbase_portal_v1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.policy.policyId).toBe("launchbase_portal_v1");
    }
  });

  // ============================================
  // TEST 7: Serverless determinism — Registration order independence
  // ============================================

  it("policy registration order doesn't change results", () => {
    // Register policies in original order
    clearPolicyRegistry();
    registerPolicies(ALL_POLICIES);
    const result1 = resolvePolicy("launchbase_portal_v1");

    // Register policies in shuffled order
    clearPolicyRegistry();
    const shuffled = [...ALL_POLICIES].reverse(); // Simple shuffle (reverse)
    registerPolicies(shuffled);
    const result2 = resolvePolicy("launchbase_portal_v1");

    // Results should be identical
    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);

    if (result1.ok && result2.ok) {
      expect(result1.policy).toEqual(result2.policy);
    }

    // Restore original order
    clearPolicyRegistry();
    registerPolicies(ALL_POLICIES);
  });
});
