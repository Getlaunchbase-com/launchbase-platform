import { readFileSync } from "node:fs";
import type { TournamentRunScore } from "../server/services/design/scoreTournament.js";

/**
 * Detect if tournament runs have converged (±5 points for last 4 runs)
 */
export function detectConvergence(scores: TournamentRunScore[], windowSize: number = 4, threshold: number = 5): {
  converged: boolean;
  variance: number;
  mean: number;
  lastScores: number[];
} {
  if (scores.length < windowSize) {
    return {
      converged: false,
      variance: Infinity,
      mean: 0,
      lastScores: [],
    };
  }
  
  // Get last N scores
  const lastScores = scores.slice(-windowSize).map((s) => s.scoreTotal);
  
  // Calculate mean
  const mean = lastScores.reduce((sum, score) => sum + score, 0) / lastScores.length;
  
  // Calculate variance
  const variance = Math.sqrt(
    lastScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / lastScores.length
  );
  
  // Check if all scores are within threshold of mean
  const converged = lastScores.every((score) => Math.abs(score - mean) <= threshold);
  
  return {
    converged,
    variance,
    mean,
    lastScores,
  };
}

/**
 * Main CLI for checking convergence
 */
async function main() {
  const scorecardPath = process.argv[2] || "/home/ubuntu/launchbase/runs/2026-01-14/TOURNAMENT_SCORECARD.json";
  
  console.log(`[Convergence] Reading scorecard: ${scorecardPath}`);
  
  const scorecardJson = readFileSync(scorecardPath, "utf-8");
  const scorecard = JSON.parse(scorecardJson);
  const scores: TournamentRunScore[] = scorecard.scores;
  
  const result = detectConvergence(scores, 4, 5);
  
  console.log("\n" + "=".repeat(80));
  console.log("CONVERGENCE ANALYSIS");
  console.log("=".repeat(80));
  console.log(`Total runs: ${scores.length}`);
  console.log(`Window size: 4 runs`);
  console.log(`Threshold: ±5 points`);
  console.log(`\nLast 4 scores: ${result.lastScores.map((s) => s.toFixed(1)).join(", ")}`);
  console.log(`Mean: ${result.mean.toFixed(1)}`);
  console.log(`Variance: ${result.variance.toFixed(2)}`);
  console.log(`\n✅ Converged: ${result.converged ? "YES" : "NO"}`);
  
  if (result.converged) {
    console.log("\n🎯 Runs have stabilized. No need for more iterations.");
  } else {
    console.log("\n⚠️  Runs are still varying. Continue iterating.");
  }
  
  process.exit(result.converged ? 0 : 1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[Convergence] Fatal error:", err);
    process.exit(1);
  });
}
