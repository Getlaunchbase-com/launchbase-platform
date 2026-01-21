/**
 * runFixtureTests - Test all fixtures with swarm:fix
 * 
 * This script:
 * 1. Loops over all fixtures in runs/fixtures/failurePackets/v1/
 * 2. For each fixture, runs swarm:fix --apply --test
 * 3. Reverts changes after each test (git reset --hard)
 * 4. Tracks PASS/FAIL for each fixture
 * 5. Reports summary at the end
 * 
 * Usage:
 *   pnpm smoke:repair:fixtures
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname, isAbsolute, posix, normalize } from "node:path";

const FIXTURES_DIR = "runs/fixtures/failurePackets/v1";
const REPO_ROOT = process.cwd();

// Parse CLI args
const args = process.argv.slice(2);
const onlyIndex = args.indexOf("--only");
const onlyFilter = onlyIndex !== -1 && args[onlyIndex + 1] ? args[onlyIndex + 1].split(",") : null;

interface FixtureResult {
  id: string;
  stopReason: string;
  applied: boolean;
  testsPassed: boolean;
  cost: number;
  latency: number;
  pass: boolean;
}

type FileSnapshot = {
  relPath: string;
  contents: string;
  sha256?: string;
  bytes?: number;
};

function assertSafeRelPath(relPath: string) {
  // no absolute paths
  if (isAbsolute(relPath)) throw new Error(`absolute path not allowed: ${relPath}`);

  // normalize and block traversal
  const norm = posix.normalize(relPath.replaceAll("\\", "/"));
  if (norm.startsWith("../") || norm.includes("/../")) throw new Error(`path traversal not allowed: ${relPath}`);

  // block obvious secrets
  const lower = norm.toLowerCase();
  const deny = [".env", "secrets", "private", "drizzle", "server/auth", "oauth", "keys"];
  if (lower.startsWith(".env") || lower.includes("/.env")) throw new Error(`env file not allowed: ${relPath}`);
  if (deny.some((d) => lower.includes(d.trim()))) throw new Error(`blocked path: ${relPath}`);

  // allowlist (adjust to your exact policy)
  const allow =
    norm === "tsconfig.json" ||
    norm === "package.json" ||
    norm.startsWith("client/") ||
    norm.startsWith("server/");
  if (!allow) throw new Error(`not allowlisted: ${relPath}`);
}

function restoreFileSnapshots(repoRoot: string, snapshots: Record<string, string> | FileSnapshot[]) {
  const MAX_FILES = 20;
  const MAX_BYTES_PER_FILE = 200_000;

  // Convert object format to array format
  let snapshotArray: FileSnapshot[];
  if (Array.isArray(snapshots)) {
    snapshotArray = snapshots;
  } else if (typeof snapshots === "object" && snapshots !== null) {
    snapshotArray = Object.entries(snapshots).map(([relPath, contents]) => ({
      relPath,
      contents: typeof contents === "string" ? contents : "",
    }));
  } else {
    return;
  }

  if (snapshotArray.length > MAX_FILES) {
    throw new Error(`too many snapshots: ${snapshotArray.length} > ${MAX_FILES}`);
  }

  for (const s of snapshotArray) {
    if (!s?.relPath || typeof s.contents !== "string") {
      throw new Error(`invalid snapshot entry: ${JSON.stringify(s)?.slice(0, 200)}`);
    }

    assertSafeRelPath(s.relPath);

    const bytes = Buffer.byteLength(s.contents, "utf8");
    if (bytes > MAX_BYTES_PER_FILE) {
      throw new Error(`snapshot too large: ${s.relPath} (${bytes} bytes)`);
    }

    const abs = join(repoRoot, s.relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, s.contents, "utf8");
    console.log(`  ✅ ${s.relPath} (${bytes} bytes)`);
  }
}

function main() {
  console.log("[FixtureRunner] Starting fixture tests...\n");
  
  // Get all fixture files
  let fixtures = readdirSync(join(REPO_ROOT, FIXTURES_DIR))
    .filter(f => f.endsWith(".json"))
    .sort();
  
  // Filter by --only if specified
  if (onlyFilter) {
    const onlySet = new Set(onlyFilter.map(id => `${id}.json`));
    fixtures = fixtures.filter(f => onlySet.has(f));
    console.log(`[FixtureRunner] --only filter: ${onlyFilter.join(", ")}`);
  }
  
  console.log(`[FixtureRunner] Found ${fixtures.length} fixtures\n`);
  
  const results: FixtureResult[] = [];
  
  for (const fixture of fixtures) {
    const fixtureId = fixture.replace(".json", "");
    const fixturePath = join(FIXTURES_DIR, fixture);
    
    console.log(`\n${"=".repeat(80)}`);
    console.log(`[FixtureRunner] Testing: ${fixtureId}`);
    console.log(`${"=".repeat(80)}\n`);
    
    try {
      // Load fixture and restore fileSnapshots
      const fixtureData = JSON.parse(readFileSync(join(REPO_ROOT, fixturePath), "utf-8"));
      const snapshots = fixtureData?.context?.fileSnapshots ?? fixtureData?.fileSnapshots ?? {};
      
      if (Object.keys(snapshots).length > 0) {
        console.log(`[FixtureRunner] Restoring ${Object.keys(snapshots).length} file(s) from fileSnapshots...`);
        restoreFileSnapshots(REPO_ROOT, snapshots);
      }
      
      // Run swarm:fix
      const output = execSync(
        `pnpm swarm:fix --from ${fixturePath} --apply --test`,
        { encoding: "utf-8", cwd: REPO_ROOT }
      );
      
      // Parse output for metrics
      const stopReasonMatch = output.match(/Stop Reason: (\w+)/);
      const costMatch = output.match(/Total Cost: \$?([\d.]+)/);
      const latencyMatch = output.match(/Total Latency: ([\d]+)ms/);
      const testsPassedMatch = output.match(/✅ Passed|❌ Failed/);
      
      const stopReason = stopReasonMatch?.[1] || "unknown";
      const cost = parseFloat(costMatch?.[1] || "0");
      const latency = parseInt(latencyMatch?.[1] || "0");
      const testsPassed = testsPassedMatch?.[0]?.includes("✅") || false;
      const applied = output.includes("✅ Patch applied successfully");
      
      // PASS criteria: stopReason=ok, applied=true, testsPassed=true
      const pass = stopReason === "ok" && applied && testsPassed;
      
      results.push({
        id: fixtureId,
        stopReason,
        applied,
        testsPassed,
        cost,
        latency,
        pass,
      });
      
      console.log(`\n[FixtureRunner] Result: ${pass ? "✅ PASS" : "❌ FAIL"}`);
      console.log(`  stopReason: ${stopReason}`);
      console.log(`  applied: ${applied}`);
      console.log(`  testsPassed: ${testsPassed}`);
      console.log(`  cost: $${cost.toFixed(4)}`);
      console.log(`  latency: ${latency}ms`);
      
    } catch (error: any) {
      console.error(`\n[FixtureRunner] Error testing ${fixtureId}:`, error.message);
      results.push({
        id: fixtureId,
        stopReason: "error",
        applied: false,
        testsPassed: false,
        cost: 0,
        latency: 0,
        pass: false,
      });
    }
    
    // Revert changes
    try {
      console.log(`\n[FixtureRunner] Reverting changes...`);
      execSync("git reset --hard HEAD", { cwd: REPO_ROOT, stdio: "ignore" });
      console.log(`[FixtureRunner] ✅ Reverted`);
    } catch (error: any) {
      console.error(`[FixtureRunner] ⚠️ Failed to revert:`, error.message);
    }
  }
  
  // Print summary
  console.log(`\n\n${"=".repeat(80)}`);
  console.log(`[FixtureRunner] SUMMARY`);
  console.log(`${"=".repeat(80)}\n`);
  
  const passCount = results.filter(r => r.pass).length;
  const failCount = results.length - passCount;
  const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
  const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
  
  console.log(`Total Fixtures: ${results.length}`);
  console.log(`✅ PASS: ${passCount}`);
  console.log(`❌ FAIL: ${failCount}`);
  console.log(`Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`Avg Latency: ${Math.round(avgLatency)}ms\n`);
  
  // Print detailed results table
  console.log("Fixture ID                | Stop Reason | Applied | Tests | Cost    | Latency | Result");
  console.log("-".repeat(95));
  
  for (const r of results) {
    const id = r.id.padEnd(25);
    const stopReason = r.stopReason.padEnd(11);
    const applied = (r.applied ? "✅" : "❌").padEnd(7);
    const tests = (r.testsPassed ? "✅" : "❌").padEnd(5);
    const cost = `$${r.cost.toFixed(4)}`.padEnd(7);
    const latency = `${r.latency}ms`.padEnd(7);
    const result = r.pass ? "✅ PASS" : "❌ FAIL";
    
    console.log(`${id} | ${stopReason} | ${applied} | ${tests} | ${cost} | ${latency} | ${result}`);
  }
  
  console.log();
  
  // Exit with error if any failed
  if (failCount > 0) {
    console.error(`\n[FixtureRunner] ❌ ${failCount} fixture(s) failed`);
    process.exit(1);
  }
  
  console.log(`\n[FixtureRunner] ✅ All fixtures passed!`);
  process.exit(0);
}

main();
