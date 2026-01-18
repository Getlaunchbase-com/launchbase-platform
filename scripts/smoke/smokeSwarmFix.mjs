#!/usr/bin/env node
/**
 * Smoke test for Auto-Swarm Fix Engine
 * 
 * Validates that the repair swarm can:
 * 1. Read a FailurePacket fixture
 * 2. Run diagnosis + coder + reviewer + arbiter
 * 3. Generate RepairPacket + ScoreCard
 * 4. Produce actionable output
 * 
 * Usage: pnpm smoke:swarm-fix
 */

import { readFileSync, existsSync } from "node:fs";
import { runRepairSwarm } from "../../server/ai/orchestration/runRepairSwarm.ts";

const FIXTURE_PATH = "runs/repair_replays/20260118_ads_engine_missing_field/failurePacket.json";

async function main() {
  console.log("[SmokeSwarmFix] Starting smoke test...\n");

  // 1. Load fixture
  if (!existsSync(FIXTURE_PATH)) {
    console.error(`❌ Fixture not found: ${FIXTURE_PATH}`);
    process.exit(1);
  }

  const failurePacket = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  console.log(`✅ Loaded FailurePacket: ${failurePacket.meta.timestamp}`);

  // 2. Run repair swarm
  console.log("\n[SmokeSwarmFix] Running repair swarm...");
  const result = await runRepairSwarm({
    failurePacket,
    maxCostUsd: 2.0,
    maxIterations: 2,
  });

  // 3. Validate RepairPacket
  if (!result.repairPacket) {
    console.error("❌ No RepairPacket generated");
    process.exit(1);
  }

  const rp = result.repairPacket;

  if (!rp.diagnosis?.likelyCause) {
    console.error("❌ RepairPacket missing diagnosis.likelyCause");
    process.exit(1);
  }

  if (!rp.patchPlan?.changes || rp.patchPlan.changes.length === 0) {
    console.error("❌ RepairPacket has no changes proposed");
    process.exit(1);
  }

  console.log(`✅ RepairPacket generated`);
  console.log(`   Diagnosis: ${rp.diagnosis.likelyCause.substring(0, 80)}...`);
  console.log(`   Changes proposed: ${rp.patchPlan.changes.length}`);
  console.log(`   Files touched: ${rp.patchPlan.changes.map(c => c.file).join(", ")}`);

  // 4. Validate ScoreCard
  if (!rp.scorecard) {
    console.error("❌ RepairPacket missing scorecard");
    process.exit(1);
  }

  console.log(`✅ ScoreCard generated`);
  console.log(`   Coder score: ${rp.scorecard.coderScore}`);
  console.log(`   Reviewer score: ${rp.scorecard.reviewerScore}`);
  console.log(`   Arbiter score: ${rp.scorecard.arbiterScore}`);

  // 5. Validate execution metadata
  if (!rp.execution) {
    console.error("❌ RepairPacket missing execution metadata");
    process.exit(1);
  }

  console.log(`✅ Execution metadata present`);
  console.log(`   Cost: $${rp.execution.costUsd?.toFixed(2) || "n/a"}`);
  console.log(`   Latency: ${rp.execution.latencyMs}ms`);
  console.log(`   Stop reason: ${rp.execution.stopReason}`);

  // 6. Success
  console.log(`\n✅ Smoke test PASSED`);
  console.log(`   Auto-Swarm Fix Engine is working end-to-end`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`\n❌ Smoke test FAILED:`, err.message);
  console.error(err.stack);
  process.exit(1);
});
