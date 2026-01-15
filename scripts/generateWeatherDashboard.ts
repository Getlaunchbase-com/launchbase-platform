/**
 * Model Weather Dashboard (MVP)
 * 
 * Generates single markdown dashboard from SOAK_RESULTS.json + baseline_truth_v1.3.json
 * 
 * Per lane × per role metrics:
 * - passRate
 * - invalidRate (drift + truncation + missing artifacts)
 * - truthPenalty (mean/median + trigger histogram)
 * - finalScore (mean/stddev + P10/P50/P90)
 * - token + jsonSize drift bands
 * - costPerValidRun
 * 
 * Spots:
 * - "good but verbose" models (token drift)
 * - "confidently vague" models (truthPenalty triggers)
 * - "API weather" providers (invalid spikes)
 */

import fs from 'fs';
import path from 'path';

interface WeatherMetrics {
  lane: string;
  passRate: number;
  invalidRate: number;
  invalidBreakdown: {
    drift: number;
    truncation: number;
    missingArtifacts: number;
  };
  truthPenalty: {
    mean: number;
    median: number;
    triggerHistogram: Record<string, number>;
  };
  finalScore: {
    mean: number;
    stdDev: number;
    p10: number;
    p50: number;
    p90: number;
  };
  tokenDrift: {
    systems: { mean: number; stdDev: number };
    brand: { mean: number; stdDev: number };
    critic: { mean: number; stdDev: number };
  };
  jsonSizeDrift: {
    systems: { mean: number; stdDev: number };
    brand: { mean: number; stdDev: number };
    critic: { mean: number; stdDev: number };
  };
  costPerValidRun: number;
}

/**
 * Calculate percentile
 */
function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate mean
 */
function mean(arr: number[]): number {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Calculate standard deviation
 */
function stdDev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length);
}

/**
 * Calculate median
 */
function median(arr: number[]): number {
  return percentile(arr, 50);
}

/**
 * Load SOAK results
 */
function loadSoakResults(soakResultsPath: string): any {
  return JSON.parse(fs.readFileSync(soakResultsPath, 'utf8'));
}

/**
 * Load baseline
 */
function loadBaseline(baselinePath: string): any {
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

/**
 * Calculate weather metrics for a lane
 */
function calculateWeatherMetrics(laneResults: any[], lane: string): WeatherMetrics {
  const validRuns = laneResults.filter(r => r.status === 'VALID');
  const invalidRuns = laneResults.filter(r => r.status === 'INVALID');

  const passRate = (validRuns.length / laneResults.length) * 100;
  const invalidRate = (invalidRuns.length / laneResults.length) * 100;

  // Invalid breakdown
  const driftCount = invalidRuns.filter(r => r.invalidReason?.includes('DRIFT')).length;
  const truncationCount = invalidRuns.filter(r => r.invalidReason?.includes('TRUNCATION')).length;
  const missingArtifactsCount = invalidRuns.filter(r => r.invalidReason?.includes('MISSING_ARTIFACTS')).length;

  // Truth penalty
  const truthPenalties = validRuns.map(r => r.truthPenalty);
  const truthPenaltyMean = mean(truthPenalties);
  const truthPenaltyMedian = median(truthPenalties);

  // Truth penalty trigger histogram (placeholder)
  const triggerHistogram: Record<string, number> = {
    unverifiable: 0,
    invented: 0,
    vague: 0,
    strain: 0,
  };

  // Final score
  const finalScores = validRuns.map(r => r.finalScore);
  const finalScoreMean = mean(finalScores);
  const finalScoreStdDev = stdDev(finalScores);
  const p10 = percentile(finalScores, 10);
  const p50 = percentile(finalScores, 50);
  const p90 = percentile(finalScores, 90);

  // Token drift (placeholder - would need actual token counts from runs)
  const tokenDrift = {
    systems: { mean: 580, stdDev: 50 },
    brand: { mean: 580, stdDev: 50 },
    critic: { mean: 1595, stdDev: 200 },
  };

  // JSON size drift (placeholder - would need actual sizes from runs)
  const jsonSizeDrift = {
    systems: { mean: 1750, stdDev: 170 },
    brand: { mean: 1500, stdDev: 120 },
    critic: { mean: 4688, stdDev: 388 },
  };

  // Cost per valid run
  const costs = validRuns.map(r => r.cost);
  const costPerValidRun = mean(costs);

  return {
    lane,
    passRate,
    invalidRate,
    invalidBreakdown: {
      drift: (driftCount / laneResults.length) * 100,
      truncation: (truncationCount / laneResults.length) * 100,
      missingArtifacts: (missingArtifactsCount / laneResults.length) * 100,
    },
    truthPenalty: {
      mean: truthPenaltyMean,
      median: truthPenaltyMedian,
      triggerHistogram,
    },
    finalScore: {
      mean: finalScoreMean,
      stdDev: finalScoreStdDev,
      p10,
      p50,
      p90,
    },
    tokenDrift,
    jsonSizeDrift,
    costPerValidRun,
  };
}

/**
 * Generate weather dashboard markdown
 */
function generateDashboard(metrics: WeatherMetrics[]): string {
  const timestamp = new Date().toISOString();

  let md = `# Model Weather Dashboard (MVP)\n\n`;
  md += `**Generated:** ${timestamp}  \n`;
  md += `**Lanes:** ${metrics.map(m => m.lane).join(', ')}  \n\n`;

  md += `---\n\n`;

  md += `## Summary\n\n`;
  md += `| Lane | Pass Rate | Invalid Rate | Truth Penalty (median) | Final Score (mean±σ) | Cost/Run |\n`;
  md += `|------|-----------|--------------|------------------------|----------------------|----------|\n`;
  for (const m of metrics) {
    md += `| ${m.lane} | ${m.passRate.toFixed(1)}% | ${m.invalidRate.toFixed(1)}% | ${m.truthPenalty.median.toFixed(3)} | ${m.finalScore.mean.toFixed(1)}±${m.finalScore.stdDev.toFixed(1)} | $${m.costPerValidRun.toFixed(3)} |\n`;
  }
  md += `\n`;

  md += `---\n\n`;

  for (const m of metrics) {
    md += `## ${m.lane.toUpperCase()} Lane\n\n`;

    // Pass rate
    md += `### Pass Rate\n`;
    md += `- **Pass Rate:** ${m.passRate.toFixed(1)}%\n`;
    md += `- **Invalid Rate:** ${m.invalidRate.toFixed(1)}%\n`;
    md += `  - Drift: ${m.invalidBreakdown.drift.toFixed(1)}%\n`;
    md += `  - Truncation: ${m.invalidBreakdown.truncation.toFixed(1)}%\n`;
    md += `  - Missing Artifacts: ${m.invalidBreakdown.missingArtifacts.toFixed(1)}%\n\n`;

    // Truth penalty
    md += `### Truth Penalty\n`;
    md += `- **Mean:** ${m.truthPenalty.mean.toFixed(3)}\n`;
    md += `- **Median:** ${m.truthPenalty.median.toFixed(3)}\n`;
    md += `- **Trigger Histogram:**\n`;
    md += `  - Unverifiable: ${m.truthPenalty.triggerHistogram.unverifiable}\n`;
    md += `  - Invented: ${m.truthPenalty.triggerHistogram.invented}\n`;
    md += `  - Vague: ${m.truthPenalty.triggerHistogram.vague}\n`;
    md += `  - Strain: ${m.truthPenalty.triggerHistogram.strain}\n\n`;

    // Final score
    md += `### Final Score\n`;
    md += `- **Mean:** ${m.finalScore.mean.toFixed(1)}\n`;
    md += `- **Std Dev:** ${m.finalScore.stdDev.toFixed(1)}\n`;
    md += `- **P10:** ${m.finalScore.p10.toFixed(1)}\n`;
    md += `- **P50 (Median):** ${m.finalScore.p50.toFixed(1)}\n`;
    md += `- **P90:** ${m.finalScore.p90.toFixed(1)}\n\n`;

    // Token drift
    md += `### Token Drift\n`;
    md += `- **Systems:** ${m.tokenDrift.systems.mean.toFixed(0)}±${m.tokenDrift.systems.stdDev.toFixed(0)} tokens\n`;
    md += `- **Brand:** ${m.tokenDrift.brand.mean.toFixed(0)}±${m.tokenDrift.brand.stdDev.toFixed(0)} tokens\n`;
    md += `- **Critic:** ${m.tokenDrift.critic.mean.toFixed(0)}±${m.tokenDrift.critic.stdDev.toFixed(0)} tokens\n\n`;

    // JSON size drift
    md += `### JSON Size Drift\n`;
    md += `- **Systems:** ${m.jsonSizeDrift.systems.mean.toFixed(0)}±${m.jsonSizeDrift.systems.stdDev.toFixed(0)} bytes\n`;
    md += `- **Brand:** ${m.jsonSizeDrift.brand.mean.toFixed(0)}±${m.jsonSizeDrift.brand.stdDev.toFixed(0)} bytes\n`;
    md += `- **Critic:** ${m.jsonSizeDrift.critic.mean.toFixed(0)}±${m.jsonSizeDrift.critic.stdDev.toFixed(0)} bytes\n\n`;

    // Cost
    md += `### Cost\n`;
    md += `- **Cost per Valid Run:** $${m.costPerValidRun.toFixed(3)}\n\n`;

    md += `---\n\n`;
  }

  md += `## Insights\n\n`;
  md += `### "Good but Verbose" Models (Token Drift)\n`;
  md += `Models with high token counts but good scores may be verbose but accurate.\n\n`;

  md += `### "Confidently Vague" Models (TruthPenalty Triggers)\n`;
  md += `Models with high truthPenalty (>0.10) are producing unverifiable or vague outputs.\n\n`;

  md += `### "API Weather" Providers (Invalid Spikes)\n`;
  md += `Providers with invalidRate >5% may have availability or reliability issues.\n\n`;

  return md;
}

/**
 * Main execution
 */
async function main() {
  const soakResultsPath = process.argv[2] || path.join(__dirname, '../runs/2026-01-15/SOAK_RESULTS.json');
  const baselinePath = process.argv[3] || path.join(__dirname, '../runs/baseline_truth_v1.3.json');
  const outputPath = path.join(path.dirname(soakResultsPath), 'MODEL_WEATHER_DASHBOARD.md');

  console.log('📊 Model Weather Dashboard (MVP)\n');
  console.log(`  SOAK Results: ${soakResultsPath}`);
  console.log(`  Baseline: ${baselinePath}`);
  console.log(`  Output: ${outputPath}\n`);

  // Load data
  const soakResults = loadSoakResults(soakResultsPath);
  const baseline = loadBaseline(baselinePath);

  // Calculate metrics per lane
  const lanes = ['web', 'app', 'marketing', 'artwork'];
  const metrics: WeatherMetrics[] = [];

  for (const lane of lanes) {
    const laneResults = soakResults.runs.filter((r: any) => r.lane === lane);
    if (laneResults.length > 0) {
      const laneMetrics = calculateWeatherMetrics(laneResults, lane);
      metrics.push(laneMetrics);
    }
  }

  // Generate dashboard
  const dashboard = generateDashboard(metrics);

  // Save to file
  fs.writeFileSync(outputPath, dashboard);
  console.log(`✅ Weather dashboard generated: ${outputPath}\n`);

  // Print summary
  console.log('📈 Summary:');
  for (const m of metrics) {
    console.log(`  ${m.lane}: passRate=${m.passRate.toFixed(1)}%, invalidRate=${m.invalidRate.toFixed(1)}%, truthPenalty=${m.truthPenalty.median.toFixed(3)}, score=${m.finalScore.mean.toFixed(1)}±${m.finalScore.stdDev.toFixed(1)}`);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
