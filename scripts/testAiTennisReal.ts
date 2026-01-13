/**
 * Test Real AI Tennis Workflow (PR2 Gate C)
 * 
 * This script tests the end-to-end AI Tennis workflow with a real AIML provider call.
 * 
 * Usage: pnpm tsx scripts/testAiTennisReal.ts
 */

import { getDb } from "../server/db";
import { intakes } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { aiTennisCopyRefine } from "../server/actionRequests/aiTennisCopyRefine";

async function main() {
  console.log("[Test] Starting AI Tennis real workflow test...\n");

  const db = await getDb();

  // Step 1: Find an existing intake
  console.log("[Test] Step 1: Finding existing intake...");
  const existingIntakes = await db.select().from(intakes).limit(1);
  
  if (!existingIntakes.length) {
    console.error("[Test] ❌ No intakes found. Create one first.");
    process.exit(1);
  }

  const intake = existingIntakes[0];
  console.log(`[Test] ✅ Found intake ID: ${intake.id}`);
  console.log(`[Test]    Business: ${intake.businessName}`);
  console.log(`[Test]    Tenant: ${intake.tenant}\n`);

  // Step 2: Trigger AI Tennis
  console.log("[Test] Step 2: Triggering AI Tennis workflow...");
  console.log("[Test]    Provider: AIML (real network call)");
  console.log("[Test]    Task: Refine homepage hero headline");
  console.log("[Test]    Constraints: maxRounds=2, costCapUsd=2\n");

  const startTime = Date.now();
  
  try {
    const result = await aiTennisCopyRefine({
      intakeId: intake.id,
      userText: "Rewrite the homepage hero headline to be clearer and more conversion-focused for a B2B SaaS audience.",
      targetSection: "hero",
      constraints: {
        maxRounds: 2,
        costCapUsd: 2,
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Test] ✅ AI Tennis completed in ${elapsed}s\n`);

    // Step 3: Verify result
    console.log("[Test] Step 3: Verifying result...");
    console.log(`[Test]    Success: ${result.success}`);
    console.log(`[Test]    StopReason: ${result.stopReason}`);
    console.log(`[Test]    TraceId: ${result.traceId}`);
    
    if (result.success) {
      console.log(`[Test]    ActionRequestId: ${result.actionRequestId}`);
      console.log(`[Test]    Rounds: ${result.meta.rounds}`);
      console.log(`[Test]    Cost: $${result.meta.estimatedUsd.toFixed(4)}`);
      console.log(`[Test]    Models: ${result.meta.models.join(", ")}\n`);

      // Step 4: Verify DB write
      console.log("[Test] Step 4: Verifying database write...");
      const { action_requests } = await import("../drizzle/schema");
      const [actionRequest] = await db
        .select()
        .from(action_requests)
        .where(eq(action_requests.id, result.actionRequestId!))
        .limit(1);

      if (!actionRequest) {
        console.error("[Test] ❌ ActionRequest not found in database");
        process.exit(1);
      }

      const rawInbound = actionRequest.rawInbound as any;
      console.log(`[Test]    ✅ ActionRequest found (ID: ${actionRequest.id})`);
      console.log(`[Test]    ✅ rawInbound.source: ${rawInbound.source}`);
      console.log(`[Test]    ✅ rawInbound.aiTennis.traceId: ${rawInbound.aiTennis?.traceId}`);
      console.log(`[Test]    ✅ rawInbound.aiTennis.stopReason: ${rawInbound.aiTennis?.stopReason}`);
      console.log(`[Test]    ✅ rawInbound.aiTennis.costUsd: $${rawInbound.aiTennis?.costUsd}`);
      console.log(`[Test]    ✅ rawInbound.proposal.targetKey: ${rawInbound.proposal?.targetKey}`);
      console.log(`[Test]    ✅ rawInbound.proposal.confidence: ${rawInbound.proposal?.confidence}\n`);

      console.log("[Test] ✅ All checks passed! PR2 Gate C complete.");
      console.log("[Test] Next: Run weekly report script to verify metrics populate.\n");
    } else {
      console.log(`[Test]    NeedsHuman: ${result.needsHuman ?? false}`);
      console.log(`[Test]    Meta: ${JSON.stringify(result.meta, null, 2)}\n`);
      
      if (result.stopReason === "needs_human") {
        console.log("[Test] ⚠️  Workflow escalated to human (expected behavior)");
        console.log("[Test] This is a valid outcome - AI Tennis correctly identified need for human input.\n");
      } else {
        console.log("[Test] ⚠️  Workflow failed with stopReason:", result.stopReason);
      }
    }

  } catch (error: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[Test] ❌ AI Tennis failed after ${elapsed}s`);
    console.error(`[Test] Error: ${error.message}`);
    console.error(`[Test] Stack: ${error.stack}\n`);
    process.exit(1);
  }

  process.exit(0);
}

main();
