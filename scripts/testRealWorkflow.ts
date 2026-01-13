#!/usr/bin/env tsx
/**
 * Real Workflow Test Script
 * 
 * Triggers AI Tennis copy refinement and verifies DB write.
 * 
 * Usage: pnpm tsx scripts/testRealWorkflow.ts
 */

import { getDb } from "../server/db";
import { intakes, actionRequests } from "../drizzle/schema";
import { aiTennisCopyRefine } from "../server/actionRequests/aiTennisCopyRefine";
import { eq } from "drizzle-orm";

async function main() {
  console.log("[Real Workflow Test] Starting...");
  
  const db = await getDb();
  if (!db) {
    console.error("❌ [Real Workflow Test] Database connection failed");
    process.exit(1);
  }

  // Step 1: Create or find a test intake
  console.log("[Real Workflow Test] Step 1: Finding/creating test intake...");
  
  let testIntake = await db
    .select()
    .from(intakes)
    .where(eq(intakes.tenant, "launchbase"))
    .limit(1)
    .then(rows => rows[0]);

  if (!testIntake) {
    console.log("[Real Workflow Test] No intake found, creating test intake...");
    await db
      .insert(intakes)
      .values({
        tenant: "launchbase",
        businessName: "Test Business",
        contactName: "Test Contact",
        email: "test@example.com",
        vertical: "professional",
        status: "new",
      });
    
    // Fetch the newly created intake
    testIntake = await db
      .select()
      .from(intakes)
      .where(eq(intakes.tenant, "launchbase"))
      .limit(1)
      .then(rows => rows[0]);
  }

  console.log(`[Real Workflow Test] Using intake ID: ${testIntake.id}`);

  // Step 2: Trigger AI Tennis copy refinement
  console.log("[Real Workflow Test] Step 2: Triggering aiTennisCopyRefine...");
  
  const result = await aiTennisCopyRefine(
    {
      tenant: "launchbase",
      intakeId: testIntake.id,
      userText: "Rewrite the homepage hero headline + subheadline to be clearer and more conversion-focused. Keep it confident, not hype. Provide rationale + risks.",
      targetSection: "hero",
      currentCopy: {
        headline: "Stop carrying the system in your head",
        subheadline: "LaunchBase takes ongoing responsibility — so you stop thinking about it.",
      },
      constraints: {
        maxRounds: 2,
        costCapUsd: 1.5,
      },
    },
    "memory" // Use memory provider for testing
  );

  console.log("[Real Workflow Test] AI Tennis result:", {
    actionRequestId: result.actionRequestId,
    stopReason: result.stopReason,
    needsHuman: result.needsHuman,
    costUsd: result.costUsd,
    rounds: result.rounds,
  });

  // Step 3: Verify DB write
  console.log("[Real Workflow Test] Step 3: Verifying DB write...");
  
  const [actionRequest] = await db
    .select()
    .from(actionRequests)
    .where(eq(actionRequests.id, result.actionRequestId))
    .limit(1);

  if (!actionRequest) {
    console.error("❌ [Real Workflow Test] ActionRequest not found in DB");
    process.exit(1);
  }

  console.log("[Real Workflow Test] ActionRequest found:", {
    id: actionRequest.id,
    status: actionRequest.status,
    createdAt: actionRequest.createdAt,
  });

  // Step 4: Verify rawInbound.aiTennis fields
  console.log("[Real Workflow Test] Step 4: Verifying rawInbound.aiTennis fields...");
  
  const rawInbound = actionRequest.rawInbound as any;
  
  if (!rawInbound) {
    console.error("❌ [Real Workflow Test] rawInbound is null");
    process.exit(1);
  }

  if (rawInbound.source !== "ai_tennis") {
    console.error(`❌ [Real Workflow Test] rawInbound.source is "${rawInbound.source}", expected "ai_tennis"`);
    process.exit(1);
  }

  const aiTennis = rawInbound.aiTennis;
  if (!aiTennis) {
    console.error("❌ [Real Workflow Test] rawInbound.aiTennis is missing");
    process.exit(1);
  }

  const requiredFields = [
    "traceId",
    "jobId",
    "rounds",
    "models",
    "requestIds",
    "usage",
    "costUsd",
    "stopReason",
    "needsHuman",
  ];

  const missingFields = requiredFields.filter(field => !(field in aiTennis));
  if (missingFields.length > 0) {
    console.error(`❌ [Real Workflow Test] Missing aiTennis fields: ${missingFields.join(", ")}`);
    process.exit(1);
  }

  console.log("✅ [Real Workflow Test] All required aiTennis fields present:");
  console.log(JSON.stringify(aiTennis, null, 2));

  // Step 5: Verify proposal fields
  console.log("[Real Workflow Test] Step 5: Verifying rawInbound.proposal fields...");
  
  const proposal = rawInbound.proposal;
  if (!proposal) {
    console.error("❌ [Real Workflow Test] rawInbound.proposal is missing");
    process.exit(1);
  }

  const proposalFields = ["rationale", "confidence", "risks", "assumptions"];
  const missingProposalFields = proposalFields.filter(field => !(field in proposal));
  
  if (missingProposalFields.length > 0) {
    console.warn(`⚠️  [Real Workflow Test] Missing proposal fields: ${missingProposalFields.join(", ")}`);
  } else {
    console.log("✅ [Real Workflow Test] All proposal fields present");
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ [Real Workflow Test] SUCCESS");
  console.log("=".repeat(60));
  console.log("\nNext step: Run weekly report script to confirm non-N/A metrics");
  console.log("Command: pnpm tsx scripts/generateWeeklyAiReport.ts");
}

main().catch((err) => {
  console.error("❌ [Real Workflow Test] Failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
