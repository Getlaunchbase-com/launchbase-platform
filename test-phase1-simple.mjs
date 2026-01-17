// Simple Phase 1 test using existing modules
import { getDb } from "./server/db.js";
import { runFieldGeneral } from "./server/ai/orchestration/runFieldGeneral.js";
import { randomBytes } from "crypto";

const db = await getDb();
if (!db) {
  console.error("Database not available");
  process.exit(1);
}

// Fetch intake #2
const [rows] = await db.select().from((await import("./drizzle/schema.js")).intakes).where((await import("drizzle-orm")).eq((await import("./drizzle/schema.js")).intakes.id, 2)).limit(1);
const intake = rows[0];

if (!intake) {
  console.error("Intake #2 not found!");
  process.exit(1);
}

console.log("[Test] Found intake:", intake.id, intake.businessName, intake.email);

// Generate IDs
const runId = `run_${Date.now()}_${randomBytes(8).toString("hex")}`;
const jobId = `job_${Date.now()}_${randomBytes(8).toString("hex")}`;

console.log("[Test] Calling runFieldGeneral...");
try {
  const runPlan = runFieldGeneral({
    intake,
    runId,
    jobId,
    runMode: "production",
  });
  
  console.log("[Test] ✅ RunPlan generated successfully!");
  console.log("[Test] Tier:", runPlan.tier);
  console.log("[Test] RunMode:", runPlan.runMode);
  console.log("[Test] CreativeMode:", runPlan.creativeMode);
  console.log("[Test] BuilderGate enabled:", runPlan.builderGate.enabled);
  
  process.exit(0);
} catch (error) {
  console.error("[Test] ❌ runFieldGeneral FAILED:", error);
  process.exit(1);
}
