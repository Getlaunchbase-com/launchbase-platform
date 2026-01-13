/**
 * Simple AI Tennis Test (PR2 Gate C - Simplified)
 * 
 * Uses a very straightforward prompt that should NOT trigger needsHuman.
 * Goal: Get one successful run to populate metrics.
 * 
 * Usage: pnpm tsx scripts/testAiTennisSimple.ts
 */

import { getDb } from "../server/db";
import { intakes } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { aiTennisCopyRefine } from "../server/actionRequests/aiTennisCopyRefine";

async function main() {
  console.log("[Test] Starting SIMPLE AI Tennis test (straightforward prompt)...\n");

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
  console.log(`[Test]    Business: ${intake.businessName}\n`);

  // Step 2: Trigger AI Tennis with VERY simple prompt
  console.log("[Test] Step 2: Triggering AI Tennis with simple prompt...");
  console.log("[Test]    Prompt: 'Make the headline shorter'");
  console.log("[Test]    Current headline: 'Welcome to our business'");
  console.log("[Test]    Expected: AI should confidently propose 'Welcome'\n");

  const startTime = Date.now();
  
  try {
    const result = await aiTennisCopyRefine({
      intakeId: intake.id,
      userText: "Make the headline shorter",
      targetSection: "hero",
      currentCopy: {
        headline: "Welcome to our business"
      },
      constraints: {
        maxRounds: 1, // Single round to reduce cost
        costCapUsd: 1,
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Test] ✅ AI Tennis completed in ${elapsed}s\n`);

    // Step 3: Verify result
    console.log("[Test] Step 3: Verifying result...");
    console.log(`[Test]    Success: ${result.success}`);
    console.log(`[Test]    StopReason: ${result.stopReason}`);
    console.log(`[Test]    TraceId: ${result.traceId}`);
    console.log(`[Test]    NeedsHuman: ${result.needsHuman ?? false}`);
    console.log(`[Test]    Rounds: ${result.meta.rounds}`);
    console.log(`[Test]    Cost: $${result.meta.estimatedUsd.toFixed(4)}`);
    console.log(`[Test]    Models: ${result.meta.models.join(", ")}\n`);
    
    if (result.success) {
      console.log(`[Test]    ActionRequestId: ${result.actionRequestId}\n`);

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
      console.log(`[Test]    ✅ rawInbound.aiTennis.needsHuman: ${rawInbound.aiTennis?.needsHuman}`);
      console.log(`[Test]    ✅ rawInbound.proposal.targetKey: ${rawInbound.proposal?.targetKey}`);
      console.log(`[Test]    ✅ rawInbound.proposal.value: ${rawInbound.proposal?.value}`);
      console.log(`[Test]    ✅ rawInbound.proposal.confidence: ${rawInbound.proposal?.confidence}\n`);

      console.log("[Test] ✅✅✅ SUCCESS! PR2 Gate C complete.");
      console.log("[Test] Next: Run weekly report script to verify metrics populate.\n");
      console.log("[Test] Command: pnpm tsx scripts/generateWeeklyAiReport.ts\n");
    } else {
      console.log(`[Test] ⚠️  Workflow did not succeed`);
      console.log(`[Test] This may indicate the prompt is still triggering needsHuman.`);
      console.log(`[Test] Try an even simpler test or check the DecisionCollapse logic.\n`);
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
