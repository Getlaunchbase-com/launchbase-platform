/**
 * Artwork Baseline Test v2 (6 reps)
 * 
 * Corrected version using proper callSpecialistWithRetry return structure:
 * - result.artifact.payload for JSON data
 * - result.meta.model for model name
 * - result.stopReason for validation
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { callSpecialistWithRetry } from "../server/ai/engine/specialists/index.js";
import { calculateDesignerTruthPenalty, calculateCriticTruthPenalty } from "../server/ai/engine/scoring/truthPenalty.js";

// Anchor detection helper (matches contentValidator logic)
function hasImplementabilityAnchors(value: string): boolean {
  const lowerValue = value.toLowerCase();
  const hasUIComponent = /\b(button|card|nav|header|footer|modal|dropdown|input|form|grid|flex|container|section|div|span)\b/i.test(value);
  const hasNumber = /\d+/.test(value);
  const hasBreakpoint = /\b(mobile|tablet|desktop|sm|md|lg|xl|xxl|320px|768px|1024px|1440px)\b/i.test(lowerValue);
  return hasUIComponent || hasNumber || hasBreakpoint;
}

function countAnchoredChanges(proposedChanges: any[]): number {
  if (!Array.isArray(proposedChanges)) return 0;
  return proposedChanges.reduce((n, ch) => {
    const val = String(ch?.value ?? "");
    return n + (hasImplementabilityAnchors(val) ? 1 : 0);
  }, 0);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_PLAN = {
  businessBrief: "LaunchBase: Professional, trustworthy, calm, transparent operating system for small businesses.",
  targetAudience: "Small business owners who need clarity and control over their operations.",
  primaryGoal: "Build trust through visual clarity and transparency metaphors.",
  constraints: ["Professional tone", "Modern but not trendy", "Clarity over decoration"]
};

interface RunResult {
  lane: string;
  rep: number;
  pass: boolean;
  failureReason?: string;
  systems: {
    modelLock: string;
    changeCount: number;
    anchorCount: number;
    jsonSizeBytes: number;
    truthPenalty: number;
  };
  brand: {
    modelLock: string;
    changeCount: number;
    anchorCount: number;
    jsonSizeBytes: number;
    truthPenalty: number;
  };
  critic: {
    modelLock: string;
    issueCount: number;
    fixCount: number;
    jsonSizeBytes: number;
    truthPenalty: number;
  };
  truthPenalty: {
    systems: number;
    brand: number;
    critic: number;
    total: number;
  };
  finalScore: number;
  costUsd: number;
  durationMs: number;
}

async function runArtworkTest(rep: number): Promise<RunResult> {
  const startTime = Date.now();
  const traceId = `artwork_baseline_rep${rep}_${Date.now()}`;
  
  console.log(`📦 Run ${rep}/6 (artwork lane)`);
  
  // Load policy
  const policyPath = join(__dirname, "../server/ai/engine/policy/policies/swarm_gate_a_control.json");
  const policy = JSON.parse(readFileSync(policyPath, "utf-8"));
  const roles = policy.swarm.roles;
  
  // 1. Systems designer
  console.log(`  [1/3] Systems designer...`);
  const systemsRole = "designer_systems_fast";
  const systemsRoleConfig = roles[systemsRole];
  if (!systemsRoleConfig) throw new Error(`Role ${systemsRole} not found in policy`);
  
  const systemsResult = await callSpecialistWithRetry({
    role: `${systemsRole}_artwork`,
    input: { plan: TEST_PLAN },
    roleConfig: systemsRoleConfig,
    trace: { traceId, startedAt: new Date().toISOString() },
    enableLadder: false
  });
  
  if (systemsResult.stopReason !== "ok") {
    throw new Error(`Systems failed: ${systemsResult.stopReason}`);
  }
  
  const systemsJson = systemsResult.artifact?.payload?.proposedChanges ? 
    { proposedChanges: systemsResult.artifact.payload.proposedChanges } : 
    systemsResult.artifact?.payload || {};
  const systemsChanges = systemsJson.proposedChanges || [];
  const systemsAnchorCount = countAnchoredChanges(systemsChanges);
  const systemsTruthPenaltyResult = calculateDesignerTruthPenalty(systemsChanges, systemsAnchorCount);
  
  console.log(`  MODEL_LOCK systems=${systemsResult.meta?.model}`);
  
  // 2. Brand designer
  console.log(`  [2/3] Brand designer...`);
  const brandRole = "designer_brand_fast";
  const brandRoleConfig = roles[brandRole];
  if (!brandRoleConfig) throw new Error(`Role ${brandRole} not found in policy`);
  
  const brandResult = await callSpecialistWithRetry({
    role: `${brandRole}_artwork`,
    input: { plan: TEST_PLAN },
    roleConfig: brandRoleConfig,
    trace: { traceId, startedAt: new Date().toISOString() },
    enableLadder: false
  });
  
  if (brandResult.stopReason !== "ok") {
    throw new Error(`Brand failed: ${brandResult.stopReason}`);
  }
  
  const brandJson = brandResult.artifact?.payload?.proposedChanges ?
    { proposedChanges: brandResult.artifact.payload.proposedChanges } :
    brandResult.artifact?.payload || {};
  const brandChanges = brandJson.proposedChanges || [];
  const brandAnchorCount = countAnchoredChanges(brandChanges);
  const brandTruthPenaltyResult = calculateDesignerTruthPenalty(brandChanges, brandAnchorCount);
  
  console.log(`  MODEL_LOCK brand=${brandResult.meta?.model}`);
  
  // 3. Critic
  console.log(`  [3/3] Critic...`);
  const criticRole = "design_critic_ruthless";
  const criticRoleConfig = roles[criticRole];
  if (!criticRoleConfig) throw new Error(`Role ${criticRole} not found in policy`);
  
  const criticResult = await callSpecialistWithRetry({
    role: `${criticRole}_artwork`,
    input: { 
      plan: TEST_PLAN,
      craftArtifacts: {
        systems: systemsJson,
        brand: brandJson
      }
    },
    roleConfig: criticRoleConfig,
    trace: { traceId, startedAt: new Date().toISOString() },
    enableLadder: false
  });
  
  if (criticResult.stopReason !== "ok") {
    throw new Error(`Critic failed: ${criticResult.stopReason}`);
  }
  
  const criticJson = criticResult.artifact?.payload || {};
  const criticIssues = criticJson.issues || [];
  const criticFixes = criticJson.suggestedFixes || [];
  const criticTruthPenaltyResult = calculateCriticTruthPenalty(criticIssues, criticFixes);
  
  console.log(`  MODEL_LOCK critic=${criticResult.meta?.model}`);
  
  // Validation
  const systemsValid = systemsChanges.length === 8;
  const brandValid = brandChanges.length === 8;
  const criticValid = criticIssues.length >= 10 && criticFixes.length >= 10;
  
  const pass = systemsValid && brandValid && criticValid;
  const failureReason = !pass ? 
    `Systems: ${systemsChanges.length}/8, Brand: ${brandChanges.length}/8, Critic: ${criticIssues.length}/${criticFixes.length}` :
    undefined;
  
  // Truth penalty
  const totalTruthPenalty = systemsTruthPenaltyResult.truthPenalty + brandTruthPenaltyResult.truthPenalty + criticTruthPenaltyResult.truthPenalty;
  const finalScore = Math.round(100 * (1 - totalTruthPenalty) * 10) / 10;
  
  const durationMs = Date.now() - startTime;
  const costUsd = (systemsResult.meta?.costUsd || 0) + (brandResult.meta?.costUsd || 0) + (criticResult.meta?.costUsd || 0);
  
  const status = pass ? "✅ PASS" : "❌ FAIL";
  console.log(`  ${status}: TruthPenalty=${totalTruthPenalty.toFixed(3)}, FinalScore=${finalScore.toFixed(1)}, Cost=$${costUsd.toFixed(4)}, Duration=${(durationMs/1000).toFixed(1)}s`);
  
  // Save artifacts
  const artifactDir = join(__dirname, `../runs/artwork_baseline/artifacts/run_${rep}`);
  mkdirSync(artifactDir, { recursive: true });
  
  writeFileSync(join(artifactDir, "systems.json"), JSON.stringify(systemsJson, null, 2));
  writeFileSync(join(artifactDir, "brand.json"), JSON.stringify(brandJson, null, 2));
  writeFileSync(join(artifactDir, "critic.json"), JSON.stringify(criticJson, null, 2));
  
  return {
    lane: "artwork",
    rep,
    pass,
    failureReason,
    systems: {
      modelLock: systemsResult.meta?.model || "unknown",
      changeCount: systemsChanges.length,
      anchorCount: systemsAnchorCount,
      jsonSizeBytes: JSON.stringify(systemsJson).length,
      truthPenalty: systemsTruthPenaltyResult.truthPenalty
    },
    brand: {
      modelLock: brandResult.meta?.model || "unknown",
      changeCount: brandChanges.length,
      anchorCount: brandAnchorCount,
      jsonSizeBytes: JSON.stringify(brandJson).length,
      truthPenalty: brandTruthPenaltyResult.truthPenalty
    },
    critic: {
      modelLock: criticResult.meta?.model || "unknown",
      issueCount: criticIssues.length,
      fixCount: criticFixes.length,
      jsonSizeBytes: JSON.stringify(criticJson).length,
      truthPenalty: criticTruthPenaltyResult.truthPenalty
    },
    truthPenalty: {
      systems: systemsTruthPenaltyResult.truthPenalty,
      brand: brandTruthPenaltyResult.truthPenalty,
      critic: criticTruthPenaltyResult.truthPenalty,
      total: totalTruthPenalty
    },
    finalScore,
    costUsd,
    durationMs
  };
}

async function main() {
  console.log("🎨 ARTWORK BASELINE TEST v2: Control Stack (6 reps)");
  console.log("📦 Loading Control policy...\n");
  
  const results: RunResult[] = [];
  
  for (let rep = 1; rep <= 6; rep++) {
    try {
      const result = await runArtworkTest(rep);
      results.push(result);
    } catch (error) {
      console.error(`❌ Run ${rep} failed:`, error);
      results.push({
        lane: "artwork",
        rep,
        pass: false,
        failureReason: String(error),
        systems: { modelLock: "unknown", changeCount: 0, anchorCount: 0, jsonSizeBytes: 0, truthPenalty: 0 },
        brand: { modelLock: "unknown", changeCount: 0, anchorCount: 0, jsonSizeBytes: 0, truthPenalty: 0 },
        critic: { modelLock: "unknown", issueCount: 0, fixCount: 0, jsonSizeBytes: 0, truthPenalty: 0 },
        truthPenalty: { systems: 0, brand: 0, critic: 0, total: 0 },
        finalScore: 0,
        costUsd: 0,
        durationMs: 0
      });
    }
  }
  
  // Compute baseline metrics
  const passedRuns = results.filter(r => r.pass);
  const passRate = (passedRuns.length / results.length) * 100;
  
  const truthPenalties = passedRuns.map(r => r.truthPenalty.total);
  const finalScores = passedRuns.map(r => r.finalScore);
  
  const truthPenaltyMedian = truthPenalties.length > 0 ? 
    truthPenalties.sort((a, b) => a - b)[Math.floor(truthPenalties.length / 2)] : 0;
  const truthPenaltyMean = truthPenalties.length > 0 ?
    truthPenalties.reduce((a, b) => a + b, 0) / truthPenalties.length : 0;
  
  const finalScoreMean = finalScores.length > 0 ?
    finalScores.reduce((a, b) => a + b, 0) / finalScores.length : 0;
  const finalScoreStdDev = finalScores.length > 1 ?
    Math.sqrt(finalScores.reduce((sum, score) => sum + Math.pow(score - finalScoreMean, 2), 0) / (finalScores.length - 1)) : 0;
  
  console.log("\n📊 ARTWORK BASELINE RESULTS:");
  console.log(`Pass rate: ${passRate.toFixed(1)}% (${passedRuns.length}/6)`);
  console.log(`TruthPenalty median: ${truthPenaltyMedian.toFixed(3)}`);
  console.log(`TruthPenalty mean: ${truthPenaltyMean.toFixed(3)}`);
  console.log(`FinalScore: ${finalScoreMean.toFixed(1)} ± ${finalScoreStdDev.toFixed(1)}`);
  
  // Save results
  const outputDir = join(__dirname, "../runs/artwork_baseline");
  mkdirSync(outputDir, { recursive: true });
  
  writeFileSync(
    join(outputDir, "ARTWORK_RESULTS.json"),
    JSON.stringify(results, null, 2)
  );
  
  writeFileSync(
    join(outputDir, "ARTWORK_BASELINE.json"),
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      stack: "Control Champion (4o + Opus)",
      policyName: "swarm_gate_a_control",
      runCount: 6,
      passRate,
      truthPenalty: {
        median: truthPenaltyMedian,
        mean: truthPenaltyMean
      },
      finalScore: {
        mean: finalScoreMean,
        stdDev: finalScoreStdDev,
        lowerBound: finalScoreMean - 2 * finalScoreStdDev,
        upperBound: finalScoreMean + 2 * finalScoreStdDev
      }
    }, null, 2)
  );
  
  console.log("\n✅ Results saved to: runs/artwork_baseline/ARTWORK_RESULTS.json");
  console.log("✅ Baseline saved to: runs/artwork_baseline/ARTWORK_BASELINE.json");
}

main().catch(console.error);
