import { getDb } from '../server/db.ts';
import { intakes } from '../drizzle/schema.ts';
import { desc } from 'drizzle-orm';

const db = await getDb();
if (!db) {
  console.log("Database not available");
  process.exit(1);
}

// Query all intakes
const results = await db
  .select()
  .from(intakes)
  .orderBy(desc(intakes.createdAt))
  .limit(20);

console.log(`Found ${results.length} intakes:\n`);
results.forEach((r, i) => {
  console.log(`${i + 1}. ${r.businessName} (ID: ${r.id})`);
  console.log(`   Email: ${r.email}`);
  console.log(`   Status: ${r.status}`);
  console.log(`   Tenant: ${r.tenant}`);
  console.log(`   Created: ${r.createdAt}`);
  console.log('');
});

process.exit(0);
