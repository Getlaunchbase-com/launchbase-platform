/**
 * Ladder Runner — Build-on-Previous Iterative Design Improvement
 * 
 * Runs 4 iterations where each builds on the previous output:
 * 1. Structure & Hierarchy
 * 2. Conversion & Trust Architecture
 * 3. Components & Interaction Design
 * 4. Final Polish Pass
 * 
 * Uses winning stack from tournament (gpt-4o-2024-08-06 + claude-opus-4-1-20250805)
 * Policy: swarm_winning_stack_v1
 */

import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { runEngine } from "../server/ai/engine/runEngine";
import type { AiWorkOrderV1, AiWorkResultV1 } from "../server/ai/engine/types";
import { registerPolicies } from "../server/ai/engine/policy/policyRegistry";
import { ALL_POLICIES } from "../server/ai/engine/policy/policyBundle";

interface LadderRun {
  iteration: number;
  title: string;
  directive: string;
  runPath: string;
  cost: number;
  duration: number;
  status: string;
  stopReason: string;
  proposedChangesCount: number;
  issuesCount: number;
}

const LADDER_ITERATIONS = [
  {
    title: "Structure & Hierarchy",
    directive: "Make it feel like Stripe/Linear. Remove friction. Improve flow. Focus on layout, section order, spacing, typography scale, and scannability.",
  },
  {
    title: "Conversion & Trust Architecture",
    directive: "Increase CTA certainty without hype. Focus on CTA placement, trust sequencing, objections handling, and proof strategy.",
  },
  {
    title: "Components & Interaction Design",
    directive: "Make it feel expensive + inevitable. Focus on sticky CTA rules, cards, tables, FAQ behavior, and micro-interactions.",
  },
  {
    title: "Final Polish Pass",
    directive: "Ship-ready. No extra ideas. Only best ones. Reduce noise, remove redundancy, unify tone, tighten all changes.",
  },
];

const BASE_BRIEF = {
  task: "Design and improve the LaunchBase homepage from first principles",
  business: "LaunchBase",
  description: `LaunchBase is an AI-powered website operations system that handles website updates, social media, and business intelligence for small businesses.

Core value proposition:
✅ Responsibility transfer (hand off operations, keep visibility)
✅ Not a website builder - a complete operations handoff
✅ Observability, reversibility, and safety gating

The problem LaunchBase solves:
- "Did that form actually send?"
- "What should I post?"
- "Is anything broken?"
- "Am I missing something?"

This is background anxiety, not a feature gap.
The enemy is not "lack of tools."
The enemy is lack of ownership.

LaunchBase replaces the customer as the default system-checker.

Promise:
✅ Change is reversible
✅ Non-action is safe
✅ Silence is a valid decision
✅ Every action is logged
✅ Customer sees their real site before paying
✅ LaunchBase acts only after approval

The brand is accountability.
LaunchBase is responsibility-as-a-service.

Target customer:
- owner-operator
- service business
- small team
- not "tech obsessed"
- wants a business to run, not to "manage tools"

Tone: calm, competent, honest, operationally serious, safety-first, premium but not flashy.
This is a systems product, not a "creative brand party."

Design objective:
✅ Create instant trust
✅ Communicate the contract clearly
✅ Show the "safe-by-default" nature
✅ Make "Hand It Off" feel low-risk
✅ Explain observability in plain English
✅ Look premium enough to justify recurring ownership`,
  currentCopy: {
    hero: "Stop carrying the system in your head. Hand it off. Keep visibility.",
    problem: "No one owns the system. You're the fallback for everything.",
    solution: "LaunchBase becomes the owner. You stay informed, not involved.",
    trust: "Safe by default. Fully logged. Reversible.",
  },
  audience: "Owner-operators of service businesses (fitness studios, coffee shops, consulting firms) who want stability and accountability, not tool management",
  tone: "Calm, minimal, trustworthy, premium. Avoid hype. Avoid 'AI magic.' Avoid exaggerated claims.",
  constraints: "Mobile-first. Must feel like 'responsibility-as-a-service.' Must emphasize safety, reversibility, observability. Must reduce mental load while reading.",
};

const results: LadderRun[] = [];
let totalCost = 0;
const BUDGET_CAP = 10.0; // $10 for ladder

function extractProposedChanges(outputPath: string): any[] {
  try {
    const outputJson = JSON.parse(readFileSync(outputPath, "utf-8"));
    const artifacts = outputJson.artifacts || [];
    
    const systemsArtifact = artifacts.find((a: any) => a.kind === "swarm.specialist.designer_systems");
    const brandArtifact = artifacts.find((a: any) => a.kind === "swarm.specialist.designer_brand");
    
    return [
      ...(systemsArtifact?.payload?.proposedChanges || []),
      ...(brandArtifact?.payload?.proposedChanges || []),
    ];
  } catch (err) {
    console.error(`Failed to extract proposedChanges:`, err);
    return [];
  }
}

function countMetrics(outputPath: string): { proposedChangesCount: number; issuesCount: number } {
  try {
    const outputJson = JSON.parse(readFileSync(outputPath, "utf-8"));
    const artifacts = outputJson.artifacts || [];
    
    const systemsArtifact = artifacts.find((a: any) => a.kind === "swarm.specialist.designer_systems");
    const brandArtifact = artifacts.find((a: any) => a.kind === "swarm.specialist.designer_brand");
    const criticArtifact = artifacts.find((a: any) => a.kind === "swarm.specialist.critic");
    
    const proposedChangesCount = 
      (systemsArtifact?.payload?.proposedChanges?.length || 0) +
      (brandArtifact?.payload?.proposedChanges?.length || 0);
    
    const issuesCount = criticArtifact?.payload?.issues?.length || 0;
    
    return { proposedChangesCount, issuesCount };
  } catch (err) {
    console.error(`Failed to count metrics:`, err);
    return { proposedChangesCount: 0, issuesCount: 0 };
  }
}

async function runIteration(
  iteration: number,
  title: string,
  directive: string,
  previousChanges: any[]
): Promise<LadderRun> {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🪜 ITERATION ${iteration}/4: ${title}`);
  console.log(`${"=".repeat(80)}`);
  console.log(`Directive: ${directive}`);
  console.log(`Previous changes count: ${previousChanges.length}`);
  console.log("");

  // Register policies
  registerPolicies(ALL_POLICIES);

  // Build brief with previous changes
  const brief = {
    ...BASE_BRIEF,
    iterationDirective: directive,
    previousChanges: previousChanges.length > 0 ? previousChanges : undefined,
  };

  // Create work order
  const order: AiWorkOrderV1 = {
    version: "v1",
    tenant: "launchbase",
    scope: `ladder.iteration${iteration}`,
    policyId: "swarm_design_tournament_v1",
    inputs: brief,
    constraints: { maxRounds: 1, costCapUsd: 2.5 },
    idempotency: {
      scope: `ladder.iteration${iteration}`,
      keyHash: `ladder-${iteration}-${Date.now()}`,
    },
    trace: { jobId: `ladder-iteration-${iteration}-${Date.now()}` },
    audit: { customerTrailOn: true, internalTrailOn: true },
  };

  console.log("📋 Work Order:");
  console.log(`  Scope: ${order.scope}`);
  console.log(`  Policy: ${order.policyId}`);
  console.log(`  KeyHash: ${order.idempotency.keyHash}`);
  console.log("");

  // Run engine
  const startTime = Date.now();
  const result = await runEngine(order);
  const duration = Date.now() - startTime;

  console.log("✅ Engine Result:");
  console.log(`  Status: ${result.status}`);
  console.log(`  StopReason: ${result.stopReason}`);
  console.log(`  Duration: ${duration}ms`);
  console.log(`  Artifacts: ${result.artifacts.length}`);
  console.log("");

  // Determine run directory
  const today = new Date().toISOString().split("T")[0];
  const runsDir = join(process.cwd(), "runs", today);
  
  // Find next run number
  let runNum = 1;
  while (existsSync(join(runsDir, `run_${runNum.toString().padStart(2, "0")}`))) {
    runNum++;
  }
  const runPath = join(runsDir, `run_${runNum.toString().padStart(2, "0")}`);

  // Create run directory
  await mkdir(runPath, { recursive: true });

  // Save input
  await writeFile(
    join(runPath, "input.json"),
    JSON.stringify(order, null, 2),
    "utf-8"
  );

  // Save output
  const outputPath = join(runPath, "output.json");
  await writeFile(
    outputPath,
    JSON.stringify(result, null, 2),
    "utf-8"
  );

  // Extract cost
  const cost = result.extensions?.swarm?.totalCostUsd || 0;

  // Count metrics
  const { proposedChangesCount, issuesCount } = countMetrics(outputPath);

  // Generate summary
  const summary = `# Ladder Iteration ${iteration}: ${title}

**Directive:** ${directive}

**Metrics:**
- Cost: $${cost.toFixed(4)}
- Duration: ${(duration / 1000).toFixed(1)}s
- Status: ${result.status}
- StopReason: ${result.stopReason}
- Proposed Changes: ${proposedChangesCount}
- Critic Issues: ${issuesCount}
- Previous Changes Injected: ${previousChanges.length}

**Run Path:** ${runPath}

**Policy:** swarm_winning_stack_v1
- Systems: gpt-4o-2024-08-06
- Brand: gpt-4o-2024-08-06
- Critic: claude-opus-4-1-20250805
`;

  await writeFile(join(runPath, "summary.md"), summary, "utf-8");

  console.log(`✅ Iteration ${iteration} complete:`);
  console.log(`   Cost: $${cost.toFixed(4)}`);
  console.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);
  console.log(`   Status: ${result.status}`);
  console.log(`   StopReason: ${result.stopReason}`);
  console.log(`   Proposed Changes: ${proposedChangesCount}`);
  console.log(`   Critic Issues: ${issuesCount}`);
  console.log(`   Persisted to: ${runPath}`);
  console.log("");

  return {
    iteration,
    title,
    directive,
    runPath,
    cost,
    duration,
    status: result.status,
    stopReason: result.stopReason,
    proposedChangesCount,
    issuesCount,
  };
}

async function main() {
  console.log("🪜 Starting 4-Run Build-on-Previous Ladder");
  console.log(`Budget: $${BUDGET_CAP}`);
  console.log(`Policy: swarm_winning_stack_v1`);
  console.log(`Models: gpt-4o-2024-08-06 (systems+brand), claude-opus-4-1-20250805 (critic)`);
  console.log("");

  let previousChanges: any[] = [];

  for (let i = 0; i < LADDER_ITERATIONS.length; i++) {
    const iteration = LADDER_ITERATIONS[i];
    const iterationNum = i + 1;

    if (totalCost >= BUDGET_CAP) {
      console.log(`⚠️  Budget cap reached ($${totalCost.toFixed(2)}/$${BUDGET_CAP})`);
      break;
    }

    const result = await runIteration(
      iterationNum,
      iteration.title,
      iteration.directive,
      previousChanges
    );

    totalCost += result.cost;
    results.push(result);

    // Extract proposedChanges for next iteration
    const outputPath = join(result.runPath, "output.json");
    if (existsSync(outputPath)) {
      previousChanges = extractProposedChanges(outputPath);
      console.log(`   Extracted ${previousChanges.length} changes for next iteration\n`);
    }

    if (totalCost >= BUDGET_CAP) break;
  }

  // Save results
  const today = new Date().toISOString().split("T")[0];
  const runsDir = join(process.cwd(), "runs", today);
  const resultsPath = join(runsDir, "LADDER_RESULTS.json");
  await writeFile(resultsPath, JSON.stringify(results, null, 2), "utf-8");

  // Generate summary markdown
  const summaryPath = join(runsDir, "LADDER_SUMMARY.md");
  const summary = generateSummary(results, totalCost);
  await writeFile(summaryPath, summary, "utf-8");

  console.log("\n\n🏆 Ladder Complete!");
  console.log(`Total Cost: $${totalCost.toFixed(2)}/$${BUDGET_CAP}`);
  console.log(`Total Iterations: ${results.length}`);
  console.log(`Results saved: ${resultsPath}`);
  console.log(`Summary saved: ${summaryPath}`);
  
  console.log("\n📊 Iteration Summary:");
  results.forEach((r) => {
    console.log(`  ${r.iteration}. ${r.title}: ${r.proposedChangesCount} changes, ${r.issuesCount} issues, $${r.cost.toFixed(4)}`);
  });
}

function generateSummary(results: LadderRun[], totalCost: number): string {
  let md = "# 4-Run Build-on-Previous Ladder Summary\n\n";
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += `**Policy:** swarm_winning_stack_v1\n`;
  md += `**Models:**\n`;
  md += `- Systems: gpt-4o-2024-08-06\n`;
  md += `- Brand: gpt-4o-2024-08-06\n`;
  md += `- Critic: claude-opus-4-1-20250805\n\n`;
  md += `**Total Cost:** $${totalCost.toFixed(4)}\n`;
  md += `**Total Iterations:** ${results.length}\n\n`;
  
  md += "---\n\n";
  md += "## Iteration Results\n\n";
  
  results.forEach((result) => {
    md += `### Iteration ${result.iteration}: ${result.title}\n\n`;
    md += `**Directive:** ${result.directive}\n\n`;
    md += `**Metrics:**\n`;
    md += `- Cost: $${result.cost.toFixed(4)}\n`;
    md += `- Duration: ${(result.duration / 1000).toFixed(1)}s\n`;
    md += `- Status: ${result.status}\n`;
    md += `- StopReason: ${result.stopReason}\n`;
    md += `- Proposed Changes: ${result.proposedChangesCount}\n`;
    md += `- Critic Issues: ${result.issuesCount}\n`;
    md += `- Run Path: ${result.runPath}\n\n`;
    md += "---\n\n";
  });
  
  md += "## Convergence Analysis\n\n";
  md += "To check if the ladder has converged, run:\n\n";
  md += "```bash\n";
  md += "pnpm tsx scripts/detectConvergence.ts\n";
  md += "```\n\n";
  md += "**Convergence criteria:** Last 4 runs within ±5 points of each other\n\n";
  
  md += "## Next Steps\n\n";
  md += "1. Review proposed changes in each iteration\n";
  md += "2. Check convergence\n";
  md += "3. If converged → ship\n";
  md += "4. If not converged → run another ladder set\n\n";
  
  return md;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
