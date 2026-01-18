// test-phase1.mjs - Manually trigger Phase 1 for intakeId=1
import { getDb } from "./server/db.ts";
import { intakes } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";
import { runFieldGeneral } from "./server/ai/orchestration/runFieldGeneral.ts";
import { createRunPlan, createShipPacket } from "./server/db.ts";
import { randomBytes } from "crypto";
import { enqueueExecuteRunPlan } from "./server/jobs/runPlanQueue.ts";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Fetch intake #1
  const [intake] = await db.select().from(intakes).where(eq(intakes.id, 1));
  if (!intake) throw new Error("Intake #1 not found");

  console.log("[Test] Found intake:", {
    id: intake.id,
    businessName: intake.businessName,
    email: intake.email,
  });

  // Generate unique IDs
  const runId = `run_${Date.now()}_${randomBytes(8).toString("hex")}`;
  const jobId = `job_${Date.now()}_${randomBytes(8).toString("hex")}`;

  console.log("[Test] Generating RunPlan...");

  // Run Field General
  const runPlan = runFieldGeneral({
    intake,
    runId,
    jobId,
    runMode: "production",
  });

  console.log("[Test] RunPlan generated:", {
    tier: runPlan.tier,
    loops: runPlan.loopsRequested,
    builderEnabled: runPlan.builderGate.enabled,
  });

  // Store RunPlan
  const storedRunPlan = await createRunPlan({
    intakeId: intake.id,
    tenant: intake.tenant,
    customerEmail: intake.email,
    runId,
    jobId,
    tier: runPlan.tier,
    runMode: runPlan.runMode,
    creativeModeEnabled: runPlan.creativeMode.enabled,
    data: runPlan,
  });

  if (!storedRunPlan) throw new Error("Failed to create RunPlan");
  console.log("[Test] RunPlan stored with ID:", storedRunPlan.id);

  // Create ShipPacket
  const shipPacket = await createShipPacket({
    intakeId: intake.id,
    runPlanId: storedRunPlan.id,
    runId,
    status: "DRAFT",
    data: {
      version: "shippacket.v1",
      intakeId: intake.id,
      runPlanId: storedRunPlan.id,
      runId,
      tier: runPlan.tier,
      proposal: {
        systems: null,
        brand: null,
        critic: null,
      },
      preview: {
        screenshots: [],
      },
      execution: {
        buildPlanId: null,
        builderSnapshotId: null,
      },
      createdAtIso: new Date().toISOString(),
    },
  });

  if (!shipPacket) throw new Error("Failed to create ShipPacket");
  console.log("[Test] ShipPacket created with ID:", shipPacket.id);

  // Enqueue execution
  enqueueExecuteRunPlan(runId);
  console.log("[Test] Enqueued execution for runId:", runId);

  console.log("\n✅ Phase 1 complete! Check DB for records.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Test] Error:", err);
  process.exit(1);
});
