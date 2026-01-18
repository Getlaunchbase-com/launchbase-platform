/**
 * runGateA0.ts
 *
 * Gate A0: Quick Reliability Gate (3 runs, parallel)
 * 
 * Requirements:
 * - 3 parallel runs
 * - Control model: gpt-4o-2024-08-06 (designers), claude-opus-4-1 (critic)
 * - Ladder: DISABLED
 * - Success criteria: 3/3 runs with 8+8 changes, EXACTLY 10 issues/fixes, valid keys
 * - Early abort on first failure
 */

import fs from "node:fs";
import path from "node:path";
import { runDesignerMacro } from "./runDesignerMacro";

const GATE_A0_RUNS = 3;
const GATE_A0_POLICY = "/home/ubuntu/launchbase/server/ai/engine/policy/policies/swarm_gate_a_control.json";
const RESULTS_DIR = "/home/ubuntu/launchbase/runs/gate_a0";

type GateA0Result = {
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
    finishReason?: string;
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

async function runSingleGateA0(runIndex: number): Promise<GateA0Result> {
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
      policyPath: GATE_A0_POLICY,
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
    const criticFinishReason = criticResult.finishReason || "unknown";

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

    const result: GateA0Result = {
      runId: out.summary.runId,
      runIndex,
      ok: systemsOk && brandOk && criticOk,
      systems: {
        ok: systemsOk,
        stopReason: out.summary.systems.stopReason,
        model: out.summary.systems.model,
        changes: systemsChanges.length,
        validKeys: validateKeys(systemsChanges, "design"),
      },
      brand: {
        ok: brandOk,
        stopReason: out.summary.brand.stopReason,
        model: out.summary.brand.model,
        changes: brandChanges.length,
        validKeys: validateKeys(brandChanges, "brand"),
      },
      critic: {
        ok: criticOk,
        stopReason: out.summary.critic.stopReason,
        model: out.summary.critic.model,
        issues: criticIssues.length,
        fixes: criticFixes.length,
        pass: criticResult.artifact?.payload?.pass ?? true,
        finishReason: criticFinishReason,
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

async function runGateA0() {
  ensureDir(RESULTS_DIR);

  const startTime = Date.now();

  console.log("=".repeat(60));
  console.log("GATE A0: Quick Reliability Gate (3 runs, parallel)");
  console.log("=".repeat(60));
  console.log(`Runs: ${GATE_A0_RUNS}`);
  console.log(`Policy: ${GATE_A0_POLICY}`);
  console.log(`Ladder: DISABLED`);
  console.log(`Model: gpt-4o-2024-08-06 (designers), claude-opus-4-1 (critic)`);
  console.log(`Critic max_tokens: 4000`);
  console.log(`Expected: EXACTLY 10 issues + 10 fixes`);
  console.log("=".repeat(60));
  console.log();

  // Run 3 in parallel
  const promises = Array.from({ length: GATE_A0_RUNS }, (_, i) => runSingleGateA0(i + 1));
  const results = await Promise.all(promises);

  const totalDuration = Date.now() - startTime;
  const passCount = results.filter((r) => r.ok).length;
  const failCount = results.length - passCount;
  const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0);
  const avgDuration = results.reduce((sum, r) => sum + r.durationMs, 0) / results.length;

  const summary = {
    gate: "A0",
    runs: GATE_A0_RUNS,
    passCount,
    failCount,
    successRate: (passCount / GATE_A0_RUNS) * 100,
    totalCostUsd: totalCost,
    avgCostUsd: totalCost / GATE_A0_RUNS,
    totalDurationMs: totalDuration,
    avgDurationMs: avgDuration,
    results,
  };

  // Write results
  fs.writeFileSync(path.join(RESULTS_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf-8");

  // Generate report
  const report = `
# Gate A0: Quick Reliability Gate

**Date:** ${new Date().toISOString()}

## Configuration
- Runs: ${GATE_A0_RUNS} (parallel)
- Model: gpt-4o-2024-08-06 (designers), claude-opus-4-1 (critic)
- Ladder: DISABLED
- Critic max_tokens: 4000
- Expected: EXACTLY 10 issues + 10 fixes

## Results
- **Pass:** ${passCount}/${GATE_A0_RUNS} (${summary.successRate.toFixed(1)}%)
- **Fail:** ${failCount}/${GATE_A0_RUNS}
- **Total Cost:** $${totalCost.toFixed(4)}
- **Avg Cost:** $${summary.avgCostUsd.toFixed(4)}/run
- **Total Duration:** ${(totalDuration / 1000).toFixed(1)}s (parallel)
- **Avg Duration:** ${(avgDuration / 1000).toFixed(1)}s/run

## Gate Status
${summary.successRate === 100 ? "✅ **GATE A0 PASSED** - Proceed to Gate A (10 runs)" : "❌ **GATE A0 FAILED** - Fix issues before Gate A"}

## Run Details

| Run | Status | Systems | Brand | Critic | Failure Mode | Cost | Duration |
|-----|--------|---------|-------|--------|--------------|------|----------|
${results
  .map(
    (r) =>
      `| ${r.runIndex} | ${r.ok ? "✅" : "❌"} | ${r.systems.changes}ch ${r.systems.validKeys ? "✓" : "✗"} | ${r.brand.changes}ch ${r.brand.validKeys ? "✓" : "✗"} | ${r.critic.issues}i/${r.critic.fixes}f | ${r.failureMode || "none"} | $${r.costUsd.toFixed(4)} | ${(r.durationMs / 1000).toFixed(1)}s |`
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
          if (r.critic.issues !== 10) issues.push(`Critic: ${r.critic.issues} issues (expected EXACTLY 10)`);
          if (r.critic.fixes !== 10) issues.push(`Critic: ${r.critic.fixes} fixes (expected EXACTLY 10)`);
          if (r.critic.finishReason === "max_tokens") issues.push("Critic: Truncated at max_tokens");
          return `### Run ${r.runIndex} (${r.failureMode})\n${issues.map((i) => `- ${i}`).join("\n")}`;
        })
        .join("\n\n")
}

## Next Steps

${
  summary.successRate === 100
    ? "✅ Gate A0 passed. Proceed to Gate A (10 runs, parallel)."
    : "❌ Gate A0 failed. Debug issues before Gate A."
}
`.trim();

  fs.writeFileSync(path.join(RESULTS_DIR, "REPORT.md"), report, "utf-8");

  console.log("=".repeat(60));
  console.log("GATE A0 COMPLETE");
  console.log("=".repeat(60));
  console.log(`Pass: ${passCount}/${GATE_A0_RUNS} (${summary.successRate.toFixed(1)}%)`);
  console.log(`Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`Wall-clock Duration: ${(totalDuration / 1000).toFixed(1)}s (parallel)`);
  console.log();
  console.log(summary.successRate === 100 ? "✅ GATE A0 PASSED" : "❌ GATE A0 FAILED");
  console.log(`Report: ${path.join(RESULTS_DIR, "REPORT.md")}`);
  console.log("=".repeat(60));

  return summary;
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  runGateA0().catch((err) => {
    console.error("❌ Gate A0 runner crashed:", err);
    process.exit(1);
  });
}
