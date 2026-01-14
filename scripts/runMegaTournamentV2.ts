/**
 * Mega Tournament V2 - The Liar Hunt
 * 
 * 4 lanes × 5 stacks × 6 reps = 120 runs
 * 
 * Lanes:
 * 1. Web Design (homepage structure + conversion + trust)
 * 2. App UX / Product Design (onboarding, IA, navigation, flows, dashboard)
 * 3. Marketing Clarity (value prop, objection handling, pricing, positioning)
 * 4. Artwork / Brand Visuals (icon system, illustration, trust visuals, motifs)
 * 
 * Stacks:
 * 1. Control Champion (gpt-4o + claude-opus)
 * 2. GPT-5.2 Pro Stack
 * 3. GPT-5.2 Stack
 * 4. O3-Pro Stack
 * 5. Gemini 2.5 Pro Stack
 * 
 * Scoring: BaseScore - TruthPenalty (0-300)
 * 
 * Output:
 * - MEGA_TOURNAMENT_V2_SCORECARD.md
 * - MEGA_TOURNAMENT_V2_SCORECARD.json
 * - CATEGORY_CHAMPIONS_BY_LANE.json
 * - LIAR_LIST.json (models + failure patterns)
 */

import { callSpecialistWithRetry } from "../server/ai/engine/specialists/index.js";
import { calculateAggregateTruthfulness } from "../server/ai/engine/scoring/truthfulnessIndex.js";
import fs from "fs";
import path from "path";

// Tournament configuration
const TOURNAMENT_CONFIG = {
  lanes: [
    {
      id: "web_design",
      name: "Web Design",
      brief: "LaunchBase homepage: Improve structure, conversion architecture, and trust patterns for small business owners who need an operating system for their website.",
    },
    {
      id: "app_ux",
      name: "App UX / Product Design",
      brief: "LaunchBase Portal: Improve onboarding flow, information architecture, navigation patterns, and dashboard layout for first-time users.",
    },
    {
      id: "marketing",
      name: "Marketing Clarity",
      brief: "LaunchBase positioning: Sharpen value proposition, handle objections, clarify pricing tiers, and strengthen positioning consistency across all touchpoints.",
    },
    {
      id: "artwork",
      name: "Artwork / Brand Visuals",
      brief: "LaunchBase brand system: Define icon language, illustration style, trust visuals, motif library, and hero visual direction.",
    },
  ],
  stacks: [
    {
      id: "control_champion",
      name: "Control Champion (4o + Opus)",
      policy: "swarm_design_prod_v1",
    },
    {
      id: "gpt_5_2_pro",
      name: "GPT-5.2 Pro Stack",
      policy: "swarm_gpt_5_2_pro", // TODO: Create this policy
    },
    {
      id: "gpt_5_2",
      name: "GPT-5.2 Stack",
      policy: "swarm_gpt_5_2", // TODO: Create this policy
    },
    {
      id: "o3_pro",
      name: "O3-Pro Stack",
      policy: "swarm_o3_pro", // TODO: Create this policy
    },
    {
      id: "gemini_2_5_pro",
      name: "Gemini 2.5 Pro Stack",
      policy: "swarm_gemini_2_5_pro", // TODO: Create this policy
    },
  ],
  repsPerLaneStack: 6,
  concurrency: 3, // Run 3 in parallel to avoid melting providers
};

interface TournamentRun {
  runId: string;
  laneId: string;
  laneName: string;
  stackId: string;
  stackName: string;
  repNumber: number;
  brief: string;
  systemsResult: any;
  brandResult: any;
  criticResult: any;
  truthfulness: any;
  baseScore: number;
  finalScore: number;
  duration: number;
  cost: number;
  timestamp: string;
}

interface LaneChampion {
  laneId: string;
  laneName: string;
  championStackId: string;
  championStackName: string;
  avgFinalScore: number;
  avgTruthScore: number;
  avgBaseScore: number;
  runCount: number;
}

interface LiarEntry {
  stackId: string;
  stackName: string;
  laneId: string;
  laneName: string;
  truthPenalty: number;
  violationCount: number;
  topViolations: string[];
}

/**
 * Run a single tournament test
 */
async function runSingleTest(
  laneId: string,
  laneName: string,
  stackId: string,
  stackName: string,
  brief: string,
  repNumber: number,
  policyName: string
): Promise<TournamentRun> {
  const runId = `${laneId}__${stackId}__rep${repNumber}__${Date.now()}`;
  const startTime = Date.now();
  
  console.log(`\n[${runId}] Starting...`);
  console.log(`  Lane: ${laneName}`);
  console.log(`  Stack: ${stackName}`);
  console.log(`  Rep: ${repNumber}/6`);
  
  try {
    // Load policy
    const policyPath = path.join(
      process.cwd(),
      "server/ai/engine/policy/policies",
      `${policyName}.json`
    );
    const policy = JSON.parse(fs.readFileSync(policyPath, "utf-8"));
    
    // Run systems designer
    const systemsResult = await callSpecialistWithRetry({
      role: "designer_systems_fast",
      brief,
      roleConfig: policy.specialists.roles.designer_systems_fast,
      enableLadder: true,
    });
    
    // Run brand designer
    const brandResult = await callSpecialistWithRetry({
      role: "designer_brand_fast",
      brief,
      roleConfig: policy.specialists.roles.designer_brand_fast,
      enableLadder: true,
    });
    
    // Run critic
    const criticResult = await callSpecialistWithRetry({
      role: "design_critic_ruthless",
      brief,
      upstream: {
        systems: systemsResult.payload,
        brand: brandResult.payload,
      },
      roleConfig: policy.specialists.roles.design_critic_ruthless,
      enableLadder: true,
    });
    
    // Calculate truthfulness
    const truthfulness = calculateAggregateTruthfulness(
      systemsResult.payload,
      brandResult.payload,
      criticResult.payload
    );
    
    // Calculate scores
    const baseScore = 100; // TODO: Implement proper base scoring
    const finalScore = Math.max(0, baseScore - (truthfulness.truthPenalty / 3));
    
    const duration = Date.now() - startTime;
    const cost = 0; // TODO: Calculate actual cost
    
    console.log(`[${runId}] ✅ COMPLETE`);
    console.log(`  Base Score: ${baseScore}`);
    console.log(`  Truth Penalty: ${truthfulness.truthPenalty}`);
    console.log(`  Final Score: ${finalScore.toFixed(1)}`);
    console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
    
    return {
      runId,
      laneId,
      laneName,
      stackId,
      stackName,
      repNumber,
      brief,
      systemsResult: systemsResult.payload,
      brandResult: brandResult.payload,
      criticResult: criticResult.payload,
      truthfulness,
      baseScore,
      finalScore,
      duration,
      cost,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`[${runId}] ❌ FAILED: ${error.message}`);
    throw error;
  }
}

/**
 * Run tournament with concurrency control
 */
async function runTournament() {
  const startTime = Date.now();
  const allRuns: TournamentRun[] = [];
  
  console.log("============================================================");
  console.log("MEGA TOURNAMENT V2: The Liar Hunt");
  console.log("============================================================");
  console.log(`Lanes: ${TOURNAMENT_CONFIG.lanes.length}`);
  console.log(`Stacks: ${TOURNAMENT_CONFIG.stacks.length}`);
  console.log(`Reps per lane/stack: ${TOURNAMENT_CONFIG.repsPerLaneStack}`);
  console.log(`Total runs: ${TOURNAMENT_CONFIG.lanes.length * TOURNAMENT_CONFIG.stacks.length * TOURNAMENT_CONFIG.repsPerLaneStack}`);
  console.log(`Concurrency: ${TOURNAMENT_CONFIG.concurrency}`);
  console.log("============================================================\n");
  
  // Build queue
  const queue: Array<{
    laneId: string;
    laneName: string;
    stackId: string;
    stackName: string;
    brief: string;
    repNumber: number;
    policyName: string;
  }> = [];
  
  for (const lane of TOURNAMENT_CONFIG.lanes) {
    for (const stack of TOURNAMENT_CONFIG.stacks) {
      for (let rep = 1; rep <= TOURNAMENT_CONFIG.repsPerLaneStack; rep++) {
        queue.push({
          laneId: lane.id,
          laneName: lane.name,
          stackId: stack.id,
          stackName: stack.name,
          brief: lane.brief,
          repNumber: rep,
          policyName: stack.policy,
        });
      }
    }
  }
  
  // Run with concurrency control
  let completed = 0;
  const total = queue.length;
  
  while (queue.length > 0) {
    const batch = queue.splice(0, TOURNAMENT_CONFIG.concurrency);
    const batchPromises = batch.map(item =>
      runSingleTest(
        item.laneId,
        item.laneName,
        item.stackId,
        item.stackName,
        item.brief,
        item.repNumber,
        item.policyName
      )
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        allRuns.push(result.value);
        completed++;
      } else {
        console.error(`Run failed: ${result.reason}`);
      }
    }
    
    console.log(`\n[PROGRESS] ${completed}/${total} completed (${((completed / total) * 100).toFixed(1)}%)\n`);
  }
  
  // Generate reports
  const duration = Date.now() - startTime;
  await generateReports(allRuns, duration);
  
  console.log("\n============================================================");
  console.log("MEGA TOURNAMENT V2 COMPLETE");
  console.log("============================================================");
  console.log(`Total runs: ${allRuns.length}`);
  console.log(`Duration: ${(duration / 1000 / 60).toFixed(1)} minutes`);
  console.log(`Reports: /home/ubuntu/launchbase/runs/mega_tournament_v2/`);
  console.log("============================================================");
}

/**
 * Generate tournament reports
 */
async function generateReports(runs: TournamentRun[], duration: number) {
  const outputDir = path.join(process.cwd(), "runs/mega_tournament_v2");
  fs.mkdirSync(outputDir, { recursive: true });
  
  // Calculate lane champions
  const laneChampions: LaneChampion[] = [];
  
  for (const lane of TOURNAMENT_CONFIG.lanes) {
    const laneRuns = runs.filter(r => r.laneId === lane.id);
    const stackScores: Record<string, { total: number; count: number; truthTotal: number; baseTotal: number }> = {};
    
    for (const run of laneRuns) {
      if (!stackScores[run.stackId]) {
        stackScores[run.stackId] = { total: 0, count: 0, truthTotal: 0, baseTotal: 0 };
      }
      stackScores[run.stackId].total += run.finalScore;
      stackScores[run.stackId].truthTotal += run.truthfulness.truthScore;
      stackScores[run.stackId].baseTotal += run.baseScore;
      stackScores[run.stackId].count++;
    }
    
    // Find champion
    let championStackId = "";
    let championStackName = "";
    let maxAvgScore = -1;
    
    for (const [stackId, scores] of Object.entries(stackScores)) {
      const avgScore = scores.total / scores.count;
      if (avgScore > maxAvgScore) {
        maxAvgScore = avgScore;
        championStackId = stackId;
        championStackName = TOURNAMENT_CONFIG.stacks.find(s => s.id === stackId)?.name || "";
      }
    }
    
    laneChampions.push({
      laneId: lane.id,
      laneName: lane.name,
      championStackId,
      championStackName,
      avgFinalScore: maxAvgScore,
      avgTruthScore: stackScores[championStackId].truthTotal / stackScores[championStackId].count,
      avgBaseScore: stackScores[championStackId].baseTotal / stackScores[championStackId].count,
      runCount: stackScores[championStackId].count,
    });
  }
  
  // Generate liar list
  const liarList: LiarEntry[] = [];
  
  for (const run of runs) {
    if (run.truthfulness.truthPenalty > 50) {
      liarList.push({
        stackId: run.stackId,
        stackName: run.stackName,
        laneId: run.laneId,
        laneName: run.laneName,
        truthPenalty: run.truthfulness.truthPenalty,
        violationCount: run.truthfulness.violations.length,
        topViolations: run.truthfulness.violations.slice(0, 3).map((v: any) => v.description),
      });
    }
  }
  
  // Sort liar list by penalty (descending)
  liarList.sort((a, b) => b.truthPenalty - a.truthPenalty);
  
  // Write JSON reports
  fs.writeFileSync(
    path.join(outputDir, "MEGA_TOURNAMENT_V2_SCORECARD.json"),
    JSON.stringify(runs, null, 2)
  );
  
  fs.writeFileSync(
    path.join(outputDir, "CATEGORY_CHAMPIONS_BY_LANE.json"),
    JSON.stringify(laneChampions, null, 2)
  );
  
  fs.writeFileSync(
    path.join(outputDir, "LIAR_LIST.json"),
    JSON.stringify(liarList, null, 2)
  );
  
  console.log("\n✅ Reports generated:");
  console.log(`  - ${outputDir}/MEGA_TOURNAMENT_V2_SCORECARD.json`);
  console.log(`  - ${outputDir}/CATEGORY_CHAMPIONS_BY_LANE.json`);
  console.log(`  - ${outputDir}/LIAR_LIST.json`);
}

// Run tournament
runTournament().catch(console.error);
