/**
 * Gate 2 Tripwire Tests — Specialist Intelligence
 * 
 * Verifies:
 * - Per-role cost cap enforcement
 * - Total cost cap enforcement
 * - Failure isolation (continue_with_warnings vs fail_fast)
 * - stopReason propagation to artifact payload
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SpecialistOutput } from "../specialists";
import { clearPolicyRegistry, registerPolicies } from "../policy/policyRegistry";

// Mock the specialists module BEFORE importing swarmRunner
vi.mock("../specialists", () => ({
  callSpecialistAIML: vi.fn(),
}));

// Import AFTER mock
import { runSwarmV1 } from "../swarmRunner";
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
        role: "craft",
        draft: { text: "draft copy v1" },
        stopReason: "ok",
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
        role: "critic",
        verdict: { pass: true, issues: [], suggestedFixes: [] },
        stopReason: "ok",
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

function mockFail(
  role: "craft" | "critic",
  stopReason: SpecialistOutput["stopReason"],
  costUsd = 0.0,
  overrides?: Partial<SpecialistOutput>
): SpecialistOutput {
  return {
    artifact: {
      kind: `swarm.specialist.${role}`,
      customerSafe: false,
      payload: {
        role,
        stopReason,
      },
    },
    meta: {
      model: "gpt-4o-mini",
      requestId: `req_${role}_fail`,
      latencyMs: 50,
      inputTokens: 10,
      outputTokens: 0,
      costUsd,
    },
    stopReason,
    ...overrides,
  } as SpecialistOutput;
}

// ============================================
// Test Policies
// ============================================

const testPolicies = [
  {
    policyId: "swarm_premium_v1",
    engineVersion: "v1",
    caps: {
      maxRounds: 3,
      costCapUsd: 4.0,
      maxTokensTotal: 16000,
    },
    routing: {
      requiredCaps: ["json_schema", "json_output"],
      preferredCaps: ["low_cost"],
    },
    swarm: {
      enabled: true,
      specialists: ["craft", "critic"],
      maxSwirlRounds: 1,
      collapseStrategy: "field_general",
      failureMode: "continue_with_warnings",
      roles: {
        craft: {
          transport: "aiml",
          model: "gpt-4o-mini",
          capabilities: ["json_output"],
        },
        critic: {
          transport: "aiml",
          model: "gpt-4o-mini",
          capabilities: ["json_output"],
        },
      },
      costCapsUsd: {
        perRole: {
          craft: 0.25,
          critic: 0.25,
        },
        total: 0.75,
      },
      timeoutsMs: {
        craft: 25000,
        critic: 25000,
      },
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
];

// ============================================
// Tests
// ============================================

describe("Gate 2: Specialist Intelligence Tripwires", () => {
  beforeEach(() => {
    clearPolicyRegistry();
    registerPolicies(testPolicies);
    vi.clearAllMocks();
  });

  it("1. both specialists succeed → ok", async () => {
    // Mock: craft ok, critic ok
    (callSpecialistAIML as any).mockImplementation(({ role }: { role: string }) => {
      if (role === "craft") return mockCraftOk();
      if (role === "critic") return mockCriticOk();
      throw new Error("unknown role");
    });

    const workOrder: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test",
      scope: "test.scope",
      policyId: "swarm_premium_v1",
      inputs: { test: "input" },
      constraints: { costCapUsd: 1.0, maxRounds: 2, maxTokensTotal: 8000 },
      idempotency: { scope: "test", keyHash: "hash1", ttlHours: 24 },
      trace: { jobId: "job1", step: "test" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runSwarmV1(workOrder, testPolicies[0] as any, { traceId: "trace1" });

    expect(result.status).toBe("succeeded");
    expect(result.stopReason).toBe("ok");
    expect(result.artifacts.length).toBe(4); // plan + craft + critic + collapse
  });

  it("2. swarm disabled → policy_invalid", async () => {
    const disabledPolicy = {
      ...testPolicies[0],
      policyId: "swarm_disabled",
      swarm: { ...testPolicies[0].swarm, enabled: false },
    };
    registerPolicies([disabledPolicy]);

    const workOrder: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test",
      scope: "test.scope",
      policyId: "swarm_disabled",
      inputs: { test: "input" },
      constraints: { costCapUsd: 1.0, maxRounds: 2, maxTokensTotal: 8000 },
      idempotency: { scope: "test", keyHash: "hash2", ttlHours: 24 },
      trace: { jobId: "job2", step: "test" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runSwarmV1(workOrder, disabledPolicy as any, { traceId: "trace2" });

    expect(result.status).toBe("failed");
    expect(result.stopReason).toBe("policy_invalid");
  });

  it("3. craft fails → critic runs → safe collapse (continue_with_warnings)", async () => {
    // Mock: craft fails, critic ok
    (callSpecialistAIML as any).mockImplementation(({ role }: { role: string }) => {
      if (role === "craft") return mockFail("craft", "provider_failed");
      if (role === "critic") return mockCriticOk();
      throw new Error("unknown role");
    });

    const workOrder: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test",
      scope: "test.scope",
      policyId: "swarm_premium_v1",
      inputs: { test: "input" },
      constraints: { costCapUsd: 1.0, maxRounds: 2, maxTokensTotal: 8000 },
      idempotency: { scope: "test", keyHash: "hash3", ttlHours: 24 },
      trace: { jobId: "job3", step: "test" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runSwarmV1(workOrder, testPolicies[0] as any, { traceId: "trace3" });

    expect(result.status).toBe("succeeded"); // continue_with_warnings
    expect(result.artifacts.length).toBe(4); // plan + craft + critic + collapse
    expect(result.artifacts[1].kind).toBe("swarm.specialist.craft");
    expect(result.artifacts[1].payload.stopReason).toBe("provider_failed");
    expect(result.artifacts[2].kind).toBe("swarm.specialist.critic");
    expect(result.artifacts[2].payload.stopReason).toBe("ok");
  });

  it("4. critic fails → safe collapse", async () => {
    // Mock: craft ok, critic fails
    (callSpecialistAIML as any).mockImplementation(({ role }: { role: string }) => {
      if (role === "craft") return mockCraftOk();
      if (role === "critic") return mockFail("critic", "provider_failed");
      throw new Error("unknown role");
    });

    const workOrder: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test",
      scope: "test.scope",
      policyId: "swarm_premium_v1",
      inputs: { test: "input" },
      constraints: { costCapUsd: 1.0, maxRounds: 2, maxTokensTotal: 8000 },
      idempotency: { scope: "test", keyHash: "hash4", ttlHours: 24 },
      trace: { jobId: "job4", step: "test" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runSwarmV1(workOrder, testPolicies[0] as any, { traceId: "trace4" });

    expect(result.status).toBe("succeeded"); // continue_with_warnings
    expect(result.artifacts.length).toBe(4); // plan + craft + critic + collapse
    expect(result.artifacts[1].kind).toBe("swarm.specialist.craft");
    expect(result.artifacts[1].payload.draft).toBeDefined();
    expect(result.artifacts[2].kind).toBe("swarm.specialist.critic");
    expect(result.artifacts[2].payload.stopReason).toBe("provider_failed");
  });

  it("5. per-role cap enforced", async () => {
    // Mock: craft exceeds per-role cap (0.25), critic ok
    (callSpecialistAIML as any).mockImplementation(({ role }: { role: string }) => {
      if (role === "craft") return mockCraftOk({ meta: { ...mockCraftOk().meta, costUsd: 0.30 } });
      if (role === "critic") return mockCriticOk();
      throw new Error("unknown role");
    });

    const workOrder: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test",
      scope: "test.scope",
      policyId: "swarm_premium_v1",
      inputs: { test: "input" },
      constraints: { costCapUsd: 1.0, maxRounds: 2, maxTokensTotal: 8000 },
      idempotency: { scope: "test", keyHash: "hash5", ttlHours: 24 },
      trace: { jobId: "job5", step: "test" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runSwarmV1(workOrder, testPolicies[0] as any, { traceId: "trace5" });

    expect(result.status).toBe("succeeded"); // continue_with_warnings
    expect(result.artifacts.length).toBe(4); // plan + craft + critic + collapse
    expect(result.artifacts[1].payload.stopReason).toBe("cost_cap_exceeded");
  });

  it("6. total cap enforced", async () => {
    // Mock: craft pushes total over cap (0.75)
    (callSpecialistAIML as any).mockImplementation(({ role }: { role: string }) => {
      if (role === "craft") return mockCraftOk({ meta: { ...mockCraftOk().meta, costUsd: 0.76 } });
      if (role === "critic") return mockCriticOk();
      throw new Error("unknown role");
    });

    const workOrder: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test",
      scope: "test.scope",
      policyId: "swarm_premium_v1",
      inputs: { test: "input" },
      constraints: { costCapUsd: 1.0, maxRounds: 2, maxTokensTotal: 8000 },
      idempotency: { scope: "test", keyHash: "hash6", ttlHours: 24 },
      trace: { jobId: "job6", step: "test" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runSwarmV1(workOrder, testPolicies[0] as any, { traceId: "trace6" });

    // continue_with_warnings: stops making calls, but succeeds with warnings tracked in extensions
    expect(result.status).toBe("succeeded");
    expect(result.stopReason).toBe("ok");
    expect(result.artifacts.length).toBe(3); // plan + craft + collapse (no critic)
    expect(result.artifacts[1].kind).toBe("swarm.specialist.craft");
  });

  it("7. idempotency unchanged (same CORE → same keyHash)", async () => {
    (callSpecialistAIML as any).mockImplementation(({ role }: { role: string }) => {
      if (role === "craft") return mockCraftOk();
      if (role === "critic") return mockCriticOk();
      throw new Error("unknown role");
    });

    const workOrder1: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test",
      scope: "test.scope",
      policyId: "swarm_premium_v1",
      inputs: { test: "input" },
      constraints: { costCapUsd: 1.0, maxRounds: 2, maxTokensTotal: 8000 },
      idempotency: { scope: "test", keyHash: "hash7", ttlHours: 24 },
      trace: { jobId: "job7", step: "test" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const workOrder2: AiWorkOrderV1 = {
      ...workOrder1,
      idempotency: { ...workOrder1.idempotency, keyHash: "hash7" }, // same keyHash
    };

    const result1 = await runSwarmV1(workOrder1, testPolicies[0] as any, { traceId: "trace7a" });
    const result2 = await runSwarmV1(workOrder2, testPolicies[0] as any, { traceId: "trace7b" });

    // Both should succeed (idempotency doesn't affect swarm execution in Gate 2)
    expect(result1.status).toBe("succeeded");
    expect(result2.status).toBe("succeeded");
  });

  it("8. no leakage in artifacts on provider failure", async () => {
    (callSpecialistAIML as any).mockImplementation(({ role }: { role: string }) => {
      if (role === "craft") return mockFail("craft", "provider_failed");
      if (role === "critic") return mockCriticOk();
      throw new Error("unknown role");
    });

    const workOrder: AiWorkOrderV1 = {
      version: "v1",
      tenant: "test",
      scope: "test.scope",
      policyId: "swarm_premium_v1",
      inputs: { test: "input" },
      constraints: { costCapUsd: 1.0, maxRounds: 2, maxTokensTotal: 8000 },
      idempotency: { scope: "test", keyHash: "hash8", ttlHours: 24 },
      trace: { jobId: "job8", step: "test" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runSwarmV1(workOrder, testPolicies[0] as any, { traceId: "trace8" });

    // All specialist artifacts should be customerSafe=false
    const specialistArtifacts = result.artifacts.filter((a) => a.kind.startsWith("swarm.specialist"));
    for (const artifact of specialistArtifacts) {
      expect(artifact.customerSafe).toBe(false);
    }

    // Only collapse should be customerSafe=true
    const collapseArtifact = result.artifacts.find((a) => a.kind === "swarm.collapse");
    expect(collapseArtifact?.customerSafe).toBe(true);
  });
});
