/**
 * Batch Approval Tests
 * 
 * Verify that batch approval mutation works correctly:
 * - Approves multiple requests at once
 * - Logs events for each request
 * - Skips already-locked requests
 * - Returns accurate summary
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../db";
import { actionRequests, actionRequestEvents, intakes } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { createActionRequest } from "../action-requests";

describe("Batch Approval", () => {
  let testIntakeId: number;
  let requestIds: number[] = [];

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test intake
    const testEmail = `batch-test-${Date.now()}@test.com`;
    await db.insert(intakes).values({
      email: testEmail,
      businessName: "Batch Test Co",
      contactName: "Test User",
      phone: "555-0100",
      vertical: "trades",
      services: "Snow plowing",
      serviceArea: "Chicago",
      status: "paid",
      rawPayload: {},
      tenant: "launchbase",
    });
    
    const [intake] = await db.select().from(intakes).where(eq(intakes.email, testEmail)).limit(1);
    testIntakeId = intake.id;

    // Create 3 test action requests
    requestIds = [];
    for (let i = 0; i < 3; i++) {
      const request = await createActionRequest({
        tenant: "launchbase",
        intakeId: testIntakeId,
        checklistKey: `test.key.${i}`,
        proposedValue: `Test Value ${i}`,
        messageType: `TEST_${i}`,
      });
      if (request) {
        requestIds.push(request.id);
      }
    }
  });

  it("should approve all 3 requests in batch", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Import router and create caller
    const { actionRequestsRouter } = await import("../routers/actionRequestsRouter");
    const caller = actionRequestsRouter.createCaller({} as any);

    // Call batchApprove
    const result = await caller.batchApprove({
      ids: requestIds,
      reason: "Testing batch approval",
    });

    // Verify summary
    expect(result.ok).toBe(true);
    expect(result.summary.total).toBe(3);
    expect(result.summary.success).toBe(3);
    expect(result.summary.failed).toBe(0);

    // Verify all requests are locked
    for (const id of requestIds) {
      const [request] = await db.select().from(actionRequests).where(eq(actionRequests.id, id)).limit(1);
      expect(request.status).toBe("locked");
      expect(request.respondedAt).toBeDefined();
    }

    // Verify events logged for each request
    for (const id of requestIds) {
      const events = await db.select()
        .from(actionRequestEvents)
        .where(eq(actionRequestEvents.actionRequestId, id))
        .orderBy(actionRequestEvents.createdAt);

      const eventTypes = events.map(e => e.eventType);
      expect(eventTypes).toContain("ADMIN_APPLY");
      expect(eventTypes).toContain("APPLIED");
      expect(eventTypes).toContain("LOCKED");

      // Verify batch metadata
      const adminApplyEvent = events.find(e => e.eventType === "ADMIN_APPLY");
      expect(adminApplyEvent?.meta).toBeDefined();
      expect((adminApplyEvent?.meta as any)?.batchSize).toBe(3);
      expect((adminApplyEvent?.meta as any)?.batchIds).toEqual(requestIds);
    }
  });

  it("should skip already-locked requests", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Lock the first request manually
    await db.update(actionRequests).set({
      status: "locked",
    }).where(eq(actionRequests.id, requestIds[0]));

    // Import router and create caller
    const { actionRequestsRouter } = await import("../routers/actionRequestsRouter");
    const caller = actionRequestsRouter.createCaller({} as any);

    // Call batchApprove
    const result = await caller.batchApprove({
      ids: requestIds,
      reason: "Testing skip locked",
    });

    // Verify summary
    expect(result.ok).toBe(true);
    expect(result.summary.total).toBe(3);
    expect(result.summary.success).toBe(2); // Only 2 succeeded
    expect(result.summary.failed).toBe(1); // 1 was already locked

    // Verify results detail
    const lockedResult = result.results.find(r => r.id === requestIds[0]);
    expect(lockedResult?.success).toBe(false);
    expect(lockedResult?.error).toBe("Already locked");
  });

  it("should handle partial failures gracefully", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Import router and create caller
    const { actionRequestsRouter } = await import("../routers/actionRequestsRouter");
    const caller = actionRequestsRouter.createCaller({} as any);

    // Call batchApprove with one invalid ID
    const result = await caller.batchApprove({
      ids: [requestIds[0], 999999, requestIds[1]], // 999999 doesn't exist
      reason: "Testing partial failure",
    });

    // Verify summary
    expect(result.ok).toBe(true);
    expect(result.summary.total).toBe(3);
    expect(result.summary.success).toBe(2);
    expect(result.summary.failed).toBe(1);

    // Verify invalid ID result
    const invalidResult = result.results.find(r => r.id === 999999);
    expect(invalidResult?.success).toBe(false);
    expect(invalidResult?.error).toBe("Not found");

    // Verify valid IDs succeeded
    const validResult1 = result.results.find(r => r.id === requestIds[0]);
    const validResult2 = result.results.find(r => r.id === requestIds[1]);
    expect(validResult1?.success).toBe(true);
    expect(validResult2?.success).toBe(true);
  });
});
