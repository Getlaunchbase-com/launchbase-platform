/**
 * FOREVER Tests for Action Request System
 * 
 * These tests lock the core safety guarantees of the Ask → Understand → Apply → Confirm loop.
 * If any of these tests fail, the system is NOT safe to deploy.
 * 
 * Run: pnpm vitest server/action-requests.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb } from "./db";
import { actionRequests, intakes } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  createActionRequest,
  getActionRequestByToken,
  isChecklistKeyLocked,
  classifyReply,
  applyActionRequest,
  confirmAndLockActionRequest,
} from "./action-requests";

describe("Action Request System - FOREVER Tests", () => {
  let testIntakeId: number;
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeEach(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test intake
    const result = await db.insert(intakes).values({
      businessName: "Test Business",
      contactName: "Test User",
      email: "test@example.com",
      tenant: "launchbase",
      vertical: "trades",
      status: "paid",
      language: "en",
      audience: "biz",
      websiteStatus: "none",
    });

    testIntakeId = result[0].insertId;
  });

  afterEach(async () => {
    if (!db) return;

    // Clean up test data
    await db.delete(actionRequests).where(eq(actionRequests.intakeId, testIntakeId));
    await db.delete(intakes).where(eq(intakes.id, testIntakeId));
  });

  /**
   * Test 1: Approve link updates state → applied → confirmed → locked
   */
  it("FOREVER: Approve link flow completes successfully", async () => {
    // Create action request
    const actionRequest = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "homepage.headline",
      proposedValue: "Test Headline",
    });

    expect(actionRequest).toBeTruthy();
    expect(actionRequest!.status).toBe("pending");

    // Simulate approve (set confidence and status)
    await db!.update(actionRequests).set({
      status: "responded",
      confidence: 0.95,
      replyChannel: "link",
    }).where(eq(actionRequests.id, actionRequest!.id));

    // Apply
    const result = await applyActionRequest(actionRequest!.id);
    expect(result.success).toBe(true);

    // Confirm and lock
    await confirmAndLockActionRequest(actionRequest!.id);

    // Verify final state
    const [final] = await db!.select().from(actionRequests).where(eq(actionRequests.id, actionRequest!.id));
    expect(final.status).toBe("locked");
  });

  /**
   * Test 2: Inbound "YES" approves and applies
   */
  it("FOREVER: Inbound YES reply approves and applies", async () => {
    const actionRequest = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "homepage.tagline",
      proposedValue: "Test Tagline",
    });

    // Classify "YES" reply
    const classification = classifyReply("YES", "Test Tagline");
    expect(classification.intent).toBe("APPROVE");
    expect(classification.confidence).toBeGreaterThanOrEqual(0.85);

    // Update with classification
    await db!.update(actionRequests).set({
      status: "responded",
      confidence: classification.confidence,
      replyChannel: "email",
    }).where(eq(actionRequests.id, actionRequest!.id));

    // Apply
    const result = await applyActionRequest(actionRequest!.id);
    expect(result.success).toBe(true);
  });

  /**
   * Test 3: Inbound edit applies when confident
   */
  it("FOREVER: Inbound edit with high confidence applies", async () => {
    const actionRequest = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "contact.phone",
      proposedValue: "555-1234",
    });

    // Classify concrete edit
    const classification = classifyReply("Call me at 555-9999", "555-1234");
    expect(classification.intent).toBe("EDIT_EXACT");
    expect(classification.extractedValue).toBeTruthy();

    // Update with classification
    await db!.update(actionRequests).set({
      status: "responded",
      confidence: classification.confidence,
      proposedValue: classification.extractedValue as any,
      replyChannel: "email",
    }).where(eq(actionRequests.id, actionRequest!.id));

    // Apply if confidence is high enough
    const result = await applyActionRequest(actionRequest!.id);
    
    if (classification.confidence >= 0.85) {
      expect(result.success).toBe(true);
    } else {
      expect(result.needsHuman || result.needsConfirmation).toBe(true);
    }
  });

  /**
   * Test 4: Inbound unclear escalates + does not apply
   */
  it("FOREVER: Unclear reply escalates without applying", async () => {
    const actionRequest = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "homepage.headline",
      proposedValue: "Test Headline",
    });

    // Classify unclear reply
    const classification = classifyReply("make it better", "Test Headline");
    expect(classification.intent).toBe("EDIT_AMBIGUOUS");
    expect(classification.confidence).toBeLessThan(0.85);

    // Update with classification
    await db!.update(actionRequests).set({
      status: "responded",
      confidence: classification.confidence,
      replyChannel: "email",
    }).where(eq(actionRequests.id, actionRequest!.id));

    // Apply should escalate
    const result = await applyActionRequest(actionRequest!.id);
    expect(result.success).toBe(false);
    expect(result.needsHuman).toBe(true);
  });

  /**
   * Test 5: Duplicate replies are idempotent (no double-apply)
   */
  it("FOREVER: Duplicate replies do not double-apply", async () => {
    const actionRequest = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "homepage.headline",
      proposedValue: "Test Headline",
    });

    // First apply
    await db!.update(actionRequests).set({
      status: "responded",
      confidence: 0.95,
    }).where(eq(actionRequests.id, actionRequest!.id));

    const result1 = await applyActionRequest(actionRequest!.id);
    expect(result1.success).toBe(true);

    await confirmAndLockActionRequest(actionRequest!.id);

    // Second apply (duplicate)
    const result2 = await applyActionRequest(actionRequest!.id);
    expect(result2.success).toBe(false);
    expect(result2.error).toContain("Already applied");
  });

  /**
   * Test 6: Locked keys can't be re-asked
   */
  it("FOREVER: Locked checklist keys cannot be re-asked", async () => {
    // Create and lock first request
    const actionRequest1 = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "homepage.headline",
      proposedValue: "Test Headline",
    });

    await db!.update(actionRequests).set({
      status: "locked",
    }).where(eq(actionRequests.id, actionRequest1!.id));

    // Check if locked
    const isLocked = await isChecklistKeyLocked("launchbase", testIntakeId, "homepage.headline");
    expect(isLocked).toBe(true);

    // Try to apply new request for same key
    const actionRequest2 = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "homepage.headline",
      proposedValue: "New Headline",
    });

    await db!.update(actionRequests).set({
      status: "responded",
      confidence: 0.95,
    }).where(eq(actionRequests.id, actionRequest2!.id));

    const result = await applyActionRequest(actionRequest2!.id);
    expect(result.success).toBe(false);
    expect(result.needsHuman).toBe(true);
  });

  /**
   * Test 7: Intent classification accuracy
   */
  it("FOREVER: Reply classification is accurate", () => {
    // APPROVE
    expect(classifyReply("yes", "value").intent).toBe("APPROVE");
    expect(classifyReply("YES", "value").intent).toBe("APPROVE");
    expect(classifyReply("looks good", "value").intent).toBe("APPROVE");
    expect(classifyReply("approved", "value").intent).toBe("APPROVE");

    // REJECT
    expect(classifyReply("no", "value").intent).toBe("REJECT");
    expect(classifyReply("NO", "value").intent).toBe("REJECT");
    expect(classifyReply("reject", "value").intent).toBe("REJECT");

    // EDIT_AMBIGUOUS
    expect(classifyReply("make it better", "value").intent).toBe("EDIT_AMBIGUOUS");
    expect(classifyReply("more professional", "value").intent).toBe("EDIT_AMBIGUOUS");
    expect(classifyReply("maybe change it", "value").intent).toBe("EDIT_AMBIGUOUS");

    // NEW_REQUEST
    expect(classifyReply("also add a careers page", "value").intent).toBe("NEW_REQUEST");
    expect(classifyReply("can you redesign the whole site", "value").intent).toBe("NEW_REQUEST");

    // EDIT_EXACT
    expect(classifyReply("555-1234", "value").intent).toBe("EDIT_EXACT");
    expect(classifyReply("https://example.com", "value").intent).toBe("EDIT_EXACT");
    expect(classifyReply("test@example.com", "value").intent).toBe("EDIT_EXACT");
  });

  /**
   * Test 8: Confidence thresholds are enforced
   */
  it("FOREVER: Confidence thresholds prevent unsafe auto-apply", async () => {
    const actionRequest = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "homepage.headline",
      proposedValue: "Test Headline",
    });

    // Low confidence (< 0.85)
    await db!.update(actionRequests).set({
      status: "responded",
      confidence: 0.60,
    }).where(eq(actionRequests.id, actionRequest!.id));

    const result = await applyActionRequest(actionRequest!.id);
    expect(result.success).toBe(false);
    expect(result.needsHuman || result.needsConfirmation).toBe(true);
  });
});
