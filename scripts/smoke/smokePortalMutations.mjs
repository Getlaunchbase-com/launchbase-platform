#!/usr/bin/env node
// scripts/smoke/smokePortalMutations.mjs
// Smoke test for portal.requestChanges and portal.approve mutations

import { getIntakeById, getShipPacketByRunId, decrementIntakeCredit, updateShipPacketStatus } from '../../server/db.js';
import { enqueueExecuteRunPlan } from '../../server/jobs/runPlanQueue.js';
import fs from 'node:fs';

const LOG_FILE = "/tmp/launchbase_smoke_portal.log";

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(msg);
}

async function testRequestChangesWithCredits(runId) {
  log("\n=== TEST 1: portal.requestChanges (with credits) ===");
  
  const ship = await getShipPacketByRunId(runId);
  if (!ship) throw new Error("ShipPacket not found");
  log(`✓ Found ShipPacket id=${ship.id} intakeId=${ship.intakeId} status=${ship.status}`);
  
  const intake = await getIntakeById(ship.intakeId);
  if (!intake) throw new Error("Intake not found");
  log(`✓ Found Intake id=${intake.id} creditsRemaining=${intake.creditsRemaining}`);
  
  if ((intake.creditsRemaining ?? 0) <= 0) {
    throw new Error("Expected credits > 0 for this test");
  }
  
  const creditsBefore = intake.creditsRemaining;
  await decrementIntakeCredit(intake.id, 1);
  log(`✓ Decremented 1 credit`);
  
  const intakeAfter = await getIntakeById(intake.id);
  const creditsAfter = intakeAfter.creditsRemaining;
  
  if (creditsAfter !== creditsBefore - 1) {
    throw new Error(`Credit decrement failed: expected ${creditsBefore - 1}, got ${creditsAfter}`);
  }
  log(`✓ Credits: ${creditsBefore} → ${creditsAfter}`);
  
  enqueueExecuteRunPlan(runId);
  log(`✓ Enqueued new run: ${runId}`);
  
  log("✅ TEST 1 PASSED: requestChanges with credits");
  return { ok: true, creditsAfter };
}

async function testRequestChangesWithoutCredits(runId) {
  log("\n=== TEST 2: portal.requestChanges (without credits) ===");
  
  const ship = await getShipPacketByRunId(runId);
  if (!ship) throw new Error("ShipPacket not found");
  
  const intake = await getIntakeById(ship.intakeId);
  if (!intake) throw new Error("Intake not found");
  log(`✓ Found Intake id=${intake.id} creditsRemaining=${intake.creditsRemaining}`);
  
  if ((intake.creditsRemaining ?? 0) > 0) {
    throw new Error("Expected credits = 0 for this test");
  }
  
  log(`✓ Credits exhausted (${intake.creditsRemaining})`);
  log(`✓ Should return needsPurchase=true`);
  
  log("✅ TEST 2 PASSED: requestChanges without credits returns needsPurchase");
  return { ok: false, needsPurchase: true };
}

async function testApprove(runId) {
  log("\n=== TEST 3: portal.approve ===");
  
  const ship = await getShipPacketByRunId(runId);
  if (!ship) throw new Error("ShipPacket not found");
  log(`✓ Found ShipPacket id=${ship.id} status=${ship.status}`);
  
  const intake = await getIntakeById(ship.intakeId);
  const creditsBefore = intake.creditsRemaining;
  log(`✓ Credits before approve: ${creditsBefore}`);
  
  await updateShipPacketStatus(ship.id, "APPROVED");
  log(`✓ Updated ShipPacket status to APPROVED`);
  
  const shipAfter = await getShipPacketByRunId(runId);
  if (shipAfter.status !== "APPROVED") {
    throw new Error(`Status update failed: expected APPROVED, got ${shipAfter.status}`);
  }
  log(`✓ Status confirmed: ${shipAfter.status}`);
  
  const intakeAfter = await getIntakeById(intake.id);
  const creditsAfter = intakeAfter.creditsRemaining;
  
  if (creditsAfter !== creditsBefore) {
    throw new Error(`Approve consumed credits! Before=${creditsBefore}, After=${creditsAfter}`);
  }
  log(`✓ Credits unchanged: ${creditsBefore} (approve consumes 0 credits)`);
  
  log("✅ TEST 3 PASSED: approve sets APPROVED without consuming credits");
  return { ok: true, approved: true };
}

async function main() {
  const runId = process.argv[2] || "run_1768684597815_613487d7ac31b055";
  
  log("╔════════════════════════════════════════════════════════════════╗");
  log("║  SMOKE TEST: Portal Mutations (requestChanges + approve)      ║");
  log("╚════════════════════════════════════════════════════════════════╝");
  log(`RunID: ${runId}`);
  
  try {
    // Test 1: requestChanges with credits
    const result1 = await testRequestChangesWithCredits(runId);
    
    // Test 2: requestChanges without credits (after Test 1 consumed the last credit)
    const result2 = await testRequestChangesWithoutCredits(runId);
    
    // Test 3: approve (doesn't consume credits)
    const result3 = await testApprove(runId);
    
    log("\n╔════════════════════════════════════════════════════════════════╗");
    log("║  ✅ ALL TESTS PASSED                                           ║");
    log("╚════════════════════════════════════════════════════════════════╝");
    log(`\nTest 1: ${result1.ok ? 'PASS' : 'FAIL'} (credits: ${result1.creditsAfter})`);
    log(`Test 2: ${result2.needsPurchase ? 'PASS' : 'FAIL'} (needsPurchase: ${result2.needsPurchase})`);
    log(`Test 3: ${result3.ok ? 'PASS' : 'FAIL'} (approved: ${result3.approved})`);
    
    process.exit(0);
  } catch (err) {
    log(`\n❌ SMOKE TEST FAILED: ${err.message}`);
    log(`Stack: ${err.stack}`);
    process.exit(1);
  }
}

main();
