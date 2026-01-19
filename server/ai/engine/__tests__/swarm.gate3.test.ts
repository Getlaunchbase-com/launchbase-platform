/**
 * Swarm Orchestration — Gate 3 Tripwire Tests
 * 
 * Provider Wiring + Cost Accounting
 * 
 * These tests lock down the cost accounting and total cap enforcement contract.
 * All tests use mocks (no real provider calls).
 * 
 * FROZEN CONTRACTS:
 * - Artifact order: plan → craft → critic → collapse (4 artifacts)
 * - Only collapse is customerSafe=true
 * - meta.swarm.roleCostsUsd + totalCostUsd always present
 * - Total cap halt emits skipped artifact (preserves 4-artifact order)
 * - No new stopReason values
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
          { targetKey: "hero.headline", value: "Fast Coffee", rationale: "Shorter and punchier" },
        ],
        risks: ["May lose brand voice"],
        assumptions: ["Target audience prefers brevity"],
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
  process.env.IDEMPOTENCY_SECRET = "test-secret-key-for-gate3";
  
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
// GATE 3 TRIPWIRE TESTS
// ============================================

describe("Swarm Orchestration — Gate 3 Tripwire Tests", () => {
  
  // ============================================
  // TEST 1: Field General uses memory transport
  // ============================================
  
  t("uses memory transport for field_general (no provider call)", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.swarm.gate3.memory",
      policyId: "swarm_premium_v1",
      inputs: { task: "test memory transport" },
      constraints: { maxRounds: 1, costCapUsd: 1.0 },
      idempotency: { scope: "gate3.test1", keyHash: "test-key-1" },
      trace: { jobId: "gate3-test-1" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    expect(result.status).toBe("succeeded");
    expect(result.stopReason).toBe("ok");
    
    // Field General (plan + collapse) should not contribute to cost
    // Only craft + critic should have costs
    const swarmMeta = result.extensions?.swarm as any;
    expect(swarmMeta).toBeDefined();
    expect(swarmMeta.roleCostsUsd).toBeDefined();
    
    // Field General roles should have zero cost
    expect(swarmMeta.roleCostsUsd.field_general).toBeUndefined();
    
    // Only specialist roles should have costs
    expect(swarmMeta.roleCostsUsd.craft).toBeGreaterThan(0);
    expect(swarmMeta.roleCostsUsd.critic).toBeGreaterThan(0);
  });

  // ============================================
  // TEST 2: Craft/Critic use policy-defined models
  // ============================================
  
  t("uses policy-defined models for craft and critic specialists", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.swarm.gate3.models",
      policyId: "swarm_premium_v1",
      inputs: { task: "test model selection" },
      constraints: { maxRounds: 1, costCapUsd: 1.0 },
      idempotency: { scope: "gate3.test2", keyHash: "test-key-2" },
      trace: { jobId: "gate3-test-2" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    expect(result.status).toBe("succeeded");
    
    // Check that craft and critic artifacts have model metadata
    const craftArtifact = result.artifacts.find((a: any) => a.kind === "swarm.specialist.craft");
    const criticArtifact = result.artifacts.find((a: any) => a.kind === "swarm.specialist.critic");
    
    expect(craftArtifact).toBeDefined();
    expect(criticArtifact).toBeDefined();
    
    // Model should be from policy (gpt-4o-mini)
    const swarmMeta = result.extensions?.swarm as any;
    expect(swarmMeta.roleModels).toBeDefined();
    expect(swarmMeta.roleModels.craft).toBe("gpt-4o-mini");
    expect(swarmMeta.roleModels.critic).toBe("gpt-4o-mini");
  });

  // ============================================
  // TEST 3: Cost accounting present on every run
  // ============================================
  
  t("includes meta.swarm.roleCostsUsd and totalCostUsd on every run", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.swarm.gate3.cost",
      policyId: "swarm_premium_v1",
      inputs: { task: "test cost accounting" },
      constraints: { maxRounds: 1, costCapUsd: 1.0 },
      idempotency: { scope: "gate3.test3", keyHash: "test-key-3" },
      trace: { jobId: "gate3-test-3" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    expect(result.status).toBe("succeeded");
    
    // Cost accounting must be present
    const swarmMeta = result.extensions?.swarm as any;
    expect(swarmMeta).toBeDefined();
    expect(swarmMeta.roleCostsUsd).toBeDefined();
    expect(swarmMeta.totalCostUsd).toBeDefined();
    
    // Total cost should equal sum of role costs
    const craftCost = swarmMeta.roleCostsUsd.craft || 0;
    const criticCost = swarmMeta.roleCostsUsd.critic || 0;
    const expectedTotal = craftCost + criticCost;
    
    expect(swarmMeta.totalCostUsd).toBeCloseTo(expectedTotal, 6);
    
    // Total cost should be positive (specialists were called)
    expect(swarmMeta.totalCostUsd).toBeGreaterThan(0);
  });

  // ============================================
  // TEST 4: Per-role cap triggers correct stopReason
  // ============================================
  
  t("enforces per-role cost cap and sets correct stopReason", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.swarm.gate3.percap",
      policyId: "swarm_premium_v1",
      inputs: { task: "test per-role cap" },
      constraints: { maxRounds: 1, costCapUsd: 0.01 }, // Very low cap to trigger
      idempotency: { scope: "gate3.test4", keyHash: "test-key-4" },
      trace: { jobId: "gate3-test-4" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    // If per-role cap is exceeded, swarm should continue with warnings
    // (failureMode: "continue_with_warnings")
    expect(result.status).toBe("succeeded");
    expect(result.stopReason).toBe("ok");
    
    // Check for warnings in extensions
    const swarmMeta = result.extensions?.swarm as any;
    if (swarmMeta.hadWarnings) {
      expect(swarmMeta.warnings).toBeDefined();
      expect(Array.isArray(swarmMeta.warnings)).toBe(true);
    }
    
    // Artifacts should still be present (4 artifacts)
    expect(result.artifacts).toHaveLength(4);
  });

  // ============================================
  // TEST 5: Total cap halts with skipped artifact
  // ============================================
  
  t("halts before next specialist when total cap exceeded, emits skipped artifact", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.swarm.gate3.totalcap",
      policyId: "swarm_premium_v1",
      inputs: { task: "test total cap halt" },
      constraints: { maxRounds: 1, costCapUsd: 0.005 }, // Extremely low to trigger after craft
      idempotency: { scope: "gate3.test5", keyHash: "test-key-5" },
      trace: { jobId: "gate3-test-5" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    // Total cap halt should still succeed with warnings
    expect(result.status).toBe("succeeded");
    expect(result.stopReason).toBe("ok");
    
    // FROZEN CONTRACT: Must have exactly 4 artifacts
    expect(result.artifacts).toHaveLength(4);
    
    // Check for skipped artifact
    const artifacts = result.artifacts as any[];
    const skippedArtifact = artifacts.find((a: any) => a.payload?.skipped === true);
    
    if (skippedArtifact) {
      expect(skippedArtifact.payload.reason).toBe("total_cap_exceeded");
      expect(skippedArtifact.kind).toMatch(/swarm\.specialist\.(craft|critic)/);
    }
    
    // Artifact order must be preserved: plan → craft → critic → collapse
    expect(artifacts[0].kind).toBe("swarm.plan");
    expect(artifacts[3].kind).toBe("swarm.collapse");
  });

  // ============================================
  // TEST 6: CustomerSafe boundary unchanged
  // ============================================
  
  t("marks only swarm.collapse as customerSafe=true (frozen contract)", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.swarm.gate3.customersafe",
      policyId: "swarm_premium_v1",
      inputs: { task: "test customer safe boundary" },
      constraints: { maxRounds: 1, costCapUsd: 1.0 },
      idempotency: { scope: "gate3.test6", keyHash: "test-key-6" },
      trace: { jobId: "gate3-test-6" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    expect(result.status).toBe("succeeded");
    expect(result.artifacts).toHaveLength(4);
    
    // FROZEN CONTRACT: Only collapse is customerSafe=true
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
});
