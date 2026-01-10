/**
 * FOREVER TESTS: Action Request Ops Controls
 * 
 * These tests lock in the operational safety guarantees for the Ask → Understand → Apply → Confirm loop.
 * 
 * DO NOT weaken these tests. If they fail, fix the code, not the test.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../db";
import { actionRequests, actionRequestEvents, intakes } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";

describe("FOREVER: Action Request Ops Controls", () => {
  let testIntakeId: number;
  let testActionRequestId: number;

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Clean up test data (use unique email pattern like other tests)
    const testEmail = `action-test-${Date.now()}@test.com`;
    
    // Create test intake (Pattern A: insert + select by unique email)
    await db.insert(intakes).values({
      email: testEmail,
      businessName: "Action Request Test Co",
      contactName: "Test User",
      phone: "555-0100",
      vertical: "trades",
      services: "Test services",
      serviceArea: "Test area",
      status: "new",
      rawPayload: {},
      tenant: "launchbase",
    });
    
    const [intake] = await db.select().from(intakes).where(eq(intakes.email, testEmail)).limit(1);
    testIntakeId = intake.id;

    // Create test action request
    const token = "test_token_" + Date.now();
    await db.insert(actionRequests).values({
      intakeId: testIntakeId,
      checklistKey: "headline",
      proposedValue: "Test Headline",
      messageType: "question",
      token,
      status: "pending",
      sendCount: 1,
      lastSentAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago (outside rate limit)
    });
    
    const [inserted] = await db.select().from(actionRequests).where(eq(actionRequests.token, token)).limit(1);
    testActionRequestId = inserted.id;
  });

  /**
   * Test 1: Resend rate limit blocks <10m and doesn't increment sendCount or log RESENT
   */
  it("FOREVER: resend rate limit blocks <10m, no sendCount increment, no RESENT event", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Update lastSentAt to 5 minutes ago (within rate limit)
    await db.update(actionRequests).set({
      lastSentAt: new Date(Date.now() - 5 * 60 * 1000),
    }).where(eq(actionRequests.id, testActionRequestId));

    // Get initial state
    const [initialRequest] = await db.select().from(actionRequests).where(eq(actionRequests.id, testActionRequestId));
    const initialSendCount = initialRequest.sendCount;
    const initialEventsCount = await db.select().from(actionRequestEvents)
      .where(eq(actionRequestEvents.actionRequestId, testActionRequestId));

    // Import and call resend mutation logic directly
    const { actionRequestsRouter } = await import("../routers/actionRequestsRouter");
    const caller = actionRequestsRouter.createCaller({ user: null } as any);

    // Attempt resend (should be rate limited)
    const result = await caller.resend({ id: testActionRequestId });

    // Assert 1: Returns rate_limited error
    expect(result.ok).toBe(false);
    expect(result.code).toBe("rate_limited");
    expect(result.retryAt).toBeDefined();

    // Assert 2: sendCount did NOT increment
    const [afterRequest] = await db.select().from(actionRequests).where(eq(actionRequests.id, testActionRequestId));
    expect(afterRequest.sendCount).toBe(initialSendCount);

    // Assert 3: NO RESENT event was written
    const afterEvents = await db.select().from(actionRequestEvents)
      .where(eq(actionRequestEvents.actionRequestId, testActionRequestId));
    expect(afterEvents.length).toBe(initialEventsCount.length); // No new events
    const resentEvents = afterEvents.filter(e => e.eventType === "RESENT");
    expect(resentEvents.length).toBe(0);
  });

  /**
   * Test 2: Expire requires reason and writes ADMIN_EXPIRE event
   */
  it("FOREVER: expire requires reason, writes ADMIN_EXPIRE event, sets status expired", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const { actionRequestsRouter } = await import("../routers/actionRequestsRouter");
    const caller = actionRequestsRouter.createCaller({ user: null } as any);

    // Test empty reason (should fail)
    await expect(async () => {
      await caller.expire({ id: testActionRequestId, reason: "" });
    }).rejects.toThrow();

    // Test with valid reason
    const validReason = "Customer changed requirements";
    const result = await caller.expire({ id: testActionRequestId, reason: validReason });

    // Assert 1: Returns success
    expect(result.ok).toBe(true);

    // Assert 2: Status is expired
    const [request] = await db.select().from(actionRequests).where(eq(actionRequests.id, testActionRequestId));
    expect(request.status).toBe("expired");

    // Assert 3: Exactly one ADMIN_EXPIRE event exists
    const events = await db.select().from(actionRequestEvents)
      .where(eq(actionRequestEvents.actionRequestId, testActionRequestId));
    const expireEvents = events.filter(e => e.eventType === "ADMIN_EXPIRE");
    expect(expireEvents.length).toBe(1);

    // Assert 4: Event reason matches provided reason
    expect(expireEvents[0].reason).toBe(validReason);
    expect(expireEvents[0].actorType).toBe("admin");
  });

  /**
   * Test 3: Unlock requires reason, sets status to needs_human, writes ADMIN_UNLOCK event
   */
  it("FOREVER: unlock requires reason, status becomes needs_human, writes ADMIN_UNLOCK, no auto-resend", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Set request to locked status first
    await db.update(actionRequests).set({
      status: "locked",
    }).where(eq(actionRequests.id, testActionRequestId));

    const { actionRequestsRouter } = await import("../routers/actionRequestsRouter");
    const caller = actionRequestsRouter.createCaller({ user: null } as any);

    // Test empty reason (should fail)
    await expect(async () => {
      await caller.unlock({ id: testActionRequestId, reason: "" });
    }).rejects.toThrow();

    // Test with valid reason
    const validReason = "Need to reprocess with updated data";
    const initialSendCount = (await db.select().from(actionRequests).where(eq(actionRequests.id, testActionRequestId)))[0].sendCount;
    
    const result = await caller.unlock({ id: testActionRequestId, reason: validReason });

    // Assert 1: Returns success
    expect(result.ok).toBe(true);

    // Assert 2: Status is needs_human (not pending - prevents auto-resend loop)
    const [request] = await db.select().from(actionRequests).where(eq(actionRequests.id, testActionRequestId));
    expect(request.status).toBe("needs_human");

    // Assert 3: ADMIN_UNLOCK event exists
    const events = await db.select().from(actionRequestEvents)
      .where(eq(actionRequestEvents.actionRequestId, testActionRequestId));
    const unlockEvents = events.filter(e => e.eventType === "ADMIN_UNLOCK");
    expect(unlockEvents.length).toBe(1);
    expect(unlockEvents[0].reason).toBe(validReason);
    expect(unlockEvents[0].actorType).toBe("admin");

    // Assert 4: No auto re-send triggered (sendCount unchanged)
    expect(request.sendCount).toBe(initialSendCount);
  });

  /**
   * Test 4: AdminApply requires reason and writes full event sequence (ADMIN_APPLY → APPLIED → LOCKED)
   */
  it("FOREVER: adminApply requires reason, writes ADMIN_APPLY + APPLIED + LOCKED events, final status locked", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const { actionRequestsRouter } = await import("../routers/actionRequestsRouter");
    const caller = actionRequestsRouter.createCaller({ user: null } as any);

    // Test empty reason (should fail)
    await expect(async () => {
      await caller.adminApply({ id: testActionRequestId, finalValue: "Updated Headline", reason: "" });
    }).rejects.toThrow();

    // Test with valid reason
    const validReason = "Customer confirmed via phone call";
    const finalValue = "Updated Headline via Admin";
    
    const result = await caller.adminApply({ 
      id: testActionRequestId, 
      finalValue, 
      reason: validReason 
    });

    // Assert 1: Returns success
    expect(result.success).toBe(true);

    // Assert 2: Final status is locked
    const [request] = await db.select().from(actionRequests).where(eq(actionRequests.id, testActionRequestId));
    expect(request.status).toBe("locked");

    // Assert 3: Stored value matches finalValue
    expect(request.proposedValue).toBe(finalValue);

    // Assert 4: Full event sequence exists (ADMIN_APPLY → APPLIED → LOCKED)
    const events = await db.select().from(actionRequestEvents)
      .where(eq(actionRequestEvents.actionRequestId, testActionRequestId))
      .orderBy(actionRequestEvents.createdAt);
    
    const adminApplyEvents = events.filter(e => e.eventType === "ADMIN_APPLY");
    const appliedEvents = events.filter(e => e.eventType === "APPLIED");
    const lockedEvents = events.filter(e => e.eventType === "LOCKED");

    expect(adminApplyEvents.length).toBe(1);
    expect(appliedEvents.length).toBe(1);
    expect(lockedEvents.length).toBe(1);

    // Assert 5: ADMIN_APPLY event has correct metadata
    expect(adminApplyEvents[0].reason).toBe(validReason);
    expect(adminApplyEvents[0].actorType).toBe("admin");
    expect(adminApplyEvents[0].meta).toBeDefined();
    const meta = adminApplyEvents[0].meta as any;
    expect(meta.finalValue).toBe(finalValue);

    // Assert 6: Event sequence is in correct order
    const adminApplyTime = new Date(adminApplyEvents[0].createdAt).getTime();
    const appliedTime = new Date(appliedEvents[0].createdAt).getTime();
    const lockedTime = new Date(lockedEvents[0].createdAt).getTime();
    expect(appliedTime).toBeGreaterThanOrEqual(adminApplyTime);
    expect(lockedTime).toBeGreaterThanOrEqual(appliedTime);
  });
});
