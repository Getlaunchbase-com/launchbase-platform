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

import { execSync } from 'node:child_process';
import mysql from 'mysql2/promise';
import { writeFailurePacket } from '../utils/failurePacket.mjs';
import { getDb } from '../../server/db.ts';
import { intakes } from '../../drizzle/schema.ts';
import { desc, eq } from 'drizzle-orm';

const TEST_EMAIL = `smoke-test-${Date.now()}@example.com`;

async function main() {
  console.log('🧪 Smoke Test: Apply Intake Flow\n');

  // Schema guard: ensure tier and enginesSelected are present
  for (const col of ['tier', 'enginesSelected']) {
    if (!(col in intakes)) {
      throw new Error(`Smoke test schema mismatch: intakes.${col} not in imported schema`);
    }
  }
  console.log('✅ Schema guard passed: tier and enginesSelected present in intakes');

  // Enforce DB schema: create columns if missing (don't trust migration messages)
  console.log('Enforcing database schema...');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Missing DATABASE_URL');

  const conn = await mysql.createConnection(url);

  try {
    // Create tier column if missing
    await conn.execute(`
      ALTER TABLE intakes
      ADD COLUMN IF NOT EXISTS tier ENUM('standard','growth','premium') NULL
    `);

    // Create enginesSelected column if missing
    await conn.execute(`
      ALTER TABLE intakes
      ADD COLUMN IF NOT EXISTS enginesSelected JSON NULL
    `);

    // Hard verify columns exist
    const [rows] = await conn.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'intakes'
        AND COLUMN_NAME IN ('tier','enginesSelected')
    `);

    const cols = new Set(rows.map(r => r.COLUMN_NAME));
    if (!cols.has('tier') || !cols.has('enginesSelected')) {
      throw new Error(
        `Schema verify failed after ALTER: have=[${[...cols].join(',')}]`
      );
    }

    console.log('✅ DB schema ensured: tier + enginesSelected exist\n');
  } finally {
    await conn.end();
  }

  const db = await getDb();

  try {
    // Step 1: Insert test intake
    console.log('Step 1: Inserting test intake...');
    
    try {
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
        
        // 🔧 Explicit values to avoid DB default issues in CI
        language: 'en',
        tenant: 'launchbase',
        services: [],
        serviceArea: '',
        primaryCTA: '',
        bookingLink: '',
        tagline: '',
        brandColors: [],
        rawPayload: {},
        status: 'new',
      });
    } catch (insertError) {
      console.error('\n=== INSERT FAILED: RAW ERROR ===');
      console.error(insertError);
      console.error('\n=== INSERT FAILED: e.message ===');
      console.error(insertError?.message);
      console.error('\n=== INSERT FAILED: mysql fields ===');
      console.error({
        code: insertError?.code,
        errno: insertError?.errno,
        sqlState: insertError?.sqlState,
        sqlMessage: insertError?.sqlMessage,
        causeMessage: insertError?.cause?.message,
        causeSqlMessage: insertError?.cause?.sqlMessage,
      });
      throw insertError;
    }

    console.log(`✅ Inserted test intake for ${TEST_EMAIL}`);

    // Step 2: Verify database persistence
    console.log('\nStep 2: Verifying database persistence...');
    const [retrieved] = await db
      .select({
        id: intakes.id,
        email: intakes.email,
        tier: intakes.tier,
        enginesSelected: intakes.enginesSelected,
        createdAt: intakes.createdAt,
      })
      .from(intakes)
      .where(eq(intakes.email, TEST_EMAIL))
      .orderBy(desc(intakes.createdAt))
      .limit(1);

    if (!retrieved) {
      throw new Error('Failed to retrieve test intake');
    }

    console.log('DB row readback:', JSON.stringify(retrieved, null, 2));

    // Verify tier
    if (retrieved.tier == null) {
      throw new Error(`tier missing/null in DB row (tier=${retrieved.tier})`);
    }
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

main().catch((err) => {
  const errorMessage =
    err?.cause?.sqlMessage ||
    err?.sqlMessage ||
    err?.message ||
    String(err);

  const fp = writeFailurePacket({
    system: "smoke:intake",
    summary: "smoke:intake failed",
    command: "pnpm smoke:intake",
    errorMessage,
    extra: {
      node: process.version,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    },
  });

  console.error("============================================================");
  console.error("❌ SMOKE TEST FAILED");
  console.error("============================================================");
  console.error(errorMessage);
  console.error("🧾 FailurePacket:", fp);

  // Plan-only (cannot apply patches). Generates RepairPacket + scorecard artifacts.
  try {
    execSync(`pnpm swarm:fix --from ${fp} --mode plan-only`, {
      stdio: "inherit",
      env: process.env,
    });
  } catch (swarmErr) {
    console.error("⚠️ swarm:fix failed (plan-only):", swarmErr?.message || swarmErr);
  }

  process.exit(1);
});
