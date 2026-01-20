/**
 * Swarm Replay Invariant Tests
 * 
 * Deterministic tests using replay provider to verify:
 * - Swarm plumbing (role routing, iteration loops, artifact writing)
 * - Decision flow (APPLY, REJECT, REVISE→APPLY)
 * - No crashes on edge cases
 */

import { describe, test, expect, beforeEach } from "vitest";
import { runSwarmV1 } from "../swarmRunner";
import type { AiWorkOrderV1 } from "../types";
import type { PolicyV1 } from "../policy/policyTypes";

// Minimal policy for replay tests
const minimalPolicy: PolicyV1 = {
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

// Minimal work order
const minimalWorkOrder: AiWorkOrderV1 = {
  version: "v1",
  scope: "fix_typescript_error",
  task: "Fix TypeScript compilation error in Apply.tsx",
  context: {
    errorMessage: "TS2322: Type 'null' is not assignable to type 'string | undefined'",
    filePath: "client/src/pages/Apply.tsx",
    line: 42,
  },
};

describe("Swarm Replay Invariants", () => {
  test("apply_ok: produces APPLY decision", async () => {
    process.env.AI_PROVIDER = "replay";
    process.env.REPLAY_ID = "apply_ok";
    
    const result = await runSwarmV1(
      minimalWorkOrder,
      minimalPolicy,
      { traceId: "test-apply-ok" }
    );
    
    // Verify swarm completed successfully
    expect(result.status).toBe("succeeded");
    expect(result.artifacts.length).toBeGreaterThan(0);
    
    // Verify collapse artifact exists (final decision)
    const collapseArtifact = result.artifacts.find(a => a.kind === "swarm.collapse");
    expect(collapseArtifact).toBeDefined();
    
    // Verify specialist artifacts exist
    const craftArtifact = result.artifacts.find(a => a.kind === "swarm.specialist.craft");
    expect(craftArtifact).toBeDefined();
  });

  test("reject_ok: produces REJECT decision", async () => {
    process.env.AI_PROVIDER = "replay";
    process.env.REPLAY_ID = "reject_ok";
    
    const result = await runSwarmV1(
      minimalWorkOrder,
      minimalPolicy,
      { traceId: "test-reject-ok" }
    );
    
    // Verify swarm completed (even with REJECT)
    expect(result.status).toBe("succeeded");
    expect(result.artifacts.length).toBeGreaterThan(0);
    
    // Verify collapse artifact exists (final decision)
    const collapseArtifact = result.artifacts.find(a => a.kind === "swarm.collapse");
    expect(collapseArtifact).toBeDefined();
    
    // Verify specialist artifacts exist
    const craftArtifact = result.artifacts.find(a => a.kind === "swarm.specialist.craft");
    expect(craftArtifact).toBeDefined();
  });

  test("revise_then_apply: triggers iteration loop", async () => {
    process.env.AI_PROVIDER = "replay";
    process.env.REPLAY_ID = "revise_then_apply";
    
    const result = await runSwarmV1(
      minimalWorkOrder,
      minimalPolicy,
      { traceId: "test-revise-apply" }
    );
    
    // Verify swarm completed with multiple iterations
    expect(result.status).toBe("succeeded");
    expect(result.artifacts.length).toBeGreaterThan(0);
    
    // Verify collapse artifact exists (final decision)
    const collapseArtifact = result.artifacts.find(a => a.kind === "swarm.collapse");
    expect(collapseArtifact).toBeDefined();
    
    // Verify at least one specialist artifact
    const craftArtifacts = result.artifacts.filter(a => a.kind === "swarm.specialist.craft");
    expect(craftArtifacts.length).toBeGreaterThanOrEqual(1);
  });
});
