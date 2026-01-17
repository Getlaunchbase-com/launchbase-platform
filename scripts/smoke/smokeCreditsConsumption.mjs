#!/usr/bin/env node
// scripts/smoke/smokeCreditsConsumption.mjs
// Smoke test for credit consumption and monetization gate

import { getDb } from '../../server/db.js';
import { intakes, runPlans, shipPackets } from '../../drizzle/schema.js';
import { getDefaultIntakeCredits } from '../../server/db-helpers.js';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';

const LOG_FILE = "/tmp/launchbase_smoke_consumption.log";

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(msg);
}

async function testCreditConsumption() {
  log("\n╔════════════════════════════════════════════════════════════════╗");
  log("║  SMOKE TEST: Credit Consumption & Monetization Gate           ║");
  log("╚════════════════════════════════════════════════════════════════╝");
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Create Premium intake (10 credits)
  log("\n=== SETUP: Create Premium intake (10 credits) ===");
  const credits = getDefaultIntakeCredits("premium");
  const result = await db.insert(intakes).values({
    businessName: "Smoke Test Premium Consumption",
    contactName: "Test User",
    email: `smoke-consumption-${Date.now()}@test.com`,
    vertical: "trades",
    tenant: "launchbase",
    ...credits,
  });
  
  const intakeId = result[0]?.insertId;
  if (!intakeId) throw new Error("Insert failed: missing insertId");
  log(`✓ Created intake id=${intakeId} with 10/10/0 credits`);
  
  // Create mock RunPlan + ShipPacket for testing portal mutations
  const runId = `run_test_${Date.now()}`;
  await db.insert(runPlans).values({
    intakeId,
    runId,
    tier: "premium",
    lane: "creative_production",
    status: "PENDING",
  });
  log(`✓ Created RunPlan runId=${runId}`);
  
  await db.insert(shipPackets).values({
    intakeId,
    runId,
    status: "READY_FOR_REVIEW",
    systemsChanges: JSON.stringify([]),
    brandChanges: JSON.stringify([]),
    criticAnalysis: JSON.stringify({ issues: [], fixes: [], pass: true }),
  });
  log(`✓ Created ShipPacket for runId=${runId}`);
  
  // Test: Call requestChanges 10 times (should consume all credits)
  log("\n=== TEST 1: Consume 10 credits via requestChanges ===");
  const { portalRouter } = await import('../../server/routers/portal.js');
  
  for (let i = 1; i <= 10; i++) {
    log(`\n--- Loop ${i}/10 ---`);
    
    // Mock context for protectedProcedure
    const mockCtx = { user: { id: 1, email: "test@test.com" } };
    const caller = portalRouter.createCaller(mockCtx);
    
    const response = await caller.requestChanges({ runId });
    
    if (!response.ok) {
      throw new Error(`Loop ${i} failed: ${JSON.stringify(response)}`);
    }
    
    // Read back credits
    const [intake] = await db.select().from(intakes).where(eq(intakes.id, intakeId)).limit(1);
    if (!intake) throw new Error("Intake not found");
    
    const expectedRemaining = 10 - i;
    const expectedConsumed = i;
    
    if (intake.creditsRemaining !== expectedRemaining || intake.creditsConsumed !== expectedConsumed) {
      throw new Error(
        `Credits mismatch after loop ${i}: expected ${expectedRemaining}/${expectedConsumed}, got ${intake.creditsRemaining}/${intake.creditsConsumed}`
      );
    }
    
    log(`✓ Credits: ${intake.creditsRemaining} remaining, ${intake.creditsConsumed} consumed`);
  }
  
  log("\n✅ All 10 credits consumed successfully");
  
  // Test: 11th request should return needsPurchase
  log("\n=== TEST 2: 11th request should return needsPurchase ===");
  const mockCtx = { user: { id: 1, email: "test@test.com" } };
  const caller = portalRouter.createCaller(mockCtx);
  
  const response = await caller.requestChanges({ runId });
  
  if (response.ok) {
    throw new Error("11th request should have failed with needsPurchase=true");
  }
  
  if (!response.needsPurchase) {
    throw new Error(`Expected needsPurchase=true, got ${JSON.stringify(response)}`);
  }
  
  log(`✓ 11th request correctly returned needsPurchase=true`);
  
  // Test: approve should still work at 0 credits
  log("\n=== TEST 3: approve should work at 0 credits ===");
  const approveResponse = await caller.approve({ runId });
  
  if (!approveResponse.ok) {
    throw new Error(`approve failed: ${JSON.stringify(approveResponse)}`);
  }
  
  log(`✓ approve worked at 0 credits (consumes 0 credits)`);
  
  log("\n╔════════════════════════════════════════════════════════════════╗");
  log("║  ✅ ALL CONSUMPTION TESTS PASSED                               ║");
  log("╚════════════════════════════════════════════════════════════════╝");
  
  process.exit(0);
}

testCreditConsumption().catch(err => {
  log(`\n❌ SMOKE TEST CRASHED: ${err.message}`);
  log(`Stack: ${err.stack}`);
  process.exit(1);
});
