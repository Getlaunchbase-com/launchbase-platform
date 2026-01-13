/**
 * Test AI Tennis with a realistic prompt that should succeed
 */

import { getDb } from "../server/db.js";
import { aiTennisCopyRefine } from "../server/actionRequests/aiTennisCopyRefine.js";

async function main() {
  console.log("[Test] Starting AI Tennis success test...\n");

  // Step 1: Find an existing intake
  console.log("[Test] Step 1: Finding existing intake...");
  const db = getDb();
  const intake = await db.query.intakes.findFirst({
    orderBy: (intakes, { desc }) => [desc(intakes.createdAt)],
  });

  if (!intake) {
    console.error("[Test] ❌ No intake found. Please create one first.");
    process.exit(1);
  }

  console.log(`[Test]    Found intake: ${intake.id}`);
  console.log(`[Test]    Business: ${intake.businessName || "N/A"}\n`);

  // Step 2: Run AI Tennis with realistic prompt
  console.log("[Test] Step 2: Running AI Tennis...");
  console.log('[Test]    Prompt: "Make the hero headline more professional and specific about the service"');
  console.log('[Test]    Current: "Welcome to Our Business"');
  console.log('[Test]    Target: hero.headline');
  console.log('[Test]    Transport: aiml\n');

  const startTime = Date.now();

  const result = await aiTennisCopyRefine(
    {
      intakeId: intake.id,
      userText: "Make the hero headline more professional and specific about the service we provide",
      targetSection: "hero",
      currentCopy: {
        "hero.headline": "Welcome to Our Business",
      },
      constraints: {
        maxRounds: 1,
        costCapUsd: 1,
      },
    },
    "aiml"
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Test] ✅ AI Tennis completed in ${elapsed}s\n`);

  // Step 3: Verify result
  console.log("[Test] Step 3: Verifying result...");
  console.log(`[Test]    Success: ${result.success}`);
  console.log(`[Test]    StopReason: ${result.stopReason}`);
  console.log(`[Test]    TraceId: ${result.traceId}`);
  console.log(`[Test]    NeedsHuman: ${result.needsHuman || false}`);
  console.log(`[Test]    Rounds: ${result.meta.rounds}`);
  console.log(`[Test]    Cost: $${result.meta.estimatedUsd.toFixed(4)}`);
  console.log(`[Test]    Models: ${result.meta.models.join(", ")}`);

  if (result.success && result.proposal) {
    console.log(`\n[Test] 🎉 SUCCESS! Proposal generated:`);
    console.log(`[Test]    Target: ${result.proposal.targetKey}`);
    console.log(`[Test]    Value: "${result.proposal.value}"`);
    console.log(`[Test]    Approval: "${result.approvalText}"`);
  } else if (result.needsHuman) {
    console.log(`\n[Test] ⚠️  Workflow escalated to human (this may be expected)`);
    console.log(`[Test]    Reason: ${result.stopReason}`);
  } else {
    console.log(`\n[Test] ❌ Workflow failed`);
    console.log(`[Test]    Reason: ${result.stopReason}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[Test] Fatal error:", err.message);
  process.exit(1);
});
