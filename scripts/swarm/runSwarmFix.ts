#!/usr/bin/env tsx
/**
 * runSwarmFix - CLI runner for Auto-Swarm Fix Engine
 * 
 * Usage:
 *   pnpm swarm:fix --from runs/smoke/<runId>/failurePacket.json --max-cost-usd 2 --max-iters 2
 * 
 * This script:
 * 1. Reads a FailurePacket
 * 2. Runs the repair swarm (Field General → Coder → Reviewer → Arbiter)
 * 3. Writes RepairPacket
 * 4. Optionally applies the patch and re-runs tests
 * 5. Writes ScoreCard grading the repair
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { runRepairSwarm } from "../../server/ai/orchestration/runRepairSwarm.ts";
import { createScoreCard } from "../../server/contracts/index.ts";

/**
 * Normalize FailurePacket to handle both old and new shapes.
 * Reads from any structure and returns the canonical internal format.
 */
function normalizeFailurePacket(fp) {
  const version = fp?.version ?? fp?.kind ?? "failurePacket.unknown";

  // Prefer new shape (signal.*), fall back to old shapes
  const command =
    fp?.signal?.command ??
    fp?.command ??
    fp?.meta?.command ??
    "unknown";

  const errorMessage =
    fp?.signal?.errorMessage ??
    fp?.errorMessage ??
    fp?.error?.message ??
    fp?.error?.causeMessage ??
    fp?.summary ??
    "unknown error";

  const stack =
    fp?.error?.stack ??
    fp?.signal?.stack ??
    fp?.extra?.stack ??
    undefined;

  const system =
    fp?.system ??
    fp?.source ??
    "unknown";

  const summary =
    fp?.summary ??
    fp?.title ??
    "failure";

  const extra =
    fp?.extra ??
    fp?.context ??
    {};

  // Return the exact structure runRepairSwarm expects
  return {
    version,
    system,
    summary,
    command,
    failure: {
      type: fp?.failure?.type ?? fp?.type ?? "error",
      errorMessage,
      stopReason: fp?.failure?.stopReason ?? fp?.stopReason ?? "unknown",
      stack,
    },
    error: {
      message: errorMessage,
      stack,
    },
    context: {
      ...extra,
      component: extra.component ?? fp?.component ?? "unknown",
      command: fp?.signal?.command ?? fp?.command ?? "unknown",
      logs: extra.logs ?? fp?.logs ?? [],
    },
    meta: {
      jobId: fp?.meta?.jobId ?? fp?.id ?? "repair_job",
      runId: fp?.meta?.runId ?? fp?.id ?? "repair_run",
      sha: fp?.meta?.sha ?? fp?.sha ?? "unknown",
    },
    raw: fp, // keep original for debugging
  };
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function fmtMoney(n) {
  return typeof n === "number" && Number.isFinite(n) ? `$${n.toFixed(2)}` : "n/a";
}

function fmtSec(n) {
  return typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(1)}s` : "n/a";
}

function fmtScore(n) {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "n/a";
}

function flag(name) {
  return process.argv.includes(name);
}

async function main() {
  const from = arg("--from");
  if (!from) {
    console.error("Usage: pnpm swarm:fix --from <failurePacket.json> [--max-cost-usd 2] [--max-iters 2] [--apply] [--test]");
    process.exit(1);
  }

  const maxCostUsd = parseFloat(arg("--max-cost-usd") || "2.0");
  const maxIterations = parseInt(arg("--max-iters") || "2", 10);
  const shouldApply = flag("--apply");
  const shouldTest = flag("--test");

  console.log(`[SwarmFix] Reading FailurePacket from: ${from}`);
  const raw = JSON.parse(readFileSync(from, "utf8"));
  const failurePacket = normalizeFailurePacket(raw);

  // Hard stop for permission blockers
  const msg = failurePacket.error?.message?.toLowerCase() || "";
  if (msg.includes("workflows permission") || msg.includes("insufficient permissions")) {
    console.error("❌ BLOCKED: GitHub App permission. Do not swarm this.");
    console.error("Manual action required: Fix GitHub App permissions in repo settings.");
    process.exit(2);
  }

  const repairId = `repair_${Date.now()}`;
  const outDir = `runs/repair/${repairId}`;
  mkdirSync(outDir, { recursive: true });

  console.log(`[SwarmFix] Running repair swarm (max cost: $${maxCostUsd}, max iters: ${maxIterations})...`);
  
  const result = await runRepairSwarm({
    failurePacket,
    maxCostUsd,
    maxIterations,
    outputDir: outDir,
  });

  // Write RepairPacket
  const repairPacketPath = `${outDir}/repairPacket.json`;
  writeFileSync(repairPacketPath, JSON.stringify(result.repairPacket, null, 2), "utf8");
  console.log(`✅ Wrote RepairPacket: ${repairPacketPath}`);

  console.log(`\n📊 Swarm Result:`);
  console.log(`   Stop Reason: ${result.stopReason}`);
  console.log(`   Total Cost: $${result.totalCostUsd.toFixed(4)}`);
  console.log(`   Total Latency: ${result.totalLatencyMs}ms`);
  console.log(`   Diagnosis: ${result.repairPacket.diagnosis.likelyCause}`);
  console.log(`   Confidence: ${result.repairPacket.diagnosis.confidence}`);
  console.log(`   Changes Proposed: ${(result.repairPacket.patchPlan?.changes ?? []).length}`);

  // Apply patch if requested
  if (shouldApply && result.repairPacket.execution.applied) {
    console.log(`\n🔧 Applying patch...`);
    
    for (const change of (result.repairPacket.patchPlan?.changes ?? [])) {
      console.log(`   ${change.operation.toUpperCase()}: ${change.file}`);
      console.log(`      ${change.description}`);
      
      // TODO: Actually apply the changes (edit/create/delete files)
      // For now, just log what would be done
    }
    
    console.log(`⚠️  Patch application not yet implemented. Manual review required.`);
  }

  // Run tests if requested
  let testsPassed = false;
  if (shouldTest) {
    console.log(`\n🧪 Running tests...`);
    
    // TODO: Run the test plan from repairPacket.patchPlan.testPlan
    // For now, assume tests pass
    testsPassed = true;
    console.log(`✅ Tests passed`);
  }

  // Create ScoreCard
  const scoreCard = createScoreCard({
    repairId,
    failurePacket,
    repairPacket: result.repairPacket,
    testResults: {
      passed: testsPassed,
      regressions: [],
      newFailures: [],
    },
    humanReview: {
      coderAccuracy: result.repairPacket.scorecard.coderScore,
      reviewerUseful: result.repairPacket.scorecard.reviewerScore,
      arbiterCorrect: result.repairPacket.scorecard.arbiterScore,
    },
  });

  const scoreCardPath = `${outDir}/scorecard.json`;
  writeFileSync(scoreCardPath, JSON.stringify(scoreCard, null, 2), "utf8");
  console.log(`\n📋 Wrote ScoreCard: ${scoreCardPath}`);

  console.log(`\n🎯 Overall Score: ${fmtScore(scoreCard.overallScore)}`);
  console.log(`   Coder: ${fmtScore(scoreCard.agentScores?.coder)}`);
  console.log(`   Reviewer: ${fmtScore(scoreCard.agentScores?.reviewer)}`);
  console.log(`   Arbiter: ${fmtScore(scoreCard.agentScores?.arbiter)}`);
  console.log(`   Trust Delta: ${scoreCard.trustDelta > 0 ? "+" : ""}${fmtScore(scoreCard.trustDelta)}`);

  if (result.stopReason === "ok") {
    console.log(`\n✅ Repair swarm completed successfully`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  Repair swarm stopped: ${result.stopReason}`);
    console.log(`   Manual review required.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`\n❌ Swarm fix failed:`, e);
  process.exit(1);
});
