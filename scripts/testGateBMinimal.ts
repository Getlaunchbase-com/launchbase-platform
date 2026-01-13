/**
 * Phase 1.3 Gate B: Minimal DB Write Verification
 * 
 * Uses router mutation (actionRequests.aiProposeCopy) to verify:
 * 1. ActionRequest creation with correct tenant
 * 2. rawInbound.aiTennis + rawInbound.proposal structure
 * 3. Event trail with safe meta
 * 4. No forbidden key leakage
 * 5. Idempotency (second call with same inputs)
 * 
 * Cost: ~$0.13 (2 calls, second should be cached)
 */

import { aiTennisCopyRefine } from "../server/actionRequests/aiTennisCopyRefine.js";
import { getDb } from "../server/db.js";
import { actionRequests, actionRequestEvents } from "../drizzle/schema.js";
import { eq, desc } from "drizzle-orm";

// Gate A winner prompt (high specificity)
const TEST_PROMPT = 'For a landing page hero, write a headline/subheadline aimed at founders launching in 30 days. Emphasize speed, quality, and cost control. Avoid generic words like "welcome" or "hello".';

const CURRENT_COPY = {
  "hero.headline": "Welcome to Our Business",
  "hero.subheadline": "We help you succeed",
};

// Forbidden keys that should never appear in rawInbound
const FORBIDDEN_KEYS = [
  "prompt",
  "system",
  "systemPrompt",
  "taskPrompt",
  "stack",
  "providerError",
  "requestPayload",
  "responsePayload",
  "messages",
  "completion",
];

function scanForForbiddenKeys(obj: any, path: string = ""): string[] {
  const found: string[] = [];
  
  if (typeof obj !== "object" || obj === null) {
    return found;
  }

  for (const key of Object.keys(obj)) {
    const fullPath = path ? `${path}.${key}` : key;
    
    // Check if this key is forbidden
    if (FORBIDDEN_KEYS.some(forbidden => key.toLowerCase().includes(forbidden.toLowerCase()))) {
      found.push(fullPath);
    }
    
    // Recurse into nested objects/arrays
    if (typeof obj[key] === "object" && obj[key] !== null) {
      found.push(...scanForForbiddenKeys(obj[key], fullPath));
    }
  }
  
  return found;
}

async function main() {
  console.log("=".repeat(80));
  console.log("Phase 1.3 Gate B: Minimal DB Write Verification");
  console.log("=".repeat(80));
  console.log("\nUsing service layer (aiTennisCopyRefine)");
  console.log("Environment: dev");
  console.log("Cost: ~$0.13 (2 calls, second should be cached)\n");

  const db = await getDb();
  
  if (!db) {
    console.error("❌ Database not available");
    process.exit(1);
  }

  // Step 1: Find existing intake
  console.log("[Step 1] Finding existing intake...");
  const intake = await db.query.intakes.findFirst({
    orderBy: (intakes, { desc }) => [desc(intakes.createdAt)],
  });

  if (!intake) {
    console.error("❌ No intake found. Create one first.");
    process.exit(1);
  }

  console.log(`✓ Found intake: ${intake.id}`);
  console.log(`  Business: ${intake.businessName || "N/A"}`);
  console.log(`  Tenant: ${intake.tenant}\n`);

  // Step 2: Ready to call service
  console.log("[Step 2] Ready to call service layer...\n");

  // Step 3: First call (should create ActionRequest)
  console.log("[Step 3] First call - should create ActionRequest...");
  console.log(`Prompt: "${TEST_PROMPT.substring(0, 80)}..."`);
  console.log(`Current copy: ${JSON.stringify(CURRENT_COPY)}\n`);

  const startTime1 = Date.now();
  
  const result1 = await aiTennisCopyRefine(
    {
      intakeId: intake.id,
      userText: TEST_PROMPT,
      targetSection: "hero",
      currentCopy: CURRENT_COPY,
      constraints: {
        maxRounds: 1,
        costCapUsd: 1,
      },
    },
    "aiml"
  );

  const elapsed1 = ((Date.now() - startTime1) / 1000).toFixed(2);

  console.log(`✓ First call completed in ${elapsed1}s`);
  console.log(`  Success: ${result1.success}`);
  console.log(`  ActionRequest ID: ${result1.actionRequestId || "N/A"}`);
  console.log(`  StopReason: ${result1.stopReason}`);
  console.log(`  NeedsHuman: ${result1.needsHuman || false}`);
  console.log(`  Cost: $${result1.meta.estimatedUsd.toFixed(4)}\n`);

  if (!result1.success || !result1.actionRequestId) {
    console.log("⚠️  First call did not create ActionRequest - cannot verify Gate B");
    console.log(`Reason: ${result1.stopReason}`);
    process.exit(1);
  }

  // Step 4: Verify DB writes
  console.log("[Step 4] Verifying DB writes...");

  const actionRequest = await db.select().from(actionRequests).where(eq(actionRequests.id, result1.actionRequestId)).limit(1);

  if (actionRequest.length === 0) {
    console.error(`❌ ActionRequest ${result1.actionRequestId} not found in DB`);
    process.exit(1);
  }

  const ar = actionRequest[0];
  console.log(`✓ ActionRequest row exists`);
  console.log(`  ID: ${ar.id}`);
  console.log(`  Tenant: ${ar.tenant}`);
  console.log(`  Intake ID: ${ar.intakeId}`);
  console.log(`  Status: ${ar.status}\n`);

  // Check rawInbound structure
  const rawInbound = ar.rawInbound as any;

  if (!rawInbound) {
    console.error("❌ rawInbound is null");
    process.exit(1);
  }

  if (rawInbound.source !== "ai_tennis") {
    console.error(`❌ rawInbound.source is "${rawInbound.source}", expected "ai_tennis"`);
    process.exit(1);
  }

  console.log(`✓ rawInbound.source = "ai_tennis"`);

  // Check aiTennis fields
  const requiredAiTennisFields = [
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

  const aiTennisFields = rawInbound.aiTennis ? Object.keys(rawInbound.aiTennis) : [];
  const missingAiTennisFields = requiredAiTennisFields.filter(
    f => !aiTennisFields.includes(f)
  );

  if (missingAiTennisFields.length > 0) {
    console.log(`❌ Missing aiTennis fields: ${missingAiTennisFields.join(", ")}`);
  } else {
    console.log(`✓ rawInbound.aiTennis has all required fields (${aiTennisFields.length})`);
  }

  // Check proposal fields
  const requiredProposalFields = [
    "targetKey",
    "value",
    "rationale",
    "confidence",
    "risks",
    "assumptions",
  ];

  const proposalFields = rawInbound.proposal ? Object.keys(rawInbound.proposal) : [];
  const missingProposalFields = requiredProposalFields.filter(
    f => !proposalFields.includes(f)
  );

  if (missingProposalFields.length > 0) {
    console.log(`❌ Missing proposal fields: ${missingProposalFields.join(", ")}`);
  } else {
    console.log(`✓ rawInbound.proposal has all required fields (${proposalFields.length})`);
  }

  // Forbidden keys scan
  const forbiddenKeys = scanForForbiddenKeys(rawInbound);
  
  if (forbiddenKeys.length > 0) {
    console.log(`❌ FORBIDDEN KEYS FOUND: ${forbiddenKeys.join(", ")}`);
  } else {
    console.log(`✓ No forbidden keys detected`);
  }

  // Check events
  const events = await db.select().from(actionRequestEvents).where(eq(actionRequestEvents.actionRequestId, ar.id)).orderBy(desc(actionRequestEvents.createdAt));

  console.log(`✓ Found ${events.length} event(s)`);
  if (events.length > 0) {
    console.log(`  Latest: ${events[0].eventType}`);
    
    // Check event meta for forbidden keys
    const eventMeta = events[0].meta as any;
    const eventForbiddenKeys = scanForForbiddenKeys(eventMeta);
    
    if (eventForbiddenKeys.length > 0) {
      console.log(`  ❌ Event meta has forbidden keys: ${eventForbiddenKeys.join(", ")}`);
    } else {
      console.log(`  ✓ Event meta is customer-safe`);
    }
  }

  console.log();

  // Step 5: Second call (idempotency test)
  console.log("[Step 5] Second call - testing idempotency...");
  console.log("Calling with IDENTICAL inputs...\n");

  const startTime2 = Date.now();
  
  const result2 = await aiTennisCopyRefine(
    {
      intakeId: intake.id,
      userText: TEST_PROMPT,
      targetSection: "hero",
      currentCopy: CURRENT_COPY,
      constraints: {
        maxRounds: 1,
        costCapUsd: 1,
      },
    },
    "aiml"
  );

  const elapsed2 = ((Date.now() - startTime2) / 1000).toFixed(2);

  console.log(`✓ Second call completed in ${elapsed2}s`);
  console.log(`  Success: ${result2.success}`);
  console.log(`  ActionRequest ID: ${result2.actionRequestId || "N/A"}`);
  console.log(`  Cost: $${result2.meta.estimatedUsd.toFixed(4)}\n`);

  // Check if idempotency worked
  if (result2.actionRequestId === result1.actionRequestId) {
    console.log(`✓ Idempotency: Same ActionRequest ID returned`);
  } else {
    console.log(`⚠️  Idempotency: Different ActionRequest ID (${result2.actionRequestId})`);
    console.log(`   This may indicate cache miss or idempotency key mismatch`);
  }

  // Check if second call was cheaper (cache hit)
  if (result2.meta.estimatedUsd < result1.meta.estimatedUsd * 0.5) {
    console.log(`✓ Cost reduced on second call (likely cache hit)`);
  } else {
    console.log(`⚠️  Cost similar on second call (may not be cached)`);
  }

  // Summary
  console.log(`\n${"=".repeat(80)}`);
  console.log("GATE B RESULT");
  console.log(`${"=".repeat(80)}\n`);

  const checks = {
    actionRequestCreated: !!result1.actionRequestId,
    rowExists: actionRequest.length > 0,
    correctTenant: ar.tenant === intake.tenant,
    aiTennisFields: missingAiTennisFields.length === 0,
    proposalFields: missingProposalFields.length === 0,
    noForbiddenKeys: forbiddenKeys.length === 0,
    eventsExist: events.length > 0,
    idempotency: result2.actionRequestId === result1.actionRequestId,
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  console.log(`Checks passed: ${passedChecks}/${totalChecks}\n`);

  Object.entries(checks).forEach(([key, passed]) => {
    const status = passed ? "✅" : "❌";
    console.log(`${status} ${key}`);
  });

  console.log(`\nTotal cost: $${(result1.meta.estimatedUsd + result2.meta.estimatedUsd).toFixed(4)}`);
  console.log(`Total time: ${(parseFloat(elapsed1) + parseFloat(elapsed2)).toFixed(2)}s`);

  if (passedChecks === totalChecks) {
    console.log(`\n✅ GATE B PASSED`);
    console.log(`\nNext steps:`);
    console.log(`1. Run weekly report (Gate C)`);
    console.log(`2. PR3: Remove debug logging`);
    console.log(`3. PR3: Implement feature alias layer`);
    console.log(`4. PR3: Add micro-tests`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  GATE B INCOMPLETE (${passedChecks}/${totalChecks} checks passed)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
