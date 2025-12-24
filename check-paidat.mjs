import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { intakes } from './drizzle/schema.js';
import { like } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const results = await db.select({
  id: intakes.id,
  businessName: intakes.businessName,
  status: intakes.status,
  paidAt: intakes.paidAt
}).from(intakes).where(like(intakes.businessName, '%E2E%'));

console.log(JSON.stringify(results, null, 2));
await connection.end();
