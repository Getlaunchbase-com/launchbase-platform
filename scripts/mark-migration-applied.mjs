#!/usr/bin/env node
/**
 * Mark migration 0007 as applied in local DB (since columns already exist from db:push)
 */

import { getDb } from '../server/db.ts';

async function main() {
  const db = await getDb();
  
  // Check if migrations table exists
  const [tables] = await db.execute("SHOW TABLES LIKE '__drizzle_migrations'");
  
  if (!Array.isArray(tables) || tables.length === 0) {
    console.log('❌ No __drizzle_migrations table found. Run drizzle-kit migrate first.');
    process.exit(1);
  }
  
  // Insert migration record
  const migrationHash = '0007_add_tier_engines_to_intakes';
  const createdAt = Date.now();
  
  await db.execute(
    `INSERT IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`,
    [migrationHash, createdAt]
  );
  
  console.log(`✅ Marked migration ${migrationHash} as applied`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
