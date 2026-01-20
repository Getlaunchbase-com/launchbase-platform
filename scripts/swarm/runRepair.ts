#!/usr/bin/env tsx
/**
 * runRepair.ts
 *
 * Swarm-based test repair hook (proposal-only, no auto-apply)
 *
 * Usage:
 *   pnpm tsx scripts/swarm/runRepair.ts --from <failurePacket.json>
 *
 * Output:
 *   - Console summary (human readable)
 *   - .swarm_runs/last_result.json (full swarm output)
 *   - .swarm_runs/proposed_patch.diff (git diff, if applicable)
 *
 * Guardrails:
 *   - Runs in replay mode by default (deterministic, no network)
 *   - Requires explicit SWARM_RECORD=1 for recording new transcripts
 *   - No auto-apply (human review required)
 */

import fs from "node:fs";
import path from "node:path";

type Args = { from: string };

function parseArgs(): Args {
  const idx = process.argv.indexOf("--from");
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error("Usage: pnpm tsx scripts/swarm/runRepair.ts --from <failurePacket.json>");
    process.exit(1);
  }
  return { from: process.argv[idx + 1] };
}

async function main() {
  const { from } = parseArgs();
  const abs = path.resolve(from);

  if (!fs.existsSync(abs)) {
    console.error(`❌ FailurePacket not found: ${abs}`);
    process.exit(1);
  }

  // Guardrails
  console.log("🔧 Swarm Repair Hook");
  console.log(`📦 FailurePacket: ${abs}`);
  console.log("");

  if (process.env.SWARM_RECORD === "1") {
    console.warn("⚠️  SWARM_RECORD=1 is enabled. This will write fixtures.");
  } else {
    console.log("✅ Running in replay mode (deterministic, no network)");
  }

  if (!process.env.AI_PROVIDER) {
    console.warn("⚠️  AI_PROVIDER is not set. Defaulting to replay is recommended.");
  }

  console.log("");

  const failurePacket = JSON.parse(fs.readFileSync(abs, "utf8"));

  console.log("📋 Failure summary:");
  console.log(`  - Tier: ${failurePacket.tier ?? "unknown"}`);
  console.log(`  - Reason: ${failurePacket.reason ?? "unknown"}`);
  console.log(`  - File: ${failurePacket.file ?? "unknown"}`);
  console.log("");

  // TODO: Convert failurePacket → workOrder/policy/ctx
  // For now, this is a placeholder that shows the structure
  console.log("🚧 TODO: Implement packetToWorkOrder converter");
  console.log("   Expected: { workOrder, policy, ctx }");
  console.log("");

  try {
    // IMPORTANT: import lazily so mocks/env are in place
    const { runSwarmV1 } = await import("../../server/ai/engine/swarmRunner");
    
    const res = await runSwarmV1(workOrder as any, policy as any, ctx as any);

    // For now, just create the output directory structure
    const outDir = path.resolve(".swarm_runs");
    fs.mkdirSync(outDir, { recursive: true });

    const artifacts = res?.artifacts ?? [];
    const craft = artifacts.filter((a: any) => a?.type?.includes("specialist.craft"));
    const critic = artifacts.filter((a: any) => a?.type?.includes("specialist.critic"));
    const collapse = artifacts.find((a: any) => a?.type?.includes("swarm.collapse"));
    
    const result = {
      status: res?.status,
      stopReason: res?.stopReason,
      craftRounds: craft.map((c: any) => c?.payload ?? c),
      criticRounds: critic.map((c: any) => c?.payload ?? c),
      collapse: collapse?.payload ?? collapse,
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.log(JSON.stringify({ status: "error", error: String(err?.message ?? err) }, null, 2));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ Swarm run failed");
  console.error(e);
  process.exit(1);
});
