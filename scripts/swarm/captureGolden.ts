#!/usr/bin/env tsx
/**
 * Capture Golden Transcript
 * 
 * Runs a real swarm workflow with SWARM_RECORD=1 to capture AI responses
 * as fixtures for deterministic replay testing.
 * 
 * Usage:
 *   AI_PROVIDER=replay SWARM_RECORD=1 SWARM_REPLAY_RUN_ID=email_test__db_mock__staging__$(date +%Y%m%d_%H%M%S) \
 *   pnpm tsx scripts/swarm/captureGolden.ts server/ai/engine/__tests__/fixtures/swarm/failurePackets/email_test_e3_db_mock.json
 * 
 * Environment Variables:
 *   SWARM_REPLAY_RUN_ID: Scenario name (default: golden_1)
 *   AI_PROVIDER: Must be "replay" (with SWARM_RECORD=1 for recording)
 *   SWARM_RECORD: Must be "1" to enable recording mode
 * 
 * Arguments:
 *   [0]: Path to FailurePacket JSON file (optional, uses default scenario if not provided)
 */

import { runSwarmV1 } from "../../server/ai/engine/swarmRunner";
import type { AiWorkOrderV1 } from "../../server/ai/engine/types";
import type { PolicyV1 } from "../../server/ai/engine/policy/policyTypes";
import { readFileSync } from "fs";
import { resolve } from "path";

// ============================================
// CONFIGURATION
// ============================================

const SWARM_REPLAY_RUN_ID = process.env.SWARM_REPLAY_RUN_ID ?? "golden_1";
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
// LOAD FAILURE PACKET
// ============================================

const failurePacketPath = process.argv[2];
let workOrder: AiWorkOrderV1;

if (failurePacketPath) {
  console.log(`📦 Loading FailurePacket from: ${failurePacketPath}`);
  const packetPath = resolve(process.cwd(), failurePacketPath);
  const packetContent = readFileSync(packetPath, "utf-8");
  const packet = JSON.parse(packetContent);
  
  // Convert FailurePacket to AiWorkOrderV1
  workOrder = {
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
  console.log(`✅ Loaded FailurePacket: ${packet.metadata?.bucket || 'unknown'}`);
} else {
  // Default scenario (TypeScript error)
  console.log("⚠️  No FailurePacket provided, using default TypeScript error scenario");
  workOrder = {
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
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("🎬 Capturing Golden Transcript");
  console.log(`   SWARM_REPLAY_RUN_ID: ${SWARM_REPLAY_RUN_ID}`);
  console.log(`   AI_PROVIDER: ${AI_PROVIDER}`);
  console.log(`   SWARM_RECORD: ${SWARM_RECORD}`);
  console.log("");

  try {
    const result = await runSwarmV1(workOrder, policy, {
      traceId: `capture-${SWARM_REPLAY_RUN_ID}`,
    });

    console.log("");
    console.log("✅ Swarm completed successfully");
    console.log(`   Status: ${result.status}`);
    console.log(`   StopReason: ${result.stopReason}`);
    console.log(`   NeedsHuman: ${result.needsHuman}`);
    console.log(`   Artifacts: ${result.artifacts.length}`);
    console.log("");
    console.log("📁 Fixtures saved to:");
    console.log(`   server/ai/engine/__tests__/fixtures/swarm/replays/${SWARM_REPLAY_RUN_ID}/`);
    console.log("");
    console.log("🧪 To replay this scenario:");
    console.log(`   AI_PROVIDER=replay SWARM_REPLAY_RUN_ID=${SWARM_REPLAY_RUN_ID} pnpm vitest server/ai/engine/__tests__/swarm.replay.invariants.test.ts`);
  } catch (error) {
    console.error("");
    console.error("❌ Swarm failed");
    console.error(error);
    process.exit(1);
  }
}

main();
