/**
 * Mini Soak Test Runner (8 runs)
 * 
 * Fast validation of Control stack truthfulness and stability:
 * - 8 runs (4 lanes × 2 reps)
 * - Lanes: Web, App, Marketing, Artwork
 * - No fallback, no ladder (hard contract enforcement)
 * - TruthPenalty scoring per run
 * - Outputs: SOAK_RESULTS.json, SOAK_SCORECARD.md, baseline_truth.json
 * 
 * Goal: Establish truth baseline for Model Weather Control Chart
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { callSpecialistWithRetry } from "../server/ai/engine/specialists/index.js";
import { calculateDesignerTruthPenalty, calculateCriticTruthPenalty } from "../server/ai/engine/scoring/truthPenalty.js";

// Mini soak configuration
const SOAK_CONFIG = {
  lanes: ["web", "app", "marketing", "artwork"] as const,
  stack: {
    name: "Control Champion (4o + Opus)",
    policyName: "swarm_gate_a_control",
  },
  repsPerLane: 2, // Mini soak: 2 reps × 4 lanes = 8 runs
  outputDir: "runs/mini_soak",
};

const TEST_PLAN = {
  projectId: "mini_soak_test",
  businessName: "LaunchBase",
  businessDescription: "Operating system for small businesses",
  industry: "SaaS",
  targetAudience: "Small business owners",
  goals: ["Establish truth baseline", "Validate TruthPenalty scoring"],
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
    systems: { requested: string; resolved: string; ok: boolean };
    brand: { requested: string; resolved: string; ok: boolean };
    critic: { requested: string; resolved: string; ok: boolean };
  };
  
  // Finish reasons
  finishReason: {
    systems: string;
    brand: string;
    critic: string;
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
    systems: { jsonSizeBytes: number };
    brand: { jsonSizeBytes: number };
    critic: { jsonSizeBytes: number };
  };
  
  // Anchors
  anchors: {
    systems: number;
    brand: number;
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
  costUsd: number;
  
  // Flags
  isTruncated: boolean;
  isValid: boolean;
  
  // Duration
  durationMs: number;
}

function jsonSizeBytes(x: unknown): number {
  return Buffer.byteLength(JSON.stringify(x ?? null), "utf8");
}

function extractCost(result: any): number {
  // Extract cost from meta if available
  return result.meta?.estimatedUsd || 0;
}

async function runMiniSoak() {
  console.log("🔬 MINI SOAK TEST: Control Stack (8 runs)\n");
  
  const startTime = Date.now();
  
  // Step 1: Load policy
  console.log("📦 Loading Control policy...");
  const policyPath = join(__dirname, `../server/ai/engine/policy/policies/${SOAK_CONFIG.stack.policyName}.json`);
  const policy = JSON.parse(readFileSync(policyPath, "utf-8"));
  console.log(`✅ Policy loaded: ${SOAK_CONFIG.stack.policyName}\n`);
  
  // Step 2: Create output directory
  mkdirSync(SOAK_CONFIG.outputDir, { recursive: true });
  mkdirSync(join(SOAK_CONFIG.outputDir, "artifacts"), { recursive: true });
  
  // Step 3: Run all 8 tests
  const runs: RunResult[] = [];
  let runIndex = 0;
  
  for (const lane of SOAK_CONFIG.lanes) {
    for (let rep = 1; rep <= SOAK_CONFIG.repsPerLane; rep++) {
      runIndex++;
      console.log(`\n📦 Run ${runIndex}/8 (${lane}, rep ${rep})`);
      
      const runId = `mini_soak_${SOAK_CONFIG.stack.policyName}_${lane}_rep${rep}_${Date.now()}`;
      const runStart = Date.now();
      
      try {
        // Systems designer
        console.log(`  [1/3] Systems designer...`);
        const systemsResult = await callSpecialistWithRetry({
          role: `designer_systems_fast_${lane}` as any,
          roleConfig: policy.swarm.roles["designer_systems_fast"],
          input: { plan: TEST_PLAN },
          trace: { traceId: `${runId}_systems`, startedAt: new Date().toISOString() },
          enableLadder: false,
        });
        
        console.log(`  MODEL_LOCK systems=${systemsResult.meta?.model || "unknown"}`);
        
        // Brand designer
        console.log(`  [2/3] Brand designer...`);
        const brandResult = await callSpecialistWithRetry({
          role: `designer_brand_fast_${lane}` as any,
          roleConfig: policy.swarm.roles["designer_brand_fast"],
          input: { plan: TEST_PLAN },
          trace: { traceId: `${runId}_brand`, startedAt: new Date().toISOString() },
          enableLadder: false,
        });
        
        console.log(`  MODEL_LOCK brand=${brandResult.meta?.model || "unknown"}`);
        
        // Critic
        console.log(`  [3/3] Critic...`);
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
        
        console.log(`  MODEL_LOCK critic=${criticResult.meta?.model || "unknown"}`);
        
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
        
        // Scoring
        const baseScore = 100;
        const finalScore = baseScore * (1 - totalTruthPenalty);
        
        // Cost
        const costUsd = extractCost(systemsResult) + extractCost(brandResult) + extractCost(criticResult);
        
        // Duration
        const durationMs = Date.now() - runStart;
        
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
          failureReason: pass ? null : `Systems: ${systemsChanges.length}/8, Brand: ${brandChanges.length}/8, Critic: ${criticIssues.length}/${criticFixes.length}`,
          modelLock: {
            systems: systemsModelLock,
            brand: brandModelLock,
            critic: criticModelLock,
          },
          finishReason: {
            systems: systemsResult.stopReason || "unknown",
            brand: brandResult.stopReason || "unknown",
            critic: criticResult.stopReason || "unknown",
          },
          schema: {
            systems: { count: systemsChanges.length, valid: systemsValid },
            brand: { count: brandChanges.length, valid: brandValid },
            critic: { issueCount: criticIssues.length, fixCount: criticFixes.length, valid: criticValid },
          },
          retries: {
            systems: (systemsResult.meta?.retryMetadata?.attemptCount || 1) - 1,
            brand: (brandResult.meta?.retryMetadata?.attemptCount || 1) - 1,
            critic: (criticResult.meta?.retryMetadata?.attemptCount || 1) - 1,
          },
          artifacts: {
            systems: { jsonSizeBytes: jsonSizeBytes(systemsPayload) },
            brand: { jsonSizeBytes: jsonSizeBytes(brandPayload) },
            critic: { jsonSizeBytes: jsonSizeBytes(criticPayload) },
          },
          anchors: {
            systems: systemsResult.meta?.content?.anchorCount || 0,
            brand: brandResult.meta?.content?.anchorCount || 0,
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
          costUsd,
          isTruncated,
          isValid,
          durationMs,
        };
        
        writeFileSync(join(artifactDir, "run_meta.json"), JSON.stringify(runResult, null, 2));
        
        runs.push(runResult);
        
        console.log(`  ${pass ? "✅ PASS" : "❌ FAIL"}: TruthPenalty=${totalTruthPenalty.toFixed(3)}, FinalScore=${finalScore.toFixed(1)}, Cost=$${costUsd.toFixed(4)}, Duration=${(durationMs / 1000).toFixed(1)}s`);
        
      } catch (error: any) {
        console.error(`  ❌ ERROR: ${error.message}`);
        // Continue with next run
      }
    }
  }
  
  // Step 4: Generate SOAK_RESULTS.json
  const resultsPath = join(SOAK_CONFIG.outputDir, "SOAK_RESULTS.json");
  writeFileSync(resultsPath, JSON.stringify(runs, null, 2));
  console.log(`\n✅ Results saved to: ${resultsPath}`);
  
  // Step 5: Generate SOAK_SCORECARD.md
  generateScorecard(runs);
  
  // Step 6: Generate baseline_truth.json
  generateTruthBaseline(runs);
  
  const totalDuration = Date.now() - startTime;
  console.log(`\n🎯 Mini Soak Test complete in ${(totalDuration / 1000).toFixed(1)}s`);
}

function generateScorecard(runs: RunResult[]) {
  const successCount = runs.filter(r => r.pass).length;
  const passRate = (successCount / runs.length) * 100;
  
  const validCount = runs.filter(r => r.isValid).length;
  const truncatedCount = runs.filter(r => r.isTruncated).length;
  
  const avgTruthPenalty = runs.reduce((sum, r) => sum + r.truthPenalty.total, 0) / runs.length;
  const avgFinalScore = runs.reduce((sum, r) => sum + r.finalScore, 0) / runs.length;
  const totalCost = runs.reduce((sum, r) => sum + r.costUsd, 0);
  
  // Per-lane stats
  const laneStats = SOAK_CONFIG.lanes.map(lane => {
    const laneRuns = runs.filter(r => r.lane === lane);
    if (laneRuns.length === 0) return null;
    
    const lanePass = laneRuns.filter(r => r.pass).length;
    const laneTruthPenalty = laneRuns.reduce((sum, r) => sum + r.truthPenalty.total, 0) / laneRuns.length;
    const laneFinalScore = laneRuns.reduce((sum, r) => sum + r.finalScore, 0) / laneRuns.length;
    const laneTruncated = laneRuns.filter(r => r.isTruncated).length;
    const laneInvalid = laneRuns.filter(r => !r.isValid).length;
    
    // Calculate variance (σ)
    const meanScore = laneFinalScore;
    const variance = laneRuns.reduce((sum, r) => sum + Math.pow(r.finalScore - meanScore, 2), 0) / laneRuns.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      lane,
      passRate: (lanePass / laneRuns.length) * 100,
      passCount: lanePass,
      totalCount: laneRuns.length,
      truthPenalty: laneTruthPenalty,
      finalScore: laneFinalScore,
      stdDev,
      truncations: laneTruncated,
      invalid: laneInvalid,
    };
  }).filter(Boolean);
  
  let scorecard = `# MINI SOAK TEST SCORECARD\n`;
  scorecard += `## Control Stack Truth Baseline (8 runs)\n\n`;
  scorecard += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
  scorecard += `**Stack:** ${SOAK_CONFIG.stack.name}\n`;
  scorecard += `**Runs:** ${runs.length} (4 lanes × 2 reps)\n\n`;
  scorecard += `---\n\n`;
  scorecard += `## 🎯 EXECUTIVE SUMMARY\n\n`;
  scorecard += `**Overall Performance:**\n`;
  scorecard += `- Pass rate: ${passRate.toFixed(1)}% (${successCount}/${runs.length})\n`;
  scorecard += `- Valid (no model drift): ${validCount}/${runs.length}\n`;
  scorecard += `- Truncations: ${truncatedCount}/${runs.length}\n`;
  scorecard += `- Avg TruthPenalty: ${avgTruthPenalty.toFixed(3)}\n`;
  scorecard += `- Avg FinalScore: ${avgFinalScore.toFixed(1)}\n`;
  scorecard += `- Total Cost: $${totalCost.toFixed(4)}\n\n`;
  
  if (passRate >= 95 && truncatedCount === 0 && validCount === runs.length) {
    scorecard += `✅ **VERDICT: Control stack is production-ready**\n\n`;
  } else {
    scorecard += `⚠️ **VERDICT: Control stack needs tuning**\n\n`;
  }
  
  scorecard += `---\n\n`;
  scorecard += `## 📊 PER-LANE BASELINES\n\n`;
  scorecard += `| Lane | Pass | Avg TruthPenalty | Avg FinalScore | σ(score) | Truncations | Invalid |\n`;
  scorecard += `|------|------|------------------|----------------|----------|-------------|----------|\n`;
  
  for (const stat of laneStats) {
    if (!stat) continue;
    scorecard += `| ${stat.lane} | ${stat.passCount}/${stat.totalCount} | ${stat.truthPenalty.toFixed(3)} | ${stat.finalScore.toFixed(1)} | ${stat.stdDev.toFixed(1)} | ${stat.truncations} | ${stat.invalid} |\n`;
  }
  
  scorecard += `\n---\n\n`;
  scorecard += `## 🔬 TRUTH BASELINE LOCKED\n\n`;
  scorecard += `These metrics become the Model Weather Control Chart thresholds:\n\n`;
  
  for (const stat of laneStats) {
    if (!stat) continue;
    scorecard += `### ${stat.lane.charAt(0).toUpperCase() + stat.lane.slice(1)} Lane\n`;
    scorecard += `- **Pass rate baseline:** ${stat.passRate.toFixed(1)}%\n`;
    scorecard += `- **TruthPenalty median:** ${stat.truthPenalty.toFixed(3)}\n`;
    scorecard += `- **FinalScore baseline:** ${stat.finalScore.toFixed(1)} ± ${stat.stdDev.toFixed(1)}\n`;
    scorecard += `- **Weather alerts:**\n`;
    scorecard += `  - 🔴 Pass rate < 95%\n`;
    scorecard += `  - 🔴 Truncations > 0\n`;
    scorecard += `  - 🔴 Invalid > 0\n`;
    scorecard += `  - 🟡 TruthPenalty rises ≥0.10 vs baseline\n`;
    scorecard += `  - 🟡 FinalScore outside ±2σ band\n\n`;
  }
  
  const scorecardPath = join(SOAK_CONFIG.outputDir, "SOAK_SCORECARD.md");
  writeFileSync(scorecardPath, scorecard);
  console.log(`✅ Scorecard saved to: ${scorecardPath}`);
}

function generateTruthBaseline(runs: RunResult[]) {
  const baseline: any = {
    generatedAt: new Date().toISOString(),
    stack: SOAK_CONFIG.stack.name,
    policyName: SOAK_CONFIG.stack.policyName,
    runCount: runs.length,
    lanes: {},
  };
  
  for (const lane of SOAK_CONFIG.lanes) {
    const laneRuns = runs.filter(r => r.lane === lane && r.pass);
    if (laneRuns.length === 0) continue;
    
    const truthPenalties = laneRuns.map(r => r.truthPenalty.total).sort((a, b) => a - b);
    const finalScores = laneRuns.map(r => r.finalScore);
    
    const medianTruthPenalty = truthPenalties[Math.floor(truthPenalties.length / 2)];
    const meanFinalScore = finalScores.reduce((sum, s) => sum + s, 0) / finalScores.length;
    const variance = finalScores.reduce((sum, s) => sum + Math.pow(s - meanFinalScore, 2), 0) / finalScores.length;
    const stdDev = Math.sqrt(variance);
    
    baseline.lanes[lane] = {
      passRate: (laneRuns.length / SOAK_CONFIG.repsPerLane) * 100,
      truthPenalty: {
        median: medianTruthPenalty,
        mean: truthPenalties.reduce((sum, p) => sum + p, 0) / truthPenalties.length,
      },
      finalScore: {
        mean: meanFinalScore,
        stdDev,
        lowerBound: meanFinalScore - 2 * stdDev,
        upperBound: meanFinalScore + 2 * stdDev,
      },
    };
  }
  
  const baselinePath = join(SOAK_CONFIG.outputDir, "baseline_truth.json");
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
  console.log(`✅ Truth baseline saved to: ${baselinePath}`);
}

// Run the mini soak test
runMiniSoak().catch(console.error);
