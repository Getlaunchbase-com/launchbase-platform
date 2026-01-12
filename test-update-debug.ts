import { getDb } from "./server/db";
import { idempotencyKeys } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function test() {
  const db = await getDb();
  if (!db) throw new Error("No DB");
  
  // Insert a test row
  await db.insert(idempotencyKeys).values({
    tenant: "test",
    scope: "debug",
    keyHash: "test123",
    status: "started",
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
  });
  
  // Update it and see what we get back
  const result = await db
    .update(idempotencyKeys)
    .set({ status: "succeeded" })
    .where(eq(idempotencyKeys.keyHash, "test123"));
  
  console.log("Update result type:", typeof result);
  console.log("Update result:", JSON.stringify(result, null, 2));
  console.log("Keys:", Object.keys(result || {}));
  console.log("Is array?", Array.isArray(result));
  
  // Cleanup
  await db.delete(idempotencyKeys).where(eq(idempotencyKeys.keyHash, "test123"));
}

test().catch(console.error);
