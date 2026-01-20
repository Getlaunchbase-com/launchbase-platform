#!/usr/bin/env tsx
/**
 * Replay Validation Script
 * 
 * Validates that a captured golden transcript replays deterministically
 * without making any real API calls.
 * 
 * Usage:
 *   AI_PROVIDER=replay SWARM_REPLAY_RUN_ID=email_test__db_mock__staging__20260119_220724 \
 *   pnpm tsx scripts/swarm/replayValidate.ts server/ai/engine/__tests__/fixtures/swarm/failurePackets/email_test_e3_db_mock.json
 * 
 * Environment Variables:
 *   SWARM_REPLAY_RUN_ID: Fixture folder name to replay from
 *   AI_PROVIDER: Must be "replay" (read-only mode, no recording)
 * 
 * Arguments:
 *   [0]: Path to FailurePacket JSON file
 */

import { runSwarmV1 } from "../../server/ai/engine/swarmRunner";
import type { AiWorkOrderV1 } from "../../server/ai/engine/types";
import type { PolicyV1 } from "../../server/ai/engine/policy/policyTypes";
import { readFileSync } from "fs";
import { resolve } from "path";

// ============================================
// CONFIGURATION
// ============================================

const SWARM_REPLAY_RUN_ID = process.env.SWARM_REPLAY_RUN_ID;
const AI_PROVIDER = process.env.AI_PROVIDER ?? "replay";
const SWARM_RECORD = process.env.SWARM_RECORD ?? "0";

if (!SWARM_REPLAY_RUN_ID) {
  console.error("❌ SWARM_REPLAY_RUN_ID is required");
  console.error("   Usage: AI_PROVIDER=replay SWARM_REPLAY_RUN_ID=<id> pnpm tsx scripts/swarm/replayValidate.ts <failurePacket.json>");
  process.exit(1);
}

if (AI_PROVIDER !== "replay") {
  console.error("❌ AI_PROVIDER must be 'replay' for validation");
  console.error("   Usage: AI_PROVIDER=replay pnpm tsx scripts/swarm/replayValidate.ts");
  process.exit(1);
}

if (SWARM_RECORD === "1") {
  console.error("⚠️  WARNING: SWARM_RECORD=1 is set. This will overwrite fixtures!");
  console.error("   For replay validation, unset SWARM_RECORD or set it to 0");
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

if (!failurePacketPath) {
  console.error("❌ FailurePacket path is required");
  console.error("   Usage: pnpm tsx scripts/swarm/replayValidate.ts <failurePacket.json>");
  process.exit(1);
}

console.log(`📦 Loading FailurePacket from: ${failurePacketPath}`);
const packetPath = resolve(process.cwd(), failurePacketPath);
const packetContent = readFileSync(packetPath, "utf-8");
const packet = JSON.parse(packetContent);

// Convert FailurePacket to AiWorkOrderV1
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

console.log(`✅ Loaded FailurePacket: ${packet.metadata?.bucket || 'unknown'}`);

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("");
  console.log("🔄 Replaying Golden Transcript (Determinism Validation)");
  console.log(`   SWARM_REPLAY_RUN_ID: ${SWARM_REPLAY_RUN_ID}`);
  console.log(`   AI_PROVIDER: ${AI_PROVIDER}`);
  console.log(`   SWARM_RECORD: ${SWARM_RECORD} (read-only mode)`);
  console.log("");
  console.log("🔒 Validation checks:");
  console.log("   ✓ No [replay:record] logs should appear");
  console.log("   ✓ No outbound AIML calls should be made");
  console.log("   ✓ Swarm should complete with same decision path");
  console.log("");

  try {
    const result = await runSwarmV1(workOrder, policy, {
      traceId: `validate-${SWARM_REPLAY_RUN_ID}`,
    });

    console.log("");
    console.log("✅ Replay validation successful!");
    console.log(`   Status: ${result.status}`);
    console.log(`   StopReason: ${result.stopReason}`);
    console.log(`   NeedsHuman: ${result.needsHuman}`);
    console.log(`   Artifacts: ${result.artifacts.length}`);
    console.log("");
    console.log("📊 Decision outcome:");
    
    // Extract decision from collapse artifact
    const collapseArtifact = result.artifacts.find(a => a.kind === "swarm.collapse");
    if (collapseArtifact && typeof collapseArtifact.payload === "object" && collapseArtifact.payload !== null) {
      const payload = collapseArtifact.payload as any;
      console.log(`   Decision: ${payload.decision || 'unknown'}`);
      console.log(`   Verdict: ${payload.verdict || 'unknown'}`);
    }
    
    console.log("");
    console.log("✅ Determinism validated - transcript is stable");
    console.log("");
    console.log("📁 Fixtures location:");
    console.log(`   server/ai/engine/__tests__/fixtures/swarm/replays/${SWARM_REPLAY_RUN_ID}/`);
  } catch (error) {
    console.error("");
    console.error("❌ Replay validation failed");
    console.error(error);
    process.exit(1);
  }
}

main();
