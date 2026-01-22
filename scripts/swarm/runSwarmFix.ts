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
import { execSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { runRepairSwarm } from "../../server/ai/orchestration/runRepairSwarm.ts";
import { createScoreCard } from "../../server/contracts/index.ts";
import { preflightFailurePacket } from "../../server/contracts/preflightValidation.ts";
import { shouldEscalateOnApplyFailure } from "./shouldEscalateOnApplyFailure";
import { applyPatchFromResult } from "./applyPatchFromResult.js";
import { buildEscalatedFailurePacket } from "./buildEscalatedFailurePacket.js";

function computeStopReason(facts: { preflightOk: boolean; patchValid: boolean; applied: boolean; testsPassed: boolean }): string {
  if (!facts.preflightOk) return "preflight_failed";
  if (!facts.patchValid) return "patch_invalid";
  if (!facts.applied) return "apply_failed";
  if (!facts.testsPassed) return "tests_failed";
  return "ok";
}

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


/**
 * Compute final stopReason from execution facts (executor-owned).
 * Hard rule: stopReason="ok" IFF applied=true AND testsPassed=true
 */
function computeStopReason(facts: {
  preflightOk?: boolean;
  patchValid?: boolean;
  applied?: boolean;
  testsPassed?: boolean;
}): string {
  if (facts.preflightOk === false) return "packet_invalid";
  if (facts.patchValid === false) return "patch_invalid";
  if (facts.applied === false) return "apply_failed";
  if (facts.testsPassed === false) return "tests_failed";
  return "ok";
}


async function main() {
  const from = arg("--from");
  if (!from) {
    console.error("Usage: pnpm swarm:fix --from <failurePacket.json> [--max-cost-usd 2] [--max-iters 2] [--apply] [--test] [--offline --repairPacket <path>]");
    process.exit(1);
  }

  const maxCostUsd = parseFloat(arg("--max-cost-usd") || "2.0");
  const maxIterations = parseInt(arg("--max-iters") || "2", 10);
  const shouldApply = flag("--apply");
  const shouldTest = flag("--test");
  const offline = flag("--offline");
  const repairPacketPath = arg("--repairPacket");

  console.log(`[SwarmFix] Reading FailurePacket from: ${from}`);
  const raw = JSON.parse(readFileSync(from, "utf8"));
  const failurePacket = normalizeFailurePacket(raw);

  // Skip preflight validation in offline mode (using pre-generated repair packets)
  if (!offline) {
    // Preflight validation (fail fast before any AI calls)
    console.log(`[SwarmFix] Running preflight validation...`);
    const preflight = preflightFailurePacket(raw);
  
  if (!preflight.ok) {
    console.error(`❌ Preflight validation failed: ${preflight.stopReason}`);
    console.error(`Errors:`);
    for (const error of preflight.errors) {
      console.error(`  - ${error}`);
    }
    
    // Write artifacts even on preflight failure
    const repairId = `repair_${Date.now()}`;
    const outDir = `runs/repair/${repairId}`;
    mkdirSync(outDir, { recursive: true });
    
    // ✅ FIX #1: Write failurePacket.json + meta.json (preflight failure path)
    writeFileSync(`${outDir}/failurePacket.json`, JSON.stringify(failurePacket, null, 2), "utf-8");
    writeFileSync(`${outDir}/meta.json`, JSON.stringify({
      repairId,
      createdAtIso: new Date().toISOString(),
      gitSha: failurePacket.context?.sha ?? process.env.GIT_SHA ?? null,
      stopReason: preflight.stopReason,
    }, null, 2), "utf-8");
    
    // Write minimal RepairPacket with preflight failure
    const failedPacket = {
      version: "repairpacket.v1",
      repairId,
      failurePacketId: raw.meta?.runId || "unknown",
      diagnosis: {
        likelyCause: "Preflight validation failed",
        confidence: 1.0,
        relatedIssues: preflight.errors,
      },
      patchPlan: null,
      execution: {
        stopReason: computeStopReason({
          preflightOk: false,
          patchValid: false,
          applied: false,
          testsPassed: false,
        }).stopReason,
        applied: false,
        testsPassed: false,
        patchValid: false,
        logs: preflight.errors,
      },
      meta: {
        createdAt: new Date().toISOString(),
        sha: process.env.GIT_SHA || "unknown",
      },
    };
    
    writeFileSync(`${outDir}/repairPacket.json`, JSON.stringify(failedPacket, null, 2));
    console.log(`\n📝 Wrote preflight failure artifact: ${outDir}/repairPacket.json`);
    process.exit(1);
  }
  
    console.log(`✅ Preflight validation passed`);
  }

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

  // Execution state tracking
  const preflightOk = true;
  let retryCount = 0;
  let escalated = false;

  // ✅ FIX #1: Always persist FailurePacket to repair dir for reproducibility
  const failurePacketPath = `${outDir}/failurePacket.json`;
  writeFileSync(failurePacketPath, JSON.stringify(failurePacket, null, 2), "utf-8");
  console.log(`📝 Wrote failurePacket.json to ${outDir}`);

  // Optional: Write meta.json for audit trail
  const metaPath = `${outDir}/meta.json`;
  writeFileSync(metaPath, JSON.stringify({
    repairId,
    createdAtIso: new Date().toISOString(),
    gitSha: failurePacket.context?.sha ?? process.env.GIT_SHA ?? null,
    stopReason: null, // Will be updated at end
  }, null, 2), "utf-8");
  console.log(`📝 Wrote meta.json to ${outDir}`);

  // IMPORTANT: Ensure all downstream AI calls log attempts under *this* repair directory.
  // The AI provider writes attempts.jsonl using trace.runId, which comes from pkt.meta.runId.
  // If we don't stamp this, artifacts will go to fixture_* or repair_run fallbacks.
  failurePacket.meta = failurePacket.meta ?? ({} as any);
  failurePacket.meta.runId = repairId;
  failurePacket.meta.jobId = failurePacket.meta.jobId ?? `repair_job_${repairId}`;

  let result;
  
  if (offline) {
    console.log(`[SwarmFix] Offline mode: skipping swarm, loading pre-generated repairPacket...`);
    if (!repairPacketPath) {
      console.error("❌ --offline requires --repairPacket <path>");
      process.exit(1);
    }
    const repairPacket = JSON.parse(readFileSync(repairPacketPath, "utf8"));
    result = {
      stopReason: "offline_mode",
      totalCostUsd: 0,
      totalLatencyMs: 0,
      repairPacket,
    };
  } else {
    console.log(`[SwarmFix] Running repair swarm (max cost: $${maxCostUsd}, max iters: ${maxIterations})...`);
    result = await runRepairSwarm({
      failurePacket,
      maxCostUsd,
      maxIterations,
      outputDir: outDir,
    });
  }



  console.log(`\n📊 Swarm Result:`);
  console.log(`   Stop Reason: ${result.stopReason}`);
  console.log(`   Total Cost: $${result.totalCostUsd.toFixed(4)}`);
  console.log(`   Total Latency: ${result.totalLatencyMs}ms`);
  console.log(`   Diagnosis: ${result.repairPacket.diagnosis.likelyCause}`);
  console.log(`   Confidence: ${result.repairPacket.diagnosis.confidence}`);
  console.log(`   Changes Proposed: ${(result.repairPacket.patchPlan?.changes ?? []).length}`);

  // Apply patch if requested
  const patchFile = `${outDir}/patch.diff`;
  let patchApplied = false;
  let patchValid = true;
  let escalationHint: string | null = null;
  const applyLogs: string[] = [];
  
  if (shouldApply) {
    const applied = applyPatchFromResult({ result, shouldApply, outDir, patchFile, applyLogs });
    patchApplied = applied.patchApplied;
    patchValid = applied.patchValid;
    escalationHint = applied.escalationHint;
   }

  // Escalation retry executor
  let escalationReason: string | null = null;
  let escalationLevel: "L0" | "L2" | null = null;

  if (shouldApply && !patchApplied && escalationHint === "apply_failed_dependency_context") {
    escalationReason = "apply_failed_dependency_context";
  }

  if (shouldApply && !patchApplied && retryCount === 0 && escalationReason === "apply_failed_dependency_context") {
    retryCount = 1;
    escalated = true;
    escalationLevel = "L2";

    try {
      writeFileSync(join(outDir, "failurePacket.original.json"), JSON.stringify(failurePacket, null, 2), "utf8");

      const escalatedPacket = await buildEscalatedFailurePacket({
        base: failurePacket,
        patchDiffPath: patchFile,
        repairId,
        maxFiles: 25,
        maxTotalBytes: 500_000,
        includeRepoIndex: true,
        includeTsconfig: true,
        includePackageJson: true,
      });

      writeFileSync(join(outDir, "failurePacket.escalated.json"), JSON.stringify(escalatedPacket, null, 2), "utf8");

      const retryResult = await runRepairSwarm({ pkt: escalatedPacket });
      result = retryResult;

      applyLogs.push(`[escalation] reran swarm with L2 context`);

      const applied2 = applyPatchFromResult({ result, shouldApply, outDir, patchFile, applyLogs });
      patchApplied = applied2.patchApplied;
      patchValid = applied2.patchValid;
    } catch (err: any) {
      applyLogs.push(`[escalation] retry failed: ${err?.message || String(err)}`);
    }
  }

  // Run tests if requested
  let testsPassed = false;
  const testLogs = [];
  
  if (shouldTest) {
    console.log(`\n🧪 Running tests...`);
    
    const testCommands = result.repairPacket.patchPlan?.testCommands;
    
    if (!testCommands || testCommands.length === 0) {
      console.log(`⚠️  No testCommands provided`);
      testLogs.push("testCommands missing - cannot execute tests");
      result.repairPacket.execution.stopReason = "tests_missing_testCommands";
      result.repairPacket.execution.testsPassed = false;
    } else {
      // spawnSync already imported at top
      let allTestsPassed = true;
      
      for (let i = 0; i < testCommands.length; i++) {
        const { cmd, args, cwd } = testCommands[i];
        const cmdStr = `${cmd} ${args.join(" ")}`;
        console.log(`   [${i + 1}/${testCommands.length}] Running: ${cmdStr}`);
        testLogs.push(`Test ${i + 1}: ${cmdStr}`);
        
        const testResult = spawnSync(cmd, args, {
          cwd: cwd || process.cwd(),
          shell: false,
          encoding: "utf8",
        });
        
        if (testResult.status === 0) {
          console.log(`   ✅ Passed`);
          testLogs.push(`Test ${i + 1} passed`);
          if (testResult.stdout?.trim()) {
            testLogs.push(`stdout: ${testResult.stdout.trim()}`);
          }
        } else {
          console.error(`   ❌ Failed (exit ${testResult.status})`);
          testLogs.push(`Test ${i + 1} failed (exit ${testResult.status})`);
          if (testResult.stdout) testLogs.push(`stdout: ${testResult.stdout}`);
          if (testResult.stderr) testLogs.push(`stderr: ${testResult.stderr}`);
          
          allTestsPassed = false;
          result.repairPacket.execution.stopReason = "tests_failed";
          break; // Fail fast
        }
      }
      
      testsPassed = allTestsPassed;
      result.repairPacket.execution.testsPassed = testsPassed;
      
      if (testsPassed) {
        console.log(`✅ All tests passed`);
      } else {
        console.error(`❌ Tests failed`);
      }
    }
  }

  // Update execution logs
  result.repairPacket.execution.logs = [
    ...applyLogs,
    ...testLogs,
  ];
  
  // Set final stopReason if not already set
  if (!result.repairPacket.execution.stopReason || result.repairPacket.execution.stopReason === "ok") {
    if (patchApplied && testsPassed) {
      result.repairPacket.execution.stopReason = "ok";
    } else if (!patchApplied && shouldApply) {
      // stopReason already set in apply logic
    } else if (!testsPassed && shouldTest) {
      // stopReason already set in test logic
    }
  }
  
  // Write retryMeta.json
  const retryMeta = {
    retryCount,
    escalated,
    escalationReason,
    escalationLevel,
    contextLevelUsedFirst: "L0",
    contextLevelUsedRetry: escalated ? "L2" : null,
  };
  writeFileSync(`${outDir}/retryMeta.json`, JSON.stringify(retryMeta, null, 2), "utf8");

  // Executor-owned stopReason (unconditional overwrite)
  result.repairPacket.execution.stopReason = computeStopReason({ preflightOk, patchValid, applied: patchApplied, testsPassed });

  // Write RepairPacket
  const outputRepairPacketPath = `${outDir}/repairPacket.json`;
  writeFileSync(outputRepairPacketPath, JSON.stringify(result.repairPacket, null, 2), "utf8");
  console.log(`\n✅ Wrote RepairPacket: ${outputRepairPacketPath}`);
  
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
