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
  "getlaunchbase": {
    baseline: {
      task: "Review and improve homepage copy for LaunchBase",
      business: "LaunchBase",
      description: "AI-powered website operations system that handles website updates, social media, and business intelligence for small businesses. Core value: responsibility transfer (hand off operations, keep visibility). Not a website builder - a complete operations handoff with observability, reversibility, and safety gating.",
      currentCopy: {
        hero: "Stop carrying the system in your head. Hand it off. Keep visibility.",
        problem: "No one owns the system. You're the fallback for everything.",
        solution: "LaunchBase becomes the owner. You stay informed, not involved.",
        trust: "Safe by default. Fully logged. Reversible.",
      },
      audience: "Small business owners (fitness studios, coffee shops, consulting firms, e-commerce) who are tired of being the bottleneck for their website and marketing operations",
      tone: "Direct, honest, reassuring. B2B professional. Emphasize responsibility transfer and observability.",
      constraints: "No hype language. No unverifiable claims. Focus on concrete benefits: mental load reduction, visibility, reversibility, safety gating.",
    },
    premium: {
      task: "Review and improve homepage copy for LaunchBase",
      business: "LaunchBase",
      description: "AI-powered website operations system that handles website updates, social media, and business intelligence for small businesses. Core value: responsibility transfer (hand off operations, keep visibility). Not a website builder - a complete operations handoff with observability, reversibility, and safety gating.",
      currentCopy: {
        hero: "Stop carrying the system in your head. Hand it off. Keep visibility.",
        problem: "No one owns the system. You're the fallback for everything.",
        solution: "LaunchBase becomes the owner. You stay informed, not involved.",
        trust: "Safe by default. Fully logged. Reversible.",
      },
      audience: "Small business owners (fitness studios, coffee shops, consulting firms, e-commerce) who are tired of being the bottleneck for their website and marketing operations",
      tone: "Direct, honest, reassuring. B2B professional. Emphasize responsibility transfer and observability.",
      constraints: "No hype language. No unverifiable claims. Focus on concrete benefits: mental load reduction, visibility, reversibility, safety gating.",
    },
    designer: {
      task: "Design and improve the LaunchBase homepage from first principles",
      business: "LaunchBase",
      whitePaper: `LaunchBase is an operating system for small businesses.
Not a website builder. Not another tool. Not a one-time agency project.

LaunchBase is ongoing ownership of a business's digital operating layer:
- website uptime + maintenance
- lead capture + forms
- monitoring + safety decisions
- updates + publishing cadence
- integrations + visibility
- logging + accountability

LaunchBase exists because most small businesses already have tools, but no one owns the system.
They have a website, a payment tool, a calendar, a Google profile, and logins…
…but the owner still carries the burden of making sure everything works.

LaunchBase sells relief from that cognitive load.

Core customer pain: The customer isn't buying a website. They're buying the ability to stop thinking about:
- "Is it still working?"
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

  // Determine policy based on variant
  let policyId = "swarm_premium_v1";
  if (variant === "premium") policyId = "swarm_premium_v2";
  if (variant === "designer") policyId = "swarm_designer_premium";

  // Create work order
  const order: AiWorkOrderV1 = {
    version: "v1",
    tenant: "launchbase",
    scope: `showroom.${showroom}.${variant}`,
    policyId,
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
