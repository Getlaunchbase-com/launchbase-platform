/**
 * END-TO-END TEST: Ask → Understand → Apply → Confirm Loop
 * 
 * This test proves the entire email automation system works without requiring real emails.
 * 
 * Flow:
 * 1. Create intake + action request (Ask)
 * 2. Send email (sendActionRequestEmail)
 * 3. Simulate customer reply webhook (Understand)
 * 4. Apply change (Apply)
 * 5. Confirm and lock (Confirm)
 * 6. Verify events logged
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../db";
import { actionRequests, actionRequestEvents, intakes } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { createActionRequest } from "../action-requests";
import { sendActionRequestEmail } from "../email";

describe("E2E: Ask → Understand → Apply → Confirm Loop", () => {
  let testIntakeId: number;
  let testActionRequestId: number;
  let testToken: string;

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test intake
    const testEmail = `e2e-test-${Date.now()}@test.com`;
    await db.insert(intakes).values({
      email: testEmail,
      businessName: "E2E Test Co",
      contactName: "Test User",
      phone: "555-0100",
      vertical: "trades",
      services: "Snow plowing",
      serviceArea: "Chicago",
      status: "paid", // Must be paid for sequencer to pick it up
      rawPayload: {},
      tenant: "launchbase",
    });
    
    const [intake] = await db.select().from(intakes).where(eq(intakes.email, testEmail)).limit(1);
    testIntakeId = intake.id;
  });

  it("E2E: Complete loop from Ask to Confirm", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // ========================================
    // STEP 1: ASK - Create action request
    // ========================================
    const actionRequest = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "homepage.headline",
      proposedValue: "E2E Test Co - Trusted Snow Plowing in Chicago",
      messageType: "DAY0_HEADLINE",
    });

    expect(actionRequest).toBeDefined();
    expect(actionRequest?.status).toBe("pending");
    testActionRequestId = actionRequest!.id;
    testToken = actionRequest!.token;

    // ========================================
    // STEP 2: SEND - Send email (simulated)
    // ========================================
    const [intake] = await db.select().from(intakes).where(eq(intakes.id, testIntakeId)).limit(1);
    
    const emailResult = await sendActionRequestEmail({
      to: intake.email,
      businessName: intake.businessName,
      firstName: intake.contactName.split(" ")[0],
      questionText: "Approve your homepage headline",
      proposedValue: String(actionRequest!.proposedValue),
      token: testToken,
      checklistKey: "homepage.headline",
    });

    expect(emailResult.success).toBe(true);

    // Update sendCount and lastSentAt (normally done by sequencer)
    await db.update(actionRequests).set({
      sendCount: 1,
      lastSentAt: new Date(),
    }).where(eq(actionRequests.id, testActionRequestId));

    // ========================================
    // STEP 3: UNDERSTAND - Simulate customer reply (APPROVE)
    // ========================================
    const { handleResendInbound } = await import("../api.webhooks.resend");
    
    // Mock Express request/response
    const mockReq = {
      body: {
        to: `approvals+${testToken}@getlaunchbase.com`,
        from: intake.email,
        subject: `Re: Approve your homepage headline`,
        text: "YES",
      },
    } as any;

    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => {
          expect(code).toBe(200);
          expect(data.message).toContain("Approved");
          return data;
        },
      }),
    } as any;

    await handleResendInbound(mockReq, mockRes);

    // ========================================
    // STEP 4: VERIFY - Check final state
    // ========================================
    
    // Check action request status
    const [finalRequest] = await db.select().from(actionRequests).where(eq(actionRequests.id, testActionRequestId)).limit(1);
    expect(finalRequest.status).toBe("locked");
    expect(finalRequest.respondedAt).toBeDefined();

    // Check events logged
    const events = await db.select().from(actionRequestEvents)
      .where(eq(actionRequestEvents.actionRequestId, testActionRequestId))
      .orderBy(actionRequestEvents.createdAt);

    expect(events.length).toBeGreaterThanOrEqual(3);

    const eventTypes = events.map(e => e.eventType);
    expect(eventTypes).toContain("CUSTOMER_APPROVED");
    expect(eventTypes).toContain("APPLIED");
    expect(eventTypes).toContain("LOCKED");

    // Verify event sequence
    const customerApprovedEvent = events.find(e => e.eventType === "CUSTOMER_APPROVED");
    const appliedEvent = events.find(e => e.eventType === "APPLIED");
    const lockedEvent = events.find(e => e.eventType === "LOCKED");

    expect(customerApprovedEvent).toBeDefined();
    expect(appliedEvent).toBeDefined();
    expect(lockedEvent).toBeDefined();

    // Verify event order
    const approvedTime = new Date(customerApprovedEvent!.createdAt).getTime();
    const appliedTime = new Date(appliedEvent!.createdAt).getTime();
    const lockedTime = new Date(lockedEvent!.createdAt).getTime();

    expect(appliedTime).toBeGreaterThanOrEqual(approvedTime);
    expect(lockedTime).toBeGreaterThanOrEqual(appliedTime);

    console.log("✅ E2E Test Complete - Ask → Understand → Apply → Confirm loop verified");
  });

  it("E2E: Edit reply flow", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create action request
    const actionRequest = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "homepage.headline",
      proposedValue: "E2E Test Co - Trusted Snow Plowing in Chicago",
      messageType: "DAY0_HEADLINE",
    });

    testActionRequestId = actionRequest!.id;
    testToken = actionRequest!.token;

    // Simulate customer edit reply
    const { handleResendInbound } = await import("../api.webhooks.resend");
    const [intake] = await db.select().from(intakes).where(eq(intakes.id, testIntakeId)).limit(1);
    
    const mockReq = {
      body: {
        to: `approvals+${testToken}@getlaunchbase.com`,
        from: intake.email,
        subject: `Re: Approve your homepage headline`,
        text: "Change it to: Chicago Snow Plow & Salting — Fast, Reliable, Insured",
      },
    } as any;

    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => {
          expect(code).toBe(200);
          return data;
        },
      }),
    } as any;

    await handleResendInbound(mockReq, mockRes);

    // Verify edit was processed
    const [finalRequest] = await db.select().from(actionRequests).where(eq(actionRequests.id, testActionRequestId)).limit(1);
    
    // Check events
    const events = await db.select().from(actionRequestEvents)
      .where(eq(actionRequestEvents.actionRequestId, testActionRequestId))
      .orderBy(actionRequestEvents.createdAt);

    const eventTypes = events.map(e => e.eventType);
    expect(eventTypes).toContain("CUSTOMER_EDITED");

    console.log("✅ E2E Edit Test Complete - Customer edit reply processed");
  });

  it("E2E: Unclear reply escalation", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create action request
    const actionRequest = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "homepage.headline",
      proposedValue: "E2E Test Co - Trusted Snow Plowing in Chicago",
      messageType: "DAY0_HEADLINE",
    });

    testActionRequestId = actionRequest!.id;
    testToken = actionRequest!.token;

    // Simulate unclear reply
    const { handleResendInbound } = await import("../api.webhooks.resend");
    const [intake] = await db.select().from(intakes).where(eq(intakes.id, testIntakeId)).limit(1);
    
    const mockReq = {
      body: {
        to: `approvals+${testToken}@getlaunchbase.com`,
        from: intake.email,
        subject: `Re: Approve your homepage headline`,
        text: "Maybe change it? Not sure...",
      },
    } as any;

    const mockRes = {
      status: (code: number) => ({
        json: (data: any) => {
          expect(code).toBe(200);
          return data;
        },
      }),
    } as any;

    await handleResendInbound(mockReq, mockRes);

    // Verify escalation
    const [finalRequest] = await db.select().from(actionRequests).where(eq(actionRequests.id, testActionRequestId)).limit(1);
    expect(finalRequest.status).toBe("needs_human");

    // Check events
    const events = await db.select().from(actionRequestEvents)
      .where(eq(actionRequestEvents.actionRequestId, testActionRequestId))
      .orderBy(actionRequestEvents.createdAt);

    const eventTypes = events.map(e => e.eventType);
    expect(eventTypes).toContain("CUSTOMER_UNCLEAR");
    expect(eventTypes).toContain("ESCALATED");

    console.log("✅ E2E Escalation Test Complete - Unclear reply escalated to human");
  });
});
