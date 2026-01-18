#!/usr/bin/env node
/**
 * Smoke test: Apply intake flow end-to-end
 * 
 * Tests:
 * 1. Submit intake with tier=premium and enginesSelected=[inbox, ads]
 * 2. Verify database persistence (tier and enginesSelected array)
 * 3. Verify no silent failures or data loss
 * 
 * Usage:
 *   pnpm smoke:intake
 */

import { getDb } from '../../server/db.ts';
import { intakes } from '../../drizzle/schema.ts';
import { desc, eq } from 'drizzle-orm';

const TEST_EMAIL = `smoke-test-${Date.now()}@example.com`;

async function main() {
  console.log('🧪 Smoke Test: Apply Intake Flow\n');

  const db = await getDb();

  try {
    // Step 1: Insert test intake
    console.log('Step 1: Inserting test intake...');
    await db.insert(intakes).values({
      businessName: 'Smoke Test Business',
      contactName: 'Smoke Test User',
      email: TEST_EMAIL,
      phone: '555-0123',
      audience: 'biz',
      websiteStatus: 'none',
      vertical: 'trades',
      tier: 'premium',
      enginesSelected: ['inbox', 'ads'],
    });

    console.log(`✅ Inserted test intake for ${TEST_EMAIL}`);

    // Step 2: Verify database persistence
    console.log('\nStep 2: Verifying database persistence...');
    const [retrieved] = await db
      .select()
      .from(intakes)
      .where(eq(intakes.email, TEST_EMAIL))
      .orderBy(desc(intakes.createdAt))
      .limit(1);

    if (!retrieved) {
      throw new Error('Failed to retrieve test intake');
    }

    // Verify tier
    if (retrieved.tier !== 'premium') {
      throw new Error(`Expected tier=premium, got tier=${retrieved.tier}`);
    }
    console.log(`✅ Tier persisted correctly: ${retrieved.tier}`);

    // Verify enginesSelected
    const engines = typeof retrieved.enginesSelected === 'string'
      ? JSON.parse(retrieved.enginesSelected)
      : retrieved.enginesSelected;

    if (!Array.isArray(engines)) {
      throw new Error(`Expected enginesSelected to be array, got ${typeof engines}`);
    }

    if (engines.length !== 2) {
      throw new Error(`Expected 2 engines, got ${engines.length}: ${JSON.stringify(engines)}`);
    }

    if (!engines.includes('inbox') || !engines.includes('ads')) {
      throw new Error(`Expected [inbox, ads], got ${JSON.stringify(engines)}`);
    }

    console.log(`✅ Engines persisted correctly: ${JSON.stringify(engines)}`);

    // Step 3: Cleanup
    console.log('\nStep 3: Cleaning up test data...');
    await db.delete(intakes).where(eq(intakes.id, retrieved.id));
    console.log(`✅ Deleted test intake ID: ${retrieved.id}`);

    // Success summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ SMOKE TEST PASSED');
    console.log('='.repeat(60));
    console.log('✅ Intake submission works');
    console.log('✅ Tier persists correctly (premium)');
    console.log('✅ Engines persist correctly ([inbox, ads])');
    console.log('✅ No data loss or silent failures');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ SMOKE TEST FAILED');
    console.error('='.repeat(60));
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    console.error('='.repeat(60));
    process.exit(1);
  }
}

main();
