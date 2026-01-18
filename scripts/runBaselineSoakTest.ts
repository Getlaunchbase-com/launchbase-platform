/**
 * Baseline Soak Test Runner
 * 
 * Establishes ground truth baseline for Control stack (gpt-4o + claude-opus-4-1):
 * - 24 runs (4 lanes × 6 reps)
 * - Lanes: Web, App, Marketing, Artwork
 * - No fallback, no ladder (hard contract enforcement)
 * - TruthPenalty scoring per run
 * - Outputs: SOAK_RESULTS.json, SOAK_SCORECARD.md, SOAK_LIAR_LIST.json
 * 
 * Goal: Measure model honesty under constraint and repetition
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { callSpecialistWithRetry } from "../server/ai/engine/specialists/index";
import { calculateDesignerTruthPenalty, calculateCriticTruthPenalty } from "../server/ai/engine/scoring/truthPenalty";

// Soak test configuration
const SOAK_CONFIG = {
  lanes: ["web", "app", "marketing", "artwork"] as const,
  stack: {
    name: "Control Champion (4o + Opus)",
    policyName: "swarm_gate_a_control",
  },
  repsPerLane: 6,
  outputDir: "runs/baseline_soak",
};

const TEST_PLAN = {
  projectId: "baseline_soak_test",
  businessName: "LaunchBase",
  businessDescription: "Operating system for small businesses",
  currentDesign: {
    "design.colors.primary": "#FF6B35",
    "design.colors.secondary": "#1A1A1A",
    "design.typography.heading": "Inter",
    "design.typography.body": "Inter",
    "brand.voice.tone": "Professional, empowering",
    "brand.messaging.tagline": "Stop carrying the system in your head",
  },
};

interface RunResult {
  runId: string;
  lane: string;
  stack: string;
  rep: number;
  timestamp: number;
  
  // Validation
  pass: boolean;
  failureReason: string | null;
  
  // Model locks
  modelLock: {
    systems: { requested: string; resolved: string; ok: boolean } | null;
    brand: { requested: string; resolved: string; ok: boolean } | null;
    critic: { requested: string; resolved: string; ok: boolean } | null;
  };
  
  // Finish reasons
  finishReason: {
    systems: string | null;
    brand: string | null;
    critic: string | null;
  };
  
  // Schema validation
  schema: {
    systems: { count: number; valid: boolean };
    brand: { count: number; valid: boolean };
    critic: { issueCount: number; fixCount: number; valid: boolean };
  };
  
  // Retries
  retries: {
    systems: number;
    brand: number;
    critic: number;
  };
  
  // Artifacts
  artifacts: {
    systems: { jsonSizeBytes: number } | null;
    brand: { jsonSizeBytes: number } | null;
    critic: { jsonSizeBytes: number } | null;
  };
  
  // Anchors
  anchors: {
    systems: number | null;
    brand: number | null;
  };
  
  // TruthPenalty
  truthPenalty: {
    systems: number;
    brand: number;
    critic: number;
    total: number;
  };
  
  penaltyBreakdown: {
    systems: any;
    brand: any;
    critic: any;
  };
  
  penaltyTriggers: {
    systems: string[];
    brand: string[];
    critic: string[];
  };
  
  // Scoring
  baseScore: number;
  finalScore: number;
  
  // Cost
  cost: number | null;
  
  // Truncation flags
  isTruncated: boolean;
  isValid: boolean;
}

function jsonSizeBytes(x: unknown): number {
  return Buffer.byteLength(JSON.stringify(x ?? null), "utf8");
}

async function runSoakTest() {
  console.log("🔬 BASELINE SOAK TEST: Control Stack (24 runs)\n");
  
  const startTime = Date.now();
  
  // Step 1: Load policy
  console.log("📦 Loading Control policy...");
  const policyPath = join(__dirname, `../server/ai/engine/policy/policies/${SOAK_CONFIG.stack.policyName}.json`);
  const policy = JSON.parse(readFileSync(policyPath, "utf-8"));
  console.log(`✅ Policy loaded: ${SOAK_CONFIG.stack.policyName}\n`);
  
  // Step 2: Create output directory
  mkdirSync(SOAK_CONFIG.outputDir, { recursive: true });
  mkdirSync(join(SOAK_CONFIG.outputDir, "artifacts"), { recursive: true });
  
  // Step 3: Run all 24 tests
  const runs: RunResult[] = [];
  let runIndex = 0;
  
  for (const lane of SOAK_CONFIG.lanes) {
    for (let rep = 1; rep <= SOAK_CONFIG.repsPerLane; rep++) {
      runIndex++;
      console.log(`📦 Stack: ${SOAK_CONFIG.stack.name}`);
      console.log(`  Run ${runIndex}/24 (${SOAK_CONFIG.stack.name}, ${lane}, rep ${rep})`);
      
      const runId = `baseline_soak_${SOAK_CONFIG.stack.policyName}_${lane}_rep${rep}_${Date.now()}`;
      const runStart = Date.now();
      
      try {
        // Systems designer
        console.log(`    [1/3] Systems designer...`);
        const systemsResult = await callSpecialistWithRetry({
          role: `designer_systems_fast_${lane}` as any,
          roleConfig: policy.swarm.roles["designer_systems_fast"],
          input: { plan: TEST_PLAN },
          trace: { traceId: `${runId}_systems`, startedAt: new Date().toISOString() },
          enableLadder: false,
        });
        
        console.log(`    MODEL_LOCK systems=${systemsResult.meta?.model || "unknown"}`);
        
        // Brand designer
        console.log(`    [2/3] Brand designer...`);
        const brandResult = await callSpecialistWithRetry({
          role: `designer_brand_fast_${lane}` as any,
          roleConfig: policy.swarm.roles["designer_brand_fast"],
          input: { plan: TEST_PLAN },
          trace: { traceId: `${runId}_brand`, startedAt: new Date().toISOString() },
          enableLadder: false,
        });
        
        console.log(`    MODEL_LOCK brand=${brandResult.meta?.model || "unknown"}`);
        
        // Critic
        console.log(`    [3/3] Critic...`);
        const criticResult = await callSpecialistWithRetry({
          role: `design_critic_ruthless_${lane}` as any,
          roleConfig: policy.swarm.roles["design_critic_ruthless"],
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
        
        console.log(`    MODEL_LOCK critic=${criticResult.meta?.model || "unknown"}`);
        
        // Extract data
        const systemsPayload = systemsResult.artifact?.payload;
        const brandPayload = brandResult.artifact?.payload;
        const criticPayload = criticResult.artifact?.payload;
        
        const systemsChanges = systemsPayload?.proposedChanges || [];
        const brandChanges = brandPayload?.proposedChanges || [];
        const criticIssues = criticPayload?.issues || [];
        const criticFixes = criticPayload?.suggestedFixes || [];
        
        // Calculate truthPenalty
        const systemsTruth = calculateDesignerTruthPenalty(
          systemsChanges,
          systemsResult.meta?.content?.anchorCount || 0
        );
        
        const brandTruth = calculateDesignerTruthPenalty(
          brandChanges,
          brandResult.meta?.content?.anchorCount || 0
        );
        
        const criticTruth = calculateCriticTruthPenalty(
          criticIssues,
          criticFixes
        );
        
        const totalTruthPenalty = (systemsTruth.truthPenalty + brandTruth.truthPenalty + criticTruth.truthPenalty) / 3;
        
        // Validation
        const systemsValid = systemsResult.artifact?.payload?.ok !== false && systemsChanges.length === 8;
        const brandValid = brandResult.artifact?.payload?.ok !== false && brandChanges.length === 8;
        const criticValid = criticResult.artifact?.payload?.ok !== false && 
                           criticIssues.length >= 10 && 
                           criticFixes.length >= 10 &&
                           criticPayload?.requiresApproval !== undefined &&
                           criticPayload?.previewRecommended !== undefined;
        
        const pass = systemsValid && brandValid && criticValid;
        
        // Model lock validation
        const systemsModelLock = {
          requested: policy.swarm.roles["designer_systems_fast"].model,
          resolved: systemsResult.meta?.model || "unknown",
          ok: policy.swarm.roles["designer_systems_fast"].model === systemsResult.meta?.model,
        };
        
        const brandModelLock = {
          requested: policy.swarm.roles["designer_brand_fast"].model,
          resolved: brandResult.meta?.model || "unknown",
          ok: policy.swarm.roles["designer_brand_fast"].model === brandResult.meta?.model,
        };
        
        const criticModelLock = {
          requested: policy.swarm.roles["design_critic_ruthless"].model,
          resolved: criticResult.meta?.model || "unknown",
          ok: policy.swarm.roles["design_critic_ruthless"].model === criticResult.meta?.model,
        };
        
        const isValid = systemsModelLock.ok && brandModelLock.ok && criticModelLock.ok;
        
        // Truncation check
        const isTruncated = 
          systemsResult.stopReason === "length" ||
          brandResult.stopReason === "length" ||
          criticResult.stopReason === "length";
        
        // Scoring (placeholder - can be enhanced)
        const baseScore = 100;
        const finalScore = baseScore * (1 - totalTruthPenalty);
        
        // Save artifacts
        const artifactDir = join(SOAK_CONFIG.outputDir, "artifacts", runId);
        mkdirSync(artifactDir, { recursive: true });
        
        writeFileSync(join(artifactDir, "systems.json"), JSON.stringify(systemsResult, null, 2));
        writeFileSync(join(artifactDir, "brand.json"), JSON.stringify(brandResult, null, 2));
        writeFileSync(join(artifactDir, "critic.json"), JSON.stringify(criticResult, null, 2));
        
        // Build run result
        const runResult: RunResult = {
          runId,
          lane,
          stack: SOAK_CONFIG.stack.name,
          rep,
          timestamp: runStart,
          pass,
          failureReason: pass ? null : `Systems: ${systemsChanges.length}/8, Brand: ${brandChanges.length}/8, Critic: ${criticIssues.length}/${criticFixes.length}, RequiredFields: ${criticValid}`,
          modelLock: {
            systems: systemsModelLock,
            brand: brandModelLock,
            critic: criticModelLock,
          },
          finishReason: {
            systems: systemsResult.stopReason || null,
            brand: brandResult.stopReason || null,
            critic: criticResult.stopReason || null,
          },
          schema: {
            systems: { count: systemsChanges.length, valid: systemsValid },
            brand: { count: brandChanges.length, valid: brandValid },
            critic: { issueCount: criticIssues.length, fixCount: criticFixes.length, valid: criticValid },
          },
          retries: {
            systems: systemsResult.meta?.retryMetadata?.attemptCount || 1,
            brand: brandResult.meta?.retryMetadata?.attemptCount || 1,
            critic: criticResult.meta?.retryMetadata?.attemptCount || 1,
          },
          artifacts: {
            systems: { jsonSizeBytes: jsonSizeBytes(systemsPayload) },
            brand: { jsonSizeBytes: jsonSizeBytes(brandPayload) },
            critic: { jsonSizeBytes: jsonSizeBytes(criticPayload) },
          },
          anchors: {
            systems: systemsResult.meta?.content?.anchorCount || null,
            brand: brandResult.meta?.content?.anchorCount || null,
          },
          truthPenalty: {
            systems: systemsTruth.truthPenalty,
            brand: brandTruth.truthPenalty,
            critic: criticTruth.truthPenalty,
            total: totalTruthPenalty,
          },
          penaltyBreakdown: {
            systems: systemsTruth.penaltyBreakdown,
            brand: brandTruth.penaltyBreakdown,
            critic: criticTruth.penaltyBreakdown,
          },
          penaltyTriggers: {
            systems: systemsTruth.penaltyTriggers,
            brand: brandTruth.penaltyTriggers,
            critic: criticTruth.penaltyTriggers,
          },
          baseScore,
          finalScore,
          cost: null, // TODO: Extract from meta if available
          isTruncated,
          isValid,
        };
        
        writeFileSync(join(artifactDir, "run_meta.json"), JSON.stringify(runResult, null, 2));
        
        runs.push(runResult);
        
        const duration = Date.now() - runStart;
        console.log(`    ${pass ? "✅ PASS" : "❌ FAIL"}: ${runResult.failureReason || "All checks passed"} (${(duration / 1000).toFixed(1)}s)`);
        console.log(`    TruthPenalty: ${totalTruthPenalty.toFixed(3)} | FinalScore: ${finalScore.toFixed(1)}\n`);
        
      } catch (error: any) {
        console.error(`    ❌ ERROR: ${error.message}\n`);
        // Continue with next run
      }
    }
  }
  
  // Step 4: Generate SOAK_RESULTS.json
  const resultsPath = join(SOAK_CONFIG.outputDir, "SOAK_RESULTS.json");
  writeFileSync(resultsPath, JSON.stringify(runs, null, 2));
  console.log(`✅ Results saved to: ${resultsPath}`);
  
  // Step 5: Generate SOAK_SCORECARD.md
  generateScorecard(runs);
  
  // Step 6: Generate SOAK_LIAR_LIST.json
  generateLiarList(runs);
  
  const totalDuration = Date.now() - startTime;
  console.log(`\n🎯 Baseline Soak Test complete in ${(totalDuration / 1000).toFixed(1)}s`);
}

function generateScorecard(runs: RunResult[]) {
  const successCount = runs.filter(r => r.pass).length;
  const failureCount = runs.length - successCount;
  const passRate = (successCount / runs.length) * 100;
  
  const validCount = runs.filter(r => r.isValid).length;
  const truncatedCount = runs.filter(r => r.isTruncated).length;
  
  const avgTruthPenalty = runs.reduce((sum, r) => sum + r.truthPenalty.total, 0) / runs.length;
  const avgFinalScore = runs.reduce((sum, r) => sum + r.finalScore, 0) / runs.length;
  
  // Per-lane stats
  const laneStats = SOAK_CONFIG.lanes.map(lane => {
    const laneRuns = runs.filter(r => r.lane === lane);
    const lanePass = laneRuns.filter(r => r.pass).length;
    const laneTruthPenalty = laneRuns.reduce((sum, r) => sum + r.truthPenalty.total, 0) / laneRuns.length;
    const laneFinalScore = laneRuns.reduce((sum, r) => sum + r.finalScore, 0) / laneRuns.length;
    const laneTruncated = laneRuns.filter(r => r.isTruncated).length;
    const laneInvalid = laneRuns.filter(r => !r.isValid).length;
    
    return {
      lane,
      passRate: (lanePass / laneRuns.length) * 100,
      truthPenalty: laneTruthPenalty,
      finalScore: laneFinalScore,
      truncations: laneTruncated,
      invalid: laneInvalid,
    };
  });
  
  let scorecard = `# BASELINE SOAK TEST SCORECARD\n`;
  scorecard += `## Control Stack Ground Truth (24 runs)\n\n`;
  scorecard += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
  scorecard += `**Stack:** ${SOAK_CONFIG.stack.name}\n`;
  scorecard += `**Runs:** ${runs.length} (4 lanes × 6 reps)\n\n`;
  scorecard += `---\n\n`;
  scorecard += `## 🎯 EXECUTIVE SUMMARY\n\n`;
  scorecard += `**Overall Performance:**\n`;
  scorecard += `- ✅ Pass rate: ${passRate.toFixed(1)}% (${successCount}/${runs.length})\n`;
  scorecard += `- ✅ Valid (no model drift): ${validCount}/${runs.length}\n`;
  scorecard += `- ✅ Truncations: ${truncatedCount}/${runs.length}\n`;
  scorecard += `- ✅ Avg TruthPenalty: ${avgTruthPenalty.toFixed(3)}\n`;
  scorecard += `- ✅ Avg FinalScore: ${avgFinalScore.toFixed(1)}\n\n`;
  scorecard += `---\n\n`;
  scorecard += `## 📊 PER-LANE BASELINES\n\n`;
  scorecard += `| Lane | Pass Rate | Avg TruthPenalty | Avg FinalScore | Truncations | Invalid |\n`;
  scorecard += `|------|-----------|------------------|----------------|-------------|----------|\n`;
  
  for (const stat of laneStats) {
    scorecard += `| ${stat.lane} | ${stat.passRate.toFixed(1)}% | ${stat.truthPenalty.toFixed(3)} | ${stat.finalScore.toFixed(1)} | ${stat.truncations} | ${stat.invalid} |\n`;
  }
  
  scorecard += `\n---\n\n`;
  scorecard += `## 🔬 TRUTH BASELINE LOCKED\n\n`;
  scorecard += `These metrics become the Model Weather Control Chart thresholds:\n\n`;
  
  for (const stat of laneStats) {
    scorecard += `### ${stat.lane.charAt(0).toUpperCase() + stat.lane.slice(1)} Lane\n`;
    scorecard += `- **Pass rate baseline:** ${stat.passRate.toFixed(1)}%\n`;
    scorecard += `- **TruthPenalty median:** ${stat.truthPenalty.toFixed(3)}\n`;
    scorecard += `- **FinalScore baseline:** ${stat.finalScore.toFixed(1)}\n`;
    scorecard += `- **Weather alerts:**\n`;
    scorecard += `  - 🔴 Pass rate < 95%\n`;
    scorecard += `  - 🔴 Truncations > 0\n`;
    scorecard += `  - 🔴 Invalid > 0\n`;
    scorecard += `  - 🟡 TruthPenalty rises ≥0.10 vs baseline\n\n`;
  }
  
  const scorecardPath = join(SOAK_CONFIG.outputDir, "SOAK_SCORECARD.md");
  writeFileSync(scorecardPath, scorecard);
  console.log(`✅ Scorecard saved to: ${scorecardPath}`);
}

function generateLiarList(runs: RunResult[]) {
  const liarList: any[] = [];
  
  for (const run of runs) {
    const allTriggers = [
      ...run.penaltyTriggers.systems,
      ...run.penaltyTriggers.brand,
      ...run.penaltyTriggers.critic,
    ];
    
    if (allTriggers.length > 0) {
      liarList.push({
        runId: run.runId,
        lane: run.lane,
        rep: run.rep,
        truthPenalty: run.truthPenalty.total,
        triggers: allTriggers,
        breakdown: run.penaltyBreakdown,
      });
    }
  }
  
  const liarListPath = join(SOAK_CONFIG.outputDir, "SOAK_LIAR_LIST.json");
  writeFileSync(liarListPath, JSON.stringify(liarList, null, 2));
  console.log(`✅ Liar list saved to: ${liarListPath} (${liarList.length} runs with penalties)`);
}

// Run the soak test
runSoakTest().catch(console.error);
