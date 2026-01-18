/**
 * Tournament Runner — Discover best models per design role
 * 
 * Tests 8 candidates for systems, 8 for brand, 4 for critic
 * 2 runs per candidate = scientific method
 * Budget cap: $50 total
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Tournament candidates
const SYSTEMS_CANDIDATES = [
  "openai/gpt-5-2025-08-07",
  "openai/o3-pro",
  "openai/gpt-4o",
  "google/gemini-2.5-pro",
  "openai/gpt-4.1-2025-04-14",
  "claude-opus-4-1-20250805",
  "openai/gpt-5-mini-2025-08-07",
  "gpt-4o-2024-08-06", // stable release
];

const BRAND_CANDIDATES = [
  "openai/gpt-5-2025-08-07",
  "openai/o3-pro",
  "openai/gpt-4o",
  "google/gemini-2.5-pro",
  "openai/gpt-4.1-2025-04-14",
  "claude-opus-4-1-20250805",
  "openai/gpt-5-mini-2025-08-07",
  "gpt-4o-2024-08-06",
];

const CRITIC_CANDIDATES = [
  "claude-opus-4-1-20250805",
  "openai/o3-pro",
  "openai/gpt-5-2025-08-07",
  "google/gemini-2.5-pro",
];

interface TournamentRun {
  phase: string;
  candidate: string;
  role: string;
  pass: number;
  runPath: string;
  cost: number;
  duration: number;
  status: string;
  stopReason: string;
  proposedChangesCount?: number;
  issuesCount?: number;
}

const results: TournamentRun[] = [];
let totalCost = 0;
const BUDGET_CAP = 50.0;

function runShowroom(
  showroom: string,
  variant: string,
  policyPath: string
): { runPath: string; cost: number; duration: number; status: string; stopReason: string } {
  try {
    const output = execSync(
      `pnpm tsx scripts/runShowroom.ts ${showroom} ${variant}`,
      {
        cwd: "/home/ubuntu/launchbase",
        env: {
          ...process.env,
          AIML_API_KEY: process.env.AIML_API_KEY,
          IDEMPOTENCY_SECRET: "dev-local-idempotency-secret",
          NODE_ENV: "development",
        },
        encoding: "utf-8",
        timeout: 180000, // 3 min max
      }
    );

    // Parse output for run path and cost
    const runPathMatch = output.match(/Persisted to: (.+)/);
    const costMatch = output.match(/Total Cost: \$([0-9.]+)/);
    const durationMatch = output.match(/Duration: ([0-9]+)ms/);
    const statusMatch = output.match(/Status: (\w+)/);
    const stopReasonMatch = output.match(/StopReason: (\w+)/);

    return {
      runPath: runPathMatch?.[1] || "unknown",
      cost: parseFloat(costMatch?.[1] || "0"),
      duration: parseInt(durationMatch?.[1] || "0"),
      status: statusMatch?.[1] || "unknown",
      stopReason: stopReasonMatch?.[1] || "unknown",
    };
  } catch (error: any) {
    console.error(`Run failed: ${error.message}`);
    return {
      runPath: "failed",
      cost: 0,
      duration: 0,
      status: "failed",
      stopReason: "error",
    };
  }
}

function updatePolicy(systemsModel: string, brandModel: string, criticModel: string) {
  const policyPath = "/home/ubuntu/launchbase/server/ai/engine/policy/policies/swarm_design_tournament_v1.json";
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf-8"));

  policy.swarm.roles.designer_systems.model = systemsModel;
  policy.swarm.roles.designer_brand.model = brandModel;
  policy.swarm.roles.design_critic_ruthless.model = criticModel;

  fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2));
}

async function main() {
  console.log("🏆 Starting Model Tournament");
  console.log(`Budget: $${BUDGET_CAP}`);
  console.log(`Phases: Systems (${SYSTEMS_CANDIDATES.length}), Brand (${BRAND_CANDIDATES.length}), Critic (${CRITIC_CANDIDATES.length})`);
  console.log("");

  // Phase A: Systems model tournament
  console.log("📊 Phase A: Systems Model Tournament");
  const brandBaseline = "openai/gpt-4o";
  const criticBaseline = "claude-opus-4-1-20250805";

  for (const candidate of SYSTEMS_CANDIDATES) {
    if (totalCost >= BUDGET_CAP) {
      console.log(`⚠️  Budget cap reached ($${totalCost.toFixed(2)}/$${BUDGET_CAP})`);
      break;
    }

    console.log(`\n🧪 Testing: ${candidate} (systems)`);
    updatePolicy(candidate, brandBaseline, criticBaseline);

    for (let pass = 1; pass <= 2; pass++) {
      console.log(`  Pass ${pass}/2...`);
      const result = runShowroom("getlaunchbase", "designer", "/home/ubuntu/launchbase/server/ai/engine/policy/policies/swarm_design_tournament_v1.json");

      totalCost += result.cost;
      results.push({
        phase: "systems",
        candidate,
        role: "designer_systems",
        pass,
        runPath: result.runPath,
        cost: result.cost,
        duration: result.duration,
        status: result.status,
        stopReason: result.stopReason,
      });

      console.log(`  ✅ Cost: $${result.cost.toFixed(4)}, Duration: ${(result.duration / 1000).toFixed(1)}s, Total: $${totalCost.toFixed(2)}`);

      if (totalCost >= BUDGET_CAP) break;
    }
  }

  // Phase B: Brand model tournament
  console.log("\n\n📊 Phase B: Brand Model Tournament");
  const systemsWinner = results
    .filter((r) => r.phase === "systems" && r.status === "succeeded")
    .sort((a, b) => a.cost - b.cost)[0]?.candidate || "openai/gpt-4o";

  console.log(`Using systems winner: ${systemsWinner}`);

  for (const candidate of BRAND_CANDIDATES) {
    if (totalCost >= BUDGET_CAP) {
      console.log(`⚠️  Budget cap reached ($${totalCost.toFixed(2)}/$${BUDGET_CAP})`);
      break;
    }

    console.log(`\n🧪 Testing: ${candidate} (brand)`);
    updatePolicy(systemsWinner, candidate, criticBaseline);

    for (let pass = 1; pass <= 2; pass++) {
      console.log(`  Pass ${pass}/2...`);
      const result = runShowroom("getlaunchbase", "designer", "/home/ubuntu/launchbase/server/ai/engine/policy/policies/swarm_design_tournament_v1.json");

      totalCost += result.cost;
      results.push({
        phase: "brand",
        candidate,
        role: "designer_brand",
        pass,
        runPath: result.runPath,
        cost: result.cost,
        duration: result.duration,
        status: result.status,
        stopReason: result.stopReason,
      });

      console.log(`  ✅ Cost: $${result.cost.toFixed(4)}, Duration: ${(result.duration / 1000).toFixed(1)}s, Total: $${totalCost.toFixed(2)}`);

      if (totalCost >= BUDGET_CAP) break;
    }
  }

  // Phase C: Critic tournament
  console.log("\n\n📊 Phase C: Critic Model Tournament");
  const brandWinner = results
    .filter((r) => r.phase === "brand" && r.status === "succeeded")
    .sort((a, b) => a.cost - b.cost)[0]?.candidate || "openai/gpt-4o";

  console.log(`Using brand winner: ${brandWinner}`);

  for (const candidate of CRITIC_CANDIDATES) {
    if (totalCost >= BUDGET_CAP) {
      console.log(`⚠️  Budget cap reached ($${totalCost.toFixed(2)}/$${BUDGET_CAP})`);
      break;
    }

    console.log(`\n🧪 Testing: ${candidate} (critic)`);
    updatePolicy(systemsWinner, brandWinner, candidate);

    for (let pass = 1; pass <= 2; pass++) {
      console.log(`  Pass ${pass}/2...`);
      const result = runShowroom("getlaunchbase", "designer", "/home/ubuntu/launchbase/server/ai/engine/policy/policies/swarm_design_tournament_v1.json");

      totalCost += result.cost;
      results.push({
        phase: "critic",
        candidate,
        role: "design_critic_ruthless",
        pass,
        runPath: result.runPath,
        cost: result.cost,
        duration: result.duration,
        status: result.status,
        stopReason: result.stopReason,
      });

      console.log(`  ✅ Cost: $${result.cost.toFixed(4)}, Duration: ${(result.duration / 1000).toFixed(1)}s, Total: $${totalCost.toFixed(2)}`);

      if (totalCost >= BUDGET_CAP) break;
    }
  }

  // Save results
  const resultsPath = `/home/ubuntu/launchbase/runs/${new Date().toISOString().split("T")[0]}/TOURNAMENT_RESULTS.json`;
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

  console.log("\n\n🏆 Tournament Complete!");
  console.log(`Total Cost: $${totalCost.toFixed(2)}/$${BUDGET_CAP}`);
  console.log(`Total Runs: ${results.length}`);
  console.log(`Results saved: ${resultsPath}`);

  // Print winners
  console.log("\n🥇 Winners:");
  console.log(`  Systems: ${systemsWinner}`);
  console.log(`  Brand: ${brandWinner}`);
  const criticWinner = results
    .filter((r) => r.phase === "critic" && r.status === "succeeded")
    .sort((a, b) => a.cost - b.cost)[0]?.candidate || criticBaseline;
  console.log(`  Critic: ${criticWinner}`);
}

main().catch((err) => {
  console.error("Tournament failed:", err);
  process.exit(1);
});
