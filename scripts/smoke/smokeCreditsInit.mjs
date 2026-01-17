#!/usr/bin/env node
// scripts/smoke/smokeCreditsInit.mjs
// Smoke test for credits initialization bug fix

import { getDb } from '../../server/db.js';
import { intakes } from '../../drizzle/schema.js';
import { getDefaultIntakeCredits } from '../../server/db-helpers.js';
import fs from 'node:fs';

const LOG_FILE = "/tmp/launchbase_smoke_credits.log";

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(msg);
}

async function testCreditsInitialization() {
  log("\n╔════════════════════════════════════════════════════════════════╗");
  log("║  SMOKE TEST: Credits Initialization Fix                       ║");
  log("╚════════════════════════════════════════════════════════════════╝");
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const testCases = [
    { tier: "standard", expected: { included: 1, remaining: 1, consumed: 0 } },
    { tier: "growth", expected: { included: 3, remaining: 3, consumed: 0 } },
    { tier: "premium", expected: { included: 10, remaining: 10, consumed: 0 } },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    log(`\n=== TEST: ${testCase.tier.toUpperCase()} tier ===`);
    
    try {
      // Get credits for tier
      const credits = getDefaultIntakeCredits(testCase.tier);
      log(`✓ Helper returned: ${JSON.stringify(credits)}`);
      
      // Verify helper output
      if (
        credits.creditsIncluded !== testCase.expected.included ||
        credits.creditsRemaining !== testCase.expected.remaining ||
        credits.creditsConsumed !== testCase.expected.consumed
      ) {
        throw new Error(`Helper mismatch: expected ${JSON.stringify(testCase.expected)}, got ${JSON.stringify(credits)}`);
      }
      
      // Insert test intake
      const result = await db.insert(intakes).values({
        businessName: `Smoke Test ${testCase.tier}`,
        contactName: "Test User",
        email: `smoke-credits-${testCase.tier}-${Date.now()}@test.com`,
        vertical: "trades",
        tenant: "launchbase",
        ...credits, // Apply helper credits
      });
      
      const insertId = result[0]?.insertId;
      if (!insertId) throw new Error("Insert failed: missing insertId");
      log(`✓ Inserted intake id=${insertId}`);
      
      // Read back from DB
      const [intake] = await db.select().from(intakes).where(eq(intakes.id, insertId)).limit(1);
      if (!intake) throw new Error("Insert succeeded but row not found");
      
      // Verify DB values
      if (
        intake.creditsIncluded !== testCase.expected.included ||
        intake.creditsRemaining !== testCase.expected.remaining ||
        intake.creditsConsumed !== testCase.expected.consumed
      ) {
        throw new Error(
          `DB mismatch: expected ${JSON.stringify(testCase.expected)}, got {included:${intake.creditsIncluded}, remaining:${intake.creditsRemaining}, consumed:${intake.creditsConsumed}}`
        );
      }
      
      log(`✓ DB verified: ${intake.creditsIncluded}/${intake.creditsRemaining}/${intake.creditsConsumed}`);
      log(`✅ ${testCase.tier.toUpperCase()} tier PASSED`);
      passed++;
      
    } catch (err) {
      log(`❌ ${testCase.tier.toUpperCase()} tier FAILED: ${err.message}`);
      failed++;
    }
  }
  
  log("\n╔════════════════════════════════════════════════════════════════╗");
  if (failed === 0) {
    log("║  ✅ ALL TESTS PASSED                                           ║");
  } else {
    log(`║  ❌ TESTS FAILED: ${failed}/${testCases.length}                                     ║`);
  }
  log("╚════════════════════════════════════════════════════════════════╝");
  log(`\nResults: ${passed} passed, ${failed} failed`);
  
  process.exit(failed > 0 ? 1 : 0);
}

// Add missing import for eq
import { eq } from 'drizzle-orm';

testCreditsInitialization().catch(err => {
  log(`\n❌ SMOKE TEST CRASHED: ${err.message}`);
  log(`Stack: ${err.stack}`);
  process.exit(1);
});
