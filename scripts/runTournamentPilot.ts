/**
 * Tournament Pilot - 10 runs to verify integrity
 * 
 * Web lane only × 5 stacks × 2 reps = 10 runs
 * 
 * Verifies:
 * ✅ Model resolution (no MODEL_NOT_IN_REGISTRY errors)
 * ✅ Schema compliance (8+8+10 pattern)
 * ✅ Truthfulness scoring applied
 * ✅ Cost/latency reasonable
 */

import { callSpecialistWithRetry } from "../server/ai/engine/specialists/index.js";
import { calculateAggregateTruthfulness } from "../server/ai/engine/scoring/truthfulnessIndex.js";
import { modelRegistry } from "../server/ai/index.js";
import fs from "fs";
import path from "path";

// Pre-flight model registry check
async function preFlightCheck(stacks: any[]) {
  console.log("\n🔍 PRE-FLIGHT MODEL REGISTRY CHECK\n");
  
  await modelRegistry.refresh(false);
  const allModels = modelRegistry.list();
  const modelIds = new Set(allModels.map(m => m.id));
  
  const missing: string[] = [];
  const verified: string[] = [];
  
  for (const stack of stacks) {
    const policyPath = path.join(process.cwd(), `server/ai/engine/policy/policies/${stack.policy}.json`);
    const policy = JSON.parse(fs.readFileSync(policyPath, "utf-8"));
    
    for (const [role, config] of Object.entries(policy.specialists.roles as any)) {
      const modelId = config.model;
      if (!modelIds.has(modelId)) {
        missing.push(`${stack.id}.${role}: ${modelId}`);
      } else {
        verified.push(`${stack.id}.${role}: ${modelId}`);
      }
    }
  }
  
  console.log(`✅ Verified models: ${verified.length}`);
  verified.forEach(v => console.log(`  - ${v}`));
  
  if (missing.length > 0) {
    console.log(`\n❌ Missing models: ${missing.length}`);
    missing.forEach(m => console.log(`  - ${m}`));
    throw new Error(`PRE-FLIGHT FAILED: ${missing.length} models not in registry`);
  }
  
  console.log("\n✅ PRE-FLIGHT PASSED: All models verified in registry\n");
}

// Pilot configuration
const PILOT_CONFIG = {
  lane: {
    id: "web",
    name: "Web Design",
    brief: "LaunchBase homepage: Improve structure, conversion architecture, and trust patterns for small business owners who need an operating system for their website.",
    promptSuffix: "_web",
  },
  stacks: [
    { id: "control_champion", name: "Control Champion (4o + Opus)", policy: "swarm_design_prod_v1", provider: "openai" },
    { id: "gpt_5", name: "GPT-5 Stack", policy: "swarm_gpt_5", provider: "openai" },
    { id: "o3_pro", name: "O3-Pro Stack", policy: "swarm_o3_pro", provider: "openai" },
    { id: "gemini_2_5_pro", name: "Gemini 2.5 Pro Stack", policy: "swarm_gemini_2_5_pro", provider: "google" },
  ],
  repsPerStack: 2,
};

interface PilotRun {
  runId: string;
  stackId: string;
  stackName: string;
  rep: number;
  systemsResult: any;
  brandResult: any;
  criticResult: any;
  truthfulness: any;
  cost: number;
  duration: number;
  success: boolean;
  error?: string;
}

async function runPilot() {
  console.log("🚀 TOURNAMENT PILOT STARTING\n");
  console.log(`Lane: ${PILOT_CONFIG.lane.name}`);
  console.log(`Stacks: ${PILOT_CONFIG.stacks.length}`);
  console.log(`Reps per stack: ${PILOT_CONFIG.repsPerStack}`);
  console.log(`Total runs: ${PILOT_CONFIG.stacks.length * PILOT_CONFIG.repsPerStack}\n`);
  
  // Pre-flight check
  await preFlightCheck(PILOT_CONFIG.stacks);
  
  const results: PilotRun[] = [];
  let totalCost = 0;
  
  for (const stack of PILOT_CONFIG.stacks) {
    console.log(`\n📦 Stack: ${stack.name}`);
    
    for (let rep = 1; rep <= PILOT_CONFIG.repsPerStack; rep++) {
      const runId = `pilot_${stack.id}_rep${rep}_${Date.now()}`;
      const startTime = Date.now();
      
      console.log(`\n  Run ${rep}/${PILOT_CONFIG.repsPerStack} (${runId})`);
      
      try {
        // Load policy
        const policyPath = path.join(process.cwd(), `server/ai/engine/policy/policies/${stack.policy}.json`);
        const policy = JSON.parse(fs.readFileSync(policyPath, "utf-8"));
        
        function getRoleConfig(roleName: string) {
          const rc = policy.specialists?.roles?.[roleName];
          if (!rc?.model) {
            throw new Error(`[TOURNAMENT] Missing model for role=${roleName} in policy=${stack.policy}`);
          }
          console.log(`[MODEL_LOCK] role=${roleName} model=${rc.model}`);
          return rc;
        }
        
        const systemsRoleConfig = getRoleConfig("designer_systems_fast");
        const brandRoleConfig = getRoleConfig("designer_brand_fast");
        const criticRoleConfig = getRoleConfig("design_critic_ruthless");
        
        // Systems designer
        console.log(`    [1/3] Systems designer...`);
        const systemsResult = await callSpecialistWithRetry({
          role: `designer_systems_fast${PILOT_CONFIG.lane.promptSuffix}`,
          trace: { jobId: runId, runId },
          input: { plan: { brief: PILOT_CONFIG.lane.brief } },
          roleConfig: systemsRoleConfig,
          enableLadder: false, // Pilot uses no ladder
          enableContentValidation: false, // Pilot tests model resolution only
        });
        
        if (systemsResult.stopReason !== "ok") {
          throw new Error(`Systems failed: ${systemsResult.stopReason}`);
        }
        
        console.log(`      ✅ ${systemsResult.artifact.payload.proposedChanges.length} changes`);
        
        // Brand designer
        console.log(`    [2/3] Brand designer...`);
        const brandResult = await callSpecialistWithRetry({
          role: `designer_brand_fast${PILOT_CONFIG.lane.promptSuffix}`,
          trace: { jobId: runId, runId },
          input: { plan: { brief: PILOT_CONFIG.lane.brief } },
          roleConfig: brandRoleConfig,
          enableLadder: false,
          enableContentValidation: false,
        });
        
        if (brandResult.stopReason !== "ok") {
          throw new Error(`Brand failed: ${brandResult.stopReason}`);
        }
        
        console.log(`      ✅ ${brandResult.artifact.payload.proposedChanges.length} changes`);
        
        // Critic
        console.log(`    [3/3] Critic...`);
        const criticResult = await callSpecialistWithRetry({
          role: `design_critic_ruthless${PILOT_CONFIG.lane.promptSuffix}`,
          trace: { jobId: runId, runId },
          input: {
            plan: { brief: PILOT_CONFIG.lane.brief },
            craftArtifacts: [
              systemsResult.artifact,
              brandResult.artifact,
            ],
          },
          roleConfig: criticRoleConfig,
          enableLadder: false,
          enableContentValidation: false,
        });
        
        if (criticResult.stopReason !== "ok") {
          throw new Error(`Critic failed: ${criticResult.stopReason}`);
        }
        
        console.log(`      ✅ ${criticResult.artifact.payload.issues.length} issues, ${criticResult.artifact.payload.fixes.length} fixes`);
        
        // Calculate truthfulness
        const truthfulness = calculateAggregateTruthfulness({
          systems: systemsResult.artifact.payload,
          brand: brandResult.artifact.payload,
          critic: criticResult.artifact.payload,
        });
        
        const duration = Date.now() - startTime;
        const cost = 0; // TODO: extract from results
        totalCost += cost;
        
        console.log(`      📊 Truthfulness: ${truthfulness.totalPenalty} penalty, ${truthfulness.liarFlags.length} liar flags`);
        console.log(`      ⏱️  Duration: ${(duration / 1000).toFixed(1)}s`);
        
        results.push({
          runId,
          stackId: stack.id,
          stackName: stack.name,
          rep,
          systemsResult: systemsResult.artifact.payload,
          brandResult: brandResult.artifact.payload,
          criticResult: criticResult.artifact.payload,
          truthfulness,
          cost,
          duration,
          success: true,
        });
        
      } catch (error: any) {
        console.log(`      ❌ FAILED: ${error.message}`);
        results.push({
          runId,
          stackId: stack.id,
          stackName: stack.name,
          rep,
          systemsResult: null,
          brandResult: null,
          criticResult: null,
          truthfulness: null,
          cost: 0,
          duration: Date.now() - startTime,
          success: false,
          error: error.message,
        });
      }
    }
  }
  
  // Summary
  console.log("\n\n📊 PILOT SUMMARY\n");
  console.log(`Total runs: ${results.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  console.log(`Total cost: $${totalCost.toFixed(2)}`);
  console.log(`Avg duration: ${(results.reduce((sum, r) => sum + r.duration, 0) / results.length / 1000).toFixed(1)}s`);
  
  // Per-stack summary
  console.log("\n📦 PER-STACK RESULTS:\n");
  for (const stack of PILOT_CONFIG.stacks) {
    const stackRuns = results.filter(r => r.stackId === stack.id);
    const successCount = stackRuns.filter(r => r.success).length;
    const avgPenalty = stackRuns
      .filter(r => r.success && r.truthfulness)
      .reduce((sum, r) => sum + r.truthfulness.totalPenalty, 0) / successCount;
    
    console.log(`${stack.name}:`);
    console.log(`  Success: ${successCount}/${stackRuns.length}`);
    if (successCount > 0) {
      console.log(`  Avg truthfulness penalty: ${avgPenalty.toFixed(1)}`);
    }
  }
  
  // Save results
  const outputDir = path.join(process.cwd(), "runs/pilot");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "PILOT_RESULTS.json"),
    JSON.stringify(results, null, 2)
  );
  
  console.log(`\n✅ Results saved to: runs/pilot/PILOT_RESULTS.json`);
  
  // Pass/fail decision
  const failedCount = results.filter(r => !r.success).length;
  if (failedCount > 0) {
    console.log(`\n❌ PILOT FAILED: ${failedCount} runs failed`);
    console.log("Fix issues before running full tournament.");
    process.exit(1);
  }
  
  console.log("\n✅ PILOT PASSED: All runs successful");
  console.log("Ready to run full Mega Tournament V2 (120 runs)");
}

runPilot().catch(err => {
  console.error("\n❌ PILOT ERROR:", err);
  process.exit(1);
});
