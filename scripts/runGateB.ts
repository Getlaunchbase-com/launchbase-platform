/**
 * runGateB.ts
 *
 * Gate B: Ladder Reliability Test (10 runs, concurrency=3, ladder ON)
 * 
 * Tests retry/fallback behavior with model ladder:
 * - r1: gpt-5.2-pro (180s)
 * - r2: gpt-5.2 (150s)
 * - r3: gpt-4o (90s)
 * 
 * Success criteria:
 * - 10/10 runs complete with valid JSON → Zod OK → critic ≥10 issues/fixes
 * - Retries allowed (track attempt count, model used, cost delta)
 * - Log: attempt/rungModel/timeoutMs/finishReason/stopReason/costUsd
 */

import fs from "node:fs";
import path from "node:path";
import { runDesignerMacro } from "./runDesignerMacro";

const GATE_B_RUNS = 10;
const GATE_B_POLICY = "/home/ubuntu/launchbase/server/ai/engine/policy/policies/swarm_gate_a_control.json"; // Use same policy, just enable ladder
const RESULTS_DIR = "/home/ubuntu/launchbase/runs/gate_b";

type GateBResult = {
  runId: string;
  runIndex: number;
  ok: boolean;
  systems: {
    ok: boolean;
    stopReason: string;
    model?: string;
    changes: number;
    validKeys: boolean;
    retryMeta?: {
      attemptCount: number;
      attemptModels: string[];
      finalModelUsed: string;
      totalCost: number;
    };
  };
  brand: {
    ok: boolean;
    stopReason: string;
    model?: string;
    changes: number;
    validKeys: boolean;
    retryMeta?: {
      attemptCount: number;
      attemptModels: string[];
      finalModelUsed: string;
      totalCost: number;
    };
  };
  critic: {
    ok: boolean;
    stopReason: string;
    model?: string;
    issues: number;
    fixes: number;
    pass: boolean;
    finishReason?: string;
    retryMeta?: {
      attemptCount: number;
      attemptModels: string[];
      finalModelUsed: string;
      totalCost: number;
    };
  };
  costUsd: number;
  durationMs: number;
  failureMode?: string;
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function validateKeys(changes: any[], prefix: "design" | "brand"): boolean {
  if (!Array.isArray(changes)) return false;
  return changes.every((c) => c.targetKey?.startsWith(`${prefix}.`));
}

async function runSingleGateB(runIndex: number): Promise<GateBResult> {
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
      enableLadder: true, // ✅ LADDER ON
      timeoutMs: 180000, // Max timeout for r1 (gpt-5.2-pro)
      policyPath: GATE_B_POLICY,
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
    const criticFinishReason = criticResult.finishReason || criticResult.meta?.finishReason || "unknown";

    const systemsOk = out.summary.systems.ok && systemsChanges.length === 8 && validateKeys(systemsChanges, "design");
    const brandOk = out.summary.brand.ok && brandChanges.length === 8 && validateKeys(brandChanges, "brand");
    const criticOk = out.summary.critic.ok && criticIssues.length === 10 && criticFixes.length === 10;

    let failureMode: string | undefined;
    if (!systemsOk) failureMode = "systems_validation";
    else if (!brandOk) failureMode = "brand_validation";
    else if (!criticOk) {
      if (criticFinishReason === "max_tokens") failureMode = "critic_truncation";
      else if (criticIssues.length !== 10) failureMode = "critic_count_mismatch";
      else failureMode = "critic_validation";
    }

    const result: GateBResult = {
      runId: out.summary.runId,
      runIndex,
      ok: systemsOk && brandOk && criticOk,
      systems: {
        ok: systemsOk,
        stopReason: out.summary.systems.stopReason,
        model: out.summary.systems.model,
        changes: systemsChanges.length,
        validKeys: validateKeys(systemsChanges, "design"),
        retryMeta: systemsResult.retryMeta,
      },
      brand: {
        ok: brandOk,
        stopReason: out.summary.brand.stopReason,
        model: out.summary.brand.model,
        changes: brandChanges.length,
        validKeys: validateKeys(brandChanges, "brand"),
        retryMeta: brandResult.retryMeta,
      },
      critic: {
        ok: criticOk,
        stopReason: out.summary.critic.stopReason,
        model: out.summary.critic.model,
        issues: criticIssues.length,
        fixes: criticFixes.length,
        pass: criticResult.artifact?.payload?.pass ?? true,
        finishReason: criticFinishReason,
        retryMeta: criticResult.retryMeta,
      },
      costUsd: out.summary.totalCostUsd,
      durationMs: runDuration,
      failureMode,
    };

    return result;
  } catch (err: any) {
    return {
      runId: `crash_${runIndex}`,
      runIndex,
      ok: false,
      systems: { ok: false, stopReason: "crash", changes: 0, validKeys: false },
      brand: { ok: false, stopReason: "crash", changes: 0, validKeys: false },
      critic: { ok: false, stopReason: "crash", issues: 0, fixes: 0, pass: true },
      costUsd: 0,
      durationMs: Date.now() - runStart,
      failureMode: "crash",
    };
  }
}

async function runGateB() {
  ensureDir(RESULTS_DIR);

  const results: GateBResult[] = [];
  const startTime = Date.now();

  console.log("=".repeat(60));
  console.log("GATE B: Ladder Reliability Test (10 runs, concurrency=3)");
  console.log("=".repeat(60));
  console.log(`Runs: ${GATE_B_RUNS}`);
  console.log(`Policy: ${GATE_B_POLICY}`);
  console.log(`Ladder: ENABLED ✅`);
  console.log(`Rungs: r1=gpt-5.2-pro (180s) → r2=gpt-5.2 (150s) → r3=gpt-4o (90s)`);
  console.log(`Critic max_tokens: 4000`);
  console.log(`Concurrency: 3`);
  console.log("=".repeat(60));
  console.log();

  // Run with concurrency=3
  const CONCURRENCY = 3;
  const failuresByType: Record<string, number> = {};
  
  for (let batch = 0; batch < Math.ceil(GATE_B_RUNS / CONCURRENCY); batch++) {
    const batchStart = batch * CONCURRENCY;
    const batchEnd = Math.min(batchStart + CONCURRENCY, GATE_B_RUNS);
    const batchPromises: Promise<GateBResult>[] = [];
    
    for (let i = batchStart; i < batchEnd; i++) {
      const runIndex = i + 1;
      batchPromises.push((async () => {
        console.log(`[${runIndex}/${GATE_B_RUNS}] Starting run (ladder ON)...`);
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
        enableLadder: true, // ✅ LADDER ON
        timeoutMs: 180000,
        policyPath: GATE_B_POLICY,
      });

      const runDuration = Date.now() - runStart;

      // Load full results
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

      const systemsOk = out.summary.systems.ok && systemsChanges.length === 8 && validateKeys(systemsChanges, "design");
      const brandOk = out.summary.brand.ok && brandChanges.length === 8 && validateKeys(brandChanges, "brand");
      const criticOk = out.summary.critic.ok && criticIssues.length === 10 && criticFixes.length === 10;

      const result: GateBResult = {
        runId: out.summary.runId,
        runIndex,
        ok: systemsOk && brandOk && criticOk,
        systems: {
          ok: systemsOk,
          stopReason: out.summary.systems.stopReason,
          model: out.summary.systems.model,
          changes: systemsChanges.length,
          validKeys: validateKeys(systemsChanges, "design"),
          retryMeta: systemsResult.retryMeta,
        },
        brand: {
          ok: brandOk,
          stopReason: out.summary.brand.stopReason,
          model: out.summary.brand.model,
          changes: brandChanges.length,
          validKeys: validateKeys(brandChanges, "brand"),
          retryMeta: brandResult.retryMeta,
        },
        critic: {
          ok: criticOk,
          stopReason: out.summary.critic.stopReason,
          model: out.summary.critic.model,
          issues: criticIssues.length,
          fixes: criticFixes.length,
          pass: criticResult.artifact?.payload?.pass ?? true,
          finishReason: criticResult.finishReason || criticResult.meta?.finishReason,
          retryMeta: criticResult.retryMeta,
        },
        costUsd: out.summary.totalCostUsd,
        durationMs: runDuration,
      };

          const status = result.ok ? "✅ PASS" : "❌ FAIL";
          console.log(`[${runIndex}/${GATE_B_RUNS}] ${status}`);
          console.log(`  Systems: ${result.systems.changes} changes (attempts: ${result.systems.retryMeta?.attemptCount || 1}, model: ${result.systems.retryMeta?.finalModelUsed || result.systems.model})`);
          console.log(`  Brand: ${result.brand.changes} changes (attempts: ${result.brand.retryMeta?.attemptCount || 1}, model: ${result.brand.retryMeta?.finalModelUsed || result.brand.model})`);
          console.log(`  Critic: ${result.critic.issues}i/${result.critic.fixes}f (attempts: ${result.critic.retryMeta?.attemptCount || 1}, model: ${result.critic.retryMeta?.finalModelUsed || result.critic.model})`);
          console.log(`  Cost: $${result.costUsd.toFixed(4)}, Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
          console.log();
          
          return result;
        } catch (err: any) {
          console.error(`[${runIndex}/${GATE_B_RUNS}] ❌ CRASH: ${err.message}`);
          const crashResult: GateBResult = {
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
          console.log(`Stopping at run ${result.runIndex}/${GATE_B_RUNS}\n`);
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

  // Retry statistics
  const totalRetries = results.reduce((sum, r) => {
    const sysRetries = (r.systems.retryMeta?.attemptCount || 1) - 1;
    const brandRetries = (r.brand.retryMeta?.attemptCount || 1) - 1;
    const criticRetries = (r.critic.retryMeta?.attemptCount || 1) - 1;
    return sum + sysRetries + brandRetries + criticRetries;
  }, 0);

  const fallbackCount = results.filter(r => 
    (r.systems.retryMeta?.attemptCount || 1) > 1 ||
    (r.brand.retryMeta?.attemptCount || 1) > 1 ||
    (r.critic.retryMeta?.attemptCount || 1) > 1
  ).length;

  const summary = {
    gate: "B",
    runs: GATE_B_RUNS,
    passCount,
    failCount,
    successRate: (passCount / GATE_B_RUNS) * 100,
    totalCostUsd: totalCost,
    avgCostUsd: totalCost / GATE_B_RUNS,
    totalDurationMs: totalDuration,
    avgDurationMs: avgDuration,
    totalRetries,
    fallbackCount,
    fallbackRate: (fallbackCount / results.length) * 100,
    results,
  };

  // Write results
  fs.writeFileSync(path.join(RESULTS_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf-8");

  // Generate report
  const report = `
# Gate B: Ladder Reliability Test

**Date:** ${new Date().toISOString()}

## Configuration
- Runs: ${GATE_B_RUNS} (concurrency=3)
- Ladder: ENABLED ✅
- Rungs: r1=gpt-5.2-pro (180s) → r2=gpt-5.2 (150s) → r3=gpt-4o (90s)
- Critic max_tokens: 4000

## Results
- **Pass:** ${passCount}/${GATE_B_RUNS} (${summary.successRate.toFixed(1)}%)
- **Fail:** ${failCount}/${GATE_B_RUNS}
- **Total Cost:** $${totalCost.toFixed(4)}
- **Avg Cost:** $${summary.avgCostUsd.toFixed(4)}/run
- **Total Duration:** ${(totalDuration / 1000).toFixed(1)}s (parallel)
- **Avg Duration:** ${(avgDuration / 1000).toFixed(1)}s/run

## Retry Metrics
- **Total Retries:** ${totalRetries}
- **Runs with Fallback:** ${fallbackCount}/${results.length} (${summary.fallbackRate.toFixed(1)}%)

## Gate Status
${summary.successRate === 100 ? "✅ **GATE B PASSED** - Ladder reliability proven" : "❌ **GATE B FAILED** - Fix issues before Mega Tournament"}

## Run Details

| Run | Status | Systems | Brand | Critic | Retries | Cost | Duration |
|-----|--------|---------|-------|--------|---------|------|----------|
${results
  .map(
    (r) => {
      const sysRetries = (r.systems.retryMeta?.attemptCount || 1) - 1;
      const brandRetries = (r.brand.retryMeta?.attemptCount || 1) - 1;
      const criticRetries = (r.critic.retryMeta?.attemptCount || 1) - 1;
      const totalRetries = sysRetries + brandRetries + criticRetries;
      return `| ${r.runIndex} | ${r.ok ? "✅" : "❌"} | ${r.systems.changes}ch (${r.systems.retryMeta?.attemptCount || 1}a) | ${r.brand.changes}ch (${r.brand.retryMeta?.attemptCount || 1}a) | ${r.critic.issues}i/${r.critic.fixes}f (${r.critic.retryMeta?.attemptCount || 1}a) | ${totalRetries} | $${r.costUsd.toFixed(4)} | ${(r.durationMs / 1000).toFixed(1)}s |`;
    }
  )
  .join("\n")}

## Next Steps

${
  summary.successRate === 100
    ? "✅ Gate B passed. Proceed to Mega Tournament V2 with Truthfulness Index."
    : "❌ Gate B failed. Debug retry/fallback issues before tournament."
}
`.trim();

  fs.writeFileSync(path.join(RESULTS_DIR, "REPORT.md"), report, "utf-8");

  console.log("=".repeat(60));
  console.log("GATE B COMPLETE");
  console.log("=".repeat(60));
  console.log(`Pass: ${passCount}/${GATE_B_RUNS} (${summary.successRate.toFixed(1)}%)`);
  console.log(`Total Retries: ${totalRetries}`);
  console.log(`Fallback Rate: ${summary.fallbackRate.toFixed(1)}%`);
  console.log(`Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`Wall-clock Duration: ${(totalDuration / 1000).toFixed(1)}s (parallel)`);
  console.log();
  console.log(summary.successRate === 100 ? "✅ GATE B PASSED" : "❌ GATE B FAILED");
  console.log(`Report: ${path.join(RESULTS_DIR, "REPORT.md")}`);
  console.log("=".repeat(60));

  return summary;
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  runGateB().catch((err) => {
    console.error("❌ Gate B runner crashed:", err);
    process.exit(1);
  });
}
