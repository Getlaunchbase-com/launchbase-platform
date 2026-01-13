/**
 * Phase 1.3 Gate B: Verify DB writes for successful AI Tennis workflows
 * 
 * Tests the 2 prompts that succeeded in Gate A and verifies:
 * 1. ActionRequest row exists
 * 2. rawInbound contains aiTennis + proposal trails
 * 3. No forbidden keys (prompt, system, stack, providerError, etc.)
 * 4. Event trail exists
 */

import { getDb } from "../server/db.js";
import { aiTennisCopyRefine } from "../server/actionRequests/aiTennisCopyRefine.js";
import { actionRequests, actionRequestEvents } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";

// The 2 prompts that succeeded in Gate A
const SUCCESS_PROMPTS = [
  {
    id: 2,
    name: "Value prop with audience + outcome",
    userText: 'For a landing page hero, write a headline/subheadline aimed at founders launching in 30 days. Emphasize speed, quality, and cost control. Avoid generic words like "welcome" or "hello".',
  },
  {
    id: 4,
    name: "High specificity + structure",
    userText: "Produce 3 variants: one punchy, one professional, one playful. Each must include a measurable benefit (time saved, fewer revisions, lower cost). Keep it human and concrete.",
  },
];

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
  console.log("Phase 1.3 Gate B: DB Write Verification");
  console.log("=".repeat(80));
  console.log(`\nTesting ${SUCCESS_PROMPTS.length} successful prompts with full DB writes...\n`);

  const db = await getDb();
  
  if (!db) {
    console.error("❌ Database not available");
    process.exit(1);
  }

  // Step 1: Find or create an intake
  console.log("[Setup] Finding existing intake...");
  let intake = await db.query.intakes.findFirst({
    orderBy: (intakes, { desc }) => [desc(intakes.createdAt)],
  });

  if (!intake) {
    console.error("❌ No intake found. Please create one first.");
    process.exit(1);
  }

  console.log(`✓ Found intake: ${intake.id}`);
  console.log(`  Business: ${intake.businessName || "N/A"}`);
  console.log(`  Tenant: ${intake.tenant}\n`);

  const results: Array<{
    promptId: number;
    promptName: string;
    success: boolean;
    actionRequestId?: string;
    verification?: {
      rowExists: boolean;
      aiTennisFields: string[];
      proposalFields: string[];
      forbiddenKeys: string[];
      eventsCount: number;
    };
    error?: string;
  }> = [];

  // Step 2: Run each prompt and verify DB writes
  for (const prompt of SUCCESS_PROMPTS) {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`[${prompt.id}] ${prompt.name}`);
    console.log(`${"─".repeat(80)}`);

    try {
      // Execute AI Tennis workflow
      console.log("Executing AI Tennis workflow...");
      const result = await aiTennisCopyRefine(
        {
          intakeId: intake.id,
          userText: prompt.userText,
          targetSection: "hero",
          currentCopy: CURRENT_COPY,
          constraints: {
            maxRounds: 1,
            costCapUsd: 1,
          },
        },
        "aiml"
      );

      console.log(`✓ Workflow completed`);
      console.log(`  Success: ${result.success}`);
      console.log(`  NeedsHuman: ${result.needsHuman || false}`);
      console.log(`  StopReason: ${result.stopReason}`);
      console.log(`  Cost: $${result.meta.estimatedUsd.toFixed(4)}`);

      if (!result.success || result.needsHuman) {
        console.log(`⚠️  Workflow did not succeed - skipping DB verification`);
        results.push({
          promptId: prompt.id,
          promptName: prompt.name,
          success: false,
          error: `Workflow escalated: ${result.stopReason}`,
        });
        continue;
      }

      // Verify DB writes
      console.log(`\nVerifying DB writes...`);

      // Check 1: ActionRequest row exists
      const actionRequest = await db.query.actionRequests.findFirst({
        where: eq(actionRequests.id, result.actionRequestId!),
      });

      if (!actionRequest) {
        throw new Error(`ActionRequest ${result.actionRequestId} not found in DB`);
      }

      console.log(`✓ ActionRequest row exists (ID: ${actionRequest.id})`);

      // Check 2: rawInbound structure
      const rawInbound = actionRequest.rawInbound as any;
      
      if (!rawInbound) {
        throw new Error("rawInbound is null");
      }

      if (rawInbound.source !== "ai_tennis") {
        throw new Error(`rawInbound.source is "${rawInbound.source}", expected "ai_tennis"`);
      }

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
        console.log(`⚠️  Missing aiTennis fields: ${missingAiTennisFields.join(", ")}`);
      } else {
        console.log(`✓ All required aiTennis fields present`);
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
        console.log(`⚠️  Missing proposal fields: ${missingProposalFields.join(", ")}`);
      } else {
        console.log(`✓ All required proposal fields present`);
      }

      // Check 3: Forbidden keys scan
      const forbiddenKeys = scanForForbiddenKeys(rawInbound);
      
      if (forbiddenKeys.length > 0) {
        console.log(`❌ FORBIDDEN KEYS FOUND: ${forbiddenKeys.join(", ")}`);
      } else {
        console.log(`✓ No forbidden keys detected`);
      }

      // Check 4: Event trail
      const events = await db.query.actionRequestEvents.findMany({
        where: eq(actionRequestEvents.actionRequestId, actionRequest.id),
        orderBy: (events, { desc }) => [desc(events.createdAt)],
      });

      console.log(`✓ Found ${events.length} event(s)`);
      if (events.length > 0) {
        console.log(`  Latest: ${events[0].eventType}`);
      }

      results.push({
        promptId: prompt.id,
        promptName: prompt.name,
        success: true,
        actionRequestId: actionRequest.id,
        verification: {
          rowExists: true,
          aiTennisFields: aiTennisFields,
          proposalFields: proposalFields,
          forbiddenKeys: forbiddenKeys,
          eventsCount: events.length,
        },
      });

    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
      results.push({
        promptId: prompt.id,
        promptName: prompt.name,
        success: false,
        error: error.message,
      });
    }
  }

  // Summary
  console.log(`\n${"=".repeat(80)}`);
  console.log("GATE B RESULT");
  console.log(`${"=".repeat(80)}\n`);

  const successCount = results.filter(r => r.success).length;
  const forbiddenKeysFound = results.some(r => r.verification && r.verification.forbiddenKeys.length > 0);

  console.log(`Prompts tested: ${results.length}`);
  console.log(`Successful with DB writes: ${successCount}/${results.length}`);
  console.log(`Forbidden keys found: ${forbiddenKeysFound ? "❌ YES" : "✅ NO"}\n`);

  results.forEach((r) => {
    const status = r.success ? "✅ SUCCESS" : "❌ FAILED";
    console.log(`[${r.promptId}] ${status} - ${r.promptName}`);
    
    if (r.actionRequestId) {
      console.log(`    ActionRequest ID: ${r.actionRequestId}`);
    }
    
    if (r.verification) {
      console.log(`    aiTennis fields: ${r.verification.aiTennisFields.length}`);
      console.log(`    proposal fields: ${r.verification.proposalFields.length}`);
      console.log(`    forbidden keys: ${r.verification.forbiddenKeys.length === 0 ? "✅ none" : `❌ ${r.verification.forbiddenKeys.length}`}`);
      console.log(`    events: ${r.verification.eventsCount}`);
    }
    
    if (r.error) {
      console.log(`    Error: ${r.error}`);
    }
  });

  if (successCount >= 2 && !forbiddenKeysFound) {
    console.log(`\n✅ GATE B PASSED`);
    console.log(`Next: Run weekly report (Gate C)`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  GATE B INCOMPLETE`);
    if (successCount < 2) {
      console.log(`Need at least 2 successful DB writes (got ${successCount})`);
    }
    if (forbiddenKeysFound) {
      console.log(`Forbidden keys detected - check rawInbound structure`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
