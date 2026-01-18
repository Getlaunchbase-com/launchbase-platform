/**
 * Clean Pilot Tournament (Control vs Gemini)
 * 
 * 8-run pilot with all fixes applied:
 * - Lane-specific anchor validation (marketing allows 0 anchors)
 * - Marketing prompt forces placement/format/count
 * - Gemini maxTokens increased (designers: 3000, critic: 4000)
 * - Critic retry on provider_failed
 * 
 * Design:
 * - Lanes: Web + Marketing (2 lanes)
 * - Stacks: 2 (Control vs Gemini) - GPT-5/O3-Pro removed (unavailable)
 * - Reps: 2 each = 8 total runs
 * - Pass criteria: ≥87.5% (7/8)
 * 
 * Scientific Requirements:
 * 1. MODEL_LOCK logging per specialist
 * 2. Runtime hard-fail on model-not-found
 * 3. 4 artifacts per run (systems.json, brand.json, critic.json, run_meta.json)
 * 4. 3 output files (PILOT_SCORECARD.md, PILOT_RESULTS.json, PILOT_LIAR_LIST.json)
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { readFileSync } from "fs";
import { preflightMultiplePolicies, printPreflightReport } from "../server/ai/engine/policy/preflightCheck";
import { callSpecialistWithRetry } from "../server/ai/engine/specialists/index";

// Pilot configuration
const PILOT_CONFIG = {
  lanes: ["web", "marketing"] as const,
  stacks: [
    { name: "Control Champion (4o + Opus)", policyName: "swarm_gate_a_control" },
    // GPT-5 Stack removed - model unavailable ("No response from AI model")
    // O3-Pro Stack removed - model unavailable (4/4 failures in V3)
    { name: "Gemini 2.5 Pro Stack", policyName: "swarm_gemini_2_5_pro" },
  ],
  repsPerStack: 2,
  outputDir: "runs/pilot_clean", // Clean Pilot: Control vs Gemini (8 runs)
};

const TEST_PLAN = {
  projectId: "pilot_tournament_v2",
  businessName: "LaunchBase",
  industry: "SaaS",
  targetAudience: "Small business owners",
  goals: ["Validate tournament infrastructure", "Test multi-model reliability"],
};

interface PilotRun {
  runId: string;
  lane: string;
  stack: string;
  policyName: string;
  rep: number;
  systemsResult: any;
  brandResult: any;
  criticResult: any;
  modelLocks: {
    systems: { requested: string; resolved: string };
    brand: { requested: string; resolved: string };
    critic: { requested: string; resolved: string };
  };
  pass: boolean;
  failureReason?: string;
  validationDetails: {
    systemsChanges: number;
    brandChanges: number;
    criticIssues: number;
    criticFixes: number;
    hasRequiredFields: boolean;
  };
  durationMs: number;
  costUsd: number;
  liarFlags: string[];
}

function extractModelLock(result: any): { requested: string; resolved: string } {
  const requested = result.meta?.modelRequested || result.meta?.model || "unknown";
  const resolved = result.meta?.modelResolved || result.meta?.model || "unknown";
  return { requested, resolved };
}

function detectLiarFlags(result: any, role: string): string[] {
  const flags: string[] = [];
  const payload = result.artifact?.payload;
  
  if (!payload) return flags;
  
  // Check for unverifiable claims
  const text = JSON.stringify(payload);
  if (text.includes("26/26 tests") || text.includes("100% coverage")) {
    flags.push(`${role}: unverifiable_test_claim`);
  }
  
  // Check for invented features
  if (text.includes("AI-powered") || text.includes("machine learning")) {
    flags.push(`${role}: invented_feature`);
  }
  
  // Check for confidence inflation
  if (payload.confidence && payload.confidence > 0.95) {
    flags.push(`${role}: confidence_inflation`);
  }
  
  // Check for schema weirdness
  if (payload.proposedChanges) {
    for (const change of payload.proposedChanges) {
      if (!change.targetKey || !change.value) {
        flags.push(`${role}: schema_weirdness`);
        break;
      }
    }
  }
  
  return flags;
}

async function runPilot() {
  console.log("🏆 CLEAN PILOT: Control vs Gemini (8 runs)\n");
  
  const startTime = Date.now();
  
  // Step 1: Load all policies
  console.log("📦 Loading policies...");
  
  function loadPolicy(policyName: string) {
    const policyPath = `/home/ubuntu/launchbase/server/ai/engine/policy/policies/${policyName}.json`;
    const raw = JSON.parse(readFileSync(policyPath, "utf-8"));
    // Handle both old (swarm.roles) and new (specialists.roles) formats
    return raw.swarm || raw.specialists || raw;
  }
  
  const policies = PILOT_CONFIG.stacks.map((stack) => ({
    name: stack.policyName,
    policy: loadPolicy(stack.policyName),
  }));
  
  // Step 2: Preflight check
  console.log("\n🔍 Running preflight policy check...");
  
  // Build required roles for each policy (base roles only, no lane suffixes)
  const policiesWithRoles = policies.map(p => ({
    ...p,
    requiredRoles: ["designer_systems_fast", "designer_brand_fast", "design_critic_ruthless"],
  }));
  
  const preflightResult = preflightMultiplePolicies(policiesWithRoles);
  printPreflightReport(preflightResult.results);
  
  if (!preflightResult.success) {
    console.error("\n❌ PREFLIGHT FAILED: Some roles are missing from policies");
    console.error("Fix policy structure before running tournament");
    process.exit(1);
  }
  
  console.log("\n✅ PREFLIGHT PASSED: All policies validated\n");
  
  // Create output directory
  mkdirSync(PILOT_CONFIG.outputDir, { recursive: true });
  mkdirSync(join(PILOT_CONFIG.outputDir, "artifacts"), { recursive: true });
  
  // Step 3: Run tournament
  const runs: PilotRun[] = [];
  let successCount = 0;
  let failureCount = 0;
  let totalCost = 0;
  const allLiarFlags: string[] = [];
  
  for (const stack of PILOT_CONFIG.stacks) {
    console.log(`\n📦 Stack: ${stack.name}`);
    const policy = policies.find(p => p.name === stack.policyName)!.policy;
    
    for (let rep = 1; rep <= PILOT_CONFIG.repsPerStack; rep++) {
      for (const lane of PILOT_CONFIG.lanes) {
        const runId = `pilot_v2_${stack.policyName}_${lane}_rep${rep}_${Date.now()}`;
        const runStartTime = Date.now();
        
        console.log(`\n  Run ${runs.length + 1}/16 (${stack.name}, ${lane}, rep ${rep})`);
        
        try {
          // Run 3-step macro: systems designer → brand designer → critic
          // Note: Use base role names for config lookup, but pass lane-suffixed role names to specialist
          console.log(`    [1/3] Systems designer...`);
          const systemsResult = await callSpecialistWithRetry({
            role: `designer_systems_fast_${lane}` as any,
            roleConfig: policy.roles["designer_systems_fast"],
            input: { plan: TEST_PLAN },
            trace: { traceId: `${runId}_systems`, startedAt: new Date().toISOString() },
            enableLadder: false,
          });
          
          const systemsModelLock = extractModelLock(systemsResult);
          console.log(`    MODEL_LOCK systems=${systemsModelLock.resolved}`);
          
          console.log(`    [2/3] Brand designer...`);
          const brandResult = await callSpecialistWithRetry({
            role: `designer_brand_fast_${lane}` as any,
            roleConfig: policy.roles["designer_brand_fast"],
            input: { plan: TEST_PLAN },
            trace: { traceId: `${runId}_brand`, startedAt: new Date().toISOString() },
            enableLadder: false,
          });
          
          const brandModelLock = extractModelLock(brandResult);
          console.log(`    MODEL_LOCK brand=${brandModelLock.resolved}`);
          
          console.log(`    [3/3] Critic...`);
          const criticResult = await callSpecialistWithRetry({
            role: `design_critic_ruthless_${lane}` as any,
            roleConfig: policy.roles["design_critic_ruthless"],
            input: {
              plan: TEST_PLAN,
              craftArtifacts: [
                { role: `designer_systems_fast_${lane}`, output: systemsResult.artifact.payload },
                { role: `designer_brand_fast_${lane}`, output: brandResult.artifact.payload },
              ],
            },
            trace: { traceId: `${runId}_critic`, startedAt: new Date().toISOString() },
            enableLadder: false,
          });
          
          const criticModelLock = extractModelLock(criticResult);
          console.log(`    MODEL_LOCK critic=${criticModelLock.resolved}`);
          
          // Save artifacts
          const artifactDir = join(PILOT_CONFIG.outputDir, "artifacts", runId);
          mkdirSync(artifactDir, { recursive: true });
          
          writeFileSync(join(artifactDir, "systems.json"), JSON.stringify(systemsResult.artifact.payload, null, 2));
          writeFileSync(join(artifactDir, "brand.json"), JSON.stringify(brandResult.artifact.payload, null, 2));
          writeFileSync(join(artifactDir, "critic.json"), JSON.stringify(criticResult.artifact.payload, null, 2));
          
          // Validate results
          const systemsChanges = systemsResult.artifact.payload.proposedChanges?.length ?? 0;
          const brandChanges = brandResult.artifact.payload.proposedChanges?.length ?? 0;
          const criticIssues = criticResult.artifact.payload.issues?.length ?? 0;
          const criticFixes = criticResult.artifact.payload.suggestedFixes?.length ?? 0;
          const hasRequiredFields = 
            criticResult.artifact.payload.requiresApproval !== undefined &&
            criticResult.artifact.payload.previewRecommended !== undefined;
          
          const pass =
            systemsResult.stopReason === "ok" &&
            brandResult.stopReason === "ok" &&
            criticResult.stopReason === "ok" &&
            systemsChanges === 8 &&
            brandChanges === 8 &&
            criticIssues >= 10 &&
            criticFixes >= 10 &&
            hasRequiredFields;
          
          const runCost =
            (systemsResult.meta?.costUsd ?? 0) +
            (brandResult.meta?.costUsd ?? 0) +
            (criticResult.meta?.costUsd ?? 0);
          
          totalCost += runCost;
          
          // Detect liar flags
          const liarFlags = [
            ...detectLiarFlags(systemsResult, "systems"),
            ...detectLiarFlags(brandResult, "brand"),
            ...detectLiarFlags(criticResult, "critic"),
          ];
          
          allLiarFlags.push(...liarFlags.map(f => `${runId}: ${f}`));
          
          const run: PilotRun = {
            runId,
            lane,
            stack: stack.name,
            policyName: stack.policyName,
            rep,
            systemsResult,
            brandResult,
            criticResult,
            modelLocks: {
              systems: systemsModelLock,
              brand: brandModelLock,
              critic: criticModelLock,
            },
            pass,
            failureReason: pass ? undefined : `Systems: ${systemsChanges}/8, Brand: ${brandChanges}/8, Critic: ${criticIssues}/${criticFixes}, RequiredFields: ${hasRequiredFields}`,
            validationDetails: {
              systemsChanges,
              brandChanges,
              criticIssues,
              criticFixes,
              hasRequiredFields,
            },
            durationMs: Date.now() - runStartTime,
            costUsd: runCost,
            liarFlags,
          };
          
          // Save run_meta.json
          writeFileSync(
            join(artifactDir, "run_meta.json"),
            JSON.stringify({
              runId,
              lane,
              stack: stack.name,
              policyName: stack.policyName,
              rep,
              modelLocks: run.modelLocks,
              pass,
              failureReason: run.failureReason,
              validationDetails: run.validationDetails,
              durationMs: run.durationMs,
              costUsd: runCost,
              liarFlags,
            }, null, 2)
          );
          
          runs.push(run);
          
          if (pass) {
            successCount++;
            console.log(`    ✅ PASS (${systemsChanges}+${brandChanges} changes, ${criticIssues}/${criticFixes} issues/fixes, $${runCost.toFixed(4)})`);
          } else {
            failureCount++;
            console.log(`    ❌ FAIL: ${run.failureReason}`);
          }
          
          if (liarFlags.length > 0) {
            console.log(`    🚩 LIAR FLAGS: ${liarFlags.join(", ")}`);
          }
        } catch (err: any) {
          failureCount++;
          const run: PilotRun = {
            runId,
            lane,
            stack: stack.name,
            policyName: stack.policyName,
            rep,
            systemsResult: null,
            brandResult: null,
            criticResult: null,
            modelLocks: {
              systems: { requested: "unknown", resolved: "unknown" },
              brand: { requested: "unknown", resolved: "unknown" },
              critic: { requested: "unknown", resolved: "unknown" },
            },
            pass: false,
            failureReason: err.message,
            validationDetails: {
              systemsChanges: 0,
              brandChanges: 0,
              criticIssues: 0,
              criticFixes: 0,
              hasRequiredFields: false,
            },
            durationMs: Date.now() - runStartTime,
            costUsd: 0,
            liarFlags: [],
          };
          runs.push(run);
          console.log(`    ❌ FAIL: ${err.message}`);
        }
      }
    }
  }
  
  // Step 4: Generate reports
  const totalDuration = Date.now() - startTime;
  const passRate = (successCount / runs.length) * 100;
  const avgDuration = runs.reduce((sum, r) => sum + r.durationMs, 0) / runs.length;
  const avgCost = totalCost / runs.length;
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 PILOT TOURNAMENT V3 SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total runs: ${runs.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  console.log(`Pass rate: ${passRate.toFixed(1)}% (target: ≥87.5% = 7/8)`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  console.log(`Avg cost/run: $${avgCost.toFixed(4)}`);
  console.log(`Avg duration: ${(avgDuration / 1000).toFixed(1)}s`);
  console.log(`Total time: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`Liar flags: ${allLiarFlags.length}`);
  
  // Per-stack breakdown
  console.log("\n📦 PER-STACK RESULTS:");
  for (const stack of PILOT_CONFIG.stacks) {
    const stackRuns = runs.filter(r => r.stack === stack.name);
    const stackSuccess = stackRuns.filter(r => r.pass).length;
    const stackCost = stackRuns.reduce((sum, r) => sum + r.costUsd, 0);
    console.log(`${stack.name}:`);
    console.log(`  Success: ${stackSuccess}/${stackRuns.length}`);
    console.log(`  Cost: $${stackCost.toFixed(4)}`);
  }
  
  // Per-lane breakdown
  console.log("\n🎯 PER-LANE RESULTS:");
  for (const lane of PILOT_CONFIG.lanes) {
    const laneRuns = runs.filter(r => r.lane === lane);
    const laneSuccess = laneRuns.filter(r => r.pass).length;
    console.log(`${lane}:`);
    console.log(`  Success: ${laneSuccess}/${laneRuns.length}`);
  }
  
  // Save PILOT_RESULTS.json
  const resultsPath = join(PILOT_CONFIG.outputDir, "PILOT_RESULTS.json");
  writeFileSync(
    resultsPath,
    JSON.stringify(
      {
        runs,
        summary: {
          successCount,
          failureCount,
          passRate,
          totalCost,
          avgCost,
          avgDuration,
          totalDuration,
          liarFlagCount: allLiarFlags.length,
        },
      },
      null,
      2
    )
  );
  console.log(`\n✅ Results saved to: ${resultsPath}`);
  
  // Save PILOT_LIAR_LIST.json
  const liarListPath = join(PILOT_CONFIG.outputDir, "PILOT_LIAR_LIST.json");
  writeFileSync(liarListPath, JSON.stringify({ flags: allLiarFlags }, null, 2));
  console.log(`✅ Liar list saved to: ${liarListPath}`);
  
  // Generate PILOT_SCORECARD.md
  const scorecardPath = join(PILOT_CONFIG.outputDir, "PILOT_SCORECARD.md");
  const scorecard = `# Pilot Tournament V2 Scorecard

**Date:** ${new Date().toISOString()}
**Duration:** ${(totalDuration / 1000).toFixed(1)}s
**Pass Rate:** ${passRate.toFixed(1)}% (${successCount}/16)
**Total Cost:** $${totalCost.toFixed(4)}

## Summary

- **Target:** ≥95% (15/16 runs passing)
- **Actual:** ${passRate.toFixed(1)}% (${successCount}/16 runs passing)
- **Result:** ${passRate >= 95 ? "✅ PASSED" : "❌ FAILED"}

## Per-Stack Leaderboard

${PILOT_CONFIG.stacks.map(stack => {
  const stackRuns = runs.filter(r => r.stack === stack.name);
  const stackSuccess = stackRuns.filter(r => r.pass).length;
  const stackCost = stackRuns.reduce((sum, r) => sum + r.costUsd, 0);
  return `### ${stack.name}
- **Success Rate:** ${stackSuccess}/${stackRuns.length} (${((stackSuccess / stackRuns.length) * 100).toFixed(1)}%)
- **Total Cost:** $${stackCost.toFixed(4)}
- **Avg Cost/Run:** $${(stackCost / stackRuns.length).toFixed(4)}`;
}).join("\n\n")}

## Per-Lane Results

${PILOT_CONFIG.lanes.map(lane => {
  const laneRuns = runs.filter(r => r.lane === lane);
  const laneSuccess = laneRuns.filter(r => r.pass).length;
  return `### ${lane}
- **Success Rate:** ${laneSuccess}/${laneRuns.length} (${((laneSuccess / laneRuns.length) * 100).toFixed(1)}%)`;
}).join("\n\n")}

## Top 3 Runs (Web)

${runs
  .filter(r => r.lane === "web" && r.pass)
  .sort((a, b) => b.validationDetails.criticIssues - a.validationDetails.criticIssues)
  .slice(0, 3)
  .map((r, i) => `${i + 1}. **${r.stack}** (rep ${r.rep}) - ${r.validationDetails.systemsChanges}+${r.validationDetails.brandChanges} changes, ${r.validationDetails.criticIssues}/${r.validationDetails.criticFixes} issues/fixes, $${r.costUsd.toFixed(4)}`)
  .join("\n")}

## Top 3 Runs (Marketing)

${runs
  .filter(r => r.lane === "marketing" && r.pass)
  .sort((a, b) => b.validationDetails.criticIssues - a.validationDetails.criticIssues)
  .slice(0, 3)
  .map((r, i) => `${i + 1}. **${r.stack}** (rep ${r.rep}) - ${r.validationDetails.systemsChanges}+${r.validationDetails.brandChanges} changes, ${r.validationDetails.criticIssues}/${r.validationDetails.criticFixes} issues/fixes, $${r.costUsd.toFixed(4)}`)
  .join("\n")}

## Failures

${runs.filter(r => !r.pass).map(r => `- **Run ${runs.indexOf(r) + 1}** (${r.stack}, ${r.lane}, rep ${r.rep}): ${r.failureReason}`).join("\n")}

## Liar Flags

${allLiarFlags.length === 0 ? "None detected ✅" : allLiarFlags.map(f => `- ${f}`).join("\n")}

## Decision

${passRate >= 95 
  ? "✅ **PILOT PASSED** - Infrastructure validated, ready for full 120-run Mega Tournament V2" 
  : `❌ **PILOT FAILED** - Fix issues before running full tournament (target: ≥95%, actual: ${passRate.toFixed(1)}%)`}
`;
  
  writeFileSync(scorecardPath, scorecard);
  console.log(`✅ Scorecard saved to: ${scorecardPath}`);
  
  // Decision gate
  if (passRate >= 87.5) {
    console.log("\n✅ PILOT PASSED: Infrastructure validated, ready for full 120-run tournament");
    process.exit(0);
  } else {
    console.log("\n❌ PILOT FAILED: Fix issues before running full tournament");
    console.log(`   Target: ≥87.5% (7/8), Actual: ${passRate.toFixed(1)}% (${successCount}/8)`);
    process.exit(1);
  }
}

runPilot().catch((err) => {
  console.error("💥 Pilot tournament crashed:", err);
  process.exit(1);
});
