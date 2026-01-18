/**
 * Showroom Runner Script
 * 
 * Executes swarm engine against showroom briefs with filesystem persistence.
 * 
 * Usage:
 *   pnpm tsx scripts/runShowroom.ts coffee-shop baseline
 *   pnpm tsx scripts/runShowroom.ts coffee-shop audience-tone
 *   pnpm tsx scripts/runShowroom.ts coffee-shop no-claims
 * 
 * Output structure:
 *   runs/<YYYY-MM-DD>/run_<NN>/
 *     input.json
 *     output.json
 *     summary.md
 */

import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { runEngine } from "../server/ai/engine/runEngine";
import type { AiWorkOrderV1, AiWorkResultV1 } from "../server/ai/engine/types";
import { registerPolicies } from "../server/ai/engine/policy/policyRegistry";
import { ALL_POLICIES } from "../server/ai/engine/policy/policyBundle";

// ============================================
// SHOWROOM BRIEFS
// ============================================

const SHOWROOM_BRIEFS: Record<string, Record<string, any>> = {
  "coffee-shop": {
    baseline: {
      task: "Write homepage copy for artisan coffee shop",
      business: "The Daily Grind",
      description: "Locally roasted coffee, cozy atmosphere, community gathering space",
    },
    "audience-tone": {
      task: "Write homepage copy for artisan coffee shop",
      business: "The Daily Grind",
      description: "Locally roasted coffee, cozy atmosphere, community gathering space",
      audience: "coffee enthusiasts, remote workers, local community",
      tone: "warm, inviting, authentic",
    },
    "no-claims": {
      task: "Write homepage copy for artisan coffee shop",
      business: "The Daily Grind",
      description: "Locally roasted coffee, cozy atmosphere, community gathering space",
      constraints: "No unverified claims, no superlatives without evidence, focus on facts",
    },
  },
};

// ============================================
// RUNNER LOGIC
// ============================================

async function runShowroom(showroom: string, variant: string) {
  console.log(`\n🚀 Running showroom: ${showroom} (${variant})\n`);

  // Get brief
  const brief = SHOWROOM_BRIEFS[showroom]?.[variant];
  if (!brief) {
    throw new Error(`Unknown showroom or variant: ${showroom}/${variant}`);
  }

  // Register policies
  registerPolicies(ALL_POLICIES);

  // Create work order
  const order: AiWorkOrderV1 = {
    version: "v1",
    tenant: "launchbase",
    scope: `showroom.${showroom}.${variant}`,
    policyId: "swarm_premium_v1",
    inputs: brief,
    constraints: { maxRounds: 1, costCapUsd: 1.0 },
    idempotency: {
      scope: `showroom.${showroom}.${variant}`,
      keyHash: `${showroom}-${variant}-${Date.now()}`,
    },
    trace: { jobId: `showroom-${showroom}-${variant}-${Date.now()}` },
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

  console.log("✅ Engine completed:");
  console.log(`  Status: ${result.status}`);
  console.log(`  StopReason: ${result.stopReason}`);
  console.log(`  Artifacts: ${result.artifacts.length}`);
  console.log(`  Duration: ${duration}ms`);
  console.log("");

  // Extract telemetry
  const swarmMeta = result.extensions?.swarm as any;
  console.log("📊 Telemetry:");
  console.log(`  Total Cost: $${swarmMeta?.totalCostUsd?.toFixed(4) || "0.0000"}`);
  console.log(`  Craft Cost: $${swarmMeta?.roleCostsUsd?.craft?.toFixed(4) || "0.0000"}`);
  console.log(`  Critic Cost: $${swarmMeta?.roleCostsUsd?.critic?.toFixed(4) || "0.0000"}`);
  console.log(`  Craft Model: ${swarmMeta?.roleModels?.craft || "unknown"}`);
  console.log(`  Critic Model: ${swarmMeta?.roleModels?.critic || "unknown"}`);
  console.log(`  NeedsHuman: ${result.needsHuman}`);
  console.log("");

  // Persist to filesystem
  const runDir = await createRunDirectory(showroom, variant);
  await persistRun(runDir, order, result, duration);

  console.log(`💾 Persisted to: ${runDir}`);
  console.log("");

  return { order, result, runDir, duration };
}

// ============================================
// FILESYSTEM PERSISTENCE
// ============================================

async function createRunDirectory(showroom: string, variant: string): Promise<string> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const baseDir = join(process.cwd(), "runs", today);

  // Ensure base directory exists
  await mkdir(baseDir, { recursive: true });

  // Find next run number
  const { readdirSync } = await import("fs");
  const existing = readdirSync(baseDir).filter((name) => name.startsWith("run_"));
  const runNumbers = existing.map((name) => parseInt(name.split("_")[1], 10));
  const nextRun = runNumbers.length > 0 ? Math.max(...runNumbers) + 1 : 1;

  const runDir = join(baseDir, `run_${String(nextRun).padStart(2, "0")}`);
  await mkdir(runDir, { recursive: true });

  return runDir;
}

async function persistRun(
  runDir: string,
  order: AiWorkOrderV1,
  result: AiWorkResultV1,
  duration: number
) {
  // Write input.json
  await writeFile(
    join(runDir, "input.json"),
    JSON.stringify(order, null, 2),
    "utf-8"
  );

  // Write output.json
  await writeFile(
    join(runDir, "output.json"),
    JSON.stringify(result, null, 2),
    "utf-8"
  );

  // Write summary.md
  const summary = generateSummary(order, result, duration);
  await writeFile(join(runDir, "summary.md"), summary, "utf-8");
}

function generateSummary(
  order: AiWorkOrderV1,
  result: AiWorkResultV1,
  duration: number
): string {
  const swarmMeta = result.extensions?.swarm as any;

  const lines: string[] = [];
  lines.push(`# Showroom Run Summary`);
  lines.push(``);
  lines.push(`**Showroom:** ${order.scope}`);
  lines.push(`**Policy:** ${order.policyId}`);
  lines.push(`**KeyHash:** ${order.idempotency.keyHash}`);
  lines.push(`**Timestamp:** ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`## Outcome`);
  lines.push(``);
  lines.push(`- **Status:** ${result.status}`);
  lines.push(`- **StopReason:** ${result.stopReason}`);
  lines.push(`- **NeedsHuman:** ${result.needsHuman}`);
  lines.push(`- **Duration:** ${duration}ms`);
  lines.push(``);
  lines.push(`## Telemetry`);
  lines.push(``);
  lines.push(`- **Total Cost:** $${swarmMeta?.totalCostUsd?.toFixed(4) || "0.0000"}`);
  lines.push(`- **Craft Cost:** $${swarmMeta?.roleCostsUsd?.craft?.toFixed(4) || "0.0000"}`);
  lines.push(`- **Critic Cost:** $${swarmMeta?.roleCostsUsd?.critic?.toFixed(4) || "0.0000"}`);
  lines.push(`- **Craft Model:** ${swarmMeta?.roleModels?.craft || "unknown"}`);
  lines.push(`- **Critic Model:** ${swarmMeta?.roleModels?.critic || "unknown"}`);
  lines.push(``);
  lines.push(`## Artifacts`);
  lines.push(``);
  lines.push(`Total: ${result.artifacts.length}`);
  lines.push(``);

  for (const artifact of result.artifacts as any[]) {
    lines.push(`### ${artifact.kind}`);
    lines.push(``);
    lines.push(`- **CustomerSafe:** ${artifact.customerSafe}`);
    if (artifact.payload) {
      lines.push(`- **Payload:**`);
      lines.push(`  \`\`\`json`);
      lines.push(`  ${JSON.stringify(artifact.payload, null, 2)}`);
      lines.push(`  \`\`\``);
    }
    lines.push(``);
  }

  lines.push(`## Input Brief`);
  lines.push(``);
  lines.push(`\`\`\`json`);
  lines.push(JSON.stringify(order.inputs, null, 2));
  lines.push(`\`\`\``);
  lines.push(``);

  return lines.join("\n");
}

// ============================================
// CLI ENTRY POINT
// ============================================

async function main() {
  // Ensure IDEMPOTENCY_SECRET is set (use default for benchmark runs)
  if (!process.env.IDEMPOTENCY_SECRET) {
    process.env.IDEMPOTENCY_SECRET = "benchmark-showroom-runner-secret-key";
    console.log("⚠️  Using default IDEMPOTENCY_SECRET for benchmark runs");
    console.log("");
  }

  const [showroom, variant] = process.argv.slice(2);

  if (!showroom || !variant) {
    console.error("Usage: pnpm tsx scripts/runShowroom.ts <showroom> <variant>");
    console.error("");
    console.error("Available showrooms:");
    console.error("  coffee-shop: baseline, audience-tone, no-claims");
    process.exit(1);
  }

  try {
    await runShowroom(showroom, variant);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

main();
