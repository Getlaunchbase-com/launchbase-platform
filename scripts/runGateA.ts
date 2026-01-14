/**
 * runGateA.ts
 *
 * Gate A: Baseline Reliability Test
 * 
 * Requirements:
 * - 10 sequential runs
 * - Control model: gpt-4o-2024-08-06 (designers), claude-opus-4-1 (critic)
 * - Ladder: DISABLED
 * - Success criteria: 10/10 runs with 8+8 changes, ≥10 issues/fixes, valid keys
 */

import fs from "node:fs";
import path from "node:path";
import { runDesignerMacro } from "./runDesignerMacro";

const GATE_A_RUNS = 10;
const GATE_A_POLICY = "/home/ubuntu/launchbase/server/ai/engine/policy/policies/swarm_gate_a_control.json";
const RESULTS_DIR = "/home/ubuntu/launchbase/runs/gate_a";

type GateAResult = {
  runId: string;
  runIndex: number;
  ok: boolean;
  systems: {
    ok: boolean;
    stopReason: string;
    model?: string;
    changes: number;
    validKeys: boolean;
  };
  brand: {
    ok: boolean;
    stopReason: string;
    model?: string;
    changes: number;
    validKeys: boolean;
  };
  critic: {
    ok: boolean;
    stopReason: string;
    model?: string;
    issues: number;
    fixes: number;
    pass: boolean;
  };
  costUsd: number;
  durationMs: number;
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function validateKeys(changes: any[], prefix: "design" | "brand"): boolean {
  if (!Array.isArray(changes)) return false;
  return changes.every((c) => c.targetKey?.startsWith(`${prefix}.`));
}

async function runGateA() {
  ensureDir(RESULTS_DIR);

  const results: GateAResult[] = [];
  const startTime = Date.now();

  console.log("=".repeat(60));
  console.log("GATE A: Baseline Reliability Test (10 runs, concurrency=3)");
  console.log("=".repeat(60));
  console.log(`Runs: ${GATE_A_RUNS}`);
  console.log(`Policy: ${GATE_A_POLICY}`);
  console.log(`Ladder: DISABLED`);
  console.log(`Model: gpt-4o-2024-08-06 (designers), claude-opus-4-1 (critic)`);
  console.log(`Critic max_tokens: 4000`);
  console.log(`Concurrency: 3`);
  console.log("=".repeat(60));
  console.log();

  // Run with concurrency=3
  const CONCURRENCY = 3;
  const failuresByType: Record<string, number> = {};
  
  for (let batch = 0; batch < Math.ceil(GATE_A_RUNS / CONCURRENCY); batch++) {
    const batchStart = batch * CONCURRENCY;
    const batchEnd = Math.min(batchStart + CONCURRENCY, GATE_A_RUNS);
    const batchPromises: Promise<GateAResult>[] = [];
    
    for (let i = batchStart; i < batchEnd; i++) {
      const runIndex = i + 1;
      batchPromises.push((async () => {
        console.log(`[${runIndex}/${GATE_A_RUNS}] Starting run...`);
        const runStart = Date.now();
        try {
      const workOrder = {
        inputs: {
          productName: "LaunchBase",
          primaryGoal: "Homepage design improvements",
          audience: "Small business owners",
          brief:
            "LaunchBase is an operating system for small businesses: ongoing responsibility + visibility/observability. Promise: hand it off without losing control.",
        },
        plan: {
          objective: "Improve conversion clarity, trust, premium feel",
        },
      };

      const out = await runDesignerMacro(workOrder, {
        enableLadder: false,
        timeoutMs: 90000,
        policyPath: GATE_A_POLICY,
      });

      const runDuration = Date.now() - runStart;

      // Load full results for validation
      const systemsResult = JSON.parse(
        fs.readFileSync(path.join(out.runDir, "systems_result.json"), "utf-8")
      );
      const brandResult = JSON.parse(
        fs.readFileSync(path.join(out.runDir, "brand_result.json"), "utf-8")
      );
      const criticResult = JSON.parse(
        fs.readFileSync(path.join(out.runDir, "critic_result.json"), "utf-8")
      );

      const systemsChanges = systemsResult.artifact?.payload?.proposedChanges || [];
      const brandChanges = brandResult.artifact?.payload?.proposedChanges || [];
      const criticIssues = criticResult.artifact?.payload?.issues || [];
      const criticFixes = criticResult.artifact?.payload?.suggestedFixes || [];

      const result: GateAResult = {
        runId: out.summary.runId,
        runIndex,
        ok:
          out.summary.systems.ok &&
          out.summary.brand.ok &&
          out.summary.critic.ok &&
          systemsChanges.length === 8 &&
          brandChanges.length === 8 &&
          criticIssues.length >= 10 &&
          criticFixes.length >= 10 &&
          validateKeys(systemsChanges, "design") &&
          validateKeys(brandChanges, "brand"),
        systems: {
          ok: out.summary.systems.ok,
          stopReason: out.summary.systems.stopReason,
          model: out.summary.systems.model,
          changes: systemsChanges.length,
          validKeys: validateKeys(systemsChanges, "design"),
        },
        brand: {
          ok: out.summary.brand.ok,
          stopReason: out.summary.brand.stopReason,
          model: out.summary.brand.model,
          changes: brandChanges.length,
          validKeys: validateKeys(brandChanges, "brand"),
        },
        critic: {
          ok: out.summary.critic.ok,
          stopReason: out.summary.critic.stopReason,
          model: out.summary.critic.model,
          issues: criticIssues.length,
          fixes: criticFixes.length,
          pass: criticResult.artifact?.payload?.pass ?? true,
        },
        costUsd: out.summary.totalCostUsd,
        durationMs: runDuration,
      };

          const status = result.ok ? "✅ PASS" : "❌ FAIL";
          console.log(`[${runIndex}/${GATE_A_RUNS}] ${status}`);
          console.log(`  Systems: ${result.systems.changes} changes, keys=${result.systems.validKeys}`);
          console.log(`  Brand: ${result.brand.changes} changes, keys=${result.brand.validKeys}`);
          console.log(`  Critic: ${result.critic.issues} issues, ${result.critic.fixes} fixes`);
          console.log(`  Cost: $${result.costUsd.toFixed(4)}, Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
          console.log();
          
          return result;
        } catch (err: any) {
          console.error(`[${runIndex}/${GATE_A_RUNS}] ❌ CRASH: ${err.message}`);
          const crashResult: GateAResult = {
            runId: `crash_${runIndex}`,
            runIndex,
            ok: false,
            systems: { ok: false, stopReason: "crash", changes: 0, validKeys: false },
            brand: { ok: false, stopReason: "crash", changes: 0, validKeys: false },
            critic: { ok: false, stopReason: "crash", issues: 0, fixes: 0, pass: true },
            costUsd: 0,
            durationMs: Date.now() - runStart,
          };
          console.log();
          return crashResult;
        }
      })());
    }
    
    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Early abort check
    for (const result of batchResults) {
      if (!result.ok) {
        const failureType = result.systems.stopReason !== "ok" ? "systems" : 
                           result.brand.stopReason !== "ok" ? "brand" : "critic";
        failuresByType[failureType] = (failuresByType[failureType] || 0) + 1;
        
        if (failuresByType[failureType] >= 2) {
          console.log(`\n⚠️  EARLY ABORT: ${failureType} failed ${failuresByType[failureType]} times`);
          console.log(`Stopping at run ${result.runIndex}/${GATE_A_RUNS}\n`);
          break;
        }
      }
    }
    
    // Check if we should abort
    if (Object.values(failuresByType).some(count => count >= 2)) {
      break;
    }
  }

  const totalDuration = Date.now() - startTime;
  const passCount = results.filter((r) => r.ok).length;
  const failCount = results.length - passCount;
  const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0);
  const avgDuration = results.reduce((sum, r) => sum + r.durationMs, 0) / results.length;

  const summary = {
    gate: "A",
    runs: GATE_A_RUNS,
    passCount,
    failCount,
    successRate: (passCount / GATE_A_RUNS) * 100,
    totalCostUsd: totalCost,
    avgCostUsd: totalCost / GATE_A_RUNS,
    totalDurationMs: totalDuration,
    avgDurationMs: avgDuration,
    results,
  };

  // Write results
  fs.writeFileSync(path.join(RESULTS_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf-8");

  // Generate report
  const report = `
# Gate A: Baseline Reliability Test

**Date:** ${new Date().toISOString()}

## Configuration
- Runs: ${GATE_A_RUNS}
- Model: gpt-4o-2024-08-06 (designers), claude-opus-4-1 (critic)
- Ladder: DISABLED
- Policy: swarm_gate_a_control.json

## Results
- **Pass:** ${passCount}/${GATE_A_RUNS} (${summary.successRate.toFixed(1)}%)
- **Fail:** ${failCount}/${GATE_A_RUNS}
- **Total Cost:** $${totalCost.toFixed(4)}
- **Avg Cost:** $${summary.avgCostUsd.toFixed(4)}/run
- **Total Duration:** ${(totalDuration / 1000).toFixed(1)}s
- **Avg Duration:** ${(avgDuration / 1000).toFixed(1)}s/run

## Gate Status
${summary.successRate === 100 ? "✅ **GATE A PASSED** - Ready for Gate B" : "❌ **GATE A FAILED** - Fix issues before proceeding"}

## Run Details

| Run | Status | Systems | Brand | Critic | Cost | Duration |
|-----|--------|---------|-------|--------|------|----------|
${results
  .map(
    (r) =>
      `| ${r.runIndex} | ${r.ok ? "✅" : "❌"} | ${r.systems.changes}ch ${r.systems.validKeys ? "✓" : "✗"} | ${r.brand.changes}ch ${r.brand.validKeys ? "✓" : "✗"} | ${r.critic.issues}i/${r.critic.fixes}f | $${r.costUsd.toFixed(4)} | ${(r.durationMs / 1000).toFixed(1)}s |`
  )
  .join("\n")}

## Issues Found

${
  failCount === 0
    ? "_No issues found._"
    : results
        .filter((r) => !r.ok)
        .map((r) => {
          const issues: string[] = [];
          if (r.systems.changes !== 8) issues.push(`Systems: ${r.systems.changes} changes (expected 8)`);
          if (!r.systems.validKeys) issues.push("Systems: Invalid keys (not design.*)");
          if (r.brand.changes !== 8) issues.push(`Brand: ${r.brand.changes} changes (expected 8)`);
          if (!r.brand.validKeys) issues.push("Brand: Invalid keys (not brand.*)");
          if (r.critic.issues < 10) issues.push(`Critic: ${r.critic.issues} issues (expected ≥10)`);
          if (r.critic.fixes < 10) issues.push(`Critic: ${r.critic.fixes} fixes (expected ≥10)`);
          return `### Run ${r.runIndex}\n${issues.map((i) => `- ${i}`).join("\n")}`;
        })
        .join("\n\n")
}

## Next Steps

${
  summary.successRate === 100
    ? "✅ Gate A passed. Proceed to Gate B (ladder enabled, 10 runs)."
    : "❌ Gate A failed. Debug issues before proceeding."
}
`.trim();

  fs.writeFileSync(path.join(RESULTS_DIR, "REPORT.md"), report, "utf-8");

  console.log("=".repeat(60));
  console.log("GATE A COMPLETE");
  console.log("=".repeat(60));
  console.log(`Pass: ${passCount}/${GATE_A_RUNS} (${summary.successRate.toFixed(1)}%)`);
  console.log(`Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`Avg Duration: ${(avgDuration / 1000).toFixed(1)}s/run`);
  console.log();
  console.log(summary.successRate === 100 ? "✅ GATE A PASSED" : "❌ GATE A FAILED");
  console.log(`Report: ${path.join(RESULTS_DIR, "REPORT.md")}`);
  console.log("=".repeat(60));

  return summary;
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  runGateA().catch((err) => {
    console.error("❌ Gate A runner crashed:", err);
    process.exit(1);
  });
}
