#!/usr/bin/env tsx
/**
 * hardenSwarm - Swarm Self-Hardening Mode
 * 
 * Runs the auto-repair system against its own pipeline using a curated fixture set.
 * The swarm is allowed to modify only:
 * - contracts (FailurePacket, RepairPacket, ScoreCard schemas)
 * - prompts (Field General, Coder, Reviewer, Arbiter)
 * - preflight validation logic
 * - fixture builder
 * 
 * Must produce:
 * - patch diff (unified format)
 * - testCommands (exact commands)
 * - "why" explanation
 * 
 * Must pass:
 * - pnpm test (or subset)
 * - pnpm smoke:preflight (if exists)
 * - pnpm smoke:e2e:intake (if exists)
 * 
 * Usage:
 *   pnpm swarm:harden [--fixture <path>] [--all]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

/**
 * Get all fixture files in the fixtures directory
 */
function getFixtures(): string[] {
  const fixturesDir = "runs/fixtures/failurePackets/v1";
  if (!existsSync(fixturesDir)) {
    return [];
  }
  
  return readdirSync(fixturesDir)
    .filter(f => f.endsWith(".json"))
    .map(f => resolve(fixturesDir, f));
}

/**
 * Run swarm:fix on a fixture
 */
function runSwarmFix(fixturePath: string): {
  success: boolean;
  output: string;
  repairDir: string | null;
} {
  console.log(`\n🔧 Running swarm:fix on: ${fixturePath}`);
  
  try {
    const output = execSync(
      `pnpm swarm:fix --from ${fixturePath} --apply --test`,
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: "pipe",
      }
    );
    
    // Extract repair directory from output
    const match = output.match(/runs\/repair\/repair_\d+/);
    const repairDir = match ? match[0] : null;
    
    return {
      success: true,
      output,
      repairDir,
    };
  } catch (error: any) {
    const output = error.stdout?.toString() || error.stderr?.toString() || error.message;
    
    // Extract repair directory even on failure
    const match = output.match(/runs\/repair\/repair_\d+/);
    const repairDir = match ? match[0] : null;
    
    return {
      success: false,
      output,
      repairDir,
    };
  }
}

/**
 * Validate that patch only modifies allowed files
 */
function validatePatchScope(patchContent: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Extract file paths from unified diff
  const fileMatches = patchContent.matchAll(/^diff --git a\/(.*?) b\/(.*?)$/gm);
  const modifiedFiles = Array.from(fileMatches).map(m => m[1]);
  
  const allowedPatterns = [
    /^server\/contracts\//,
    /^server\/ai\/prompts\//,
    /^server\/contracts\/preflightValidation\.ts$/,
    /^scripts\/fixtures\/makeFailurePacket\.ts$/,
    /^scripts\/swarm\/runSwarmFix\.ts$/,
  ];
  
  for (const file of modifiedFiles) {
    const isAllowed = allowedPatterns.some(pattern => pattern.test(file));
    if (!isAllowed) {
      errors.push(`Patch modifies forbidden file: ${file}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Run smoke tests to validate the patch
 */
function runSmokeTests(): {
  success: boolean;
  output: string;
} {
  console.log(`\n🧪 Running smoke tests...`);
  
  const tests = [
    "pnpm test",
    // "pnpm smoke:preflight", // Optional: if exists
    // "pnpm smoke:e2e:intake", // Optional: if exists
  ];
  
  for (const test of tests) {
    try {
      console.log(`   Running: ${test}`);
      const output = execSync(test, {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: "pipe",
      });
      console.log(`   ✅ ${test} passed`);
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || error.message;
      console.error(`   ❌ ${test} failed`);
      return {
        success: false,
        output,
      };
    }
  }
  
  return {
    success: true,
    output: "All smoke tests passed",
  };
}

async function main() {
  console.log(`🔨 Swarm Self-Hardening Mode`);
  console.log(`============================\n`);
  
  const fixturePath = arg("--fixture");
  const runAll = flag("--all");
  
  let fixtures: string[] = [];
  
  if (fixturePath) {
    // Run on single fixture
    fixtures = [fixturePath];
  } else if (runAll) {
    // Run on all fixtures
    fixtures = getFixtures();
  } else {
    // Run on curated set (first 3 fixtures)
    const allFixtures = getFixtures();
    fixtures = allFixtures.slice(0, 3);
  }
  
  if (fixtures.length === 0) {
    console.error("❌ No fixtures found. Create fixtures with: pnpm fixture:make");
    process.exit(1);
  }
  
  console.log(`📦 Running on ${fixtures.length} fixture(s):\n`);
  for (const fixture of fixtures) {
    console.log(`   - ${fixture}`);
  }
  
  const results: Array<{
    fixture: string;
    success: boolean;
    repairDir: string | null;
    errors: string[];
  }> = [];
  
  // Run swarm:fix on each fixture
  for (const fixture of fixtures) {
    const result = runSwarmFix(fixture);
    
    const errors: string[] = [];
    
    if (!result.success) {
      errors.push("Swarm execution failed");
    }
    
    // Validate patch scope if repair directory exists
    if (result.repairDir && existsSync(`${result.repairDir}/patch.diff`)) {
      const patchContent = readFileSync(`${result.repairDir}/patch.diff`, "utf8");
      const validation = validatePatchScope(patchContent);
      
      if (!validation.valid) {
        errors.push(...validation.errors);
      }
    }
    
    results.push({
      fixture,
      success: result.success && errors.length === 0,
      repairDir: result.repairDir,
      errors,
    });
  }
  
  // Print results
  console.log(`\n\n📊 Hardening Results:`);
  console.log(`=====================\n`);
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;
  
  for (const result of results) {
    const status = result.success ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${result.fixture}`);
    
    if (result.repairDir) {
      console.log(`   Repair: ${result.repairDir}`);
    }
    
    if (result.errors.length > 0) {
      console.log(`   Errors:`);
      for (const error of result.errors) {
        console.log(`     - ${error}`);
      }
    }
    console.log();
  }
  
  console.log(`\n📈 Summary: ${successCount}/${results.length} passed, ${failCount} failed\n`);
  
  // Run smoke tests if all fixtures passed
  if (failCount === 0) {
    const smokeResult = runSmokeTests();
    
    if (!smokeResult.success) {
      console.error(`\n❌ Smoke tests failed. Hardening incomplete.`);
      process.exit(1);
    }
    
    console.log(`\n✅ All hardening tests passed! System is hardened.`);
  } else {
    console.error(`\n❌ Some fixtures failed. Review repair artifacts and try again.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
