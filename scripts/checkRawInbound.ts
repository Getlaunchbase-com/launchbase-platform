import { getDb } from "../server/db.js";
import { actionRequests } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  
  if (!db) {
    console.error("DB not available");
    process.exit(1);
  }
  
  const ar = await db.select().from(actionRequests).where(eq(actionRequests.id, "2")).limit(1);
  
  if (ar.length === 0) {
    console.log("ActionRequest 2 not found");
    process.exit(1);
  }
  
  console.log("ActionRequest 2 rawInbound:");
  console.log(JSON.stringify(ar[0].rawInbound, null, 2));
}

main();
