import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scoreDesignRun, selectCategoryChampions, type RunArtifacts, type ScoreBreakdown } from "../server/services/design/scoreTournament.js";

interface TournamentRunScore {
  runId: string;
  scoreTotal: number;
  scoreBreakdown: ScoreBreakdown;
  models: {
    systems: string;
    brand: string;
    critic: string;
  };
  costUsd: number;
  durationMs: number;
  stopReason: string;
}

/**
 * Generate tournament scorecard from all runs in a directory
 */
async function main() {
  const runsDir = process.argv[2] || "/home/ubuntu/launchbase/runs/2026-01-14";
  
  console.log(`[Scorecard] Scanning runs in: ${runsDir}`);
  
  const runFolders = readdirSync(runsDir)
    .filter((name) => name.startsWith("run_"))
    .sort((a, b) => {
      const numA = parseInt(a.replace("run_", ""), 10);
      const numB = parseInt(b.replace("run_", ""), 10);
      return numA - numB;
    });
  
  console.log(`[Scorecard] Found ${runFolders.length} runs`);
  
  const scores: TournamentRunScore[] = [];
  const errors: Array<{ run: string; error: string }> = [];
  
  for (const runFolder of runFolders) {
    const runPath = join(runsDir, runFolder);
    const outputPath = join(runPath, "output.json");
    
    try {
      const outputJson = readFileSync(outputPath, "utf-8");
      const output = JSON.parse(outputJson);
      
      // Parse artifacts from output
      const artifacts = parseRunArtifacts(output);
      
      // Score the run
      const scoreBreakdown = scoreDesignRun(artifacts);
      
      // Extract models from extensions
      const models = {
        systems: output.extensions?.swarm?.roleModels?.designer_systems || "unknown",
        brand: output.extensions?.swarm?.roleModels?.designer_brand || "unknown",
        critic: output.extensions?.swarm?.roleModels?.critic || "unknown",
      };
      
      const score: TournamentRunScore = {
        runId: runFolder,
        scoreTotal: scoreBreakdown.finalScore,
        scoreBreakdown,
        models,
        costUsd: output.extensions?.swarm?.totalCostUsd || 0,
        durationMs: output.extensions?.swarm?.durationMs || 0,
        stopReason: output.stopReason || "unknown",
      };
      
      scores.push(score);
      
      console.log(`[Scorecard] ✅ ${runFolder}: ${score.scoreTotal.toFixed(1)}/100`);
    } catch (err: any) {
      console.error(`[Scorecard] ❌ ${runFolder}: ${err.message}`);
      errors.push({ run: runFolder, error: err.message });
    }
  }
  
  // Sort by score (descending)
  scores.sort((a, b) => b.scoreTotal - a.scoreTotal);
  
  // Generate markdown scorecard
  const markdown = generateMarkdownScorecard(scores, errors);
  const markdownPath = join(runsDir, "TOURNAMENT_SCORECARD.md");
  writeFileSync(markdownPath, markdown, "utf-8");
  console.log(`[Scorecard] 📊 Saved: ${markdownPath}`);
  
  // Generate JSON scorecard
  const jsonPath = join(runsDir, "TOURNAMENT_SCORECARD.json");
  writeFileSync(jsonPath, JSON.stringify({ scores, errors }, null, 2), "utf-8");
  console.log(`[Scorecard] 📊 Saved: ${jsonPath}`);
  
  // Generate category champions
  const championsInput = scores.map(s => ({
    runId: s.runId,
    models: {
      designer_systems: s.models.systems,
      designer_brand: s.models.brand,
      design_critic_ruthless: s.models.critic,
    },
    artifacts: parseRunArtifacts(JSON.parse(readFileSync(join(runsDir, s.runId, "output.json"), "utf-8"))),
    score: s.scoreBreakdown,
  }));
  const champions = selectCategoryChampions(championsInput);
  const championsPath = join(runsDir, "CATEGORY_CHAMPIONS.json");
  writeFileSync(championsPath, JSON.stringify(champions, null, 2), "utf-8");
  console.log(`[Scorecard] 🏆 Saved: ${championsPath}`);
  
  // Print summary
  console.log("\n" + "=".repeat(80));
  console.log("TOURNAMENT SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total runs: ${scores.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`\nTop 5 runs:`);
  scores.slice(0, 5).forEach((score, i) => {
    console.log(`  ${i + 1}. ${score.runId}: ${score.scoreTotal.toFixed(1)}/100`);
    console.log(`     Systems: ${score.models.systems}`);
    console.log(`     Brand: ${score.models.brand}`);
    console.log(`     Critic: ${score.models.critic}`);
  });
  
  console.log(`\n🏆 CATEGORY CHAMPIONS:`);
  console.log(`  Systems: ${champions.systems.model} (score: ${champions.systems.score.toFixed(1)})`);
  console.log(`  Brand: ${champions.brand.model} (score: ${champions.brand.score.toFixed(1)})`);
  console.log(`  Critic: ${champions.critic.model} (score: ${champions.critic.score.toFixed(1)})`);
}

function parseRunArtifacts(output: any): RunArtifacts {
  // Extract artifacts from output
  const artifacts = output.artifacts || [];
  
  const systemsArtifact = artifacts.find((a: any) => a.kind === "swarm.specialist.designer_systems");
  const brandArtifact = artifacts.find((a: any) => a.kind === "swarm.specialist.designer_brand");
  const criticArtifact = artifacts.find((a: any) => a.kind === "swarm.specialist.critic");
  
  return {
    systems: {
      proposedChanges: systemsArtifact?.payload?.proposedChanges || [],
    },
    brand: {
      proposedChanges: brandArtifact?.payload?.proposedChanges || [],
    },
    critic: {
      issues: criticArtifact?.payload?.issues || [],
      suggestedFixes: criticArtifact?.payload?.suggestedFixes || [],
      pass: criticArtifact?.payload?.pass || false,
      requiresApproval: criticArtifact?.payload?.requiresApproval || false,
    },
    meta: {
      totalCostUsd: output.extensions?.swarm?.totalCostUsd || 0,
      durationMs: output.extensions?.swarm?.durationMs || 0,
      stopReason: output.stopReason || "unknown",
    },
  };
}

function generateMarkdownScorecard(scores: TournamentRunScore[], errors: Array<{ run: string; error: string }>): string {
  let md = "# Tournament Scorecard\n\n";
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `Total runs: ${scores.length}\n`;
  md += `Errors: ${errors.length}\n\n`;
  
  md += "---\n\n";
  md += "## Leaderboard\n\n";
  md += "| Rank | Run | Score | Systems Model | Brand Model | Critic Model | Cost | Duration |\n";
  md += "|------|-----|-------|---------------|-------------|--------------|------|----------|\n";
  
  scores.forEach((score, i) => {
    md += `| ${i + 1} | ${score.runId} | ${score.scoreTotal.toFixed(1)} | ${score.models.systems} | ${score.models.brand} | ${score.models.critic} | $${score.costUsd.toFixed(4)} | ${(score.durationMs / 1000).toFixed(1)}s |\n`;
  });
  
  md += "\n---\n\n";
  md += "## Score Breakdown\n\n";
  
  scores.forEach((score) => {
    md += `### ${score.runId} — ${score.scoreTotal.toFixed(1)}/100\n\n`;
    md += `**Models:** ${score.models.systems} (systems), ${score.models.brand} (brand), ${score.models.critic} (critic)\n\n`;
    md += `**Quality (${score.scoreBreakdown.qualityScore.toFixed(1)}/70):**\n`;
    md += `- Coverage: ${score.scoreBreakdown.breakdown.coverage.toFixed(1)}/20\n`;
    md += `- Actionability: ${score.scoreBreakdown.breakdown.actionability.toFixed(1)}/20\n`;
    md += `- Conversion Architecture: ${score.scoreBreakdown.breakdown.conversionArchitecture.toFixed(1)}/20\n`;
    md += `- Coherence: ${score.scoreBreakdown.breakdown.coherence.toFixed(1)}/10\n\n`;
    md += `**Rigor (${score.scoreBreakdown.rigorScore.toFixed(1)}/20):**\n`;
    md += `- Critic Pressure: ${score.scoreBreakdown.breakdown.criticPressure.toFixed(1)}/10\n`;
    md += `- Severity Distribution: ${score.scoreBreakdown.breakdown.severityDistribution.toFixed(1)}/10\n\n`;
    md += `**Efficiency (${score.scoreBreakdown.efficiencyScore.toFixed(1)}/10):**\n`;
    md += `- Cost: ${score.scoreBreakdown.breakdown.cost.toFixed(1)}/5\n`;
    md += `- Speed: ${score.scoreBreakdown.breakdown.speed.toFixed(1)}/5\n\n`;
    md += `**Meta:** $${score.costUsd.toFixed(4)}, ${(score.durationMs / 1000).toFixed(1)}s, stopReason=${score.stopReason}\n\n`;
    md += "---\n\n";
  });
  
  if (errors.length > 0) {
    md += "## Errors\n\n";
    errors.forEach((err) => {
      md += `- **${err.run}:** ${err.error}\n`;
    });
    md += "\n";
  }
  
  return md;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
