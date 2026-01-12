import { getDb } from '../server/db';
import { actionRequests } from '../drizzle/schema';

async function main() {
  const db = await getDb();
  const rows = await db.select().from(actionRequests).limit(5);
  console.log('Total rows:', rows.length);
  if (rows.length > 0) {
    console.log('Sample row:', JSON.stringify(rows[0], null, 2));
  }
}

main().catch(console.error);
