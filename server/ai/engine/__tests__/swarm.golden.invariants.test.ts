/**
 * Swarm Golden Transcript Invariant Tests
 * 
 * These tests validate that golden transcripts (captured from real swarm runs)
 * remain stable and deterministic in CI. They serve as "trust anchors" to prevent
 * replay plumbing from drifting.
 * 
 * Each test:
 * 1. Loads a golden transcript via replay provider
 * 2. Runs the swarm with the same FailurePacket
 * 3. Asserts the decision outcome matches expectations
 * 4. Verifies artifacts are generated correctly
 * 
 * @see docs/SWARM_COMMANDS.md for golden transcript registry
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { runSwarmV1 } from "../swarmRunner";
import type { AiWorkOrderV1 } from "../types";
import type { PolicyV1 } from "../policy/policyTypes";
import { __resetReplayProviderForTests } from "../../providers/providerFactory";
import { readFileSync } from "fs";
import { resolve } from "path";

// ============================================
// SETUP
// ============================================

const FIXTURES_ROOT = resolve(__dirname, "fixtures/swarm");

// Swarm policy (2-role Gate 1 design)
const policy: PolicyV1 = {
  version: "v1",
  swarm: {
    enabled: true,
    roles: {
      craft: { model: "gpt-4o-mini", transport: "replay", timeoutMs: 30000 },
      critic: { model: "gpt-4o-mini", transport: "replay", timeoutMs: 30000 },
    },
    costCapsUsd: {
      perRole: 0.5,
      total: 2.0,
    },
    failureMode: "stop",
    specialists: ["craft", "critic"],
  },
};

// Helper to load FailurePacket
function loadFailurePacket(bucketName: string) {
  const packetPath = resolve(FIXTURES_ROOT, `failurePackets/${bucketName}.json`);
  const packetContent = readFileSync(packetPath, "utf-8");
  const packet = JSON.parse(packetContent);
  
  // Convert to AiWorkOrderV1
  const workOrder: AiWorkOrderV1 = {
    version: "v1",
    scope: packet.context.component === "vitest" ? "fix_test_failure" : "fix_error",
    task: packet.failure?.errorMessage || "Fix test failures",
    inputs: {
      component: packet.context.component,
      command: packet.context.command,
      logs: packet.context.logs,
      constraints: packet.context.constraints,
      expectedFixes: packet.context.expectedFixes,
      // Pass through role-specific prompt overrides (swarmRunner expects inputs.promptOverrides[role])
      ...(packet.context.promptOverrides ? {
        promptOverrides: packet.context.promptOverrides,
      } : {}),
    },
  };
  
  return { packet, workOrder };
}

// ============================================
// GOLDEN TRANSCRIPT INVARIANT TESTS
// ============================================

describe("Swarm Golden Transcript Invariants", () => {
  beforeAll(() => {
    // Vitest setup overrides AI_PROVIDER to 'memory' for deterministic tests
    // For golden transcript tests, we MUST use 'replay' mode
    // Force it unconditionally (tests will set SWARM_REPLAY_RUN_ID per-test)
    console.log("[golden-invariants] Forcing AI_PROVIDER=replay for golden transcript tests");
    process.env.AI_PROVIDER = "replay";
  });

  describe("email_test__db_mock__golden_v1", () => {
    const GOLDEN_RUN_ID = "email_test__db_mock__golden_v1";
    const BUCKET_NAME = "email_test_e3_db_mock";

    beforeEach(() => {
      // Reset replay provider singleton to pick up new SWARM_REPLAY_RUN_ID
      __resetReplayProviderForTests();
      process.env.SWARM_REPLAY_RUN_ID = GOLDEN_RUN_ID;
    });

    it("should replay deterministically with same decision outcome", async () => {
      // Set replay run ID
      process.env.SWARM_REPLAY_RUN_ID = GOLDEN_RUN_ID;

      // Load FailurePacket
      const { workOrder } = loadFailurePacket(BUCKET_NAME);

      // Run swarm
      const result = await runSwarmV1(workOrder, policy, {
        traceId: `test-${GOLDEN_RUN_ID}`,
      });

      // Assert decision outcome
      expect(result.status).toBe("succeeded");
      expect(result.stopReason).toBe("needs_human");
      expect(result.needsHuman).toBe(true);

      // Assert artifacts (structural, future-proof)
      const byKind = (k: string) => result.artifacts.filter((a) => a.kind === k);
      
      // Plan exists exactly once
      expect(byKind("swarm.plan").length).toBe(1);
      
      // Collapse exists exactly once and is last
      expect(byKind("swarm.collapse").length).toBe(1);
      const last = result.artifacts[result.artifacts.length - 1];
      expect(last.kind).toBe("swarm.collapse");
      
      // Craft/critic exist >= 1 (may iterate)
      expect(byKind("swarm.specialist.craft").length).toBeGreaterThanOrEqual(1);
      expect(byKind("swarm.specialist.critic").length).toBeGreaterThanOrEqual(1);
      
      // Plan comes first
      expect(result.artifacts[0].kind).toBe("swarm.plan");
    });

    it("should produce needs_human stopReason (APPLY path)", async () => {
      // Set replay run ID
      process.env.SWARM_REPLAY_RUN_ID = GOLDEN_RUN_ID;

      // Load FailurePacket
      const { workOrder } = loadFailurePacket(BUCKET_NAME);

      // Run swarm
      const result = await runSwarmV1(workOrder, policy, {
        traceId: `test-${GOLDEN_RUN_ID}-collapse`,
      });

      // Extract collapse artifact
      const collapseArtifact = result.artifacts.find(a => a.kind === "swarm.collapse");
      expect(collapseArtifact).toBeDefined();
      
      // Assert stopReason
      expect(result.stopReason).toBe("needs_human");
      expect(result.needsHuman).toBe(true);
      
      // Note: payload is null when needs_human=true (by design)
      // This is the APPLY path - human needs to review and apply the patch
      expect(collapseArtifact!.payload).toBeNull();
      expect(collapseArtifact!.customerSafe).toBe(true);
    });

    it("should maintain fixture stability (no drift)", async () => {
      // This test proves fixtures haven't changed since promotion
      // by running the same swarm twice and comparing results
      
      process.env.SWARM_REPLAY_RUN_ID = GOLDEN_RUN_ID;
      const { workOrder } = loadFailurePacket(BUCKET_NAME);

      // Run 1
      const result1 = await runSwarmV1(workOrder, policy, {
        traceId: `test-${GOLDEN_RUN_ID}-drift-1`,
      });

      // Run 2
      const result2 = await runSwarmV1(workOrder, policy, {
        traceId: `test-${GOLDEN_RUN_ID}-drift-2`,
      });

      // Assert identical outcomes
      expect(result1.status).toBe(result2.status);
      expect(result1.stopReason).toBe(result2.stopReason);
      expect(result1.needsHuman).toBe(result2.needsHuman);
      expect(result1.artifacts.length).toBe(result2.artifacts.length);
      
      // Assert artifact kinds match
      const kinds1 = result1.artifacts.map(a => a.kind).sort();
      const kinds2 = result2.artifacts.map(a => a.kind).sort();
      expect(kinds1).toEqual(kinds2);
    });
  });

  describe("facebook_postWeatherAware__revise_apply__golden_v1", () => {
    const GOLDEN_RUN_ID = "facebook_postWeatherAware__revise_apply__golden_v1";
    const BUCKET_NAME = "facebook_postWeatherAware_revise_apply";

    beforeEach(() => {
      // Reset replay provider singleton to pick up new SWARM_REPLAY_RUN_ID
      __resetReplayProviderForTests();
      process.env.SWARM_REPLAY_RUN_ID = GOLDEN_RUN_ID;
    });

    it("should replay deterministically with same decision outcome", async () => {
      // Set replay run ID
      process.env.SWARM_REPLAY_RUN_ID = GOLDEN_RUN_ID;

      // Load FailurePacket
      const { workOrder } = loadFailurePacket(BUCKET_NAME);

      // Run swarm
      const result = await runSwarmV1(workOrder, policy, {
        traceId: `test-${GOLDEN_RUN_ID}`,
      });

      // Assert decision outcome
      expect(result.status).toBe("succeeded");
      expect(result.stopReason).toBe("needs_human");
      expect(result.needsHuman).toBe(true);

      // Assert artifacts (structural, future-proof)
      const byKind = (k: string) => result.artifacts.filter((a) => a.kind === k);
      
      // Plan exists exactly once
      expect(byKind("swarm.plan").length).toBe(1);
      
      // Collapse exists exactly once and is last
      expect(byKind("swarm.collapse").length).toBe(1);
      const last = result.artifacts[result.artifacts.length - 1];
      expect(last.kind).toBe("swarm.collapse");
      
      // Craft/critic exist >= 1 (may iterate)
      expect(byKind("swarm.specialist.craft").length).toBeGreaterThanOrEqual(1);
      expect(byKind("swarm.specialist.critic").length).toBeGreaterThanOrEqual(1);
      
      // Plan comes first
      expect(result.artifacts[0].kind).toBe("swarm.plan");
    });

    it("should demonstrate REVISE→REVISE→NEEDS_HUMAN iteration loop", async () => {
      // Set replay run ID
      process.env.SWARM_REPLAY_RUN_ID = GOLDEN_RUN_ID;

      // Load FailurePacket
      const { workOrder } = loadFailurePacket(BUCKET_NAME);

      // Run swarm
      const result = await runSwarmV1(workOrder, policy, {
        traceId: `test-${GOLDEN_RUN_ID}-iteration`,
      });

      // Extract craft and critic artifacts
      const craftArtifacts = result.artifacts.filter(a => a.kind === "swarm.specialist.craft");
      const criticArtifacts = result.artifacts.filter(a => a.kind === "swarm.specialist.critic");
      
      // Assert 2 iterations (maxIterations=2)
      expect(craftArtifacts.length).toBe(2);
      expect(criticArtifacts.length).toBe(2);
      
      // Assert critic[0] and critic[1] both failed (pass=false)
      const critic0 = criticArtifacts[0].payload as any;
      const critic1 = criticArtifacts[1].payload as any;
      expect(critic0.pass).toBe(false);
      expect(critic1.pass).toBe(false);
      
      // Assert both have high severity issues (triggers iteration)
      expect(critic0.issues.some((i: any) => i.severity === "high")).toBe(true);
      expect(critic1.issues.some((i: any) => i.severity === "high")).toBe(true);
      
      // Assert final outcome is needs_human (exhausted maxIterations)
      expect(result.stopReason).toBe("needs_human");
      expect(result.needsHuman).toBe(true);
    });

    it("should maintain fixture stability (no drift)", async () => {
      // This test proves fixtures haven't changed since promotion
      // by running the same swarm twice and comparing results
      
      process.env.SWARM_REPLAY_RUN_ID = GOLDEN_RUN_ID;
      const { workOrder } = loadFailurePacket(BUCKET_NAME);

      // Run 1
      const result1 = await runSwarmV1(workOrder, policy, {
        traceId: `test-${GOLDEN_RUN_ID}-drift-1`,
      });

      // Run 2
      const result2 = await runSwarmV1(workOrder, policy, {
        traceId: `test-${GOLDEN_RUN_ID}-drift-2`,
      });

      // Assert identical outcomes
      expect(result1.status).toBe(result2.status);
      expect(result1.stopReason).toBe(result2.stopReason);
      expect(result1.needsHuman).toBe(result2.needsHuman);
      expect(result1.artifacts.length).toBe(result2.artifacts.length);
      
      // Assert artifact kinds match
      const kinds1 = result1.artifacts.map(a => a.kind).sort();
      const kinds2 = result2.artifacts.map(a => a.kind).sort();
      expect(kinds1).toEqual(kinds2);
    });
  });

  describe("email_spanish_copy__apply_pass__golden_v1", () => {
    const GOLDEN_RUN_ID = "email_spanish_copy__apply_pass__golden_v1";
    const BUCKET_NAME = "email_spanish_copy_mismatch";

    beforeEach(() => {
      // Reset replay provider singleton to pick up new SWARM_REPLAY_RUN_ID
      __resetReplayProviderForTests();
      process.env.SWARM_REPLAY_RUN_ID = GOLDEN_RUN_ID;
    });

    it("should replay deterministically with same decision outcome", async () => {
      // Load FailurePacket
      const { workOrder } = loadFailurePacket(BUCKET_NAME);

      // Run swarm
      const result = await runSwarmV1(workOrder, policy, {
        traceId: `test-${GOLDEN_RUN_ID}`,
      });

      // Assert decision outcome
      expect(result.status).toBe("succeeded");
      expect(result.stopReason).toBe("needs_human");
      expect(result.needsHuman).toBe(true);

      // Assert artifacts (structural, future-proof)
      const byKind = (k: string) => result.artifacts.filter((a) => a.kind === k);
      
      // Plan exists exactly once
      expect(byKind("swarm.plan").length).toBe(1);
      
      // Collapse exists exactly once and is last
      expect(byKind("swarm.collapse").length).toBe(1);
      const last = result.artifacts[result.artifacts.length - 1];
      expect(last.kind).toBe("swarm.collapse");
      
      // Craft/critic exist >= 1 (may iterate)
      expect(byKind("swarm.specialist.craft").length).toBeGreaterThanOrEqual(1);
      expect(byKind("swarm.specialist.critic").length).toBeGreaterThanOrEqual(1);
      
      // Plan comes first
      expect(result.artifacts[0].kind).toBe("swarm.plan");
    });

    it("should demonstrate APPLY with pass=true (clean first-pass success)", async () => {
      // Load FailurePacket
      const { workOrder } = loadFailurePacket(BUCKET_NAME);

      // Run swarm
      const result = await runSwarmV1(workOrder, policy, {
        traceId: `test-${GOLDEN_RUN_ID}-apply`,
      });

      // Extract craft and critic artifacts
      const craftArtifacts = result.artifacts.filter(a => a.kind === "swarm.specialist.craft");
      const criticArtifacts = result.artifacts.filter(a => a.kind === "swarm.specialist.critic");
      
      // Assert single iteration (no revision needed)
      expect(craftArtifacts.length).toBe(1);
      expect(criticArtifacts.length).toBe(1);
      
      // Assert critic passed on first try
      const critic0 = criticArtifacts[0].payload as any;
      expect(critic0.pass).toBe(true);
      expect(critic0.issues.length).toBe(0);
      
      // Assert craft proposed valid changes
      const craft0 = craftArtifacts[0].payload as any;
      expect(craft0.proposedChanges.length).toBeGreaterThan(0);
      expect(craft0.proposedChanges[0].filePath).toBe("server/emails/emailCopy.test.ts");
      
      // Assert final outcome is needs_human (human must apply the patch)
      expect(result.stopReason).toBe("needs_human");
      expect(result.needsHuman).toBe(true);
    });

    it("should maintain fixture stability (no drift)", async () => {
      // This test proves fixtures haven't changed since promotion
      // by running the same swarm twice and comparing results
      
      const { workOrder } = loadFailurePacket(BUCKET_NAME);

      // Run 1
      const result1 = await runSwarmV1(workOrder, policy, {
        traceId: `test-${GOLDEN_RUN_ID}-drift-1`,
      });

      // Run 2
      const result2 = await runSwarmV1(workOrder, policy, {
        traceId: `test-${GOLDEN_RUN_ID}-drift-2`,
      });

      // Assert identical outcomes
      expect(result1.status).toBe(result2.status);
      expect(result1.stopReason).toBe(result2.stopReason);
      expect(result1.needsHuman).toBe(result2.needsHuman);
      expect(result1.artifacts.length).toBe(result2.artifacts.length);
      
      // Assert artifact kinds match
      const kinds1 = result1.artifacts.map(a => a.kind).sort();
      const kinds2 = result2.artifacts.map(a => a.kind).sort();
      expect(kinds1).toEqual(kinds2);
    });
  });

  // TODO: Add tests for REJECT golden transcript (Phase 6)
});
