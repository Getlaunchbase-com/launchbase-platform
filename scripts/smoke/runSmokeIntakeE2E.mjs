#!/usr/bin/env node
/**
 * End-to-end smoke test for intake → preflight → enqueue flow
 */

import { getDb, createIntake } from '../../server/db.js';
import { shipPackets } from '../../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import { runPreflight } from '../../server/ai/orchestration/runPreflight.js';

const TIERS = [
  { name: 'standard', complete: true },
  { name: 'growth', complete: true },
  { name: 'premium', complete: false }, // Missing OAuth for testing NEEDS_INFO
];

async function testE2EIntake() {
  console.log('=== SMOKE TEST: E2E Intake Flow ===\n');
  
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const results = [];
  
  for (const { name: tier, complete } of TIERS) {
    console.log(`\n📋 Testing ${tier.toUpperCase()} tier (${complete ? 'complete' : 'incomplete'})...`);
    
    try {
      // 1. Create synthetic intake
      const intake = await createIntake({
        businessName: `Test ${tier} Business`,
        contactName: 'Test Contact',
        email: `test-${tier}@example.com`,
        language: 'en',
        audience: 'biz',
        websiteStatus: 'none',
        vertical: 'professional',
        services: ['Web design', 'SEO'],
        serviceArea: ['San Francisco, CA'],
        primaryCTA: 'book',
        rawPayload: {
          businessName: `Test ${tier} Business`,
          location: 'San Francisco, CA',
          services: 'Web design',
          idealCustomer: 'Small businesses',
          primaryGoal: 'more leads',
          cta: 'book',
          // Conditionally add tier-specific fields
          ...(tier === 'growth' || tier === 'premium' ? {
            leadHandling: 'email',
            reviews: 'https://google.com/reviews/test',
          } : {}),
          ...(tier === 'premium' && complete ? {
            currentTools: 'QuickBooks',
            automationPriorities: 'invoicing',
            accessMethod: 'oauth',
            quickbooksConnected: true,
          } : {}),
        },
      });
      
      console.log(`  ✓ Created intake id=${intake.id}`);
      
      // 2. Run preflight
      const preflightResult = await runPreflight({ intake, tier });
      
      console.log(`  ✓ Preflight status: ${preflightResult.validation.status}`);
      
      // 3. Create ShipPacket with preflight data
      const shipPacketId = await db.insert(shipPackets).values({
        intakeId: intake.id,
        runPlanId: 0, // Placeholder for test
        runId: `smoke_${tier}_${Date.now()}`,
        status: 'DRAFT', // Always DRAFT for preflight; status stored in data.preflight.validation.status
        data: {
          preflight: preflightResult,
        },
      });
      
      const [shipPacket] = await db.select().from(shipPackets).where(eq(shipPackets.intakeId, intake.id));
      
      console.log(`  ✓ Created ShipPacket id=${shipPacket.id} status=${shipPacket.status}`);
      
      // 4. Verify expectations
      if (complete) {
        if (preflightResult.validation.status !== 'PASS') {
          throw new Error(`Expected PASS for complete ${tier}, got ${preflightResult.validation.status}`);
        }
        if (preflightResult.repairPacket.questions.length > 0) {
          throw new Error(`Expected 0 questions for complete ${tier}, got ${preflightResult.repairPacket.questions.length}`);
        }
        if (shipPacket.status !== 'DRAFT') {
          throw new Error(`Expected DRAFT status, got ${shipPacket.status}`);
        }
      } else {
        if (preflightResult.validation.status === 'PASS') {
          throw new Error(`Expected NEEDS_INFO for incomplete ${tier}, got PASS`);
        }
        if (preflightResult.repairPacket.questions.length === 0) {
          throw new Error(`Expected questions for incomplete ${tier}, got 0`);
        }
        if (shipPacket.status !== 'DRAFT') {
          throw new Error(`Expected DRAFT status, got ${shipPacket.status}`);
        }
      }
      
      // 5. Verify preflight stored correctly
      const [storedPacket] = await db.select().from(shipPackets).where(eq(shipPackets.id, shipPacket.id));
      
      if (!storedPacket.data || !storedPacket.data.preflight) {
        throw new Error('Preflight data not stored in ShipPacket');
      }
      
      console.log(`  ✓ Preflight data stored correctly`);
      
      results.push({
        tier,
        pass: true,
        intakeId: intake.id,
        shipPacketId: shipPacket.id,
        status: preflightResult.validation.status,
      });
      
      console.log(`  ✅ ${tier.toUpperCase()} tier test PASSED`);
      
    } catch (error) {
      console.log(`  ❌ ${tier.toUpperCase()} tier test FAILED: ${error.message}`);
      results.push({
        tier,
        pass: false,
        error: error.message,
      });
    }
  }
  
  // Print summary table
  console.log(`\n\n=== RESULTS TABLE ===`);
  console.log('┌──────────┬────────┬───────────┬──────────────┬──────────────┐');
  console.log('│ Tier     │ Status │ IntakeID  │ ShipPacketID │ Preflight    │');
  console.log('├──────────┼────────┼───────────┼──────────────┼──────────────┤');
  
  for (const result of results) {
    const status = result.pass ? '✅ PASS' : '❌ FAIL';
    const intakeId = result.intakeId || 'N/A';
    const shipPacketId = result.shipPacketId || 'N/A';
    const preflightStatus = result.status || 'N/A';
    
    console.log(`│ ${result.tier.padEnd(8)} │ ${status.padEnd(6)} │ ${String(intakeId).padEnd(9)} │ ${String(shipPacketId).padEnd(12)} │ ${preflightStatus.padEnd(12)} │`);
  }
  
  console.log('└──────────┴────────┴───────────┴──────────────┴──────────────┘');
  
  const passCount = results.filter(r => r.pass).length;
  const failCount = results.filter(r => !r.pass).length;
  
  console.log(`\n✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  
  if (failCount > 0) {
    process.exit(1);
  }
}

testE2EIntake().catch(err => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
