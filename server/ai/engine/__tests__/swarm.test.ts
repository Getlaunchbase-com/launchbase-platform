/**
 * Swarm Tripwire Tests — Gate 1 Contract Locks
 * 
 * Ensures swarm orchestration behavior is frozen and predictable.
 * 
 * Required tests:
 * 1. Policy toggle (swarm disabled → no swarm artifacts)
 * 2. Artifact order frozen (exact kinds in exact order)
 * 3. Customer safety invariant (only collapse is customerSafe=true)
 * 4. Idempotency unchanged (same CORE → same keyHash)
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { SpecialistOutput } from "../specialists";
import { registerPolicies, clearPolicyRegistry } from "../policy/policyRegistry";
import { ALL_POLICIES } from "../policy/policyBundle";
import type { AiWorkOrderV1 } from "../types";

// Mock the specialists module BEFORE importing runEngine
vi.mock("../specialists", () => ({
  callSpecialistAIML: vi.fn(),
}));

// Import AFTER mock
import { runEngine, computeWorkOrderKeyV1 } from "../runEngine";
import { callSpecialistAIML } from "../specialists";

// Mock helper functions
function mockCraftOk(): SpecialistOutput {
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
  } as SpecialistOutput;
}

function mockCriticOk(): SpecialistOutput {
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
  } as SpecialistOutput;
}

// Set up environment
beforeAll(() => {
  process.env.IDEMPOTENCY_SECRET = "test-secret-do-not-use-in-production";
  clearPolicyRegistry();
  registerPolicies(ALL_POLICIES);
});

beforeEach(() => {
  vi.clearAllMocks();
  // Mock specialists to return valid payloads
  (callSpecialistAIML as any).mockImplementation(({ role }: { role: string }) => {
    if (role === "craft") return mockCraftOk();
    if (role === "critic") return mockCriticOk();
    throw new Error("unknown role");
  });
});

describe("Swarm Orchestration — Gate 1 Tripwire Tests", () => {
  // ============================================
  // TEST 1: Policy toggle behavior
  // ============================================

  it("produces no swarm artifacts when swarm disabled", async () => {
    const workOrder: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test-tenant",
      scope: "test.copy_refine",
      policyId: "launchbase_portal_v1", // Non-swarm policy
      inputs: {
        userTextHash: "sha256:abc123",
        targetKey: "hero.headline",
      },
      constraints: {
        costCapUsd: 1.0,
        maxRounds: 2,
        maxTokensTotal: 10000,
      },
      idempotency: {
        scope: "test.copy_refine",
        keyHash: "placeholder", // Will be computed
        ttlHours: 24,
      },
      trace: {
        jobId: "job_test_001",
      },
      audit: {
        customerTrailOn: true,
        internalTrailOn: true,
      },
    };

    // Compute real keyHash
    workOrder.idempotency.keyHash = computeWorkOrderKeyV1(workOrder);

    const result = await runEngine(workOrder);

    // Should not have swarm artifacts
    const swarmArtifacts = result.artifacts.filter(a => a.kind.startsWith("swarm."));
    expect(swarmArtifacts.length).toBe(0);
  });

  it("produces exactly 4 swarm artifacts when swarm enabled", async () => {
    const workOrder: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test-tenant",
      scope: "test.copy_refine",
      policyId: "swarm_premium_v1", // Swarm policy
      inputs: {
        userTextHash: "sha256:abc123",
        targetKey: "hero.headline",
      },
      constraints: {
        costCapUsd: 3.0,
        maxRounds: 3,
        maxTokensTotal: 15000, // Within policy cap (16000)
      },
      idempotency: {
        scope: "test.copy_refine",
        keyHash: "placeholder",
        ttlHours: 24,
      },
      trace: {
        jobId: "job_test_002",
      },
      audit: {
        customerTrailOn: true,
        internalTrailOn: true,
      },
    };

    workOrder.idempotency.keyHash = computeWorkOrderKeyV1(workOrder);

    const result = await runEngine(workOrder);

    // Should have exactly 4 swarm artifacts
    const swarmArtifacts = result.artifacts.filter(a => a.kind.startsWith("swarm."));
    expect(swarmArtifacts.length).toBe(4);
  });

  // ============================================
  // TEST 2: Artifact order frozen
  // ============================================

  it("produces swarm artifacts in exact order: plan, craft, critic, collapse", async () => {
    const workOrder: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test-tenant",
      scope: "test.copy_refine",
      policyId: "swarm_premium_v1",
      inputs: {
        userTextHash: "sha256:abc123",
        targetKey: "hero.headline",
      },
      constraints: {
        costCapUsd: 3.0,
        maxRounds: 3,
        maxTokensTotal: 15000, // Within policy cap (16000)
      },
      idempotency: {
        scope: "test.copy_refine",
        keyHash: "placeholder",
        ttlHours: 24,
      },
      trace: {
        jobId: "job_test_003",
      },
      audit: {
        customerTrailOn: true,
        internalTrailOn: true,
      },
    };

    workOrder.idempotency.keyHash = computeWorkOrderKeyV1(workOrder);

    const result = await runEngine(workOrder);

    // Extract swarm artifact kinds
    const swarmKinds = result.artifacts
      .filter(a => a.kind.startsWith("swarm."))
      .map(a => a.kind);

    // Exact order required
    expect(swarmKinds).toEqual([
      "swarm.plan",
      "swarm.specialist.craft",
      "swarm.specialist.critic",
      "swarm.collapse",
    ]);
  });

  // ============================================
  // TEST 3: Customer safety invariant
  // ============================================

  it("marks only swarm.collapse as customerSafe=true", async () => {
    const workOrder: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test-tenant",
      scope: "test.copy_refine",
      policyId: "swarm_premium_v1",
      inputs: {
        userTextHash: "sha256:abc123",
        targetKey: "hero.headline",
      },
      constraints: {
        costCapUsd: 3.0,
        maxRounds: 3,
        maxTokensTotal: 15000, // Within policy cap (16000)
      },
      idempotency: {
        scope: "test.copy_refine",
        keyHash: "placeholder",
        ttlHours: 24,
      },
      trace: {
        jobId: "job_test_004",
      },
      audit: {
        customerTrailOn: true,
        internalTrailOn: true,
      },
    };

    workOrder.idempotency.keyHash = computeWorkOrderKeyV1(workOrder);

    const result = await runEngine(workOrder);

    // Check customerSafe flags
    const swarmArtifacts = result.artifacts.filter(a => a.kind.startsWith("swarm."));

    expect(swarmArtifacts[0].kind).toBe("swarm.plan");
    expect(swarmArtifacts[0].customerSafe).toBe(false);

    expect(swarmArtifacts[1].kind).toBe("swarm.specialist.craft");
    expect(swarmArtifacts[1].customerSafe).toBe(false);

    expect(swarmArtifacts[2].kind).toBe("swarm.specialist.critic");
    expect(swarmArtifacts[2].customerSafe).toBe(false);

    expect(swarmArtifacts[3].kind).toBe("swarm.collapse");
    expect(swarmArtifacts[3].customerSafe).toBe(true); // ONLY customerSafe artifact
  });

  // ============================================
  // TEST 4: Idempotency unchanged
  // ============================================

  it("produces same keyHash for same CORE inputs", () => {
    const workOrder1: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test-tenant",
      scope: "test.copy_refine",
      policyId: "swarm_premium_v1",
      inputs: {
        userTextHash: "sha256:abc123",
        targetKey: "hero.headline",
      },
      constraints: {
        costCapUsd: 3.0,
        maxRounds: 3,
        maxTokensTotal: 15000, // Within policy cap (16000)
      },
      idempotency: {
        scope: "test.copy_refine",
        keyHash: "placeholder",
        ttlHours: 24,
      },
      trace: {
        jobId: "job_test_005a",
      },
      audit: {
        customerTrailOn: true,
        internalTrailOn: true,
      },
    };

    const workOrder2: AiWorkOrderV1 = {
      ...workOrder1,
      trace: {
        jobId: "job_test_005b", // Different trace, same CORE
      },
    };

    const key1 = computeWorkOrderKeyV1(workOrder1);
    const key2 = computeWorkOrderKeyV1(workOrder2);

    expect(key1).toBe(key2); // Same CORE → same keyHash
  });

  it("produces different keyHash for different CORE inputs", () => {
    const workOrder1: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test-tenant",
      scope: "test.copy_refine",
      policyId: "swarm_premium_v1",
      inputs: {
        userTextHash: "sha256:abc123",
        targetKey: "hero.headline",
      },
      constraints: {
        costCapUsd: 3.0,
        maxRounds: 3,
        maxTokensTotal: 15000, // Within policy cap (16000)
      },
      idempotency: {
        scope: "test.copy_refine",
        keyHash: "placeholder",
        ttlHours: 24,
      },
      trace: {
        jobId: "job_test_006a",
      },
      audit: {
        customerTrailOn: true,
        internalTrailOn: true,
      },
    };

    const workOrder2: AiWorkOrderV1 = {
      ...workOrder1,
      inputs: {
        userTextHash: "sha256:xyz789", // Different input hash
        targetKey: "hero.headline",
      },
    };

    const key1 = computeWorkOrderKeyV1(workOrder1);
    const key2 = computeWorkOrderKeyV1(workOrder2);

    expect(key1).not.toBe(key2); // Different CORE → different keyHash
  });

  // ============================================
  // TEST 5: stopReason always present
  // ============================================

  it("includes stopReason in successful swarm execution", async () => {
    const workOrder: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test-tenant",
      scope: "test.copy_refine",
      policyId: "swarm_premium_v1",
      inputs: {
        userTextHash: "sha256:abc123",
        targetKey: "hero.headline",
      },
      constraints: {
        costCapUsd: 3.0,
        maxRounds: 3,
        maxTokensTotal: 15000, // Within policy cap (16000)
      },
      idempotency: {
        scope: "test.copy_refine",
        keyHash: "placeholder",
        ttlHours: 24,
      },
      trace: {
        jobId: "job_test_007",
      },
      audit: {
        customerTrailOn: true,
        internalTrailOn: true,
      },
    };

    workOrder.idempotency.keyHash = computeWorkOrderKeyV1(workOrder);

    const result = await runEngine(workOrder);

    // stopReason must always be present
    expect(result.stopReason).toBeDefined();
    expect(result.stopReason).toBe("ok"); // Success case
    expect(result.status).toBe("succeeded");
  });
});
