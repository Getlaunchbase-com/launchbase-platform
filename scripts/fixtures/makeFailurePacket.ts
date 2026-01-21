#!/usr/bin/env tsx
/**
 * makeFailurePacket - Fixture Builder for FailurePackets
 * 
 * Generates golden FailurePacket fixtures from real repo files.
 * Eliminates manual JSON authoring and ensures fixtures always reference real files.
 * 
 * Usage:
 *   pnpm tsx scripts/fixtures/makeFailurePacket.ts \
 *     --target tsconfig.json \
 *     --kind typescript_config \
 *     --id minimal-tsconfig-forcecasing \
 *     --test "pnpm tsc --noEmit" \
 *     --test "pnpm vitest run"
 * 
 * Output:
 *   runs/fixtures/failurePackets/v1/<id>.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import type { FailurePacketV1 } from "../../server/contracts/failurePacket";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

function allArgs(name: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === name && i + 1 < process.argv.length) {
      results.push(process.argv[i + 1]);
    }
  }
  return results;
}

function sha256File(path: string): string {
  const content = readFileSync(path);
  return createHash("sha256").update(content).digest("hex");
}

function getGitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim().slice(0, 8);
  } catch {
    return "unknown";
  }
}

async function main() {
  const target = arg("--target");
  const kind = arg("--kind") as FailurePacketV1["failure"]["type"] | null;
  const id = arg("--id");
  const testCommands = allArgs("--test");
  const errorMessage = arg("--error") || "Fixture error for testing";
  const stopReason = arg("--stop-reason") || "fixture_test";

  // Validate required args
  if (!target) {
    console.error("Error: --target is required");
    console.error("Usage: pnpm tsx scripts/fixtures/makeFailurePacket.ts --target <file> --kind <type> --id <id> --test <cmd> [--test <cmd>...]");
    process.exit(1);
  }

  if (!kind) {
    console.error("Error: --kind is required (smoke_test, swarm_execution, builder_gate, etc.)");
    process.exit(1);
  }

  if (!id) {
    console.error("Error: --id is required (e.g., minimal-tsconfig-forcecasing)");
    process.exit(1);
  }

  if (testCommands.length === 0) {
    console.error("Error: At least one --test command is required");
    process.exit(1);
  }

  // Resolve paths
  const repoRoot = process.cwd();
  const targetPath = resolve(repoRoot, target);

  // Check if target exists
  if (!existsSync(targetPath)) {
    console.error(`Error: Target file does not exist: ${target}`);
    process.exit(1);
  }

  // Get file metadata
  const stats = statSync(targetPath);
  const sha256 = sha256File(targetPath);
  const relativePath = relative(repoRoot, targetPath);

  console.log(`[MakeFixture] Building FailurePacket fixture:`);
  console.log(`  ID: ${id}`);
  console.log(`  Target: ${relativePath}`);
  console.log(`  Kind: ${kind}`);
  console.log(`  SHA256: ${sha256}`);
  console.log(`  Test Commands: ${testCommands.length}`);

  // Build FailurePacket
  const packet: FailurePacketV1 = {
    version: "failurepacket.v1",
    meta: {
      timestamp: new Date().toISOString(),
      sha: getGitSha(),
      runId: `fixture_${id}`,
      environment: "dev",
    },
    failure: {
      type: kind,
      stopReason,
      errorMessage,
    },
    context: {
      command: testCommands[0], // First test command as primary command
      inputs: {
        target: relativePath,
      },
      outputs: {},
      logs: [],
      models: [],
      requestIds: [],
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      cwd: repoRoot,
      envVars: {
        NODE_ENV: "test",
        CI: "false",
      },
    },
  };

  // Add targets field (used by preflight validation)
  (packet as any).targets = [
    {
      path: relativePath,
      exists: true,
      sha256,
      size: stats.size,
    },
  ];

  // Add testCommands field (used by preflight validation and swarm)
  (packet as any).testCommands = testCommands;

  // Add policy field (snapshot of allowlist/denylist)
  (packet as any).policy = {
    allowlist: ["client/**", "server/**", "scripts/**", "docs/**", "tsconfig.json", "package.json"],
    denylist: [".env*", "drizzle/**", "node_modules/**", ".git/**", "**/secrets/**"],
  };

  // Write fixture
  const outDir = `runs/fixtures/failurePackets/v1`;
  mkdirSync(outDir, { recursive: true });
  const outPath = `${outDir}/${id}.json`;
  writeFileSync(outPath, JSON.stringify(packet, null, 2));

  console.log(`\n✅ Wrote fixture: ${outPath}`);
  console.log(`\nTo test this fixture:`);
  console.log(`  pnpm swarm:fix --from ${outPath} --apply --test`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
