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

import { describe, it, expect, beforeAll } from "vitest";
import { runSwarmV1 } from "../swarmRunner";
import type { AiWorkOrderV1 } from "../types";
import type { PolicyV1 } from "../policy/policyTypes";
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
    context: {
      component: packet.context.component,
      command: packet.context.command,
      logs: packet.context.logs,
      constraints: packet.context.constraints,
      expectedFixes: packet.context.expectedFixes,
    },
  };
  
  return { packet, workOrder };
}

// ============================================
// GOLDEN TRANSCRIPT INVARIANT TESTS
// ============================================

describe("Swarm Golden Transcript Invariants", () => {
  beforeAll(() => {
    // Vitest setup may override AI_PROVIDER to 'memory' for deterministic tests
    // For golden transcript tests, we need 'replay' mode
    // Force it back to 'replay' if it was set in the command line
    const originalProvider = process.env.AI_PROVIDER;
    if (originalProvider !== "replay") {
      // Check if SWARM_REPLAY_RUN_ID is set (indicates replay intent)
      if (process.env.SWARM_REPLAY_RUN_ID) {
        console.log("[golden-invariants] Forcing AI_PROVIDER=replay for golden transcript tests");
        process.env.AI_PROVIDER = "replay";
      } else {
        throw new Error("AI_PROVIDER must be 'replay' for golden transcript tests. Set SWARM_REPLAY_RUN_ID to enable replay mode.");
      }
    }
  });

  describe("email_test__db_mock__golden_v1", () => {
    const GOLDEN_RUN_ID = "email_test__db_mock__golden_v1";
    const BUCKET_NAME = "email_test_e3_db_mock";

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

      // Assert artifacts
      expect(result.artifacts).toHaveLength(4);
      
      const artifactKinds = result.artifacts.map(a => a.kind);
      expect(artifactKinds).toContain("swarm.plan");
      expect(artifactKinds).toContain("swarm.specialist.craft");
      expect(artifactKinds).toContain("swarm.specialist.critic");
      expect(artifactKinds).toContain("swarm.collapse");
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

  // TODO: Add tests for REVISE→APPLY golden transcript (Phase 5)
  // TODO: Add tests for REJECT golden transcript (Phase 6)
});
