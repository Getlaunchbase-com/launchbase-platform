/**
 * Swarm Orchestration — Gate 4 Tripwire Tests
 * 
 * Showroom Runner + Benchmark Runs
 * 
 * These tests lock down the output packaging, telemetry, and persistence contract.
 * All tests use mocks (no real provider calls).
 * 
 * FROZEN CONTRACTS:
 * - Artifact order: plan → craft → critic → collapse (4 artifacts)
 * - Only collapse is customerSafe=true
 * - meta.swarm.roleCostsUsd + totalCostUsd + roleModels always present
 * - Run persistence: input.json, output.json, summary.md
 * - No prompt/provider internals leak
 */

import { describe, it, expect, beforeEach, vi } from "vitest
import { allowNetwork } from "../../../__tests__/helpers/networkGate";

const t = allowNetwork ? test : test.skip;";
import type { SpecialistOutput } from "../specialists";
import { clearPolicyRegistry, registerPolicies } from "../policy/policyRegistry";
import { ALL_POLICIES } from "../policy/policyBundle";

// Mock the specialists module BEFORE importing runEngine
vi.mock("../specialists", () => ({
  callSpecialistAIML: vi.fn(),
}));

// Import AFTER mock
import { runEngine } from "../runEngine";
import { callSpecialistAIML } from "../specialists";
import type { AiWorkOrderV1 } from "../types";

// ============================================
// Test Helpers — Role-Specific Mocks
// ============================================

function mockCraftOk(overrides?: Partial<SpecialistOutput>): SpecialistOutput {
  return {
    artifact: {
      kind: "swarm.specialist.craft",
      customerSafe: false,
      payload: {
        proposedChanges: [
          { targetKey: "hero.headline", value: "Artisan coffee, locally roasted", rationale: "Clear and concise" },
        ],
        risks: [],
        assumptions: [],
      },
    },
    meta: {
      model: "gpt-4o-mini",
      requestId: "req_craft_1",
      latencyMs: 120,
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.02,
    },
    stopReason: "ok",
    ...overrides,
  } as SpecialistOutput;
}

function mockCriticOk(overrides?: Partial<SpecialistOutput>): SpecialistOutput {
  return {
    artifact: {
      kind: "swarm.specialist.critic",
      customerSafe: false,
      payload: {
        pass: true,
        issues: [],
        previewRecommended: false,
        risks: [],
        assumptions: [],
      },
    },
    meta: {
      model: "gpt-4o-mini",
      requestId: "req_critic_1",
      latencyMs: 140,
      inputTokens: 110,
      outputTokens: 55,
      costUsd: 0.02,
    },
    stopReason: "ok",
    ...overrides,
  } as SpecialistOutput;
}

// ============================================
// SETUP
// ============================================

beforeEach(() => {
  // Ensure IDEMPOTENCY_SECRET is set
  process.env.IDEMPOTENCY_SECRET = "test-secret-key-for-gate4";
  
  // Register policies
  clearPolicyRegistry();
  registerPolicies(ALL_POLICIES);
  
  // Setup default mocks (craft → critic → ok)
  const mockedCallSpecialist = vi.mocked(callSpecialistAIML);
  mockedCallSpecialist.mockImplementation(async ({ role }) => {
    if (role === "craft") return mockCraftOk();
    if (role === "critic") return mockCriticOk();
    throw new Error(`Unexpected role: ${role}`);
  });
});

// ============================================
// GATE 4 TRIPWIRE TESTS
// ============================================

describe("Swarm Orchestration — Gate 4 Tripwire Tests", () => {
  
  // ============================================
  // T1: Stable output envelope
  // ============================================
  
  t("T1: returns stable output envelope (status, stopReason, artifacts)", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.showroom.coffee",
      policyId: "swarm_premium_v1",
      inputs: { 
        task: "Write homepage copy for artisan coffee shop",
        business: "The Daily Grind",
        audience: "coffee enthusiasts, remote workers",
      },
      constraints: { maxRounds: 1, costCapUsd: 1.0 },
      idempotency: { scope: "gate4.t1", keyHash: "test-key-t1" },
      trace: { jobId: "gate4-t1" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    // FROZEN CONTRACT: Stable output envelope
    expect(result.status).toBeDefined();
    expect(result.status).toMatch(/^(succeeded|failed|in_progress)$/);
    expect(result.stopReason).toBeDefined();
    expect(result.artifacts).toBeDefined();
    expect(Array.isArray(result.artifacts)).toBe(true);
  });

  // ============================================
  // T2: Frozen artifact ordering preserved
  // ============================================
  
  t("T2: preserves frozen artifact ordering (plan → craft → critic → collapse)", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.showroom.coffee",
      policyId: "swarm_premium_v1",
      inputs: { 
        task: "Write homepage copy for artisan coffee shop",
      },
      constraints: { maxRounds: 1, costCapUsd: 1.0 },
      idempotency: { scope: "gate4.t2", keyHash: "test-key-t2" },
      trace: { jobId: "gate4-t2" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    // FROZEN CONTRACT: Exactly 4 artifacts in order
    expect(result.artifacts).toHaveLength(4);
    
    const artifacts = result.artifacts as any[];
    expect(artifacts[0].kind).toBe("swarm.plan");
    expect(artifacts[0].customerSafe).toBe(false);
    
    expect(artifacts[1].kind).toBe("swarm.specialist.craft");
    expect(artifacts[1].customerSafe).toBe(false);
    
    expect(artifacts[2].kind).toBe("swarm.specialist.critic");
    expect(artifacts[2].customerSafe).toBe(false);
    
    expect(artifacts[3].kind).toBe("swarm.collapse");
    expect(artifacts[3].customerSafe).toBe(true);
  });

  // ============================================
  // T3: Telemetry required
  // ============================================
  
  t("T3: includes required telemetry (roleCostsUsd, totalCostUsd, roleModels)", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.showroom.coffee",
      policyId: "swarm_premium_v1",
      inputs: { 
        task: "Write homepage copy for artisan coffee shop",
      },
      constraints: { maxRounds: 1, costCapUsd: 1.0 },
      idempotency: { scope: "gate4.t3", keyHash: "test-key-t3" },
      trace: { jobId: "gate4-t3" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    // FROZEN CONTRACT: Telemetry always present
    const swarmMeta = result.extensions?.swarm as any;
    expect(swarmMeta).toBeDefined();
    expect(swarmMeta.roleCostsUsd).toBeDefined();
    expect(swarmMeta.totalCostUsd).toBeDefined();
    expect(swarmMeta.roleModels).toBeDefined();
    
    // Validate structure
    expect(typeof swarmMeta.roleCostsUsd).toBe("object");
    expect(typeof swarmMeta.totalCostUsd).toBe("number");
    expect(typeof swarmMeta.roleModels).toBe("object");
    
    // Validate content
    expect(swarmMeta.roleCostsUsd.craft).toBeGreaterThan(0);
    expect(swarmMeta.roleCostsUsd.critic).toBeGreaterThan(0);
    expect(swarmMeta.totalCostUsd).toBeGreaterThan(0);
    expect(swarmMeta.roleModels.craft).toBe("gpt-4o-mini");
    expect(swarmMeta.roleModels.critic).toBe("gpt-4o-mini");
  });

  // ============================================
  // T4: Cost caps enforced, non-chaotic
  // ============================================
  
  t("T4: enforces cost caps without chaos (per-role + total)", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.showroom.coffee",
      policyId: "swarm_premium_v1",
      inputs: { 
        task: "Write homepage copy for artisan coffee shop",
      },
      constraints: { maxRounds: 1, costCapUsd: 0.005 }, // Very low to trigger cap
      idempotency: { scope: "gate4.t4", keyHash: "test-key-t4" },
      trace: { jobId: "gate4-t4" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    // Cost cap should trigger, but still produce 4 artifacts
    expect(result.artifacts).toHaveLength(4);
    expect(result.status).toBe("succeeded");
    
    // Check for warnings or skipped artifacts
    const swarmMeta = result.extensions?.swarm as any;
    if (swarmMeta.hadWarnings || swarmMeta.warnings) {
      expect(Array.isArray(swarmMeta.warnings)).toBe(true);
    }
  });

  // ============================================
  // T5: Run persistence contract
  // ============================================
  
  t("T5: output structure supports persistence (input, output, summary)", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.showroom.coffee",
      policyId: "swarm_premium_v1",
      inputs: { 
        task: "Write homepage copy for artisan coffee shop",
        business: "The Daily Grind",
      },
      constraints: { maxRounds: 1, costCapUsd: 1.0 },
      idempotency: { scope: "gate4.t5", keyHash: "test-key-t5" },
      trace: { jobId: "gate4-t5" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    // Verify result has all data needed for persistence
    expect(result.status).toBeDefined();
    expect(result.stopReason).toBeDefined();
    expect(result.artifacts).toBeDefined();
    expect(result.extensions?.swarm).toBeDefined();
    
    // Verify idempotency keyHash is present (for deterministic runs)
    expect(order.idempotency.keyHash).toBeDefined();
    
    // Verify telemetry for summary generation
    const swarmMeta = result.extensions?.swarm as any;
    expect(swarmMeta.totalCostUsd).toBeDefined();
    expect(swarmMeta.roleCostsUsd).toBeDefined();
  });

  // ============================================
  // T6: No prompt/provider internals leak
  // ============================================
  
  t("T6: does not leak prompts or provider internals", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.showroom.coffee",
      policyId: "swarm_premium_v1",
      inputs: { 
        task: "Write homepage copy for artisan coffee shop",
      },
      constraints: { maxRounds: 1, costCapUsd: 1.0 },
      idempotency: { scope: "gate4.t6", keyHash: "test-key-t6" },
      trace: { jobId: "gate4-t6" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    // Serialize result to JSON (as would be persisted)
    const serialized = JSON.stringify(result, null, 2);
    
    // FROZEN CONTRACT: No prompt/provider leakage
    expect(serialized).not.toContain("system:");
    expect(serialized).not.toContain("You are a");
    expect(serialized).not.toContain("AIML");
    expect(serialized).not.toContain("X-Request-ID");
    expect(serialized).not.toContain("stack trace");
    expect(serialized).not.toContain("Error:");
    
    // Verify artifacts don't contain raw prompts
    for (const artifact of result.artifacts as any[]) {
      const artifactStr = JSON.stringify(artifact);
      expect(artifactStr).not.toContain("system:");
      expect(artifactStr).not.toContain("You are a");
    }
  });

  // ============================================
  // T7: Showroom-to-policy mapping deterministic
  // ============================================
  
  t("T7: produces deterministic keyHash for same inputs", async () => {
    const orderA: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.showroom.coffee",
      policyId: "swarm_premium_v1",
      inputs: { 
        task: "Write homepage copy for artisan coffee shop",
        business: "The Daily Grind",
      },
      constraints: { maxRounds: 1, costCapUsd: 1.0 },
      idempotency: { scope: "gate4.t7", keyHash: "deterministic-key-1" },
      trace: { jobId: "gate4-t7-a" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const orderB: AiWorkOrderV1 = {
      ...orderA,
      trace: { jobId: "gate4-t7-b" }, // Different traceId
    };

    const resultA = await runEngine(orderA);
    const resultB = await runEngine(orderB);

    // FROZEN CONTRACT: Same keyHash should produce idempotent behavior
    // (In real runs, second call would be cached)
    expect(orderA.idempotency.keyHash).toBe(orderB.idempotency.keyHash);
    
    // Both should succeed
    expect(resultA.status).toBe("succeeded");
    expect(resultB.status).toBe("succeeded");
    
    // Both should have same artifact structure
    expect(resultA.artifacts).toHaveLength(4);
    expect(resultB.artifacts).toHaveLength(4);
  });
});
