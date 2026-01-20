#!/usr/bin/env tsx
/**
 * Capture Golden Transcript
 * 
 * Runs a real swarm workflow with SWARM_RECORD=1 to capture AI responses
 * as fixtures for deterministic replay testing.
 * 
 * Usage:
 *   REPLAY_ID=ts_bucket_real pnpm tsx scripts/swarm/captureGolden.ts
 * 
 * Environment Variables:
 *   REPLAY_ID: Scenario name (default: golden_1)
 *   AI_PROVIDER: Must be "replay" (with SWARM_RECORD=1 for recording)
 *   SWARM_RECORD: Must be "1" to enable recording mode
 */

import { runSwarmV1 } from "../../server/ai/engine/swarmRunner";
import type { AiWorkOrderV1 } from "../../server/ai/engine/types";
import type { PolicyV1 } from "../../server/ai/engine/policy/policyTypes";

// ============================================
// CONFIGURATION
// ============================================

const REPLAY_ID = process.env.REPLAY_ID ?? "golden_1";
const AI_PROVIDER = process.env.AI_PROVIDER ?? "replay";
const SWARM_RECORD = process.env.SWARM_RECORD ?? "0";

if (AI_PROVIDER !== "replay") {
  console.error("❌ AI_PROVIDER must be 'replay' for recording");
  console.error("   Usage: AI_PROVIDER=replay SWARM_RECORD=1 pnpm tsx scripts/swarm/captureGolden.ts");
  process.exit(1);
}

if (SWARM_RECORD !== "1") {
  console.error("❌ SWARM_RECORD must be '1' to enable recording");
  console.error("   Usage: AI_PROVIDER=replay SWARM_RECORD=1 pnpm tsx scripts/swarm/captureGolden.ts");
  process.exit(1);
}

// ============================================
// SWARM POLICY (2-role Gate 1 design)
// ============================================

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

// ============================================
// WORK ORDER (Real TypeScript error scenario)
// ============================================

const workOrder: AiWorkOrderV1 = {
  version: "v1",
  scope: "fix_typescript_error",
  task: "Fix TypeScript compilation error in swarmRunner.ts",
  context: {
    errorMessage: "TS2698: Spread types may only be created from object types",
    filePath: "server/ai/engine/swarmRunner.ts",
    line: 131,
    code: `
      artifacts.push({
        kind: \`swarm.specialist.\${specialist}\`,
        customerSafe: false,
        payload: {
          ...(typeof result.artifact.payload === "object" && result.artifact.payload !== null ? result.artifact.payload : {}),
          role: specialist,
          stopReason: "cost_cap_exceeded",
          meta: result.meta,
          cap: { roleCapUsd: perRoleCap, costUsd: result.meta.costUsd },
        },
      });
    `,
    suggestion: "Guard the spread operation by checking if payload is an object before spreading",
  },
};

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("🎬 Capturing Golden Transcript");
  console.log(`   REPLAY_ID: ${REPLAY_ID}`);
  console.log(`   AI_PROVIDER: ${AI_PROVIDER}`);
  console.log(`   SWARM_RECORD: ${SWARM_RECORD}`);
  console.log("");

  try {
    const result = await runSwarmV1(workOrder, policy, {
      traceId: `capture-${REPLAY_ID}`,
    });

    console.log("");
    console.log("✅ Swarm completed successfully");
    console.log(`   Status: ${result.status}`);
    console.log(`   StopReason: ${result.stopReason}`);
    console.log(`   NeedsHuman: ${result.needsHuman}`);
    console.log(`   Artifacts: ${result.artifacts.length}`);
    console.log("");
    console.log("📁 Fixtures saved to:");
    console.log(`   server/ai/engine/__tests__/fixtures/swarm/replays/${REPLAY_ID}/`);
    console.log("");
    console.log("🧪 To replay this scenario:");
    console.log(`   AI_PROVIDER=replay REPLAY_ID=${REPLAY_ID} pnpm vitest server/ai/engine/__tests__/swarm.replay.invariants.test.ts`);
  } catch (error) {
    console.error("");
    console.error("❌ Swarm failed");
    console.error(error);
    process.exit(1);
  }
}

main();
