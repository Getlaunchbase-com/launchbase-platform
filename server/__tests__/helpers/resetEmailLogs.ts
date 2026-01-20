import { getDb } from "../../db";
import { emailLogs } from "../../../drizzle/schema";
import { sql } from "drizzle-orm";

/**
 * Reset email logs table for test isolation
 * Prevents cross-test pollution when tests insert email logs
 */
export async function resetEmailLogs() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available for resetEmailLogs");
  }
  
  await db.execute(sql`TRUNCATE TABLE ${emailLogs}`);
}
