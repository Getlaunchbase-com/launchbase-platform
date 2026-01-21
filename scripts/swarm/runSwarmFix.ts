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
import { dirname } from "node:path";
import { runRepairSwarm } from "../../server/ai/orchestration/runRepairSwarm.ts";
import { createScoreCard } from "../../server/contracts/index.ts";
import { preflightFailurePacket } from "../../server/contracts/preflightValidation.ts";
import { shouldEscalateOnApplyFailure } from "./shouldEscalateOnApplyFailure";

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
        stopReason: computeStopReason({ preflightOk: true, patchValid, applied: patchApplied, testsPassed }).stopReason,
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
  let patchApplied = false;
  const applyLogs = [];
  
  if (shouldApply) {
    console.log(`\n🔧 Applying patch...`);
    
    const changes = result.repairPacket.patchPlan?.changes ?? [];
    
    // Validate all changes have diffs
    const missingDiffs = changes.filter(c => !c.diff);
    if (missingDiffs.length > 0) {
      console.error(`❌ Cannot apply: ${missingDiffs.length} changes missing diffs`);
      for (const change of missingDiffs) {
        console.error(`   - ${change.file}: ${change.description}`);
        applyLogs.push(`Missing diff for ${change.file}`);
      }
      result.repairPacket.execution.stopReason = "human_review_required";
      result.repairPacket.execution.applied = false;
    } else {
      // Create temp patch file
      let patchContent = changes.map(c => c.diff).join("\n");
      
      // Sanitize patch
      // 1. Strip markdown code fences
      patchContent = patchContent.replace(/^```diff\n/gm, "").replace(/^```\n/gm, "");
      // 2. Trim whitespace
      patchContent = patchContent.trim();
      // 3. Ensure newline at EOF
      if (!patchContent.endsWith("\n")) {
        patchContent += "\n";
      }
      
      // Validate patch format
      const isUnifiedDiff = patchContent.includes("diff --git") && 
                           patchContent.includes("---") && 
                           patchContent.includes("+++");
      const isCustomFormat = patchContent.includes("*** Begin Patch") || 
                            patchContent.includes("*** Update File:");
      
      if (isCustomFormat) {
        console.error(`❌ Invalid patch format: *** Begin Patch style not supported`);
        applyLogs.push(`Invalid patch format: must be unified diff (git apply compatible)`);
        result.repairPacket.execution.stopReason = "patch_invalid_format";
        result.repairPacket.execution.applied = false;
      } else if (!isUnifiedDiff) {
        console.error(`❌ Invalid patch format: missing unified diff headers`);
        applyLogs.push(`Invalid patch format: must include 'diff --git', '---', and '+++'`);
        result.repairPacket.execution.stopReason = "patch_invalid_format";
        result.repairPacket.execution.applied = false;
      } else {
        // Write sanitized patch
        const patchFile = `${outDir}/patch.diff`;
        writeFileSync(patchFile, patchContent, "utf8");
        applyLogs.push(`Created patch file: ${patchFile}`);
        
        // Preflight check
        let checkPassed = false;
        try {
          execSync(`git apply --check --whitespace=nowarn ${patchFile}`, { 
            cwd: process.cwd(), 
            stdio: "pipe" 
          });
          applyLogs.push(`git apply --check passed`);
          checkPassed = true;
        } catch (checkErr) {
          const errorMsg = checkErr.message || "";
          const stderr = checkErr.stderr?.toString() || "";
          
          // Detect "new file dependency context" failure
          const isNewFileDep = stderr.includes("depends on old contents") || 
                               stderr.includes("patch failed") ||
                               errorMsg.includes("depends on old contents");
          
          if (isNewFileDep) {
            console.log(`⚠️ New file dependency context issue detected`);
            applyLogs.push(`git apply --check failed: ${errorMsg}`);
            applyLogs.push(`Escalation hint: new_file_dep_context (needs Level 2 context)`);
            result.repairPacket.execution.stopReason = "apply_failed_dependency_context";
            result.repairPacket.execution.applied = false;
            // TODO: Implement Level 2 escalation (rebuild packet with expanded context)
          }
          // Retry with --recount if "corrupt patch" error
          else if (errorMsg.includes("corrupt patch") || stderr.includes("corrupt patch")) {
            console.log(`⚠️ Corrupt patch detected, retrying with --recount...`);
            applyLogs.push(`git apply --check failed: ${errorMsg}`);
            applyLogs.push(`Retrying with --recount to fix hunk header counts...`);
            
            try {
              execSync(`git apply --check --recount --whitespace=nowarn ${patchFile}`, { 
                cwd: process.cwd(), 
                stdio: "pipe" 
              });
              applyLogs.push(`git apply --check --recount passed`);
              checkPassed = true;
            } catch (recountErr) {
              console.error(`❌ git apply --check --recount failed: ${recountErr.message}`);
              applyLogs.push(`git apply --check --recount failed: ${recountErr.message}`);
              if (recountErr.stderr) applyLogs.push(`stderr: ${recountErr.stderr}`);
              result.repairPacket.execution.stopReason = "patch_failed";
              result.repairPacket.execution.applied = false;
            }
          } else {
            console.error(`❌ git apply --check failed: ${errorMsg}`);
            applyLogs.push(`git apply --check failed: ${errorMsg}`);
            if (stderr) applyLogs.push(`stderr: ${stderr}`);
            result.repairPacket.execution.stopReason = "patch_failed";
            result.repairPacket.execution.applied = false;
          }
        }
        
        // Apply patch if check passed
        if (checkPassed) {
          try {
            // Use --recount if check needed it (detect from logs)
            const needsRecount = applyLogs.some(log => log.includes("--recount passed"));
            const applyCmd = needsRecount 
              ? `git apply --recount --whitespace=nowarn ${patchFile}`
              : `git apply --whitespace=nowarn ${patchFile}`;
            
            execSync(applyCmd, { 
              cwd: process.cwd(), 
              stdio: "pipe" 
            });
            
            // Log diff stats
            const diffStat = execSync(`git diff --stat`, { cwd: process.cwd(), encoding: "utf8" });
            console.log(`✅ Patch applied successfully`);
            console.log(diffStat);
            applyLogs.push(`git apply succeeded`);
            applyLogs.push(`Diff stats:\n${diffStat}`);
            
            patchApplied = true;
            result.repairPacket.execution.applied = true;
          } catch (err) {
            console.error(`❌ git apply failed: ${err.message}`);
            applyLogs.push(`git apply failed: ${err.message}`);
            result.repairPacket.execution.stopReason = "patch_failed";
            result.repairPacket.execution.applied = false;
          }
        }
      }
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
