/**
 * Lane-by-Lane Pilot Runner
 * 
 * Validates challenger models with 2-lane pilot (Web + Marketing) before full 4-lane expansion.
 * 
 * Pilot acceptance criteria:
 * - ≥95% pass rate (4/4 for 2 lanes × 2 reps)
 * - 0 truncations
 * - 0 model drift
 * - Beat Control by ≥3 points OR match score with lower truthPenalty
 * 
 * Only expands to all 4 lanes after 2-lane pilot passes.
 */

import { preflightSchemaHashCheck } from '../server/ai/engine/validation/schemaHashValidator';
import { validateChallengerStack } from '../server/ai/engine/validation/preflightCheck';
import fs from 'fs';
import path from 'path';

const BASELINE_PATH = path.join(__dirname, '../runs/baseline_truth_v1.2.json');
const OUTPUT_DIR = path.join(__dirname, '../runs', new Date().toISOString().split('T')[0]);

interface PilotConfig {
  challengerName: string;
  challengerStack: {
    name: string;
    models: {
      systems: string;
      brand: string;
      critic: string;
    };
  };
  pilotLanes: string[];
  repsPerLane: number;
}

interface PilotRunResult {
  lane: string;
  rep: number;
  runId: string;
  passed: boolean;
  finalScore: number;
  truthPenalty: number;
  qualityPenalty: number;
  truncated: boolean;
  modelDrift: boolean;
  duration: number;
}

interface PilotResult {
  challengerName: string;
  pilotPassed: boolean;
  passRate: number;
  truncationCount: number;
  modelDriftCount: number;
  avgScore: number;
  avgTruthPenalty: number;
  controlComparison: {
    scoreDiff: number;
    truthPenaltyDiff: number;
    beatsControl: boolean;
  };
  runs: PilotRunResult[];
  recommendation: string;
}

/**
 * Load baseline control scores for comparison
 */
function loadControlBaseline(baselinePath: string): Record<string, any> {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  return baseline.lanes;
}

/**
 * Run a single pilot run
 */
async function runPilotRun(
  challengerStack: any,
  lane: string,
  rep: number
): Promise<PilotRunResult> {
  const runId = `pilot_${challengerStack.name}_${lane}_rep${rep}_${Date.now()}`;
  const startTime = Date.now();

  console.log(`  [${runId}] Running...`);

  // TODO: Integrate with actual design macro runner
  // For now, return mock data
  const mockResult: PilotRunResult = {
    lane,
    rep,
    runId,
    passed: true,
    finalScore: 96 + Math.random() * 4,
    truthPenalty: Math.random() * 0.03,
    qualityPenalty: Math.random() * 0.02,
    truncated: false,
    modelDrift: false,
    duration: (Date.now() - startTime) / 1000,
  };

  console.log(`  [${runId}] Completed: score=${mockResult.finalScore.toFixed(1)}, truth=${mockResult.truthPenalty.toFixed(3)}`);

  return mockResult;
}

/**
 * Run 2-lane pilot
 */
async function run2LanePilot(config: PilotConfig): Promise<PilotResult> {
  console.log(`\n🧪 Running 2-lane pilot for ${config.challengerName}`);
  console.log(`  Lanes: ${config.pilotLanes.join(', ')}`);
  console.log(`  Reps per lane: ${config.repsPerLane}`);
  console.log(`  Total runs: ${config.pilotLanes.length * config.repsPerLane}\n`);

  const runs: PilotRunResult[] = [];

  for (const lane of config.pilotLanes) {
    console.log(`\n📊 Running ${lane} lane (${config.repsPerLane} reps)...`);
    
    for (let rep = 1; rep <= config.repsPerLane; rep++) {
      const result = await runPilotRun(config.challengerStack, lane, rep);
      runs.push(result);
    }
  }

  // Calculate pilot statistics
  const passedRuns = runs.filter(r => r.passed);
  const passRate = (passedRuns.length / runs.length) * 100;
  const truncationCount = runs.filter(r => r.truncated).length;
  const modelDriftCount = runs.filter(r => r.modelDrift).length;
  const avgScore = runs.reduce((sum, r) => sum + r.finalScore, 0) / runs.length;
  const avgTruthPenalty = runs.reduce((sum, r) => sum + r.truthPenalty, 0) / runs.length;

  // Load control baseline for comparison
  const controlBaseline = loadControlBaseline(BASELINE_PATH);
  const controlScores = config.pilotLanes.map(lane => controlBaseline[lane]?.finalScore?.mean || 0);
  const controlTruthPenalties = config.pilotLanes.map(lane => controlBaseline[lane]?.truthPenalty?.mean || 0);
  const avgControlScore = controlScores.reduce((a, b) => a + b, 0) / controlScores.length;
  const avgControlTruthPenalty = controlTruthPenalties.reduce((a, b) => a + b, 0) / controlTruthPenalties.length;

  const scoreDiff = avgScore - avgControlScore;
  const truthPenaltyDiff = avgTruthPenalty - avgControlTruthPenalty;
  const beatsControl = scoreDiff >= 3 || (scoreDiff >= 0 && truthPenaltyDiff <= -0.02);

  // Determine if pilot passed
  const pilotPassed = passRate >= 95 && truncationCount === 0 && modelDriftCount === 0 && beatsControl;

  let recommendation = '';
  if (!pilotPassed) {
    if (passRate < 95) recommendation = `❌ FAILED: Pass rate ${passRate.toFixed(1)}% < 95%`;
    else if (truncationCount > 0) recommendation = `❌ FAILED: ${truncationCount} truncation(s) detected`;
    else if (modelDriftCount > 0) recommendation = `❌ FAILED: ${modelDriftCount} model drift(s) detected`;
    else if (!beatsControl) recommendation = `❌ FAILED: Does not beat Control (score diff: ${scoreDiff.toFixed(1)}, truth diff: ${truthPenaltyDiff.toFixed(3)})`;
  } else {
    recommendation = `✅ PASSED: Ready for 4-lane expansion`;
  }

  return {
    challengerName: config.challengerName,
    pilotPassed,
    passRate,
    truncationCount,
    modelDriftCount,
    avgScore,
    avgTruthPenalty,
    controlComparison: {
      scoreDiff,
      truthPenaltyDiff,
      beatsControl,
    },
    runs,
    recommendation,
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🏆 Lane-by-Lane Pilot Runner\n');

  // Preflight: Validate schema hashes
  console.log('🔍 Preflight: Validating schema hashes...');
  try {
    const validation = preflightSchemaHashCheck(BASELINE_PATH, true);
    console.log(validation.message);
  } catch (error: any) {
    console.error('\n❌ PREFLIGHT FAILED:', error.message);
    process.exit(1);
  }

  // Example pilot configuration
  const pilotConfig: PilotConfig = {
    challengerName: 'Claude 3.5 Sonnet',
    challengerStack: {
      name: 'claude-3.5-sonnet',
      models: {
        systems: 'anthropic/claude-3.5-sonnet',
        brand: 'anthropic/claude-3.5-sonnet',
        critic: 'anthropic/claude-3.5-sonnet',
      },
    },
    pilotLanes: ['web', 'marketing'],
    repsPerLane: 2,
  };

  // Preflight: Validate challenger stack
  console.log('\n🔍 Preflight: Validating challenger stack...');
  const stackValidation = validateChallengerStack(pilotConfig.challengerStack, BASELINE_PATH);
  console.log(stackValidation.message);
  
  if (!stackValidation.passed) {
    console.error('\n❌ PREFLIGHT FAILED: Challenger stack is blocked');
    process.exit(1);
  }

  // Run 2-lane pilot
  const pilotResult = await run2LanePilot(pilotConfig);

  // Save pilot results
  const outputPath = path.join(OUTPUT_DIR, `PILOT_${pilotConfig.challengerName.replace(/\s+/g, '_')}.json`);
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(pilotResult, null, 2));
  console.log(`\n✅ Saved pilot results: ${outputPath}`);

  // Print summary
  console.log('\n📈 Pilot Summary:');
  console.log(`  Challenger: ${pilotResult.challengerName}`);
  console.log(`  Pass Rate: ${pilotResult.passRate.toFixed(1)}%`);
  console.log(`  Avg Score: ${pilotResult.avgScore.toFixed(1)} (Control: ${pilotResult.avgScore - pilotResult.controlComparison.scoreDiff})`);
  console.log(`  Avg Truth Penalty: ${pilotResult.avgTruthPenalty.toFixed(3)}`);
  console.log(`  Truncations: ${pilotResult.truncationCount}`);
  console.log(`  Model Drifts: ${pilotResult.modelDriftCount}`);
  console.log(`  Beats Control: ${pilotResult.controlComparison.beatsControl ? 'YES' : 'NO'}`);
  console.log(`\n${pilotResult.recommendation}`);

  if (pilotResult.pilotPassed) {
    console.log('\n✅ Pilot passed! Ready for 4-lane expansion.');
    console.log('\nNext steps:');
    console.log('1. Run full 4-lane tournament (web, app, marketing, artwork)');
    console.log('2. Compare results against Control baseline');
    console.log('3. Update challenger status in baseline_truth_v1.2.json');
  } else {
    console.log('\n❌ Pilot failed. Challenger not ready for tournament.');
    console.log('\nNext steps:');
    console.log('1. Review pilot results and identify failure causes');
    console.log('2. Tune model configuration (maxTokens, temperature, etc.)');
    console.log('3. Re-run pilot after fixes');
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
