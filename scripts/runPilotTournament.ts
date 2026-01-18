/**
 * Pilot Tournament Runner
 * 
 * 16-run pilot to validate tournament infrastructure before full 120-run Mega Tournament V2
 * 
 * Design:
 * - Lanes: Web + Marketing (2 lanes)
 * - Stacks: 4 (Control/GPT-5/O3-Pro/Gemini)
 * - Reps: 2 each = 16 total runs
 * - Pass criteria: ≥95% (15/16)
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
    { name: "GPT-5 Stack", policyName: "swarm_gpt_5" },
    { name: "O3-Pro Stack", policyName: "swarm_o3_pro" },
    { name: "Gemini 2.5 Pro Stack", policyName: "swarm_gemini_2_5_pro" },
  ],
  repsPerStack: 2,
  outputDir: "runs/pilot",
};

const TEST_PLAN = {
  projectId: "pilot_tournament",
  businessName: "LaunchBase",
  industry: "SaaS",
  targetAudience: "Small business owners",
  goals: ["Validate tournament infrastructure", "Test multi-model reliability"],
};

interface PilotRun {
  runId: string;
  lane: string;
  stack: string;
  rep: number;
  systemsResult: any;
  brandResult: any;
  criticResult: any;
  pass: boolean;
  failureReason?: string;
  durationMs: number;
  costUsd: number;
}

async function runPilot() {
  console.log("🏆 PILOT TOURNAMENT: 16-run infrastructure validation\n");
  
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
    console.error("\n❌ PREFLIGHT FAILED: Some models are missing from registry");
    console.error("Fix model references before running tournament");
    process.exit(1);
  }
  
  console.log("\n✅ PREFLIGHT PASSED: All models verified in registry\n");
  
  // Step 3: Run tournament
  const runs: PilotRun[] = [];
  let successCount = 0;
  let failureCount = 0;
  let totalCost = 0;
  
  for (const stack of PILOT_CONFIG.stacks) {
    console.log(`\n📦 Stack: ${stack.name}`);
    const policy = policies.find(p => p.name === stack.policyName)!.policy;
    
    for (let rep = 1; rep <= PILOT_CONFIG.repsPerStack; rep++) {
      for (const lane of PILOT_CONFIG.lanes) {
        const runId = `pilot_${stack.policyName}_${lane}_rep${rep}_${Date.now()}`;
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
          
          console.log(`    [2/3] Brand designer...`);
          const brandResult = await callSpecialistWithRetry({
            role: `designer_brand_fast_${lane}` as any,
            roleConfig: policy.roles["designer_brand_fast"],
            input: { plan: TEST_PLAN },
            trace: { traceId: `${runId}_brand`, startedAt: new Date().toISOString() },
            enableLadder: false,
          });
          
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
          
          // Validate results
          const systemsChanges = systemsResult.artifact.payload.proposedChanges?.length ?? 0;
          const brandChanges = brandResult.artifact.payload.proposedChanges?.length ?? 0;
          const criticIssues = criticResult.artifact.payload.issues?.length ?? 0;
          const criticFixes = criticResult.artifact.payload.suggestedFixes?.length ?? 0;
          
          const pass =
            systemsResult.stopReason === "ok" &&
            brandResult.stopReason === "ok" &&
            criticResult.stopReason === "ok" &&
            systemsChanges === 8 &&
            brandChanges === 8 &&
            criticIssues >= 10 &&
            criticFixes >= 10;
          
          const runCost =
            (systemsResult.meta?.costUsd ?? 0) +
            (brandResult.meta?.costUsd ?? 0) +
            (criticResult.meta?.costUsd ?? 0);
          
          totalCost += runCost;
          
          const run: PilotRun = {
            runId,
            lane,
            stack: stack.name,
            rep,
            systemsResult,
            brandResult,
            criticResult,
            pass,
            failureReason: pass ? undefined : `Systems: ${systemsChanges}/8, Brand: ${brandChanges}/8, Critic: ${criticIssues}/${criticFixes}`,
            durationMs: Date.now() - runStartTime,
            costUsd: runCost,
          };
          
          runs.push(run);
          
          if (pass) {
            successCount++;
            console.log(`    ✅ PASS (${systemsChanges}+${brandChanges} changes, ${criticIssues}/${criticFixes} issues/fixes, $${runCost.toFixed(4)})`);
          } else {
            failureCount++;
            console.log(`    ❌ FAIL: ${run.failureReason}`);
          }
        } catch (err: any) {
          failureCount++;
          const run: PilotRun = {
            runId,
            lane,
            stack: stack.name,
            rep,
            systemsResult: null,
            brandResult: null,
            criticResult: null,
            pass: false,
            failureReason: err.message,
            durationMs: Date.now() - runStartTime,
            costUsd: 0,
          };
          runs.push(run);
          console.log(`    ❌ FAIL: ${err.message}`);
        }
      }
    }
  }
  
  // Step 4: Generate report
  const totalDuration = Date.now() - startTime;
  const passRate = (successCount / runs.length) * 100;
  const avgDuration = runs.reduce((sum, r) => sum + r.durationMs, 0) / runs.length;
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 PILOT TOURNAMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total runs: ${runs.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  console.log(`Pass rate: ${passRate.toFixed(1)}% (target: ≥95%)`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  console.log(`Avg duration: ${(avgDuration / 1000).toFixed(1)}s`);
  console.log(`Total time: ${(totalDuration / 1000).toFixed(1)}s`);
  
  // Per-stack breakdown
  console.log("\n📦 PER-STACK RESULTS:");
  for (const stack of PILOT_CONFIG.stacks) {
    const stackRuns = runs.filter(r => r.stack === stack.name);
    const stackSuccess = stackRuns.filter(r => r.pass).length;
    console.log(`${stack.name}:`);
    console.log(`  Success: ${stackSuccess}/${stackRuns.length}`);
  }
  
  // Save results
  mkdirSync(PILOT_CONFIG.outputDir, { recursive: true });
  const resultsPath = join(PILOT_CONFIG.outputDir, "PILOT_RESULTS.json");
  writeFileSync(resultsPath, JSON.stringify({ runs, summary: { successCount, failureCount, passRate, totalCost, avgDuration, totalDuration } }, null, 2));
  console.log(`\n✅ Results saved to: ${resultsPath}`);
  
  // Decision gate
  if (passRate >= 95) {
    console.log("\n✅ PILOT PASSED: Infrastructure validated, ready for full 120-run tournament");
    process.exit(0);
  } else {
    console.log("\n❌ PILOT FAILED: Fix issues before running full tournament");
    console.log(`   Target: ≥95% (15/16), Actual: ${passRate.toFixed(1)}% (${successCount}/16)`);
    process.exit(1);
  }
}

runPilot().catch((err) => {
  console.error("💥 Pilot tournament crashed:", err);
  process.exit(1);
});
